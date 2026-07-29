import { create } from 'zustand';

const COMPONENT_DEFAULTS = {
  cpu_core:               { power_mW: 250, voltage_V: 1.2, freq_GHz: 3.2, switching_activity: 0.3, color: '#ef4444', label: 'CPU Core',     width: 2, height: 2 },
  gpu_cluster:            { power_mW: 180, voltage_V: 1.1, freq_GHz: 2.4, switching_activity: 0.5, color: '#fb923c', label: 'GPU Cluster',  width: 3, height: 2 },
  mem_ctrl:               { power_mW: 80,  voltage_V: 1.0, freq_GHz: 1.6, switching_activity: 0.2, color: '#f59e0b', label: 'Mem Ctrl',     width: 2, height: 1 },
  cache_sram:             { power_mW: 50,  voltage_V: 0.9, freq_GHz: 3.2, switching_activity: 0.1, color: '#22d3ee', label: 'Cache SRAM',   width: 2, height: 2 },
  npu_accelerator:        { power_mW: 220, voltage_V: 1.1, freq_GHz: 2.0, switching_activity: 0.4, color: '#a855f7', label: 'NPU Engine',   width: 3, height: 2 },
  image_signal_processor: { power_mW: 130, voltage_V: 1.1, freq_GHz: 1.5, switching_activity: 0.3, color: '#ec4899', label: 'ISP Core',     width: 2, height: 2 },
  media_engine:           { power_mW: 70,  voltage_V: 1.0, freq_GHz: 1.2, switching_activity: 0.2, color: '#14b8a6', label: 'Video Codec',  width: 2, height: 1 },
  io_ctrl:                { power_mW: 30,  voltage_V: 1.8, freq_GHz: 0.8, switching_activity: 0.4, color: '#06b6d4', label: 'I/O Ctrl',     width: 2, height: 1 },
  wireless_modem:         { power_mW: 140, voltage_V: 1.2, freq_GHz: 0.8, switching_activity: 0.3, color: '#64748b', label: 'Radio Subsys', width: 3, height: 2 },
  secure_enclave:         { power_mW: 15,  voltage_V: 1.0, freq_GHz: 1.0, switching_activity: 0.1, color: '#475569', label: 'Secure Enc',   width: 1, height: 1 },
  pmu:                    { power_mW: 20,  voltage_V: 3.3, freq_GHz: 0.1, switching_activity: 0.1, color: '#818cf8', label: 'PMU',          width: 1, height: 1 },
  clock_pll:              { power_mW: 12,  voltage_V: 1.8, freq_GHz: 4.0, switching_activity: 0.5, color: '#f43f5e', label: 'Clock PLL',    width: 1, height: 1 },
  bus_fabric:             { power_mW: 45,  voltage_V: 1.0, freq_GHz: 1.8, switching_activity: 0.4, color: '#6366f1', label: 'Bus Fabric',   width: 2, height: 1 }
};

// Default chip layout shown on first launch & after Clear Chip
export const DEFAULT_LAYOUT = [
  { id: 'cpu_core-default-0', type: 'cpu_core',    x: 2,  y: 2,  ...COMPONENT_DEFAULTS.cpu_core },
  { id: 'cpu_core-default-1', type: 'cpu_core',    x: 5,  y: 2,  ...COMPONENT_DEFAULTS.cpu_core },
  { id: 'gpu_cluster-default',type: 'gpu_cluster', x: 8,  y: 2,  ...COMPONENT_DEFAULTS.gpu_cluster },
  { id: 'mem_ctrl-default-0', type: 'mem_ctrl',    x: 2,  y: 6,  ...COMPONENT_DEFAULTS.mem_ctrl },
  { id: 'mem_ctrl-default-1', type: 'mem_ctrl',    x: 5,  y: 6,  ...COMPONENT_DEFAULTS.mem_ctrl },
  { id: 'cache_sram-default', type: 'cache_sram',  x: 8,  y: 6,  ...COMPONENT_DEFAULTS.cache_sram },
  { id: 'io_ctrl-default',    type: 'io_ctrl',     x: 2,  y: 9,  ...COMPONENT_DEFAULTS.io_ctrl },
  { id: 'pmu-default',        type: 'pmu',         x: 5,  y: 9,  ...COMPONENT_DEFAULTS.pmu },
];

// Build occupied-cell set from a component list (for collision detection)
function buildOccupied(components) {
  const set = new Set();
  components.forEach(({ x, y, width, height }) => {
    for (let dy = 0; dy < height; dy++)
      for (let dx = 0; dx < width; dx++)
        set.add(`${x + dx},${y + dy}`);
  });
  return set;
}

export const useChipStore = create((set, get) => ({
  placedComponents: DEFAULT_LAYOUT,
  selectedType: null,
  selectedPlacedId: null,   // which placed component is "focused" for removal
  material: 'silicon',
  fanSpeedRpm: 2000,
  ambientTempC: 25,
  maxIterations: 500,
  convergenceDelta: 0.01,
  COMPONENT_DEFAULTS,

  setSelectedType: (type) => set({ selectedType: type, selectedPlacedId: null }),

  // Select a placed component (for removal)
  selectPlaced: (id) => set((s) => ({
    selectedPlacedId: s.selectedPlacedId === id ? null : id,
    selectedType: null,  // deselect palette when picking a placed comp
  })),

  // Place with full collision detection
  placeComponent: (x, y) => {
    const { selectedType, placedComponents } = get();
    if (!selectedType) return;
    const defaults = COMPONENT_DEFAULTS[selectedType];
    // Check if any cell in the footprint is occupied
    const occupied = buildOccupied(placedComponents);
    for (let dy = 0; dy < defaults.height; dy++) {
      for (let dx = 0; dx < defaults.width; dx++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return; // collision — abort silently
      }
    }
    // Also check grid bounds
    if (x + defaults.width > 16 || y + defaults.height > 16) return;
    const id = `${selectedType}-${Date.now()}`;
    set({ placedComponents: [...placedComponents, { id, type: selectedType, x, y, ...defaults }] });
  },

  removeComponent: (id) => set((s) => ({
    placedComponents: s.placedComponents.filter((c) => c.id !== id),
    selectedPlacedId: s.selectedPlacedId === id ? null : s.selectedPlacedId,
  })),

  rotateComponent: (id) => set((s) => {
    const compIndex = s.placedComponents.findIndex(c => c.id === id);
    if (compIndex === -1) return s;
    const comp = s.placedComponents[compIndex];
    
    const newWidth = comp.height;
    const newHeight = comp.width;
    
    if (comp.x + newWidth > 16 || comp.y + newHeight > 16) return s;
    
    const others = s.placedComponents.filter(c => c.id !== id);
    const occupied = buildOccupied(others);
    
    for (let dy = 0; dy < newHeight; dy++) {
      for (let dx = 0; dx < newWidth; dx++) {
        if (occupied.has(`${comp.x + dx},${comp.y + dy}`)) return s;
      }
    }
    
    const nextComps = [...s.placedComponents];
    nextComps[compIndex] = { ...comp, width: newWidth, height: newHeight };
    return { placedComponents: nextComps };
  }),

  updateComponentTuning: (id, voltage_V, freq_GHz, power_mW) => set((s) => {
    return {
      placedComponents: s.placedComponents.map(c => {
        if (c.id !== id) return c;
        // Dynamic power formula: P = C * V^2 * f
        // We estimate C (capacitance + switching factor) from the default power:
        // default_P = C * default_V^2 * default_f => C = default_P / (default_V^2 * default_f)
        const def = COMPONENT_DEFAULTS[c.type];
        const C = def.power_mW / (Math.pow(def.voltage_V, 2) * def.freq_GHz);
        const calcPower = Math.round(C * Math.pow(voltage_V, 2) * freq_GHz);
        const finalPower = power_mW !== undefined ? power_mW : calcPower;
        
        return { ...c, voltage_V, freq_GHz, power_mW: finalPower };
      })
    };
  }),

  // Clear → completely empty the board
  clearBoard: () => set({ placedComponents: [], selectedType: null, selectedPlacedId: null }),

  setMaterial: (m) => set({ material: m }),
  setFanSpeed: (rpm) => set({ fanSpeedRpm: rpm }),
  setAmbientTemp: (t) => set({ ambientTempC: t }),
  setMaxIterations: (v) => set({ maxIterations: v }),
  setConvergenceDelta: (v) => set({ convergenceDelta: v }),

  // Random layout with collision detection (and caller resets simulation)
  randomLayout: () => {
    const types = Object.keys(COMPONENT_DEFAULTS);
    const components = [];
    const occupied = new Set();
    // One of each type, in a reasonable order
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const defaults = COMPONENT_DEFAULTS[type];
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = Math.floor(Math.random() * (16 - defaults.width));
        const y = Math.floor(Math.random() * (16 - defaults.height));
        const cells = [];
        let ok = true;
        for (let dy = 0; dy < defaults.height && ok; dy++)
          for (let dx = 0; dx < defaults.width && ok; dx++) {
            const key = `${x + dx},${y + dy}`;
            if (occupied.has(key)) ok = false;
            else cells.push(key);
          }
        if (ok) {
          cells.forEach((k) => occupied.add(k));
          components.push({ id: `${type}-rand-${Date.now()}-${i}`, type, x, y, ...defaults });
          break;
        }
      }
    }
    set({ placedComponents: components, selectedType: null, selectedPlacedId: null });
  },

  // Load a saved layout (caller also resets simulation)
  loadLayout: (components) => {
    // Hydrate saved components with the latest defaults to ensure colors and new properties exist
    const hydrated = components.map(c => ({
      ...COMPONENT_DEFAULTS[c.type],
      ...c,
      color: COMPONENT_DEFAULTS[c.type]?.color || c.color // Force latest theme color
    }));
    set({
      placedComponents: hydrated,
      selectedType: null,
      selectedPlacedId: null,
    });
  },
}));
