import { create } from 'zustand';

// Much wider XP thresholds — 10 simulations per level minimum
const LEVELS = [
  { min: 0,     label: 'Junior Engineer' },
  { min: 500,   label: 'Engineer' },
  { min: 1500,  label: 'Senior Engineer' },
  { min: 3500,  label: 'Staff Engineer' },
  { min: 7000,  label: 'Principal Engineer' },
  { min: 12000, label: 'Distinguished Fellow' },
];

const getLevel = (xp) => [...LEVELS].reverse().find((l) => xp >= l.min)?.label || 'Junior Engineer';
const getNextLevelXP = (xp) => LEVELS.find((l) => l.min > xp)?.min || 15000;

export const useGamificationStore = create((set, get) => ({
  username: 'Gangman',
  avatarId: 'hacker',
  xp: 0,
  level: 'Junior Engineer',
  nextLevelXP: 500,
  achievements: [],
  
  setUsername: (name) => set({ username: name }),
  setAvatar: (id) => set({ avatarId: id }),
  pendingToasts: [],
  sessionId: (() => {
    const stored = localStorage.getItem('chippulse_session');
    if (stored) return stored;
    const id = crypto.randomUUID().slice(0, 8);   // short 8-char ID for display
    localStorage.setItem('chippulse_session', id);
    return id;
  })(),

  addXP: (amount) => {
    const prev = get().xp;
    const newXP = prev + amount;
    const prevLevel = getLevel(prev);
    const newLevel  = getLevel(newXP);
    const leveledUp = newLevel !== prevLevel;
    set({ xp: newXP, level: newLevel, nextLevelXP: getNextLevelXP(newXP) });
    // Level-up toast
    if (leveledUp) {
      set((s) => ({
        pendingToasts: [...s.pendingToasts, {
          key: `levelup-${newLevel}`,
          label: `Level Up! ${newLevel}`,
          desc: `You reached ${newLevel}`,
          id: Date.now(),
          isLevelUp: true,
        }],
      }));
    }
  },

  unlockAchievement: (key, label, desc, xpBonus = 0) => {
    if (get().achievements.find((a) => a.key === key)) return;
    const newXP = get().xp + xpBonus;
    set((s) => ({
      achievements: [...s.achievements, { key, label, desc, unlockedAt: new Date() }],
      pendingToasts: [...s.pendingToasts, { key, label, desc, id: Date.now() }],
      xp: newXP,
      level: getLevel(newXP),
      nextLevelXP: getNextLevelXP(newXP),
    }));
  },

  dismissToast: (id) => set((s) => ({ pendingToasts: s.pendingToasts.filter((t) => t.id !== id) })),
}));
