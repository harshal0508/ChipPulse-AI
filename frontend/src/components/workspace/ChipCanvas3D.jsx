import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, RoundedBox, Html, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useChipStore } from '../../store/chipStore';
import { useSimulationStore } from '../../store/simulationStore';
import { useThemeStore } from '../../store/themeStore';
import { tempToColor } from '../../utils/tempToColor';
import { askGeminiAI } from '../../utils/aiAdvisor';
const GRID_SIZE = 16;

// Material ↔️ substrate visual properties (distinct colors for visual feedback)
const getMaterialStyles = () => ({
  silicon:  { color: '#1e293b', roughness: 0.6, metalness: 0.8, clearcoat: 0.1, label: 'Silicon', badge: '#6366f1' }, // Metallic Slate
  gaas:     { color: '#b45309', roughness: 0.3, metalness: 0.9, clearcoat: 0.7, label: 'GaAs', badge: '#10b981' }, // Bright Metallic Bronze
  diamond:  { color: '#38bdf8', roughness: 0.1, metalness: 0.9, clearcoat: 1.0, label: 'Diamond', badge: '#a78bfa' }, // Bright Crystal Blue
  sic:      { color: '#10b981', roughness: 0.4, metalness: 0.8, clearcoat: 0.5, label: 'SiC', badge: '#f59e0b' }, // Bright Emerald
});

// 🟪 Substrate (material-aware) 🟪
function ChipSubstrate({ material }) {
  const styles = getMaterialStyles();
  const style = styles[material] || styles.silicon;
  return (
    <mesh position={[GRID_SIZE / 2, -0.1, GRID_SIZE / 2]} receiveShadow>
      <RoundedBox args={[GRID_SIZE, 0.2, GRID_SIZE]} radius={0.05} smoothness={4} receiveShadow>
        <meshPhysicalMaterial 
          color={style.color} 
          roughness={style.roughness} 
          metalness={style.metalness} 
          clearcoat={style.clearcoat} 
          transmission={style.transmission || 0}
          ior={style.ior || 1.5}
          thickness={0.5}
        />
      </RoundedBox>
    </mesh>
  );
}

// 🟪 Heatsink Layer 🟪
function ChipHeatsink() {
  return (
    <mesh position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]} receiveShadow castShadow>
      <RoundedBox args={[GRID_SIZE + 0.2, 0.4, GRID_SIZE + 0.2]} radius={0.05} smoothness={4} receiveShadow castShadow>
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </RoundedBox>
    </mesh>
  );
}

// 🔢 Grid Labels 🔢
function GridLabels({ isLight }) {
  const labels = [];
  const color = isLight ? '#64748b' : '#94a3b8'; // Adapts to theme
  
  // X axis labels
  for (let i = 0; i < GRID_SIZE; i++) {
    labels.push(
      <Text key={`x-${i}`} position={[i + 0.5, 0.12, GRID_SIZE + 0.4]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.35} color={color} anchorX="center" anchorY="middle">
        {i}
      </Text>
    );
  }
  // Z axis labels
  for (let i = 0; i < GRID_SIZE; i++) {
    labels.push(
      <Text key={`z-${i}`} position={[-0.4, 0.12, i + 0.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.35} color={color} anchorX="center" anchorY="middle">
        {i}
      </Text>
    );
  }
  return <>{labels}</>;
}

// 🟪 Animated Layer Wrapper 🟪
function AnimatedLayer({ targetY, children }) {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.08);
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

// ─── Invisible click-capture plane ───────────────────────────────────────
function GridClickPlane({ onGridClick }) {
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const x = Math.floor(e.point.x);
    const y = Math.floor(e.point.z);
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) onGridClick(x, y);
  }, [onGridClick]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[GRID_SIZE / 2, 0.02, GRID_SIZE / 2]}
      onClick={handleClick}
      receiveShadow
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshStandardMaterial transparent opacity={0} />
    </mesh>
  );
}

// ─── Thermal overlay tiles — high contrast, correct color scale ───────────
function ThermalOverlay({ thermalMap }) {
  const flat = useMemo(() => thermalMap?.flat() ?? [], [thermalMap]);
  const minT  = useMemo(() => flat.length ? Math.min(...flat) : 25, [flat]);
  const maxT  = useMemo(() => flat.length ? Math.max(...flat) : 110, [flat]);

  if (!thermalMap || maxT - minT < 1) return null;

  return (
    <>
      {thermalMap.map((row, ry) =>
        row.map((temp, cx) => {
          const color = tempToColor(temp, minT, maxT);
          // Cells with higher temp get more opacity — cooler cells fade out so hot spots POP
          const t = (temp - minT) / (maxT - minT);
          const opacity = 0.25 + t * 0.65;          // 0.25 at cold → 0.90 at peak
          return (
            <mesh key={`${cx}-${ry}`} position={[cx + 0.5, 0.03, ry + 0.5]}>
              <boxGeometry args={[1.0, 0.06, 1.0]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={0}
                roughness={0.8}
                transparent={false}
              />
            </mesh>
          );
        })
      )}
    </>
  );
}

// ─── Component 3D block — Gamified 3D shapes & AI Hover ──────────
function ComponentBlock({ component, thermalMap, minT, maxT, hasResult }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('Analyzing...');
  const { x, y, width, height, color, power_mW, label, type } = component;

  // Base height proportional to power
  const blockH = Math.max(0.35, Math.min(2.2, power_mW / 100));

  // Compute average temperature for this component's footprint
  const avgTemp = useMemo(() => {
    if (!hasResult || !thermalMap) return null;
    const temps = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const row = thermalMap[y + dy];
        if (row) temps.push(row[x + dx] ?? 25);
      }
    }
    return temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 25;
  }, [hasResult, thermalMap, x, y, width, height]);

  // Fetch AI suggestion when hovered
  useEffect(() => {
    if (hovered && avgTemp !== null) {
      setAiSuggestion('Thinking...');
      askGeminiAI(component, avgTemp).then(setAiSuggestion).catch(() => setAiSuggestion('AI offline.'));
    }
  }, [hovered, avgTemp, component]);

  // Aggressive fallback to default color if instance color is somehow missing or white
  const defaultColor = useChipStore.getState().COMPONENT_DEFAULTS[type]?.color || '#3b82f6';
  const safeColor = (color && color !== '#ffffff') ? color : defaultColor;

  const blockColor   = hasResult && avgTemp != null ? tempToColor(avgTemp, minT, maxT) : safeColor;
  const emissiveCol  = hasResult && avgTemp != null ? tempToColor(avgTemp, minT, maxT) : safeColor;

  const cx = x + width  / 2;
  const cy = y + height / 2;

  // Custom component aesthetics based on type
  const isRAM = type === 'cache_sram' || type === 'mem_ctrl';
  const isCPU = type === 'cpu_core' || type === 'gpu_cluster';
  const radius = isRAM ? 0.05 : 0.15; // Sharper RAM, rounder CPUs
  
  // In Edit Mode, we want them to look like bright, colorful anodized metal, not chrome mirrors (which reflect white studio light).
  // In Simulation Mode, we want matte painted heatmaps.
  const metalness = (hasResult && avgTemp != null) ? 0.1 : 0.3;
  const roughness = (hasResult && avgTemp != null) ? 0.8 : 0.4;
  
  // Give a slight emissive boost in Edit Mode so the colors pop
  const finalEmissiveInt = (hasResult && avgTemp != null) ? 0 : 0.2;

  return (
    <group position={[cx, blockH / 2, cy]}>
      <mesh 
        ref={meshRef} 
        castShadow 
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'default'; }}
        onContextMenu={(e) => { 
          e.stopPropagation(); 
          useChipStore.getState().selectPlaced(component.id); 
        }}
      >
        <RoundedBox args={[width - 0.08, blockH, height - 0.08]} radius={radius} smoothness={4} castShadow>
          <meshPhysicalMaterial
            color={blockColor}
            emissive={emissiveCol}
            emissiveIntensity={finalEmissiveInt}
            roughness={roughness}
            metalness={metalness}
            clearcoat={0.3}
          />
        </RoundedBox>
      </mesh>
      
      {/* AI Hover Tooltip */}
      {hovered && (
        <Html center position={[0, blockH / 2 + 0.6, 0]} zIndexRange={[100, 0]}>
          <div style={{
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            color: 'var(--text-primary)',
            width: hasResult ? '280px' : 'max-content',
            boxShadow: 'var(--shadow-lg), 0 0 40px rgba(99,102,241,0.3)',
            fontFamily: 'DM Sans, sans-serif',
            pointerEvents: 'none',
            animation: 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px', background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {label} ({x}, {y})
              </strong>
              {avgTemp !== null && (
                <span style={{ 
                  fontFamily: 'JetBrains Mono, monospace', 
                  fontSize: '13px', 
                  fontWeight: '700',
                  color: avgTemp > 90 ? 'var(--accent-rose)' : avgTemp > 75 ? 'var(--accent-gold)' : 'var(--accent-emerald)'
                }}>
                  {avgTemp.toFixed(1)}°C
                </span>
              )}
            </div>
            {hasResult && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <span style={{ color: 'var(--accent-violet)', fontWeight: 'bold' }}>✨ AI Verdict: </span>
                {aiSuggestion}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────
export default function ChipCanvas3D() {
  const { placedComponents, selectedType, placeComponent, material } = useChipStore();
  const { thermalMap, hasResult, isRunning } = useSimulationStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  
  const [isExploded, setIsExploded] = useState(false);

  const bgColor = isLight ? '#f8fafc' : '#080910';
  const gridColor = isLight ? '#e2e8f0' : '#252840';
  const gridCenterColor = isLight ? '#cbd5e1' : '#1a1d30';

  // Compute global thermal range once for all blocks + overlay
  const flat = useMemo(() => thermalMap?.flat() ?? [], [thermalMap]);
  const minT  = useMemo(() => flat.length ? Math.min(...flat) : 25,  [flat]);
  const maxT  = useMemo(() => flat.length ? Math.max(...flat) : 110, [flat]);

  const handleGridClick = useCallback((x, y) => {
    placeComponent(x, y);
  }, [placeComponent]);

  const statusColor = isRunning ? '#f59e0b' : hasResult ? '#10b981' : '#6366f1';
  const statusText  = isRunning ? 'SIMULATING' : hasResult ? 'COMPLETE' : 'IDLE';
  const styles      = getMaterialStyles();
  const matStyle    = styles[material] || styles.silicon;

  // Only show placement hint on the very first component (nothing placed yet)
  const showHint = selectedType && placedComponents.length === 0;

  return (
    <div 
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bgColor, pointerEvents: 'auto' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [8, 15, 22], fov: 44 }}
        shadows
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 20, 60]} />

        {/* Safe fallback lighting that won't crash the browser or require network */}
        <ambientLight intensity={isLight ? 1.5 : 1.2} />
        <directionalLight
          position={[18, 30, 12]} intensity={isLight ? 1.5 : 2.0}
          castShadow shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        <pointLight position={[8, 12, 8]} intensity={1.5} color="#06b6d4" />

        {/* Layer 1: Substrate */}
        <AnimatedLayer targetY={isExploded ? -3 : 0}>
          <ChipSubstrate material={material} />
        </AnimatedLayer>

        {/* Layer 2: Die (Grid + Components + Thermal Map) */}
        <AnimatedLayer targetY={0}>
          <gridHelper
            args={[GRID_SIZE, GRID_SIZE, '#c9c4a5', '#c9c4a5']}
            position={[GRID_SIZE / 2, 0.11, GRID_SIZE / 2]}
          />
          <GridLabels isLight={isLight} />
          {hasResult && thermalMap && <ThermalOverlay thermalMap={thermalMap} />}
          {placedComponents.map((comp) => (
            <ComponentBlock
              key={comp.id}
              component={comp}
              thermalMap={thermalMap}
              minT={minT}
              maxT={maxT}
              hasResult={hasResult}
            />
          ))}
          {selectedType && <GridClickPlane onGridClick={handleGridClick} />}
        </AnimatedLayer>

        {/* Layer 3: Heatsink (only visible when exploded) */}
        {isExploded && (
          <AnimatedLayer targetY={4}>
            <ChipHeatsink />
            {hasResult && thermalMap && (
              <group position={[0, 0.25, 0]}>
                <ThermalOverlay thermalMap={thermalMap} />
              </group>
            )}
          </AnimatedLayer>
        )}

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          target={[8, 0, 8]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={5}
          maxDistance={50}
        />
        <GizmoHelper alignment="bottom-right" margin={[360, 80]}>
          <GizmoViewport axisColors={['#ef4444', '#10b981', '#6366f1']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {/* ─ Status badge (top-left) ─ */}
      {/* ─ Simulation status (top-right area) ─ */}
      <div style={{ position: 'absolute', top: 20, right: 360, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
        <button
          onClick={() => setIsExploded(!isExploded)}
          style={{
            padding: '4px 12px', borderRadius: 20,
            background: isExploded ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isExploded ? '#6366f1' : 'var(--border-subtle)'}`,
            fontSize: 11, fontFamily: 'Orbitron, sans-serif', fontWeight: 600,
            color: isExploded ? '#818cf8' : 'var(--text-secondary)', 
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {isExploded ? 'Collapse Layers' : 'Exploded View'}
        </button>

        <span style={{
          padding: '3px 10px', borderRadius: 20,
          background: `${statusColor}18`, border: `1px solid ${statusColor}55`,
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
          color: statusColor, letterSpacing: '0.1em',
        }}>{statusText}</span>
      </div>

      {/* ─ Material badge (bottom-left) ─ */}
      <div style={{ position: 'absolute', bottom: 20, left: 280, zIndex: 10 }}>
        <span style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: `${matStyle.badge}18`, border: `1px solid ${matStyle.badge}44`,
          color: matStyle.badge, letterSpacing: '0.04em',
        }}>
          💎 {matStyle.label}
        </span>
      </div>

      {/* ─ Thermal legend (bottom, centre) — only after sim ─ */}
      {hasResult && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 11,
          background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(8,9,16,0.75)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '5px 16px',
          zIndex: 10
        }}>
          <span style={{ color: '#22d3ee' }}>● {minT.toFixed(0)}°C</span>
          <div style={{
            width: 80, height: 6, borderRadius: 3,
            background: 'linear-gradient(90deg, #22d3ee, #6366f1, #fb923c, #ef4444)',
          }} />
          <span style={{ color: '#ef4444' }}>● {maxT.toFixed(0)}°C</span>
        </div>
      )}

      {/* ─ First-time placement hint ─ */}
      {showHint && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)', 
          border: '1px solid var(--border-subtle)',
          padding: '8px 18px', borderRadius: 10, fontSize: 13, color: 'var(--text-primary)',
          backdropFilter: 'blur(8px)',
        }}>
          ✦ Click anywhere on the grid to place {selectedType.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
}
