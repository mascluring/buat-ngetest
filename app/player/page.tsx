'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

type Player = {
  id: number;
  name: string;
  team_short: string;
  position: string;
  price: string;
  price_raw: number;
  status: string;
  status_color: string;
  progress: string;
  predicted_progress: string;
  next_3_gw: { gw: number; opponent: string; isHome: boolean; difficulty: number; label: string }[];
  form: string;
  eo_percent: string;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<keyof Player | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => { setPlayers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filter, sortKey, sortDir]);

  const sortedPlayers = useMemo(() => {
    let result = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(query.toLowerCase()) || p.team_short.toLowerCase().includes(query.toLowerCase());
      const matchesPos = filter === 'All' || p.position === filter;
      return matchesSearch && matchesPos;
    });

    if (sortKey) {
      result = result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        
        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = parseFloat(valA) - parseFloat(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }

        return sortDir === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [players, query, filter, sortKey, sortDir]);

  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPlayers.slice(start, start + pageSize);
  }, [sortedPlayers, currentPage]);

  const totalPages = Math.ceil(sortedPlayers.length / pageSize);

  const handleSort = (key: keyof Player) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <main className="container p-6 bg-slate-950 min-h-screen text-slate-100">
      <Link href="/" className="flex items-center gap-2 mb-6 text-slate-400 hover:text-white">
        <ArrowLeft size={16}/> Kembali
      </Link>
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <div className="text-slate-400">{players.length} players</div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 items-center">
        {['All', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
          <button key={pos} onClick={() => setFilter(pos)} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === pos ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
            {pos}
          </button>
        ))}
        <div className="flex gap-1 ml-auto">
          <span className="text-sm text-slate-400 mr-2 self-center">Sort by:</span>
          {(['price_raw', 'form', 'eo_percent'] as const).map(key => (
             <button key={key} onClick={() => handleSort(key)} className={`px-3 py-1 rounded-md text-xs font-medium ${sortKey === key ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {key === 'price_raw' ? 'Price' : key === 'form' ? 'Form' : 'EO%'} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
             </button>
          ))}
          <div className="relative flex-1 max-w-sm ml-2">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player or team..." className="w-full pl-10 pr-4 py-2 bg-slate-800 rounded-full text-sm"/>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-lg overflow-x-auto border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">PLAYER</th>
              <th className="px-4 py-3 text-left">PRICE</th>
              <th className="px-4 py-3 text-left">STATUS</th>
              <th className="px-4 py-3 text-left">PROGRESS</th>
              <th className="px-4 py-3 text-left">PREDICTED</th>
              <th className="px-4 py-3 text-left">NEXT 3 GW</th>
              <th className="px-4 py-3 text-left">FORM</th>
              <th className="px-4 py-3 text-left">EO%</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="p-4 text-center">Loading...</td></tr> : paginatedPlayers.map(p => (
              <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <Link href={`https://fantasy.premierleague.com/player/${p.id}/`} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-blue-400">
                    {p.name}
                  </Link>
                  <div className="text-xs text-slate-500">{p.team_short} • {p.position}</div>
                </td>
                <td className="px-4 py-3 font-medium">{p.price}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${p.status_color} text-white whitespace-nowrap`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{p.progress}</td>
                <td className="px-4 py-3 font-medium text-slate-400">{p.predicted_progress}</td>
                <td className="px-4 py-3 flex gap-1">
                  {p.next_3_gw.map((f, i) => (
                    <span key={i} className={`px-2 py-1 rounded text-[10px] font-bold ${f.difficulty <= 2 ? 'bg-green-700' : f.difficulty === 3 ? 'bg-slate-600' : 'bg-red-700'}`}>
                      {f.label}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 font-medium text-amber-400">{p.form}</td>
                <td className="px-4 py-3 text-slate-300">{p.eo_percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-slate-800 rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm self-center">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-slate-800 rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </main>
  );
}
