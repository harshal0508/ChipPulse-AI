import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useChipStore } from '../../store/chipStore';
import { useSimulationStore } from '../../store/simulationStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { analyzeBoard } from '../../utils/aiAdvisor';
import ExportReportButton from './ExportReportButton';

const SIMULATION_STEPS = [
  'Initializing grid...',
  'Computing Joule Heating...',
  'Applying IR Drop correction...',
  'Solving non-linear Fourier PDE...',
  'Applying Robin boundary conditions...',
  'Computing Z-axis conduction...',
  "Running Black's equation analysis...",
  'Finalizing thermal map...',
];

export default function TelemetryPanel({ onRunSimulation, onClearResults, hasResult }) {
  const {
    maxIterations, convergenceDelta, setMaxIterations, setConvergenceDelta,
    placedComponents, fanSpeedRpm, material
  } = useChipStore();
  const { isRunning, metrics, violations } = useSimulationStore();
  const { addXP, unlockAchievement } = useGamificationStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [aiLayoutTip, setAiLayoutTip] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAllViolations, setShowAllViolations] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const DELAYS = [200, 300, 200, 300, 200, 200, 200, 100];
    setStepIndex(0);
    let totalDelay = 0;
    DELAYS.forEach((d, idx) => {
      totalDelay += d;
      setTimeout(() => setStepIndex(idx + 1), totalDelay);
    });
  }, [isRunning]);

  useEffect(() => {
    if (!hasResult || !metrics) return;
    const target = metrics.physics_score || 0;
    const duration = 1000;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const val = Math.round(progress * target);
      setDisplayedScore(val);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    addXP(10);
    if (metrics.max_temp_C < 70 || metrics.max_temp_c < 70) unlockAchievement('cool_chip', 'Cool Chip!', 'Max temp under 70°C', 100);
    if (metrics.max_temp_C >= 100 || metrics.max_temp_c >= 100) unlockAchievement('meltdown', 'Thermal Runaway', 'Max temp exceeded 100°C', 150);
    if (metrics.physics_score > 900) unlockAchievement('physics_master', 'Physics Master', 'Score over 900', 150);
    if (fanSpeedRpm >= 6000) unlockAchievement('overclocker', 'Overclocker', 'Maxed out fan speed', 50);
    if (material !== 'FR4') unlockAchievement('material_scientist', 'Material Scientist', 'Used an advanced PCB substrate', 50);

    // Fetch AI Layout Analysis
    const fetchAnalysis = async () => {
      setIsAiLoading(true);
      setAiLayoutTip('');
      try {
        const components = useChipStore.getState().placedComponents;
        const tip = await analyzeBoard(components, metrics.max_temp_C || metrics.max_temp_c, target);
        setAiLayoutTip(tip);
      } catch (err) {
        setAiLayoutTip("AI offline.");
      } finally {
        setIsAiLoading(false);
      }
    };
    fetchAnalysis();

  }, [hasResult, metrics]);

  const panelStyle = {
    width: 300, height: '100%',
    background: 'var(--bg-card)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-glow)',
    borderRadius: 'var(--radius-xl)',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg), 0 0 40px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
    overflowY: 'auto',
    overflowX: 'hidden',
  };

  const sectionStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  };

  const sectionTitle = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10,
  };

  const metricBox = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 14px',
    flex: 1,
  };

  const maxTemp = hasResult && metrics ? (metrics.max_temp_C ?? metrics.max_temp_c) : null;
  const avgTemp = hasResult && metrics ? (metrics.avg_temp_C ?? metrics.avg_temp_c) : null;

  const tempColor = (t) => {
    if (!t) return 'var(--thermal-cold)';
    if (t > 105) return 'var(--thermal-critical)';
    if (t > 85) return 'var(--thermal-hot)';
    if (t > 65) return 'var(--thermal-warm)';
    if (t > 40) return 'var(--thermal-cool)';
    return 'var(--thermal-cold)';
  };

  const EQUATIONS = [
    'div(k(T)·∇T) + Q = 0',
    'q = -k·∇T  [Fourier]',
    'Solver: Gauss-Seidel FDM',
    'Grid: 16×16 × 1mm/cell',
    'k = 149 W/m·K [Si]',
  ];

  return (
    <aside style={panelStyle}>
      {/* THERMAL PROFILE */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Thermal Profile</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={metricBox}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>MAX TEMP</div>
            <div style={{
              fontSize: 24, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: tempColor(maxTemp),
            }}>
              {maxTemp != null ? `${maxTemp.toFixed(1)}°` : '--°'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Celsius</div>
          </div>
          <div style={metricBox}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>AVG TEMP</div>
            <div style={{
              fontSize: 24, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: tempColor(avgTemp),
            }}>
              {avgTemp != null ? `${avgTemp.toFixed(1)}°` : '--°'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Celsius</div>
          </div>
        </div>
      </div>

      {/* PHYSICS SCORE */}
      <div style={sectionStyle}>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Physics Score</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>Thermal Efficiency</span>
        </div>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{
            fontSize: 56, fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            background: 'linear-gradient(135deg, var(--accent-gold), #fcd34d)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            lineHeight: 1,
          }}>
            {hasResult ? displayedScore : '---'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.4 }}>
            Measures your layout's ability to dissipate heat. Higher scores mean the chip is staying close to room temperature. Spread high-power components apart to increase this!
          </div>
        </div>
      </div>

      {/* SYSTEM STATUS */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>System Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isRunning ? 'var(--accent-gold)' : hasResult ? 'var(--accent-emerald)' : 'var(--accent-primary)',
            boxShadow: `0 0 8px ${isRunning ? 'var(--accent-gold)' : hasResult ? 'var(--accent-emerald)' : 'var(--accent-primary)'}`,
            animation: isRunning ? 'pulse-glow 1s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: isRunning ? 'var(--accent-gold)' : hasResult ? 'var(--accent-emerald)' : 'var(--accent-secondary)',
          }}>
            {isRunning
              ? SIMULATION_STEPS[Math.min(stepIndex, SIMULATION_STEPS.length - 1)]
              : hasResult
              ? 'Simulation Complete'
              : 'Ready to Simulate'}
          </span>
        </div>
      </div>

      {/* VIOLATIONS — handles both {thermal_throttle, electromigration} and flat array */}
      {hasResult && violations && (() => {
        // Normalise to a flat list of display items
        let items = [];
        if (Array.isArray(violations)) {
          items = violations;
        } else {
          (violations.thermal_throttle || []).forEach((v) =>
            items.push({ type: `Thermal ${v.temp_C?.toFixed(1)}°C`, location: `Cell (${v.x},${v.y})`, icon: '🌡' })
          );
          (violations.electromigration || []).forEach((v) =>
            items.push({ type: `EM Risk ${(v.risk * 100).toFixed(0)}%`, location: `Cell (${v.x},${v.y})`, icon: '⚡' })
          );
        }
        const hasNone = items.length === 0;
        const displayItems = showAllViolations ? items : items.slice(0, 3);
        
        return (
          <div style={sectionStyle}>
            <div style={sectionTitle}>Violations</div>
            {hasNone ? (
              <div style={{ fontSize: 12, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span> No violations detected
              </div>
            ) : (
              <>
                {displayItems.map((v, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '6px 0', borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'var(--accent-rose)', marginTop: 1 }}>{v.icon || '⚠'}</span>
                    <div>
                      <div style={{ color: 'var(--accent-rose)', fontWeight: 500 }}>{v.type}</div>
                      {v.location && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v.location}</div>}
                    </div>
                  </div>
                ))}
                {items.length > 3 && (
                  <button 
                    onClick={() => setShowAllViolations(!showAllViolations)}
                    style={{ 
                      width: '100%', background: 'transparent', border: '1px dashed var(--border-glow)', 
                      color: 'var(--text-secondary)', padding: '6px 0', fontSize: 11, 
                      borderRadius: 8, cursor: 'pointer', marginTop: 8, transition: '0.2s' 
                    }}
                    onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
                  >
                    {showAllViolations ? 'Show Less' : `+${items.length - 3} More Violations`}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* PINN SOLVER CONTROLS */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>PINN Solver Controls</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>Max Iterations</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)' }}>{maxIterations}</span>
          </div>
          <input type="range" min={100} max={2000} step={100} value={maxIterations}
            onChange={(e) => setMaxIterations(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Convergence Delta</div>
          <input
            type="number" step={0.001} min={0.001} max={1}
            value={convergenceDelta}
            onChange={(e) => setConvergenceDelta(Number(e.target.value))}
            style={{
              width: '100%', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '6px 10px',
              color: 'var(--text-primary)', fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* PHYSICS ENGINE */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Physics Engine</div>
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6, padding: '10px 12px',
        }}>
          {EQUATIONS.map((eq, i) => (
            <div key={i} style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              color: i === 0 ? 'var(--accent-secondary)' : 'var(--text-muted)',
              marginBottom: i < EQUATIONS.length - 1 ? 4 : 0,
              paddingBottom: i < EQUATIONS.length - 1 ? 4 : 0,
              borderBottom: i === 1 ? '1px solid var(--border-subtle)' : 'none',
              marginTop: i === 2 ? 4 : 0,
            }}>{eq}</div>
          ))}
        </div>
      </div>

      {/* RUN SIMULATION / BACK TO EDIT MODE */}
      <div style={{ padding: '16px', marginTop: 'auto' }}>
        {hasResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={onClearResults}
              style={{
                width: '100%', padding: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'var(--bg-tertiary)'}
              onMouseOut={(e) => e.target.style.background = 'var(--bg-card)'}
            >
              Back to Edit Mode
            </button>
            <ExportReportButton />
          </div>
        ) : (
          <button
            onClick={onRunSimulation}
            disabled={isRunning || placedComponents.length === 0}
            style={{
              width: '100%', padding: '14px',
              background: isRunning ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none', borderRadius: 10,
              color: isRunning ? 'var(--text-muted)' : '#1B2026', fontSize: 15, fontWeight: 800,
              cursor: isRunning || placedComponents.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.3s',
              boxShadow: !isRunning && placedComponents.length > 0 ? 'var(--shadow-glow)' : 'none',
            }}
          >
            {isRunning ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--text-muted)" strokeWidth="3" fill="none" strokeDasharray="31" strokeDashoffset="10" />
                </svg>
                <span style={{ color: 'var(--text-muted)' }}>Simulating...</span>
              </>
            ) : (
              <>
                Run Simulation
              </>
            )}
          </button>
        )}
        {placedComponents.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Place components on the canvas first
          </div>
        )}

      {/* AI Layout Analysis Section */}
      {hasResult && metrics && (
        <div style={{ marginTop: 'auto' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 8,
            padding: 12,
            marginTop: 16,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              AI Layout Architect
            </div>
            {isAiLoading ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 40 }}>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                </motion.div>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                </motion.div>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                </motion.div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  fontSize: 13, 
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)'
                }}
              >
                {aiLayoutTip}
              </motion.div>
            )}
          </div>
        </div>
      )}
      </div>
    </aside>
  );
}
