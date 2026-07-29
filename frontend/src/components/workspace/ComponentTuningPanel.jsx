import { useState, useEffect } from 'react';
import { useChipStore } from '../../store/chipStore';

export default function ComponentTuningPanel() {
  const { placedComponents, selectedPlacedId, updateComponentTuning, COMPONENT_DEFAULTS, removeComponent, rotateComponent } = useChipStore();
  const component = placedComponents.find(c => c.id === selectedPlacedId);

  const [voltage, setVoltage] = useState(1.0);
  const [freq, setFreq] = useState(2.0);
  const [power, setPower] = useState(50);
  const [isManualPower, setIsManualPower] = useState(false);
  const defaults = COMPONENT_DEFAULTS[component?.type] || { power_mW: 50, voltage_V: 1.0, freq_GHz: 1.0 };

  // Sync local state when a new component is selected
  useEffect(() => {
    if (component) {
      setVoltage(component.voltage_V || defaults.voltage_V);
      setFreq(component.freq_GHz || defaults.freq_GHz);
      
      const currentPower = component.power_mW || defaults.power_mW;
      setPower(currentPower);
      
      const calcC = defaults.power_mW / (Math.pow(defaults.voltage_V, 2) * defaults.freq_GHz);
      const calcP = Math.round(calcC * Math.pow(component.voltage_V || defaults.voltage_V, 2) * (component.freq_GHz || defaults.freq_GHz));
      setIsManualPower(currentPower !== calcP);
    }
  }, [component?.id]); // Only re-run when the selected ID changes

  // Auto-calculate power when voltage/freq change
  useEffect(() => {
    if (!isManualPower) {
      const C = defaults.power_mW / (Math.pow(defaults.voltage_V, 2) * defaults.freq_GHz);
      setPower(Math.round(C * Math.pow(voltage, 2) * freq));
    }
  }, [voltage, freq, isManualPower, defaults]);

  if (!component) return null;

  const handleApply = () => {
    updateComponentTuning(component.id, voltage, freq, power);
  };

  const isOverclocked = power > defaults.power_mW * 1.2;

  return (
    <>
      {/* Invisible backdrop to dismiss panel when clicking outside (e.g. on canvas) */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: -1 }} 
        onClick={() => useChipStore.getState().selectPlaced(null)}
      />
      <div style={{
        width: 280,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: '16px',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-lg), 0 0 40px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: component.color }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{component.label} Tuning</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{component.x}, {component.y} • {component.width}x{component.height} cells</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Core Voltage (V)</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-primary)' }}>{voltage.toFixed(2)} V</span>
        </div>
        <input 
          type="range" 
          min={0.6} max={2.0} step={0.05} 
          value={voltage}
          onChange={(e) => setVoltage(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          <span>0.6V</span>
          <span>Default: {defaults.voltage_V}V</span>
          <span>2.0V</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Clock Frequency (GHz)</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-primary)' }}>{freq.toFixed(1)} GHz</span>
        </div>
        <input 
          type="range" 
          min={0.1} max={6.0} step={0.1} 
          value={freq}
          onChange={(e) => setFreq(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          <span>0.1</span>
          <span>Default: {defaults.freq_GHz}</span>
          <span>6.0</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Power (mW)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isManualPower && (
              <button 
                onClick={() => setIsManualPower(false)}
                style={{ 
                  background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, 
                  color: 'var(--text-muted)', fontSize: 10, padding: '2px 6px', cursor: 'pointer' 
                }}
              >
                Auto
              </button>
            )}
            <span style={{ fontFamily: 'JetBrains Mono', color: isOverclocked ? 'var(--thermal-hot)' : 'var(--text-primary)' }}>
              {power} mW
            </span>
          </div>
        </div>
        <input 
          type="range" 
          min={10} max={2000} step={10} 
          value={power}
          onChange={(e) => {
            setPower(parseInt(e.target.value, 10));
            setIsManualPower(true);
          }}
          style={{ width: '100%', accentColor: isOverclocked ? 'var(--thermal-hot)' : 'var(--accent-primary)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          <span>10mW</span>
          <span>Default: {defaults.power_mW}mW</span>
          <span>2000mW</span>
        </div>
      </div>

          <button 
            onClick={handleApply}
            style={{ 
              width: '100%', padding: '10px', 
              background: 'linear-gradient(135deg, var(--accent-emerald), #22c55e)',
              border: 'none', borderRadius: 8, 
              color: '#000', fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)',
              marginBottom: '10px'
            }}
          >
            Apply Tuning
          </button>
          
          <button 
            onClick={() => rotateComponent(component.id)}
            style={{ 
              width: '100%', padding: '10px', 
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)', 
              borderRadius: 8, 
              color: 'var(--accent-violet)', fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Rotate Component
          </button>
          
          <button 
            onClick={() => removeComponent(component.id)}
            style={{ 
              width: '100%', padding: '10px', 
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              borderRadius: 8, 
              color: 'var(--accent-rose)', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Delete Component
          </button>
      </div>
    </>
  );
}
