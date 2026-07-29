import { create } from 'zustand';
import { api } from '../services/api';

export const useSimulationStore = create((set, get) => ({
  isRunning: false,
  hasResult: false,
  thermalMap: null,
  irDropMap: null,
  emRiskMap: null,
  metrics: null,
  violations: null,
  history: [],
  runSimulation: async (layout, solverConfig, sessionId) => {
    set({ isRunning: true, hasResult: false });
    try {
      const { data } = await api.simulate({ session_id: sessionId, layout, solver_config: solverConfig });
      set({
        isRunning: false,
        hasResult: true,
        thermalMap: data.thermal_map,
        irDropMap: data.ir_drop_map,
        emRiskMap: data.em_risk_map,
        metrics: data.metrics,
        violations: data.violations,
        history: [data, ...get().history].slice(0, 20),
      });
      return data;
    } catch (e) {
      set({ isRunning: false });
      throw e;
    }
  },
  reset: () => set({ hasResult: false, thermalMap: null, metrics: null, violations: null }),
}));
