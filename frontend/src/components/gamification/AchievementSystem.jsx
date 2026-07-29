import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGamificationStore } from '../../store/gamificationStore';

export default function AchievementSystem() {
  const { pendingToasts, dismissToast } = useGamificationStore();

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 12,
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {pendingToasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        pointerEvents: 'all',
        background: 'rgba(26,29,46,0.95)',
        border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 12,
        padding: '14px 18px',
        minWidth: 280,
        maxWidth: 360,
        boxShadow: '0 0 24px rgba(245,158,11,0.15)',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>🏆</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b' }}>Achievement Unlocked!</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', marginTop: 2 }}>{toast.label}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{toast.desc}</div>
        </div>
      </div>
    </motion.div>
  );
}
