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
  total_points?: number;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  bonus?: number;
  yellow_cards?: number;
  red_cards?: number;
  saves?: number;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<keyof Player | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
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
              <th className="px-6 py-3.5 text-left">PLAYER</th>
              <th className="px-6 py-3.5 text-left">PRICE</th>
              <th className="px-6 py-3.5 text-left">NEXT 5 GW</th>
              <th className="px-6 py-3.5 text-left">FORM</th>
              <th className="px-6 py-3.5 text-left">EO%</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-6 text-center text-slate-400">Loading players...</td></tr> : paginatedPlayers.map(p => (
              <tr 
                key={p.id} 
                className="border-t border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-colors"
                onClick={() => setSelectedPlayer(p)}
                title="Klik untuk melihat statistik detail pemain"
              >
                <td className="px-6 py-4">
                  <div className="font-bold text-white hover:text-cyan-400 transition-colors">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.team_short} • <span className="text-cyan-300 font-medium">{p.position}</span></div>
                </td>
                <td className="px-6 py-4 font-semibold text-emerald-400">{p.price}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 items-center">
                    {p.next_3_gw.map((f, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm ${f.difficulty <= 2 ? 'bg-emerald-600/90' : f.difficulty === 3 ? 'bg-slate-600' : 'bg-rose-600/90'}`}>
                        {f.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-amber-400">{p.form}</td>
                <td className="px-6 py-4 text-slate-200 font-medium">{p.eo_percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PLAYER STATS POPUP MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative text-slate-100">
            <button 
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
            >
              ✕
            </button>
            
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
                {selectedPlayer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{selectedPlayer.name}</h2>
                <div className="text-sm text-cyan-400 font-semibold">{selectedPlayer.team_short} • {selectedPlayer.position} • <span className="text-emerald-400">{selectedPlayer.price}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Points</div>
                <div className="text-lg font-black text-cyan-400 mt-1">{selectedPlayer.total_points ?? 0}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Form</div>
                <div className="text-lg font-black text-amber-400 mt-1">{selectedPlayer.form}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Ownership</div>
                <div className="text-lg font-black text-indigo-400 mt-1">{selectedPlayer.eo_percent}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Status</div>
                <div className="text-xs font-bold text-white mt-1.5 truncate px-1" title={selectedPlayer.status}>
                  {selectedPlayer.status}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statistik Musim Ini</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs">
                <div><span className="text-slate-400">Goals:</span> <b className="text-white float-right">{selectedPlayer.goals_scored ?? 0}</b></div>
                <div><span className="text-slate-400">Assists:</span> <b className="text-white float-right">{selectedPlayer.assists ?? 0}</b></div>
                <div><span className="text-slate-400">Clean Sheets:</span> <b className="text-white float-right">{selectedPlayer.clean_sheets ?? 0}</b></div>
                <div><span className="text-slate-400">Bonus:</span> <b className="text-white float-right">{selectedPlayer.bonus ?? 0}</b></div>
                <div><span className="text-slate-400">Yellow Cards:</span> <b className="text-white float-right">{selectedPlayer.yellow_cards ?? 0}</b></div>
                <div><span className="text-slate-400">Red Cards:</span> <b className="text-white float-right">{selectedPlayer.red_cards ?? 0}</b></div>
                {selectedPlayer.position === 'GK' && (
                  <div><span className="text-slate-400">Saves:</span> <b className="text-white float-right">{selectedPlayer.saves ?? 0}</b></div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <a 
                href={`https://fantasy.premierleague.com/player/${selectedPlayer.id}/`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm shadow-lg transition-all"
              >
                Buka di FPL Resmi ↗
              </a>
              <button 
                onClick={() => setSelectedPlayer(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-5 rounded-xl text-sm transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-slate-800 rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm self-center">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-slate-800 rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.0 Players • League ID 134820</footer>
    </main>
  );
}
