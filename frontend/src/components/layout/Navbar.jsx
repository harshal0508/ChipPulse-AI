import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGamificationStore } from '../../store/gamificationStore';
import { useThemeStore } from '../../store/themeStore';

export default function Navbar() {
  const location = useLocation();
  const { sessionId, username, avatarId, xp, level, nextLevelXP, achievements } = useGamificationStore();
  const { theme, toggleTheme } = useThemeStore();
  
  const LEVELS = [0, 100, 300, 600, 1000, 1500];
  const prevLevelXP = [...LEVELS].reverse().find((l) => xp > l) || 0;
  const progress = ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100;

  const links = [
    { to: '/workspace', label: 'Workspace' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/projects', label: 'Projects' },
  ];
  return (
    <nav style={{
      height: 56,
      background: 'var(--bg-card)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 32,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#c9c4a5" strokeWidth="1.5" />
          <rect x="8" y="8" width="3" height="3" fill="#c9c4a5" />
          <rect x="13" y="8" width="3" height="3" fill="#e6e2cc" />
          <rect x="8" y="13" width="3" height="3" fill="#e6e2cc" />
          <rect x="13" y="13" width="3" height="3" fill="#c9c4a5" />
          <line x1="6" y1="3" x2="6" y2="0" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="12" y1="3" x2="12" y2="0" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="18" y1="3" x2="18" y2="0" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="3" y1="6" x2="0" y2="6" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="3" y1="12" x2="0" y2="12" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="3" y1="18" x2="0" y2="18" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="6" y1="21" x2="6" y2="24" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="12" y1="21" x2="12" y2="24" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="18" y1="21" x2="18" y2="24" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="21" y1="6" x2="24" y2="6" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="21" y1="12" x2="24" y2="12" stroke="#c9c4a5" strokeWidth="1.5" />
          <line x1="21" y1="18" x2="24" y2="18" stroke="#c9c4a5" strokeWidth="1.5" />
        </svg>
        <span style={{
          fontFamily: '"Orbitron", sans-serif',
          fontWeight: 700, fontSize: 18,
          background: 'linear-gradient(135deg, #c9c4a5, #e6e2cc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>ChipPulse AI</span>
      </Link>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {links.map(({ to, label }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} style={{ position: 'relative', padding: '6px 14px', borderRadius: 6,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active ? 800 : 700, fontSize: 16,
              transition: 'color 0.2s', textDecoration: 'none'
            }}>
              {label}
              {active && (
                <motion.span
                  layoutId="navbar-underline"
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    borderRadius: 1,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Gamification Stats */}
        <Link to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, marginRight: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 200 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{xp} XP</div>
            <div style={{ flex: 1, height: 6, background: 'rgba(99,102,241,0.15)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(Math.max(progress, 0), 100)}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nextLevelXP} XP</div>
          </div>

          <div style={{
            padding: '4px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6, fontSize: 13, fontWeight: 600,
            color: 'var(--accent-primary)',
          }}>
            {level}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid var(--border-gold)',
            borderRadius: 6, fontSize: 13, color: 'var(--accent-gold)',
          }}>
            🏆 {achievements.length}
          </div>
        </Link>

        <button
          onClick={toggleTheme}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 4, borderRadius: '50%',
            transition: 'color 0.2s, background 0.2s'
          }}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '☀️' : '🌙'}
        </button>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-tertiary)', padding: '4px 12px 4px 4px', borderRadius: 20, fontSize: 12,
            color: 'var(--accent-secondary)',
            fontFamily: 'JetBrains Mono, monospace',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <img 
              src={`/avatars/${avatarId}.jpg`} 
              alt="avatar" 
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} 
            />
            {username || 'anonymous'}
          </div>
        </Link>
      </div>
    </nav>
  );
}
