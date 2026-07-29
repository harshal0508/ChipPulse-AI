import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { useSimulationStore } from '../store/simulationStore';
import { useChipStore } from '../store/chipStore';
import { tempToColor } from '../utils/tempToColor';

// ─── Normalize both API and mock metric shapes ────────────────────────────
function norm(m) {
  if (!m) return null;
  return {
    max_temp_C:             m.max_temp_C ?? m.max_temp_c,
    avg_temp_C:             m.avg_temp_C ?? m.avg_temp_c,
    min_temp_C:             m.min_temp_C ?? m.min_temp_c,
    physics_score:          m.physics_score,
    total_power_W:          m.total_power_W ?? (m.total_power_mW ? m.total_power_mW / 1000 : null),
    convergence_iterations: m.convergence_iterations,
    solver_time_ms:         m.solver_time_ms,
    laws_applied:           m.laws_applied,
    ir_details:             m.ir_details,
    convection_h:           m.convection_h,
    fan_speed_rpm:          m.fan_speed_rpm,
    ambient_temp_C:         m.ambient_temp_C,
  };
}

// ─── Ignis AI advisor ─────────────────────────────────────────────────────
// "Ignis" = Latin for fire/heat — the expert who gives the final thermal verdict
function IgnisAdvisor({ metrics, violations, thermalMap, placedComponents }) {
  const [open, setOpen] = useState(false);

  const advice = useMemo(() => {
    if (!metrics) return [];
    const m = norm(metrics);
    const suggestions = [];
    const maxT = m?.max_temp_C;
    const score = m?.physics_score;
    const h = m?.convection_h;

    // 1. Core Temperature Checks
    if (maxT > 100) {
      suggestions.push({
        severity: 'critical',
        icon: '🔥',
        title: 'Critical Thermal Throttle Risk',
        detail: `Peak temperature ${maxT?.toFixed(1)}°C exceeds 100°C. Immediate action required: (1) Spread compute clusters to avoid heat pooling. (2) Increase fan speed to maximum. (3) Switch substrate to SiC or Diamond for better heat spread.`,
      });
    } else if (maxT > 90) {
      suggestions.push({
        severity: 'warning',
        icon: '⚠️',
        title: 'Elevated Temperature — Optimize Layout',
        detail: `Peak at ${maxT?.toFixed(1)}°C is approaching throttle threshold (95°C). Move high-power components away from chip center where heat gets trapped. Separating hot cores by 2+ cells reduces thermal coupling by ~30%.`,
      });
    } else {
      const positiveTips = [
        `Max temperature ${maxT?.toFixed(1)}°C is well within safe operating range. Current layout shows excellent thermal distribution.`,
        `Thermal profile is healthy (${maxT?.toFixed(1)}°C peak). You have enough thermal headroom to add more processing cores or accelerators.`,
        `Excellent thermal mitigation. The substrate is effectively spreading the heat away from high-density components.`,
        `Temperatures are low (${maxT?.toFixed(1)}°C). If you are optimizing for power-efficiency, consider lowering fan speeds to save system power.`
      ];
      const tipIndex = (score || 0) % positiveTips.length;
      suggestions.push({
        severity: 'good',
        icon: '🟢',
        title: 'Thermal Profile Within Safe Limits',
        detail: positiveTips[tipIndex],
      });
    }

    // 2. Physics & Airflow Diagnostics
    if (score < 700) {
      suggestions.push({
        severity: 'warning',
        icon: '⚠️',
        title: 'Solver Convergence Issue',
        detail: `Score ${score}/1000 indicates the physics engine struggled to converge. Try increasing max iterations to 800+ or lowering the convergence delta for tighter accuracy.`,
      });
    }

    if (h && h < 15 && maxT > 70) {
      suggestions.push({
        severity: 'warning',
        icon: '💨',
        title: 'Insufficient Airflow for Current Load',
        detail: `Current convection coefficient h=${h} W/m²K (natural convection only). Heat is building up. Increase fan speed to at least 2000 RPM to introduce active air cooling.`,
      });
    }

    // 3. Component-Specific Thermal Coupling & Architecture Rules
    const npuCount = (placedComponents || []).filter((c) => c.type === 'npu_accelerator').length;
    const pllCount = (placedComponents || []).filter((c) => c.type === 'clock_pll').length;
    const cpuCount = (placedComponents || []).filter((c) => c.type === 'cpu_core').length;
    const gpuCount = (placedComponents || []).filter((c) => c.type === 'gpu_cluster').length;
    
    if (npuCount > 0 && maxT > 65) {
      suggestions.push({
        severity: 'warning',
        icon: '🧠',
        title: 'NPU Thermal Density Alert',
        detail: `Detected ${npuCount} NPU Engine(s). Dense matrix-multiplication accelerators create extreme localized thermal spikes during inference. Ensure NPUs are placed near the edges or surrounded by low-power SRAM blocks to prevent throttling.`,
      });
    }

    if (pllCount > 0 && (score || 0) % 3 === 0) {
      suggestions.push({
        severity: 'info',
        icon: '⏱️',
        title: 'Clock PLL Point-Source Hotspot',
        detail: `The 4.0GHz Clock PLL has a tiny 1x1 footprint but generates concentrated heat. This creates a severe point-source thermal spike. Avoid placing it adjacent to temperature-sensitive I/O controllers.`,
      });
    }

    if (cpuCount >= 2 && gpuCount >= 1) {
      suggestions.push({
        severity: 'info',
        icon: '🔥',
        title: 'Complex SoC Thermal Coupling',
        detail: `Heavy compute components (CPUs and GPUs) detected. When placed near each other, thermal coupling raises the local junction temperature exponentially. Consider floorplanning with a memory block (SRAM) between them as a thermal "buffer zone".`,
      });
    } else if (cpuCount >= 2 && (score || 0) % 2 === 0) {
      suggestions.push({
        severity: 'info',
        icon: '🔬',
        title: 'Multi-Core Thermal Coupling Detected',
        detail: `${cpuCount} CPU cores detected. When cores are within 2 cells of each other, overlapping thermal gradients raise temperatures by 8–15°C above baseline.`,
      });
    }

    // 4. IR Drop (Power Delivery)
    const irDetails = m?.ir_details || [];
    const maxIR = irDetails.reduce((max, d) => d.vDrop > max.vDrop ? d : max, { vDrop: 0 });
    
    // Only show IR drop warning if it's significant (> 0.1V) to reduce noise
    if (maxIR.vDrop > 0.1) {
      suggestions.push({
        severity: 'info',
        icon: '⚡',
        title: `IR Drop Warning: ${maxIR.label}`,
        detail: `Component "${maxIR.label}" experiences ΔV = ${maxIR.vDrop.toFixed(4)}V voltage drop due to wire resistance, producing ${maxIR.rHeat?.toFixed(2)}mW of additional resistive heat. Move high-current components closer to the power delivery network origin (chip center) to reduce I²R losses.`,
      });
    }

    // Only return the top 3 most relevant suggestions to avoid overwhelming the user
    return suggestions.slice(0, 3);
  }, [metrics, violations, thermalMap, placedComponents]);

  if (!metrics) return null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-gold)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-gold)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer',
          borderBottom: open ? '1px solid rgba(251,146,60,0.15)' : 'none',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #fb923c, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 16px rgba(251,146,60,0.4)',
          }}>🔥</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fb923c' }}>Ignis</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>AI Thermal Layout Advisor · {advice.length} suggestion{advice.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{
          fontSize: 11, color: '#fb923c', background: 'rgba(251,146,60,0.1)',
          border: '1px solid rgba(251,146,60,0.25)', borderRadius: 20,
          padding: '3px 12px', fontWeight: 600,
        }}>
          {open ? 'Hide ↑' : 'View Advice ↓'}
        </div>
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {advice.map((a, i) => {
                const borderColor = a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : a.severity === 'good' ? '#10b981' : '#6366f1';
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{
                      background: `${borderColor}08`,
                      border: `1px solid ${borderColor}25`,
                      borderLeft: `3px solid ${borderColor}`,
                      borderRadius: 10, padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{a.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: borderColor }}>{a.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{a.detail}</p>
                  </motion.div>
                );
              })}
              <div style={{ fontSize: 10, color: '#334155', textAlign: 'right', marginTop: 4 }}>
                Ignis — Physics-Informed Thermal Verdict System · ChipPulse AI
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Zone classifier ──────────────────────────────────────────────────────
function classifyTemp(temp, minT, maxT) {
  const t = (temp - minT) / Math.max(1, maxT - minT);
  if (t > 0.85) return { zone: 'Critical Hot Zone 🔴', color: '#ef4444', desc: 'Severe thermal stress. High electromigration risk. Consider heatsink or spreading components.' };
  if (t > 0.65) return { zone: 'Hot Zone 🟠',          color: '#fb923c', desc: 'Elevated — monitor for throttling. IR drop effects significant here.' };
  if (t > 0.40) return { zone: 'Warm Zone 🟡',         color: '#eab308', desc: 'Above ambient but within safe limits. Moderate heat spreading from nearby components.' };
  if (t > 0.15) return { zone: 'Moderate Zone 🟣',     color: '#818cf8', desc: 'Slightly elevated. Heat diffusing from hot components via Fourier conduction.' };
  return          { zone: 'Cool Zone 🔵',               color: '#22d3ee', desc: 'Near ambient. Good thermal isolation from heat sources.' };
}

// ─── Thermal map cell popup ───────────────────────────────────────────────
function HeatmapTooltip({ cell, onClose }) {
  if (!cell) return null;
  
  // Calculate absolute document coordinates so the tooltip scrolls with the page
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  
  const absoluteLeft = cell.screenX + scrollX;
  const absoluteTop  = cell.screenY + scrollY + 14;
  
  // Keep tooltip from overflowing the right edge
  const left = Math.min(absoluteLeft, (window.innerWidth + scrollX) - 310);
  const top  = absoluteTop;

  return createPortal(
    <>
      <div 
        onClick={onClose} 
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          position: 'absolute', zIndex: 9999, top, left,
          background: 'var(--bg-elevated)',
          border: `1px solid ${cell.info.color}55`,
          borderRadius: 12, padding: '14px 18px',
          maxWidth: 290, pointerEvents: 'none',
          boxShadow: `var(--shadow-lg), 0 0 0 1px ${cell.info.color}22`,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: cell.info.color, marginBottom: 5 }}>{cell.info.zone}</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 800, marginBottom: 5, color: '#f1f5f9' }}>
          {cell.temp.toFixed(1)}°C
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>Grid ({cell.cx}, {cell.ry})</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: cell.component ? 10 : 0 }}>
          {cell.info.desc}
        </div>
        {cell.component && (
          <div style={{ padding: '7px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: 12, color: '#a5b4fc' }}>
            📦 {cell.component.label} · {cell.component.power_mW}mW · ({cell.component.x},{cell.component.y})
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}

// ─── Interactive 2D Heatmap ───────────────────────────────────────────────
function Heatmap2D({ thermalMap, placedComponents }) {
  const [tooltip, setTooltip] = useState(null);

  const flat = useMemo(() => thermalMap?.flat() ?? [], [thermalMap]);
  const minT  = useMemo(() => flat.length ? Math.min(...flat) : 25,  [flat]);
  const maxT  = useMemo(() => flat.length ? Math.max(...flat) : 100, [flat]);

  const compMap = useMemo(() => {
    const map = {};
    (placedComponents || []).forEach((comp) => {
      for (let dy = 0; dy < comp.height; dy++)
        for (let dx = 0; dx < comp.width; dx++)
          map[`${comp.x + dx},${comp.y + dy}`] = comp;
    });
    return map;
  }, [placedComponents]);

  const handleCellClick = (e, temp, cx, ry) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ temp, cx, ry, info: classifyTemp(temp, minT, maxT), component: compMap[`${cx},${ry}`] || null, screenX: rect.left, screenY: rect.top });
  };

  return (
    <div onClick={() => setTooltip(null)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🌡 Thermal Map (16×16)</div>
        <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ color: '#22d3ee' }}>● {minT.toFixed(0)}°C</span>
          <span style={{ color: '#ef4444' }}>● {maxT.toFixed(0)}°C</span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>💡 Click any cell to inspect</div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 1, border: '1px solid rgba(99,102,241,0.1)', borderRadius: 8, overflow: 'hidden', cursor: 'crosshair' }}
        onClick={(e) => e.stopPropagation()}
      >
        {(thermalMap ?? Array(16).fill(Array(16).fill(25))).map((row, ry) =>
          row.map((temp, cx) => {
            const t = (temp - minT) / Math.max(1, maxT - minT);
            return (
              <div key={`${ry}-${cx}`}
                onClick={(e) => handleCellClick(e, temp, cx, ry)}
                title={`(${cx},${ry}) ${temp.toFixed(1)}°C`}
                style={{
                  aspectRatio: '1',
                  backgroundColor: tempToColor(temp, minT, maxT),
                  opacity: 0.3 + t * 0.7,
                  cursor: 'pointer',
                  outline: compMap[`${cx},${ry}`] ? '1px solid rgba(255,255,255,0.2)' : 'none',
                }}
              />
            );
          })
        )}
      </div>
      <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #22d3ee, #6366f1, #fb923c, #ef4444)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 3 }}>
        <span>Cold ({minT.toFixed(0)}°C)</span><span>Hot ({maxT.toFixed(0)}°C)</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {[['Cool','#22d3ee'],['Moderate','#818cf8'],['Warm','#eab308'],['Hot','#fb923c'],['Critical','#ef4444']].map(([label, color]) => (
          <span key={label} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}44`, color }}>{label}</span>
        ))}
      </div>
      <AnimatePresence>
        {tooltip && <HeatmapTooltip key="tt" cell={tooltip} onClose={() => setTooltip(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color, sub }) {
  return (
    <div className="metric-box" style={{ flex: 1 }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || 'var(--text-primary)', fontSize: 26 }}>
        {value ?? '—'}{unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Recharts tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-glow)', borderRadius: 10, padding: '10px 14px', minWidth: 160, maxWidth: 220 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      {payload.map((p) => {
        let suggestion = null;
        if (p.name === 'Power (mW)' || p.dataKey === 'power') {
          if (p.value > 1500) suggestion = "Very high power! Place this near the edges for better dissipation.";
          else if (p.value > 800) suggestion = "High power draw. Keep away from other hot components.";
          else suggestion = "Efficient power. Safe to group with other components.";
        } else if (p.dataKey === 'Score' || p.name === 'Score') {
          if (p.value >= 900) suggestion = "Excellent! Heat is dissipated effectively.";
          else if (p.value >= 700) suggestion = "Good. Spread hot components further for a higher score.";
          else suggestion = "Thermal bottleneck! High-power components are too close together.";
        }

        return (
          <div key={p.dataKey} style={{ marginBottom: suggestion ? 4 : 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: p.color }}>{p.name}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#f1f5f9' }}>{p.value}</span>
            </div>
            {suggestion && (
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6, marginTop: 2 }}>
                <span style={{color: 'var(--accent-primary)', fontWeight: 700}}>Tip: </span>{suggestion}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>📊</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>No Simulation Data Yet</div>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.7 }}>
        Run a simulation in the Workspace to see convergence plots, power breakdowns, and your 2D thermal heatmap here.
      </p>
      <Link to="/workspace">
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn btn-primary btn-lg">
          ⚡ Go to Workspace
        </motion.button>
      </Link>
    </motion.div>
  );
}

// ─── History table ────────────────────────────────────────────────────────
function SimHistoryTable({ history }) {
  if (!history?.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {['Run','Max Temp','Avg Temp','Physics Score','Iterations','Solver Time','Converged'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((sim, i) => {
            const m = norm(sim.metrics);
            if (!m) return null;
            const converged = (m.convergence_iterations ?? 0) < 480;
            return (
              <motion.tr key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>#{history.length - i}</td>
                <td style={{ padding: '10px 12px', color: m.max_temp_C > 95 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{m.max_temp_C?.toFixed(1) ?? '—'}°C</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>{m.avg_temp_C?.toFixed(1) ?? '—'}°C</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: m.physics_score >= 900 ? 'var(--accent-emerald)' : m.physics_score >= 700 ? 'var(--accent-gold)' : 'var(--accent-rose)' }}>
                    {m.physics_score ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>{m.convergence_iterations ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>{m.solver_time_ms?.toFixed(0) ?? '—'} ms</td>
                <td style={{ padding: '10px 12px' }}>
                  <span className={`badge ${converged ? 'badge-emerald' : 'badge-rose'}`}>{converged ? '✓ Yes' : '✗ No'}</span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────
export default function Analytics() {
  const { thermalMap, metrics: rawMetrics, violations, history } = useSimulationStore();
  const { placedComponents } = useChipStore();
  const [showAllViolations, setShowAllViolations] = useState(false);
  const [showAllIrDrop, setShowAllIrDrop] = useState(false);
  const hasData = !!thermalMap;
  const metrics = norm(rawMetrics);

  const convergenceData = useMemo(() =>
    [...history].reverse().map((sim, i) => {
      const m = norm(sim.metrics);
      return {
        run: `#${i + 1}`,
        'Max Temp': m?.max_temp_C != null ? parseFloat(m.max_temp_C.toFixed(1)) : null,
        'Avg Temp': m?.avg_temp_C != null ? parseFloat(m.avg_temp_C.toFixed(1)) : null,
        Score: m?.physics_score ?? null,
      };
    }), [history]
  );

  const powerByType = useMemo(() => {
    const acc = {};
    placedComponents.forEach((c) => { const k = c.label || c.type; acc[k] = (acc[k] || 0) + c.power_mW; });
    return Object.entries(acc).map(([type, power]) => ({ type, power }));
  }, [placedComponents]);

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg-primary)', padding: '28px 32px', overflowY: 'auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
              <span className="gradient-text">Simulation Analytics</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {hasData ? `Latest simulation · ${history.length} run${history.length !== 1 ? 's' : ''} total` : 'Awaiting first simulation run'}
            </p>
          </div>
          {hasData && (
            <div style={{ display: 'flex', gap: 10 }}>
              <span className={`badge ${metrics?.physics_score >= 900 ? 'badge-emerald' : metrics?.physics_score >= 700 ? 'badge-gold' : 'badge-rose'}`}>
                ⚡ Score: {metrics?.physics_score ?? '—'}
              </span>
              <span className={`badge ${metrics?.max_temp_C > 95 ? 'badge-rose' : 'badge-emerald'}`}>
                🌡 {metrics?.max_temp_C?.toFixed(1)}°C max
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {!hasData ? <EmptyState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Ignis AI Advisor ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
            <IgnisAdvisor metrics={rawMetrics} violations={violations} thermalMap={thermalMap} placedComponents={placedComponents} />
          </motion.div>

          {/* ── Stats ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} style={{ display: 'flex', gap: 16 }}>
            <StatCard label="Max Temperature" value={metrics?.max_temp_C?.toFixed(1)} unit="°C"
              color={metrics?.max_temp_C > 95 ? 'var(--thermal-hot)' : metrics?.max_temp_C > 75 ? 'var(--thermal-warm)' : 'var(--accent-emerald)'}
              sub={metrics?.max_temp_C > 95 ? '⚠ Thermal throttle risk' : '✓ Within safe range'} />
            <StatCard label="Avg Temperature"  value={metrics?.avg_temp_C?.toFixed(1)} unit="°C" color="var(--accent-secondary)" />
            <StatCard label="Min Temperature"  value={metrics?.min_temp_C?.toFixed(1)} unit="°C" color="var(--thermal-cold)" />
            <StatCard label="Physics Score"    value={metrics?.physics_score} unit="/1000"
              color={metrics?.physics_score >= 900 ? 'var(--accent-emerald)' : metrics?.physics_score >= 700 ? 'var(--accent-gold)' : 'var(--accent-rose)'}
              sub={metrics?.convergence_iterations < 480 ? '✓ Converged' : '⚠ Did not converge'} />
            <StatCard label="Total Power"
              value={metrics?.total_power_W != null ? (metrics.total_power_W * 1000).toFixed(0) : null}
              unit="mW" color="var(--accent-gold)"
              sub={`${placedComponents.length} components`} />
          </motion.div>

          {/* ── Charts ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>📈 Temperature History</div>
              {convergenceData.length >= 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={convergenceData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="rgba(99,102,241,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="run" tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="°C" domain={['auto','auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '95°C', fill: '#ef4444', fontSize: 10 }} />
                    <Line type="monotone" dataKey="Max Temp" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="Avg Temp" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12 }}>Run a simulation to see history</div>
              )}
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🎯 Physics Score Trend</div>
              {convergenceData.length >= 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={convergenceData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="rgba(99,102,241,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="run" tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis domain={[0, 1000]} tick={{ fill: '#475569', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                    <ReferenceLine y={900} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Excellent', fill: '#10b981', fontSize: 10 }} />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#4338ca" />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="Score" fill="url(#scoreGrad)" radius={[4,4,0,0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
              )}
            </div>
          </motion.div>

          {/* ── Heatmap + Power + Violations ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 20 }}>
            <div className="card">
              <Heatmap2D thermalMap={thermalMap} placedComponents={placedComponents} />
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>⚡ Power by Component</div>
              {powerByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={powerByType} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="rgba(99,102,241,0.08)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} unit=" mW" />
                    <YAxis type="category" dataKey="type" width={90} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                    <Bar dataKey="power" name="Power (mW)" radius={[0,4,4,0]} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12 }}>Place components first</div>}
            </div>

            {/* Violations + IR details — physics laws MOVED to separate section */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>⚠️ Violation Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(() => {
                  let items = [];
                  if (Array.isArray(violations)) {
                    items = violations;
                  } else {
                    (violations?.thermal_throttle || []).forEach((v) => items.push({ icon: '🌡', type: `Thermal ${v.temp_C?.toFixed(1)}°C`, location: `Cell (${v.x},${v.y})`, color: '#ef4444' }));
                    (violations?.electromigration || []).forEach((v) => items.push({ icon: '⚡', type: `EM Risk ${(v.risk*100).toFixed(0)}%`, location: `Cell (${v.x},${v.y})`, color: '#f59e0b' }));
                  }
                  
                  const displayItems = showAllViolations ? items : items.slice(0, 3);
                  
                  return items.length === 0
                    ? <>
                        <div style={{ fontSize: 12, color: '#10b981', padding: '8px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>✓ No thermal violations</div>
                        <div style={{ fontSize: 12, color: '#10b981', padding: '8px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>✓ No EM violations</div>
                      </>
                    : <>
                        {displayItems.map((v, i) => (
                          <div key={i} style={{ display:'flex', gap:8, padding:'8px 10px', background:`${v.color}0e`, border:`1px solid ${v.color}25`, borderRadius:8, fontSize:12 }}>
                            <span>{v.icon}</span>
                            <div><div style={{color:v.color,fontWeight:600}}>{v.type}</div><div style={{color:'#475569',fontSize:11}}>{v.location}</div></div>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <button 
                            onClick={() => setShowAllViolations(!showAllViolations)}
                            style={{ 
                              background: 'transparent', border: '1px dashed var(--border-glow)', 
                              color: 'var(--text-secondary)', padding: '6px 0', fontSize: 11, 
                              borderRadius: 8, cursor: 'pointer', marginTop: 4, transition: '0.2s' 
                            }}
                            onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
                            onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
                          >
                            {showAllViolations ? 'Show Less' : `+${items.length - 3} More Violations`}
                          </button>
                        )}
                      </>;
                })()}
              </div>

              {/* IR Drop Details */}
              {metrics?.ir_details?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Resistance Heat (IR Drop)</div>
                  {(showAllIrDrop ? metrics.ir_details : metrics.ir_details.slice(0, 5)).map((d) => (
                    <div key={d.id} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'4px 0', borderBottom:'1px solid rgba(99,102,241,0.05)', color:'#64748b' }}>
                      <span>{d.label}</span>
                      <span style={{ fontFamily:'JetBrains Mono' }}>ΔV={d.vDrop.toFixed(4)}V · +{d.rHeat.toFixed(2)}mW</span>
                    </div>
                  ))}
                  {metrics.ir_details.length > 5 && (
                    <button 
                      onClick={() => setShowAllIrDrop(!showAllIrDrop)}
                      style={{ 
                        width: '100%', background: 'transparent', border: '1px dashed rgba(99,102,241,0.3)', 
                        color: 'var(--text-secondary)', padding: '6px 0', fontSize: 11, 
                        borderRadius: 8, cursor: 'pointer', marginTop: 8, transition: '0.2s' 
                      }}
                      onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
                      onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
                    >
                      {showAllIrDrop ? 'Show Less' : `+${metrics.ir_details.length - 5} More Components`}
                    </button>
                  )}
                  <div style={{ fontSize:10, color:'#334155', marginTop:6 }}>R_wire = 0.05 Ω/cell segment</div>
                </div>
              )}
            </div>
          </motion.div>



          {/* ── History table ── */}
          {history.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>📋 Simulation Run History</div>
              <SimHistoryTable history={history} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
