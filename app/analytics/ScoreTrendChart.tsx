'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface ScoreTrendPoint {
  event: number;
  averagePoints: number;
  highestPoints: number;
  lowestPoints: number;
  managerCount: number;
}

interface Props {
  data: ScoreTrendPoint[];
}

export default function ScoreTrendChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-slate-500 text-sm italic">
        Belum ada data tren skor Gameweek yang cukup...
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: `GW ${d.event}`,
    gw: d.event,
    average: d.averagePoints,
    highest: d.highestPoints,
    lowest: d.lowestPoints,
    managers: d.managerCount,
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '0.75rem',
              color: '#f8fafc',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
              padding: '10px 14px',
            }}
            itemStyle={{ color: '#f8fafc', fontSize: '12px', padding: '2px 0' }}
            labelStyle={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '6px' }}
            formatter={(value: any, name: any) => {
              if (name === 'Rata-rata Liga') return [`${value} pts`, name];
              if (name === 'Skor Tertinggi') return [`${value} pts`, name];
              if (name === 'Skor Terendah') return [`${value} pts`, name];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="average"
            name="Rata-rata Liga"
            stroke="#38bdf8"
            strokeWidth={3}
            fill="url(#avgFill)"
            dot={{ r: 4, fill: '#38bdf8' }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="highest"
            name="Skor Tertinggi"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: '#10b981' }}
          />
          <Line
            type="monotone"
            dataKey="lowest"
            name="Skor Terendah"
            stroke="#f43f5e"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: '#f43f5e' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
