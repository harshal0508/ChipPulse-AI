import { useChipStore } from '../../store/chipStore';
import { useSimulationStore } from '../../store/simulationStore';

const MATERIALS = [
  { id: 'silicon', label: 'Silicon (Si)', k: '149 W/m·K', desc: 'Standard substrate' },
  { id: 'gaas',    label: 'GaAs',         k: '46 W/m·K',  desc: 'High-freq RF chips' },
  { id: 'diamond', label: 'Diamond',      k: '2000 W/m·K', desc: 'Ultra-high conductivity' },
  { id: 'sic',     label: 'SiC',          k: '490 W/m·K',  desc: 'Power electronics' },
];

export default function ComponentLibrary({ onRunSimulation, onClear, onRandom, onClearResults, onSave, onLoad, hasResult }) {
  const {
    placedComponents, selectedType, selectedPlacedId, material,
    fanSpeedRpm, ambientTempC,
    setSelectedType, setMaterial, setFanSpeed, setAmbientTemp,
    selectPlaced, removeComponent,
    COMPONENT_DEFAULTS,
  } = useChipStore();
  const { isRunning } = useSimulationStore();

  const sidebarStyle = {
    width: 280, height: '100%',
    background: 'var(--bg-card)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg), 0 0 40px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
    overflowY: 'auto',
    fontFamily: "'Inter', sans-serif",
  };
  const section = { padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' };
  const sectionTitle = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
    color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8,
  };
  const sliderStyle = {
    width: '100%', height: 4, borderRadius: 2,
    accentColor: '#6366f1', cursor: 'pointer', marginTop: 5,
  };

  return (
    <aside style={sidebarStyle}>

      {/* ── SUBSTRATE ─────────────────────────────────────── */}
      <div style={section}>
        <div style={sectionTitle}>Substrate Material</div>
        {MATERIALS.map((mat) => {
          const sel = material === mat.id;
          return (
            <label key={mat.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', borderRadius: 6, marginBottom: 3,
              background: sel ? 'var(--bg-tertiary)' : 'transparent',
              border: `1px solid ${sel ? 'var(--border-glow)' : 'transparent'}`,
              cursor: 'pointer', fontSize: 12, color: sel ? 'var(--accent-secondary)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              <input type="radio" name="material" value={mat.id}
                checked={sel} onChange={() => setMaterial(mat.id)}
                style={{ accentColor: '#6366f1', width: 12, height: 12 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{mat.label}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{mat.k} · {mat.desc}</div>
              </div>
            </label>
          );
        })}
      </div>

      {/* ── COMPONENT PALETTE ────────────────────────────── */}
      <div style={section}>
        <div style={sectionTitle}>
          Components
          <span style={{ color: 'var(--accent-primary)', marginLeft: 4 }}>→ select then click grid</span>
        </div>
        {Object.entries(COMPONENT_DEFAULTS).map(([type, def]) => {
          const isSel = selectedType === type;
          return (
            <div key={type}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px', borderRadius: 7, marginBottom: 4,
                background: isSel ? 'var(--bg-tertiary)' : 'transparent',
                border: `1px solid ${isSel ? 'var(--border-glow)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onClick={() => setSelectedType(isSel ? null : type)}
            >
              <div style={{ width: 9, height: 9, borderRadius: 2, background: def.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{def.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{def.power_mW}mW · {def.freq_GHz}GHz · {def.width}×{def.height}</div>
              </div>
              {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* ── PLACED COMPONENTS (with remove) ──────────────── */}
      {placedComponents.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>
            Placed · <span style={{ color: 'var(--accent-rose)' }}>click to remove</span>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {placedComponents.map((comp) => {
              const isSelected = selectedPlacedId === comp.id;
              const def = COMPONENT_DEFAULTS[comp.type];
              return (
                <div key={comp.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 8px', borderRadius: 6, marginBottom: 3,
                    background: isSelected ? 'rgba(239,68,68,0.1)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onClick={() => selectPlaced(comp.id)}
                >
                  <div style={{ width: 7, height: 7, borderRadius: 1, background: def?.color || comp.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 11, color: isSelected ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>
                    {comp.label} ({comp.x},{comp.y})
                  </div>
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
                      style={{
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                        borderRadius: 4, color: 'var(--accent-rose)', fontSize: 11, padding: '1px 7px',
                        cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                      }}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ENVIRONMENT ──────────────────────────────────── */}
      <div style={section}>
        <div style={sectionTitle}>Environment</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Fan Speed</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-primary)', fontSize: 11 }}>{fanSpeedRpm} RPM</span>
          </div>
          <input type="range" min={0} max={4000} step={100} value={fanSpeedRpm}
            onChange={(e) => setFanSpeed(Number(e.target.value))} style={sliderStyle} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {fanSpeedRpm === 0 ? 'Natural convection h=5 W/m²K' :
             fanSpeedRpm < 1000 ? 'Low airflow h=15 W/m²K' :
             fanSpeedRpm < 2000 ? 'Moderate h=25 W/m²K' :
             fanSpeedRpm < 3000 ? 'High airflow h=45 W/m²K' : 'Max airflow h=65 W/m²K'}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Ambient Temp</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--thermal-cold)', fontSize: 11 }}>{ambientTempC}°C</span>
          </div>
          <input type="range" min={20} max={45} step={1} value={ambientTempC}
            onChange={(e) => setAmbientTemp(Number(e.target.value))} style={sliderStyle} />
        </div>
      </div>

      {/* ── ACTIONS ──────────────────────────────────────── */}
      <div style={{ ...section, flex: 1 }}>
        <div style={sectionTitle}>Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 5 }}>
          <button
            style={{
              padding: '6px', borderRadius: 5,
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            }}
            onClick={onSave}
          >💾 Save</button>
          <button
            style={{
              padding: '6px', borderRadius: 5, flex: 1,
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            }}
            onClick={onLoad}
          >📂 Load</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={{
                padding: '6px', borderRadius: 5, flex: 1,
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
              }}
              onClick={onRandom}
            >🎲 Random</button>
            <button
              style={{
                padding: '6px', borderRadius: 5,
                border: '1px solid rgba(239,68,68,0.2)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
              }}
              onClick={onClear}
            >🗑️ Clear</button>
          </div>
        
        {hasResult ? (
          <button
            style={{
              width: '100%', padding: '9px', borderRadius: 7, marginTop: 4,
              border: '1px solid var(--accent-primary)',
              background: 'transparent',
              color: 'var(--accent-primary)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
            onClick={onClearResults}
          >
            ← Back to Edit Mode
          </button>
        ) : (
          <button
            disabled={isRunning || placedComponents.length === 0}
            style={{
              width: '100%', padding: '9px', borderRadius: 7, marginTop: 4,
              border: 'none',
              background: isRunning || placedComponents.length === 0
                ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: isRunning || placedComponents.length === 0 ? 'var(--text-muted)' : '#1B2026',
              fontSize: 13, fontWeight: 800, cursor: isRunning ? 'wait' : 'pointer',
              boxShadow: isRunning || placedComponents.length === 0 ? 'none' : 'var(--shadow-glow)',
            }}
            onClick={onRunSimulation}
          >
            {isRunning ? 'Simulating...' : 'Run Simulation'}
          </button>
        )}
        
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          {placedComponents.length} component{placedComponents.length !== 1 ? 's' : ''} on board
        </div>
      </div>
    </aside>
  );
}
