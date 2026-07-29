import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const LAWS = [
  {
    num: '01',
    title: 'Joule Heating',
    desc: 'Every active component generates heat based on its power consumption. We accurately map exactly where and how much heat is produced across the die, predicting hotspots before they happen.',
  },
  {
    num: '02',
    title: 'Non-Linear Heat Transfer',
    desc: 'Heat doesn\'t just sit still—it spreads. Our solver simulates how thermal energy flows outward through the silicon. Because materials conduct heat differently when hot, we dynamically adjust these properties in real-time.',
  },
  {
    num: '03',
    title: 'Convective Surface Cooling',
    desc: 'The interaction between the chip surface and ambient air is critical. We simulate how effectively fans and heatsinks remove energy from the boundaries of your chip design.',
  },
  {
    num: '04',
    title: '3D Substrate Conduction',
    desc: 'Heat doesn\'t only move sideways. We model the vertical thermal resistance down through the package and substrate, which is essential for catching hidden hotspots in modern 2.5D/3D architectures.',
  },
  {
    num: '05',
    title: 'Dynamic & Static Power',
    desc: 'A chip’s heat profile changes based on its clock speed, voltage, and workload. We merge switching activity with static leakage to create a holistic, real-world power profile for every block.',
  },
  {
    num: '06',
    title: 'IR Drop Analysis',
    desc: 'Voltage drops across long wires can starve components of power, causing unexpected localized heating. We overlay voltage drop maps directly onto your thermal grid.',
  },
  {
    num: '07',
    title: 'Electromigration Risk (MTTF)',
    desc: 'Extreme temperatures and high currents literally move metal atoms over time, degrading the chip. We flag components that are at high risk of early failure, ensuring tape-out reliability.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Design Your Chip',
    desc: 'Drag CPU cores, GPU clusters, memory controllers, and I/O blocks onto a 16×16 grid canvas. Configure substrate material, fan speed, and ambient temperature.',
    icon: '/>',
  },
  {
    num: '02',
    title: 'Run Physics Simulation',
    desc: 'Our PINN solver applies 7 physics laws simultaneously — Fourier heat equation, Joule heating, IR drop, electromigration risk — converging to a steady-state thermal map.',
    icon: '{...}',
  },
  {
    num: '03',
    title: 'Analyze & Optimize',
    desc: 'Inspect thermal hotspots in 3D, review violation reports, track your Physics Score, and iterate until you achieve tape-out-ready thermal characteristics.',
    icon: '[]',
  },
];

export default function Landing() {
  return (
    <div style={{ background: '#20252b', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* HERO SECTION - HUD STYLE */}
      <section style={{ height: '100vh', width: '100vw', position: 'relative' }}>
        
        {/* Top Left */}
        <div style={{ position: 'absolute', top: '5%', left: '5%', color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <div style={{ fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: 500 }}>CHIPPULSE©</div>
          <div style={{ fontSize: 'clamp(10px, 1vw, 14px)', marginTop: 8, letterSpacing: '0.25em', paddingLeft: 4 }}>RESEARCH</div>
        </div>

        {/* Top Right */}
        <div style={{ position: 'absolute', top: '5%', right: '5%', color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'right', fontSize: 'clamp(12px, 1.2vw, 16px)', lineHeight: 1.6 }}>
          COMPUTATIONALLY<br/>
          DEMANDING<br/>
          SIMULATIONS
        </div>

        {/* Center Main Text */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', textAlign: 'center' }}>
          <div style={{ color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', fontSize: 'clamp(40px, 8vw, 120px)', fontWeight: 400, letterSpacing: '0.15em', margin: 0, lineHeight: 1 }}>
            CHIPPULSE
          </div>
          <Link to="/login">
            <div style={{ display: 'inline-block', marginTop: '6vh', padding: '16px 40px', border: '1px solid rgba(201,196,165,0.4)', color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer', transition: 'all 0.3s' }}
                 onMouseOver={(e) => { e.currentTarget.style.background = '#c9c4a5'; e.currentTarget.style.color = '#20252b'; }}
                 onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9c4a5'; }}>
              INITIALIZE WORKSPACE
            </div>
          </Link>
        </div>

        {/* Bottom Left */}
        <div style={{ position: 'absolute', bottom: '5%', left: '5%', color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 'clamp(12px, 1.2vw, 16px)', lineHeight: 1.6 }}>
          PREDICTIVE THERMAL<br/>
          STABILITY<br/>
          &amp; RESILIENCE<br/>
          OF SILICON PROTOCOL
        </div>

        {/* Bottom Right */}
        <div style={{ position: 'absolute', bottom: '5%', right: '5%', display: 'flex', alignItems: 'flex-end', gap: 24 }}>
          {/* HUD Graphic */}
          <div style={{ position: 'relative', width: 120, height: 60, marginBottom: 8, display: 'none', '@media (minWidth: 768px)': { display: 'block' } }}>
            <svg width="100%" height="100%" viewBox="0 0 120 60">
              <path d="M 0,55 L 40,55 L 100,5 L 120,5" fill="none" stroke="#c9c4a5" strokeWidth="1.5" />
              <circle cx="120" cy="5" r="3" fill="none" stroke="#c9c4a5" strokeWidth="1.5" />
              {/* Box around text */}
              <rect x="0" y="35" width="40" height="24" rx="4" fill="none" stroke="#c9c4a5" strokeWidth="1" />
              <text x="20" y="51" fill="#c9c4a5" fontSize="10" fontFamily="Orbitron" textAnchor="middle" letterSpacing="0.1em">SIM</text>
            </svg>
          </div>
          <div style={{ color: '#c9c4a5', fontFamily: '"Orbitron", sans-serif', textTransform: 'uppercase', textAlign: 'right' }}>
            <div style={{ fontSize: 'clamp(24px, 3vw, 40px)', letterSpacing: '0.1em', fontWeight: 400 }}>7 LAWS</div>
            <div style={{ fontSize: 'clamp(10px, 1vw, 14px)', letterSpacing: '0.25em', marginTop: 4 }}>THEOREM</div>
          </div>
        </div>
      </section>

      {/* 7 LAWS SECTION */}
      <section id="laws" style={{
        padding: '100px 24px',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 16px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 20, fontSize: 12, color: '#f59e0b',
            marginBottom: 16,
          }}>
            PHYSICS ENGINE
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, marginBottom: 16 }}>
            <span style={{
              background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>The 7 Laws of ChipPulse</span>
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
            Every simulation runs all 7 equations simultaneously, coupled and non-linear.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {LAWS.map((law, i) => {
            const accents = ['#ef4444','#6366f1','#22d3ee','#10b981','#f59e0b','#f97316','#a78bfa'];
            const accent = accents[i % accents.length];
            return (
              <motion.div key={law.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${accent}25`,
                  borderRadius: 16,
                  padding: '24px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'default',
                  boxShadow: `var(--shadow-md)`,
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}66)` }} />
                <div style={{ position: 'absolute', top: 8, right: 14, fontSize: 52, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: `${accent}10`, lineHeight: 1, userSelect: 'none' }}>{law.num}</div>
                <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: accent, background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 20, padding: '2px 10px', letterSpacing: '0.08em', marginBottom: 8 }}>LAW {law.num}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{law.title}</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0 }}>{law.desc}</p>
              </motion.div>
            );
          })}
        </div>

      </section>

      {/* HOW IT WORKS */}
      <section style={{
        padding: '100px 24px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, marginBottom: 12 }}>
              <span style={{
                background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>How It Works</span>
            </h2>
            <p style={{ color: '#475569', fontSize: 16 }}>From layout to tape-out confidence in three steps</p>
          </div>

          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 260 }}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 16, padding: '28px 24px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 12 }}>{step.icon}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)',
                    letterSpacing: '0.1em', marginBottom: 8,
                  }}>STEP {step.num}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>{step.title}</div>
                  <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>{step.desc}</p>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div style={{ padding: '0 12px', color: '#6366f1', fontSize: 24, flexShrink: 0 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY TRUST US */}
      <section style={{
        padding: '100px 24px',
        maxWidth: 1000, margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 16px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 20, fontSize: 12, color: '#10b981',
            marginBottom: 16,
          }}>
            VERIFIED ACCURACY
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, marginBottom: 16 }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Why Trust ChipPulse?</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7 }}>
            ChipPulse AI isn't just a visualization tool—it's a rigorous computational engine. We solve the exact same non-linear Partial Differential Equations (PDEs) used by industry-standard multi-physics solvers like Ansys and COMSOL.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>True FDM Solver</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>We use a Gauss-Seidel Finite Difference Method (FDM) to compute steady-state thermal diffusion, iterating until residual convergence is achieved.</p>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>Material Science</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>Thermal conductivity isn't a static number. We accurately model temperature-dependent properties (k(T)) for Silicon, GaAs, SiC, and Diamond.</p>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>No Black Boxes</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>While our AI provides actionable insights and suggestions, the core thermal map is always derived from rigorous, proven thermodynamic laws.</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '120px 24px', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, marginBottom: 20 }}>
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #818cf8, #22d3ee)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Start Simulating Today</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
            No installation. No license fees. Just physics-accurate thermal simulation
            running in your browser.
          </p>
          <Link to="/login">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(99,102,241,0.6)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '20px 56px', fontSize: 18, fontWeight: 700,
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none', borderRadius: 14, color: 'white',
                boxShadow: '0 0 40px rgba(37,99,235,0.3)',
                cursor: 'pointer', letterSpacing: '0.02em',
              }}
            >
              Launch Workspace →
            </motion.button>
          </Link>
          <div style={{ marginTop: 24, fontSize: 13, color: '#475569' }}>
            Free · No sign-up · Works offline after first load
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '24px',
        borderTop: '1px solid rgba(99,102,241,0.08)',
        textAlign: 'center',
        fontSize: 12, color: '#475569',
      }}>
        ChipPulse AI · Physics-Informed EDA Simulation · Built with ❤️ for semiconductor engineers
      </footer>
    </div>
  );
}
