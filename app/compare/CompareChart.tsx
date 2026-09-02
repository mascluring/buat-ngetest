'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

export default function CompareChart({ data, nameA, nameB }: { data: any[]; nameA: string; nameB: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !data || data.length === 0) {
    return <div className="w-full h-80 flex items-center justify-center text-slate-400 text-sm italic">Memuat grafik poin kumulatif...</div>;
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis dataKey="gw" stroke="#94a3b8" fontSize={12} tickLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
            itemStyle={{ color: '#f8fafc', fontSize: '13px', padding: '2px 0' }}
            labelStyle={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Line 
            type="monotone" 
            dataKey={nameA} 
            name={nameA}
            stroke="#FFB800" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#FFB800' }} 
            activeDot={{ r: 7 }} 
            isAnimationActive={true} 
            connectNulls={true} 
          />
          <Line 
            type="monotone" 
            dataKey={nameB} 
            name={nameB}
            stroke="#00B2FF" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#00B2FF' }} 
            activeDot={{ r: 7 }} 
            isAnimationActive={true} 
            connectNulls={true} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
