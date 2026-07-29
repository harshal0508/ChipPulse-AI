import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGamificationStore } from '../store/gamificationStore';
import { useChipStore } from '../store/chipStore';
import { useSimulationStore } from '../store/simulationStore';
import { api } from '../services/api';

const LS_KEY_PREFIX = 'chippulse_projects_';
const getLSKey = (user) => `${LS_KEY_PREFIX}${user || 'anonymous'}`;

// ✨✨✨ localStorage helpers ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
function lsLoad(user) {
  try { return JSON.parse(localStorage.getItem(getLSKey(user)) || '[]'); }
  catch { return []; }
}
function lsSave(user, projects) {
  localStorage.setItem(getLSKey(user), JSON.stringify(projects));
}
function lsAdd(user, name, description, layout) {
  const projects = lsLoad(user);
  const entry = {
    id: crypto.randomUUID(),
    name,
    description,
    created_at: new Date().toISOString(),
    layout,
    source: 'local',
  };
  lsSave(user, [entry, ...projects]);
  return entry;
}
function lsDelete(user, id) {
  lsSave(user, lsLoad(user).filter((p) => p.id !== id));
}

// ─── Confirm dialog ───────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: 'var(--shadow-glow)' }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete Project?</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Save modal ───────────────────────────────────────────────────────────
function SaveModal({ onSave, onClose, isSaving }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', borderRadius: 16, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: 'var(--shadow-glow)' }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>💾</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Save Current Layout</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Project Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CPU Layout v3" autoFocus
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name.trim(), desc.trim())} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Description</label>
          <textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description…" rows={3} style={{ resize: 'vertical', minHeight: 70 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!name.trim() || isSaving}
            onClick={() => onSave(name.trim(), desc.trim())}>
            {isSaving ? '⏳ Saving…' : '💾 Save Project'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────
function ProjectCard({ project, onDelete, onLoad, index }) {
  const maxTemp = project.latest_simulation?.max_temp_C;
  const score   = project.latest_simulation?.physics_score;
  const isLocal = project.source === 'local';
  const date    = new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      style={{
        position: 'relative',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '20px 20px 16px',
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: isLocal ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #818cf8)',
        borderRadius: '16px 16px 0 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{project.name}</div>
          {project.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{project.description}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{date}</div>
          {isLocal && (
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', marginTop: 2, display: 'inline-block' }}>
              LOCAL
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {maxTemp != null ? (
          <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '7px 10px',
            borderLeft: `3px solid ${maxTemp > 95 ? 'var(--thermal-hot)' : 'var(--accent-emerald)'}` }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>MAX TEMP</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: maxTemp > 95 ? 'var(--thermal-hot)' : 'var(--accent-emerald)' }}>
              {maxTemp.toFixed(1)}°C
            </div>
          </div>
        ) : null}
        {score != null ? (
          <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '7px 10px', borderLeft: '3px solid var(--accent-gold)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>PHYSICS SCORE</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{score}/1000</div>
          </div>
        ) : null}
        {!maxTemp && !score && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '7px 0' }}>
            {project.layout?.components?.length ?? 0} component{project.layout?.components?.length !== 1 ? 's' : ''} saved
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="btn btn-primary" style={{ flex: 1, padding: '9px 0', fontSize: 12, color: '#000', textTransform: 'uppercase', fontWeight: 800 }}
          onClick={() => onLoad(project)}>
          📂 Load Layout
        </motion.button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="btn btn-danger btn-sm" style={{ padding: '9px 14px' }}
          onClick={() => onDelete(project)}>
          🗑
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyProjects({ onNewProject }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: 'center', padding: '80px 24px' }}
    >
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        style={{ fontSize: 72, marginBottom: 24 }}>🚀</motion.div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>No Projects Yet</div>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7, fontSize: 14 }}>
        Save your chip layouts to track and compare thermal performance across design iterations.
        Saves locally — no backend required.
      </p>
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        className="btn btn-primary btn-lg" onClick={onNewProject}>
        ＋ Save Current Layout
      </motion.button>
    </motion.div>
  );
}

// ─── Main Projects Page ───────────────────────────────────────────────────
export default function Projects() {
  const { username, addXP, unlockAchievement } = useGamificationStore();
  const { placedComponents, material, fanSpeedRpm, ambientTempC } = useChipStore();

  const [projects,      setProjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Load projects (backend first, localStorage fallback) ────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.getProjects(username);
      const merged = [
        ...lsLoad(username),                                      // local saves
        ...(Array.isArray(data) ? data : []),                     // backend saves
      ];
      setProjects(merged);
      setBackendOnline(true);
    } catch {
      // Backend offline — use localStorage only
      setProjects(lsLoad(username));
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (name, description) => {
    if (!placedComponents.length) {
      showToast('Place components on the board first', 'error');
      setShowSaveModal(false);
      return;
    }
    setIsSaving(true);
    const layout = {
      grid_size: 16, cell_size_mm: 1.0,
      components: placedComponents.map((c) => ({
        id: c.id, type: c.type, x: c.x, y: c.y,
        width: c.width, height: c.height,
        power_mW: c.power_mW, voltage_V: c.voltage_V,
        freq_GHz: c.freq_GHz, switching_activity: c.switching_activity,
      })),
      material, fan_speed_rpm: fanSpeedRpm, ambient_temp_C: ambientTempC,
    };

    try {
      if (backendOnline) {
        await api.saveProject({ session_id: username, name, description, layout });
        await fetchProjects();
      } else {
        lsAdd(username, name, description, layout);
        setProjects(lsLoad(username));
      }
      setShowSaveModal(false);
      showToast(`"${name}" saved successfully 💾`);
      addXP(10);
      if (projects.filter((p) => p.source === 'local').length === 0)
        unlockAchievement('first_project', 'First Project!', 'Saved your first chip design', 25);
    } catch (e) {
      // Backend tried but failed — fallback to local
      lsAdd(username, name, description, layout);
      setProjects(lsLoad(username));
      setShowSaveModal(false);
      showToast(`"${name}" saved locally (backend offline)`);
      addXP(10);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (backendOnline && deleteTarget.source !== 'local') {
        await api.deleteProject(deleteTarget.id);
        await fetchProjects();
      } else {
        lsDelete(username, deleteTarget.id);
        setProjects(lsLoad(username));
      }
      showToast(`"${deleteTarget.name}" deleted`);
    } catch {
      lsDelete(username, deleteTarget.id);
      setProjects(lsLoad(username));
      showToast('Deleted locally');
    } finally {
      setDeleteTarget(null);
    }
  };

  // ─── Load layout into workspace ───────────────────────────────────────────
  const handleLoad = (project) => {
    const comps = project.layout?.components ?? project.layouts?.[0]?.components;
    if (!comps) { showToast('No layout data in this project', 'error'); return; }
    const parsed = typeof comps === 'string' ? JSON.parse(comps) : comps;
    useChipStore.setState({ placedComponents: parsed });
    // Reset simulation state so we don't see the thermal map of the previous layout
    useSimulationStore.setState({
      isRunning: false,
      hasResult: false,
      thermalMap: null,
      irDropMap: null,
      emRiskMap: null,
      metrics: null,
      violations: null,
    });
    showToast(`"${project.name}" loaded into workspace`);
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg-primary)', padding: '28px 32px', overflowY: 'auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            <span className="gradient-text">Saved Projects</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: backendOnline ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${backendOnline ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
              color: backendOnline ? '#10b981' : '#f59e0b',
            }}>
              {backendOnline ? '● Backend Online' : '● Offline (Local Save Active)'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="btn btn-ghost" onClick={fetchProjects}>🔄 Refresh</motion.button>
          <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(99,102,241,0.5)' }} whileTap={{ scale: 0.97 }}
            className="btn btn-primary" style={{ color: '#000', textTransform: 'uppercase', fontWeight: 800 }} onClick={() => setShowSaveModal(true)}>
            ➕ Save Layout
          </motion.button>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 180, borderRadius: 16, background: 'var(--bg-tertiary)', animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyProjects onNewProject={() => setShowSaveModal(true)} />
      ) : (
        <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          <AnimatePresence mode="popLayout">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i}
                onDelete={setDeleteTarget} onLoad={handleLoad} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast"
            initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }}
            style={{
              position: 'fixed', bottom: 32, left: '50%',
              background: toast.type === 'error' ? 'rgba(244,63,94,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${toast.type === 'error' ? 'rgba(244,63,94,0.4)' : 'var(--border-emerald)'}`,
              color: toast.type === 'error' ? 'var(--accent-rose)' : 'var(--accent-emerald)',
              borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 600,
              backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-lg)', zIndex: 3000,
            }}>
            {toast.type === 'error' ? '⚠️' : '✓'} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showSaveModal && <SaveModal onSave={handleSave} onClose={() => setShowSaveModal(false)} isSaving={isSaving} />}
        {deleteTarget && (
          <ConfirmDialog
            message={`This will permanently delete "${deleteTarget.name}" and all associated data.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
