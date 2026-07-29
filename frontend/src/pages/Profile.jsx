import { useState } from 'react';
import { useGamificationStore } from '../store/gamificationStore';
import { motion } from 'framer-motion';

const ALL_ACHIEVEMENTS = [
  { key: 'first_sim', label: 'First Simulation!', desc: 'Ran your first thermal simulation', icon: '🔥' },
  { key: 'cool_chip', label: 'Cool Chip!', desc: 'Max temp under 70°C', icon: '❄️' },
  { key: 'big_chip', label: 'Big Chip Designer', desc: 'Placed 5+ components', icon: '🧩' },
  { key: 'first_project', label: 'First Project!', desc: 'Saved your first chip design', icon: '💾' },
  { key: 'tape_out', label: 'Tape-Out Ready', desc: 'Export a PDF Validation Report', icon: '📄' },
  { key: 'physics_master', label: 'Physics Master', desc: 'Score over 900', icon: '👑' },
  { key: 'meltdown', label: 'Thermal Runaway', desc: 'Max temp exceeded 100°C', icon: '🌋' },
  { key: 'overclocker', label: 'Overclocker', desc: 'Maxed out fan speed', icon: '🌪️' },
  { key: 'material_scientist', label: 'Material Scientist', desc: 'Used an advanced PCB substrate', icon: '🔬' },
];

const LEVELS = [
  { min: 0,     label: 'Junior Engineer' },
  { min: 500,   label: 'Engineer' },
  { min: 1500,  label: 'Senior Engineer' },
  { min: 3500,  label: 'Staff Engineer' },
  { min: 7000,  label: 'Principal Engineer' },
  { min: 12000, label: 'Distinguished Fellow' },
];

export default function Profile() {
  const { username, avatarId, setAvatar, xp, level, nextLevelXP, achievements } = useGamificationStore();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const prevLevelXP = [...LEVELS].reverse().find((l) => xp >= l.min)?.min || 0;
  const progress = ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100;

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 48 }}>
        <div 
          onClick={() => setIsAvatarModalOpen(true)}
          style={{ 
            width: 90, height: 90, borderRadius: 24, 
            background: 'var(--bg-elevated)',
            boxShadow: '0 0 30px rgba(99,102,241,0.3)',
            position: 'relative', cursor: 'pointer', overflow: 'hidden',
            border: '2px solid var(--border-subtle)'
          }}
        >
          <img 
            src={`/avatars/${avatarId}.jpg`} 
            alt="avatar" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, 
            background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11,
            textAlign: 'center', padding: '4px 0', backdropFilter: 'blur(4px)'
          }}>
            EDIT
          </div>
        </div>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 32, fontFamily: 'Orbitron, sans-serif' }}>
            {username}
          </h1>
          <div style={{ 
            color: 'var(--accent-primary)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace',
            display: 'inline-block', padding: '4px 12px', background: 'rgba(99,102,241,0.1)',
            borderRadius: 6, border: '1px solid var(--accent-primary)'
          }}>
            {level}
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div style={{ 
        background: 'var(--bg-card)', padding: 24, borderRadius: 16, 
        border: '1px solid var(--border-subtle)', marginBottom: 48 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Current Progress</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)' }}>
            {xp} / {nextLevelXP} XP
          </span>
        </div>
        <div style={{ height: 12, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden' }}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: 6
            }}
          />
        </div>
      </div>

      {/* Achievements Grid */}
      <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, marginBottom: 24 }}>
        Achievements ({achievements.length} / {ALL_ACHIEVEMENTS.length})
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
        {ALL_ACHIEVEMENTS.map((ach) => {
          const isUnlocked = achievements.find(a => a.key === ach.key);
          
          return (
            <div key={ach.key} style={{
              background: isUnlocked ? 'var(--bg-card)' : 'var(--bg-tertiary)',
              border: `1px solid ${isUnlocked ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
              padding: 20, borderRadius: 12,
              opacity: isUnlocked ? 1 : 0.4,
              display: 'flex', flexDirection: 'column', gap: 12,
              boxShadow: isUnlocked ? '0 0 20px rgba(245,158,11,0.1)' : 'none',
              filter: isUnlocked ? 'none' : 'grayscale(100%)'
            }}>
              <div style={{ fontSize: 32 }}>{ach.icon}</div>
              <div>
                <div style={{ fontWeight: 600, color: isUnlocked ? 'var(--accent-gold)' : 'var(--text-primary)', marginBottom: 4 }}>
                  {ach.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {ach.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: 32, borderRadius: 24,
            border: '1px solid var(--border-subtle)', width: 500, maxWidth: '90%'
          }}>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', marginTop: 0, marginBottom: 24 }}>Select Avatar</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {['hacker', 'robot', 'core', 'ninja'].map((id) => (
                <div 
                  key={id}
                  onClick={() => { setAvatar(id); setIsAvatarModalOpen(false); }}
                  style={{
                    borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                    border: `3px solid ${avatarId === id ? 'var(--accent-primary)' : 'transparent'}`,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img src={`/avatars/${id}.jpg`} alt={id} style={{ width: '100%', display: 'block' }} />
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsAvatarModalOpen(false)}
              style={{
                marginTop: 24, width: '100%', padding: '12px', borderRadius: 8,
                background: 'var(--bg-elevated)', color: 'white', border: '1px solid var(--border-subtle)',
                cursor: 'pointer', fontFamily: 'Orbitron, sans-serif'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
