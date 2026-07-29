import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useChipStore } from '../../store/chipStore';

export default function PowerGraph() {
  const { placedComponents, COMPONENT_DEFAULTS } = useChipStore();

  const data = useMemo(() => {
    const agg = {};
    placedComponents.forEach(comp => {
      if (!agg[comp.label]) {
        // Find default color if the component instance doesn't have it explicitly stored
        const defaultColor = COMPONENT_DEFAULTS[comp.type]?.color || 'var(--accent-primary)';
        agg[comp.label] = { name: comp.label, power: 0, color: comp.color || defaultColor };
      }
      agg[comp.label].power += (comp.power_mW || 0);
    });
    
    // Convert to array and sort descending by power
    return Object.values(agg).sort((a, b) => b.power - a.power);
  }, [placedComponents, COMPONENT_DEFAULTS]);

  if (data.length === 0) return null;

  return (
    <div 
      id="power-graph-container"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '16px',
        marginTop: '16px',
      }}
    >
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 
      }}>
        <span style={{ color: 'var(--accent-gold)' }}>⚡</span>
        Power by Component
      </div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: -10, bottom: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" opacity={0.3} />
            <XAxis 
              type="number" 
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Orbitron' }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              tickFormatter={(val) => `${val} mW`}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'Orbitron' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-glow)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--text-primary)'
              }}
              formatter={(value) => [`${value} mW`, 'Power']}
            />
            <Bar 
              dataKey="power" 
              radius={[0, 4, 4, 0]}
              barSize={16}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
