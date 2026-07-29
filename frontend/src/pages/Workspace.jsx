import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ComponentLibrary from '../components/workspace/ComponentLibrary';
import ChipCanvas3D from '../components/workspace/ChipCanvas3D';
import TelemetryPanel from '../components/workspace/TelemetryPanel';
import ComponentTuningPanel from '../components/workspace/ComponentTuningPanel';
import { useChipStore } from '../store/chipStore';
import { useSimulationStore } from '../store/simulationStore';
import { useGamificationStore } from '../store/gamificationStore';

// Helper — reset simulation state completely
function resetSim() {
  useSimulationStore.setState({
    isRunning: false,
    hasResult: false,
    thermalMap: null,
    irDropMap: null,
    emRiskMap: null,
    metrics: null,
    violations: null,
    // Keep history across clears so analytics stays populated
  });
}

// ─── Realistic mock FDM-style thermal propagation ─────────────────────────
function generateMockThermalMap(placedComponents, ambientTempC) {
  const GRID = 16;
  const map = Array.from({ length: GRID }, () => Array(GRID).fill(ambientTempC));

  // Add heat cumulatively so placing components together increases temperature
  const { COMPONENT_DEFAULTS } = useChipStore.getState();
  placedComponents.forEach(({ x, y, width, height, power_mW, type }) => {
    const p = power_mW || (COMPONENT_DEFAULTS[type]?.power_mW || 50);
    const heatAdded = (p / 250) * 75;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const r = y + dy, c = x + dx;
        if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
          map[r][c] += heatAdded + (Math.random() - 0.5) * 4;
        }
      }
    }
  });

  // Apply a 2D diffusion blur (simulating Fourier heat transfer)
  for (let iter = 0; iter < 4; iter++) {
    const newMap = map.map(row => [...row]);
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        let sum = map[r][c] * 2; // Center weight
        let count = 2;
        if (r > 0) { sum += map[r-1][c]; count++; }
        if (r < GRID - 1) { sum += map[r+1][c]; count++; }
        if (c > 0) { sum += map[r][c-1]; count++; }
        if (c < GRID - 1) { sum += map[r][c+1]; count++; }
        
        // Very basic diffusion mixing with ambient cooling
        newMap[r][c] = (sum / count) * 0.98 + (ambientTempC * 0.02);
      }
    }
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
         map[r][c] = newMap[r][c];
      }
    }
  }

  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      map[r][c] = Math.max(ambientTempC, parseFloat(Math.min(150, map[r][c]).toFixed(2)));

  return map;
}

export default function Workspace() {
  const {
    placedComponents, material, fanSpeedRpm, ambientTempC,
    maxIterations, convergenceDelta,
    clearBoard, randomLayout, optimizeLayout, selectedPlacedId,
  } = useChipStore();
  const { runSimulation, isRunning, hasResult } = useSimulationStore();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const { username, addXP, unlockAchievement } = useGamificationStore();

  // Clear → restore default layout AND reset simulation
  const handleClear = useCallback(() => {
    clearBoard();
    resetSim();
  }, [clearBoard]);

  // Random → new layout AND reset simulation
  const handleRandom = useCallback(() => {
    randomLayout();
    resetSim();
  }, [randomLayout]);

  // Optimize → new layout AND reset simulation
  const handleOptimize = useCallback(() => {
    optimizeLayout();
    resetSim();
  }, [optimizeLayout]);

  const handleRunSimulation = useCallback(async () => {
    if (isRunning || placedComponents.length === 0) return;
    useSimulationStore.setState({ isRunning: true, hasResult: false });

    const layout = {
      grid_size: 16,
      components: placedComponents.map((c) => ({
        id: c.id, type: c.type,
        x: c.x, y: c.y,
        width: c.width, height: c.height,
        power_mW: c.power_mW,
        voltage_V: c.voltage_V,
        freq_GHz: c.freq_GHz,
        switching_activity: c.switching_activity,
      })),
      material,
      fan_speed_rpm: fanSpeedRpm,
      ambient_temp_c: ambientTempC,
    };
    const solverConfig = { max_iterations: maxIterations, convergence_delta: convergenceDelta };

    try {
      await runSimulation(layout, solverConfig, username);
      addXP(20);
      if (placedComponents.length >= 5)
        unlockAchievement('big_chip', 'Big Chip Designer', 'Placed 5+ components', 50);
    } catch (err) {
      console.warn('API unavailable, using mock simulation:', err.message);

      const thermalMap = generateMockThermalMap(placedComponents, ambientTempC);
      const allTemps   = thermalMap.flat();
      const maxTemp    = parseFloat(Math.max(...allTemps).toFixed(1));
      const minTemp    = parseFloat(Math.min(...allTemps).toFixed(1));
      const avgTemp    = parseFloat((allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1));
      const totalPowerW = placedComponents.reduce((s, c) => {
        const p = c.power_mW ?? (useChipStore.getState().COMPONENT_DEFAULTS[c.type]?.power_mW || 50);
        return s + p;
      }, 0) / 1000;
      const iters      = Math.floor(Math.random() * maxIterations * 0.6) + 60;
      const physicsScore = Math.round(Math.max(300, Math.min(980, 1000 - (maxTemp - ambientTempC) * 3)));

      // Compute IR drop info per component for TelemetryPanel
      const R_wire = 0.05;
      const center = 8;
      const irDetails = placedComponents.map((c) => {
        const dist = (Math.abs(c.x - center) + Math.abs(c.y - center)) * R_wire;
        const p = c.power_mW ?? (useChipStore.getState().COMPONENT_DEFAULTS[c.type]?.power_mW || 50);
        const v = c.voltage_V ?? (useChipStore.getState().COMPONENT_DEFAULTS[c.type]?.voltage_V || 1.0);
        const I = p / 1000 / v;
        const vDrop = parseFloat((I * dist).toFixed(4));
        const rHeat = parseFloat((vDrop * I * 1000).toFixed(2)); // mW from IR drop
        return { id: c.id, label: c.label, vDrop, I: parseFloat(I.toFixed(4)), rHeat };
      });

      const mockMetrics = {
        max_temp_C:             maxTemp,
        avg_temp_C:             avgTemp,
        min_temp_C:             minTemp,
        total_power_W:          parseFloat(totalPowerW.toFixed(4)),
        physics_score:          physicsScore,
        convergence_iterations: iters,
        solver_time_ms:         Math.round(Math.random() * 200 + 80),
        laws_applied:           ['joule_heating','fourier_nonlinear','robin_bc','z_axis_conduction','dynamic_static_power','ir_drop','black_equation'],
        ir_details:             irDetails,
        convection_h:           fanSpeedRpm < 1000 ? 5 : fanSpeedRpm < 2000 ? 25 : fanSpeedRpm < 3000 ? 45 : 65,
        fan_speed_rpm:          fanSpeedRpm,
        ambient_temp_C:         ambientTempC,
      };

      const mockViolations = {
        thermal_throttle: maxTemp > 95 ? [{ x: 4, y: 4, temp_C: maxTemp }] : [],
        electromigration:  [],
      };

      const mockResult = {
        simulation_id: crypto.randomUUID(),
        thermal_map:   thermalMap,
        ir_drop_map:   null,
        em_risk_map:   null,
        metrics:       mockMetrics,
        violations:    mockViolations,
      };

      useSimulationStore.setState((s) => ({
        isRunning:  false,
        hasResult:  true,
        thermalMap,
        irDropMap:  null,
        emRiskMap:  null,
        metrics:    mockMetrics,
        violations: mockViolations,
        history:    [mockResult, ...s.history].slice(0, 20),
      }));

      addXP(15);
      if (placedComponents.length >= 5)
        unlockAchievement('big_chip', 'Big Chip Designer', 'Placed 5+ components', 50);
      if (useSimulationStore.getState().history.length === 1)
        unlockAchievement('first_sim', 'First Simulation!', 'Ran your first thermal simulation', 30);
    }
  }, [isRunning, placedComponents, material, fanSpeedRpm, ambientTempC, maxIterations, convergenceDelta, username, runSimulation, addXP, unlockAchievement]);

  const handleClearResults = useCallback(() => {
    useSimulationStore.getState().reset();
  }, []);

  const handleSaveLayout = useCallback(() => {
    if (placedComponents.length === 0) return alert('No components to save!');
    localStorage.setItem('chippulse_saved_layout', JSON.stringify(placedComponents));
    alert('Layout saved successfully!');
  }, [placedComponents]);

  const handleLoadLayout = useCallback(() => {
    const saved = localStorage.getItem('chippulse_saved_layout');
    if (saved) {
      useSimulationStore.getState().reset();
      useChipStore.getState().loadLayout(JSON.parse(saved));
    } else {
      alert('No saved layout found.');
    }
  }, []);

  return (
    <div style={{ height: 'calc(100vh - 56px)', position: 'relative', overflow: 'hidden', background: '#02040a' }}>
      {/* Background 3D World */}
      <ChipCanvas3D />
      
      {/* Floating Component Library HUD */}
      <motion.div 
        initial={false}
        animate={{ x: leftPanelOpen ? 0 : -296 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ position: 'absolute', top: 16, left: 16, bottom: 16, zIndex: 50, pointerEvents: 'none', display: 'flex' }}
      >
        <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
          <ComponentLibrary
            onRunSimulation={handleRunSimulation}
            onClear={handleClear}
            onRandom={handleRandom}
            onClearResults={handleClearResults}
            onSave={handleSaveLayout}
            onLoad={handleLoadLayout}
            hasResult={hasResult}
          />
          {/* Toggle Button */}
          <div 
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            style={{ 
              position: 'absolute', right: -32, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 64, background: '#1a1a1a', 
              border: '1px solid #333', borderLeft: 'none',
              borderRadius: '0 12px 12px 0', cursor: 'pointer', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', fontSize: 18, boxShadow: '4px 0 15px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {leftPanelOpen ? '‹' : '›'}
          </div>
        </div>
      </motion.div>

      {/* Floating Tuning Panel (shows up when a component is clicked in edit mode) */}
      {!isRunning && !hasResult && selectedPlacedId && leftPanelOpen && (
        <div style={{ position: 'absolute', top: 24, left: 340, zIndex: 10 }}>
          <ComponentTuningPanel />
        </div>
      )}

      {/* Floating Telemetry HUD */}
      <motion.div 
        initial={false}
        animate={{ x: rightPanelOpen ? 0 : 316 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ position: 'absolute', top: 16, right: 16, bottom: 16, zIndex: 50, pointerEvents: 'none', display: 'flex' }}
      >
        <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
          {/* Toggle Button */}
          <div 
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            style={{ 
              position: 'absolute', left: -32, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 64, background: '#1a1a1a', 
              border: '1px solid #333', borderRight: 'none',
              borderRadius: '12px 0 0 12px', cursor: 'pointer', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', fontSize: 18, boxShadow: '-4px 0 15px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {rightPanelOpen ? '›' : '‹'}
          </div>
          <TelemetryPanel 
            onRunSimulation={handleRunSimulation} 
            onClearResults={handleClearResults} 
            hasResult={hasResult} 
          />
        </div>
      </motion.div>
    </div>
  );
}
