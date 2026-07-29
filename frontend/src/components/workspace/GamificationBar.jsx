import { useGamificationStore } from '../../store/gamificationStore';

export default function GamificationBar() {
  const { xp, level, nextLevelXP, achievements } = useGamificationStore();
  const LEVELS = [0, 100, 300, 600, 1000, 1500];
  const prevLevelXP = [...LEVELS].reverse().find((l) => xp > l) || 0;
  const progress = ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100;

  return (
    <div style={{
      height: 44,
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 16, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--accent-primary)" strokeWidth="1.5" />
          <rect x="8" y="8" width="3" height="3" fill="var(--accent-primary)" />
          <rect x="13" y="13" width="3" height="3" fill="var(--accent-secondary)" />
        </svg>
        <span style={{
          fontFamily: '"Orbitron", sans-serif',
          fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>ChipPulse AI</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 300 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{xp} XP</div>
        <div style={{
          flex: 1, height: 6, background: 'rgba(99,102,241,0.15)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(Math.max(progress, 0), 100)}%`,
            background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
            borderRadius: 3,
            transition: 'width 0.5s ease',
            boxShadow: 'var(--shadow-glow)',
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{nextLevelXP} XP</div>
      </div>

      <div style={{
        padding: '3px 10px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.15))',
        border: '1px solid var(--border-subtle)',
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        color: 'var(--accent-primary)',
      }}>
        {level}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px',
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid var(--border-gold)',
        borderRadius: 20, fontSize: 12, color: 'var(--accent-gold)',
      }}>
        🏆 {achievements.length}
      </div>
    </div>
  );
}
