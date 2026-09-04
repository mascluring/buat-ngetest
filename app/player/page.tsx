'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Trophy, Flame, Target, Shield, Award, Users, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react';

type Player = {
  id: number;
  name: string;
  fullName: string;
  team: string;
  teamShortName: string;
  team_short: string;
  position: string;
  
  // V6.1 Season Statistics
  points: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  xGI: number;
  defensiveContribution: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  minutes: number;
  starts: number;
  cleanSheets: number;
  bonus: number;
  bps: number;
  price: number;
  selectedBy: number;
  form: number;
  ictIndex: number;

  // Additional / UI properties
  price_raw?: number;
  status?: string;
  status_color?: string;
  progress?: string;
  predicted_progress?: string;
  next_3_gw?: { gw: number; opponent: string; isHome: boolean; difficulty: number; label: string }[];
  eo_percent?: string;
  total_points?: number;
  goals_scored?: number;
  clean_sheets?: number;
  yellow_cards?: number;
  red_cards?: number;
  saves?: number;
};

type SortField = 'points' | 'goals' | 'assists' | 'xG' | 'xA' | 'xGI' | 'defensiveContribution' | 'yellowCards' | 'redCards' | 'ownGoals' | 'price' | 'form' | 'selectedBy' | 'minutes' | 'starts' | 'cleanSheets' | 'bonus' | 'bps' | 'ictIndex' | 'name' | 'teamShortName' | 'position';

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'standard' | 'advanced'>('standard');
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const pageSize = 25;

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPlayers(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, positionFilter, teamFilter, sortField, sortDir]);

  // Extract unique teams for dropdown
  const uniqueTeams = useMemo(() => {
    const set = new Set<string>();
    players.forEach(p => {
      if (p.team && p.team !== 'Unknown') set.add(p.team);
    });
    return Array.from(set).sort();
  }, [players]);

  // Summary Metrics with consistent tie-breakers
  const summary = useMemo(() => {
    if (!players.length) return null;

    const findTop = (metricFn: (p: Player) => number) => {
      return [...players].sort((a, b) => {
        const valA = metricFn(a);
        const valB = metricFn(b);
        if (valB !== valA) return valB - valA;
        if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
        return a.name.localeCompare(b.name);
      })[0];
    };

    return {
      total: players.length,
      topPoints: findTop(p => p.points ?? p.total_points ?? 0),
      topGoals: findTop(p => p.goals ?? p.goals_scored ?? 0),
      topAssists: findTop(p => p.assists ?? 0),
      topDC: findTop(p => p.defensiveContribution ?? 0)
    };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter(p => {
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        (p.fullName && p.fullName.toLowerCase().includes(q)) || 
        (p.teamShortName && p.teamShortName.toLowerCase().includes(q)) ||
        (p.team && p.team.toLowerCase().includes(q));

      const matchPos = positionFilter === 'ALL' || 
        p.position === positionFilter || 
        (positionFilter === 'GKP' && p.position === 'GK') || 
        (positionFilter === 'GK' && p.position === 'GKP');

      const matchTeam = teamFilter === 'ALL' || p.team === teamFilter || p.teamShortName === teamFilter;

      return matchSearch && matchPos && matchTeam;
    });
  }, [players, query, positionFilter, teamFilter]);

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else {
        const numA = Number(valA ?? 0);
        const numB = Number(valB ?? 0);
        comparison = numA - numB;
      }

      // Secondary tie-breaker: points desc, name asc
      if (comparison === 0) {
        const ptsDiff = (Number(b.points ?? 0)) - (Number(a.points ?? 0));
        if (ptsDiff !== 0) return ptsDiff;
        return a.name.localeCompare(b.name);
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filteredPlayers, sortField, sortDir]);

  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPlayers.slice(start, start + pageSize);
  }, [sortedPlayers, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} className="inline ml-0.5" /> : <ChevronDown size={14} className="inline ml-0.5" />;
  };

  return (
    <main className="container mx-auto p-4 sm:p-6 bg-slate-950 min-h-screen text-slate-100">
      {/* HEADER & NAV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-2 transition-colors">
            <ArrowLeft size={16}/> Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>FPL Player Statistics</span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 rounded-full">V6.2 Season Stats</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Database statistik komprehensif seluruh pemain Fantasy Premier League langsung dari sumber resmi FPL.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link 
            href="/compare/player" 
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
          >
            <BarChart3 size={15}/> Compare Player
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Total Players</span>
              <Users size={16} className="text-cyan-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-white">{summary.total}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">20 Klub Premier League</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Top Points</span>
              <Trophy size={16} className="text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-400">{summary.topPoints?.points ?? 0} <span className="text-xs font-medium text-slate-400">pts</span></div>
              <div className="text-[11px] text-slate-200 font-semibold truncate mt-0.5">{summary.topPoints?.name} <span className="text-slate-400 font-normal">({summary.topPoints?.teamShortName})</span></div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Top Goals</span>
              <Flame size={16} className="text-rose-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-rose-400">{summary.topGoals?.goals ?? 0} <span className="text-xs font-medium text-slate-400">goals</span></div>
              <div className="text-[11px] text-slate-200 font-semibold truncate mt-0.5">{summary.topGoals?.name} <span className="text-slate-400 font-normal">({summary.topGoals?.teamShortName})</span></div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Top Assists</span>
              <Target size={16} className="text-blue-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-blue-400">{summary.topAssists?.assists ?? 0} <span className="text-xs font-medium text-slate-400">assists</span></div>
              <div className="text-[11px] text-slate-200 font-semibold truncate mt-0.5">{summary.topAssists?.name} <span className="text-slate-400 font-normal">({summary.topAssists?.teamShortName})</span></div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Top DC</span>
              <Shield size={16} className="text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-400">{summary.topDC?.defensiveContribution ?? 0}</div>
              <div className="text-[11px] text-slate-200 font-semibold truncate mt-0.5">{summary.topDC?.name} <span className="text-slate-400 font-normal">({summary.topDC?.teamShortName})</span></div>
            </div>
          </div>
        </div>
      )}

      {/* TOOLBAR & CONTROLS */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* SEARCH */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16}/>
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              placeholder="Search player name, full name, or club..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-white placeholder-slate-500"
            />
          </div>

          {/* TEAM FILTER */}
          <div className="w-full md:w-56">
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">Semua Klub (All Teams)</option>
              {uniqueTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* VIEW MODE TOGGLE */}
          <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setViewMode('standard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'standard' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Statistik Utama
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'advanced' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              Market & Lanjutan
            </button>
          </div>
        </div>

        {/* POSITION PILLS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-semibold text-slate-400 mr-1.5">Posisi:</span>
            {['ALL', 'GKP', 'DEF', 'MID', 'FWD'].map(pos => (
              <button 
                key={pos} 
                onClick={() => setPositionFilter(pos)} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${positionFilter === pos ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400">
            Menampilkan <b className="text-white">{sortedPlayers.length}</b> pemain
          </div>
        </div>
      </div>

      {/* PLAYERS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-950/90 text-slate-400 text-xs uppercase font-bold tracking-wider border-b border-slate-800 select-none">
              {viewMode === 'standard' ? (
                <tr>
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                    PLAYER {renderSortIcon('name')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-center" onClick={() => handleSort('teamShortName')}>
                    TEAM {renderSortIcon('teamShortName')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-center" onClick={() => handleSort('position')}>
                    POS {renderSortIcon('position')}
                  </th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white text-right font-black text-cyan-400" title="Total Fantasy Premier League Points" onClick={() => handleSort('points')}>
                    PTS {renderSortIcon('points')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Goals Scored" onClick={() => handleSort('goals')}>
                    G {renderSortIcon('goals')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Assists" onClick={() => handleSort('assists')}>
                    A {renderSortIcon('assists')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-rose-300" title="Expected Goals" onClick={() => handleSort('xG')}>
                    xG {renderSortIcon('xG')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-blue-300" title="Expected Assists" onClick={() => handleSort('xA')}>
                    xA {renderSortIcon('xA')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-amber-300" title="Expected Goal Involvements (xG + xA)" onClick={() => handleSort('xGI')}>
                    xGI {renderSortIcon('xGI')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-emerald-300" title="Defensive Contribution" onClick={() => handleSort('defensiveContribution')}>
                    DC {renderSortIcon('defensiveContribution')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-amber-400" title="Yellow Cards" onClick={() => handleSort('yellowCards')}>
                    YC {renderSortIcon('yellowCards')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-rose-500" title="Red Cards" onClick={() => handleSort('redCards')}>
                    RC {renderSortIcon('redCards')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-purple-400" title="Own Goals" onClick={() => handleSort('ownGoals')}>
                    OG {renderSortIcon('ownGoals')}
                  </th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                    PLAYER {renderSortIcon('name')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-center" onClick={() => handleSort('teamShortName')}>
                    TEAM {renderSortIcon('teamShortName')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-center" onClick={() => handleSort('position')}>
                    POS {renderSortIcon('position')}
                  </th>
                  <th className="px-4 py-3.5 cursor-pointer hover:text-white text-right font-black text-cyan-400" title="Total Points" onClick={() => handleSort('points')}>
                    PTS {renderSortIcon('points')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-emerald-400 font-bold" title="Current Price" onClick={() => handleSort('price')}>
                    PRICE {renderSortIcon('price')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-amber-400" title="Form (Average points per match over recent games)" onClick={() => handleSort('form')}>
                    FORM {renderSortIcon('form')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-indigo-300" title="Selected By Percent" onClick={() => handleSort('selectedBy')}>
                    SEL% {renderSortIcon('selectedBy')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Minutes Played" onClick={() => handleSort('minutes')}>
                    MIN {renderSortIcon('minutes')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Match Starts" onClick={() => handleSort('starts')}>
                    STARTS {renderSortIcon('starts')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Clean Sheets" onClick={() => handleSort('cleanSheets')}>
                    CS {renderSortIcon('cleanSheets')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right text-amber-300" title="Bonus Points" onClick={() => handleSort('bonus')}>
                    BONUS {renderSortIcon('bonus')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="Bonus Points System Score" onClick={() => handleSort('bps')}>
                    BPS {renderSortIcon('bps')}
                  </th>
                  <th className="px-3 py-3.5 cursor-pointer hover:text-white text-right" title="ICT Index" onClick={() => handleSort('ictIndex')}>
                    ICT {renderSortIcon('ictIndex')}
                  </th>
                  <th className="px-4 py-3.5 text-left">NEXT 3 GW</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={viewMode === 'standard' ? 14 : 15} className="p-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Memuat statistik seluruh pemain FPL…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'standard' ? 14 : 15} className="p-8 text-center text-slate-400">
                    Tidak ada pemain yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((p, index) => {
                  const rankNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedPlayer(p)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      title="Klik untuk melihat statistik detail dan profil pemain"
                    >
                      <td className="px-4 py-3 text-center text-xs text-slate-500 font-mono">{rankNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                          {p.fullName !== p.name ? p.fullName : p.team}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
                          {p.teamShortName || p.team_short}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          p.position === 'GKP' || p.position === 'GK' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' :
                          p.position === 'DEF' ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60' :
                          p.position === 'MID' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' :
                          'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        }`}>
                          {p.position}
                        </span>
                      </td>

                      {/* TOTAL POINTS */}
                      <td className="px-4 py-3 text-right font-black text-cyan-400 font-mono text-base">
                        {p.points ?? p.total_points ?? 0}
                      </td>

                      {viewMode === 'standard' ? (
                        <>
                          <td className="px-3 py-3 text-right font-semibold text-slate-200 font-mono">{p.goals ?? p.goals_scored ?? 0}</td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-200 font-mono">{p.assists ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-rose-300">{Number(p.xG ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-mono text-blue-300">{Number(p.xA ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-mono text-amber-300 font-semibold">{Number(p.xGI ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-400 font-semibold">{p.defensiveContribution ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-amber-400">{p.yellowCards ?? p.yellow_cards ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-rose-500 font-bold">{p.redCards ?? p.red_cards ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-purple-400">{p.ownGoals ?? 0}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-right font-bold text-emerald-400 font-mono">£{Number(p.price ?? 0).toFixed(1)}m</td>
                          <td className="px-3 py-3 text-right font-bold text-amber-400 font-mono">{Number(p.form ?? 0).toFixed(1)}</td>
                          <td className="px-3 py-3 text-right font-mono text-indigo-300">{Number(p.selectedBy ?? 0).toFixed(1)}%</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{p.minutes ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{p.starts ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-200">{p.cleanSheets ?? p.clean_sheets ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-amber-300 font-semibold">{p.bonus ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{p.bps ?? 0}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{Number(p.ictIndex ?? 0).toFixed(1)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 items-center">
                              {p.next_3_gw && p.next_3_gw.length > 0 ? (
                                p.next_3_gw.map((f, i) => (
                                  <span key={i} className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm ${f.difficulty <= 2 ? 'bg-emerald-600/90' : f.difficulty === 3 ? 'bg-slate-600' : 'bg-rose-600/90'}`}>
                                    {f.label}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
          <div className="text-xs text-slate-400">
            Halaman <b className="text-white">{currentPage}</b> dari <b className="text-white">{totalPages}</b> ({sortedPlayers.length} total pemain)
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(1)} 
              disabled={currentPage === 1} 
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              First
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
              disabled={currentPage === 1} 
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-cyan-400">
              {currentPage} / {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={currentPage === totalPages} 
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
            <button 
              onClick={() => setCurrentPage(totalPages)} 
              disabled={currentPage === totalPages} 
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* PLAYER STATS POPUP MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
              aria-label="Tutup"
            >
              ✕
            </button>
            
            {/* MODAL HEADER */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg shrink-0">
                {selectedPlayer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{selectedPlayer.fullName || selectedPlayer.name}</h2>
                <div className="text-sm text-cyan-400 font-semibold mt-0.5">
                  {selectedPlayer.team} ({selectedPlayer.teamShortName || selectedPlayer.team_short}) • <span className="text-white font-bold">{selectedPlayer.position}</span> • <span className="text-emerald-400 font-bold">£{Number(selectedPlayer.price ?? 0).toFixed(1)}m</span>
                </div>
              </div>
            </div>

            {/* KEY METRICS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400 uppercase font-bold">Total Points</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{selectedPlayer.points ?? selectedPlayer.total_points ?? 0}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400 uppercase font-bold">Form</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{Number(selectedPlayer.form ?? 0).toFixed(1)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400 uppercase font-bold">Ownership</div>
                <div className="text-2xl font-black text-indigo-400 mt-1">{Number(selectedPlayer.selectedBy ?? 0).toFixed(1)}%</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400 uppercase font-bold">ICT Index</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{Number(selectedPlayer.ictIndex ?? 0).toFixed(1)}</div>
              </div>
            </div>

            {/* FULL SEASON STATS BREAKDOWN */}
            <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 mb-6">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Award size={14} className="text-cyan-400"/>
                <span>Statistik Musim Lengkap (V6.2)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-xs divide-y sm:divide-y-0 divide-slate-900">
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Goals:</span> <b className="text-white font-mono">{selectedPlayer.goals ?? selectedPlayer.goals_scored ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Assists:</span> <b className="text-white font-mono">{selectedPlayer.assists ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Expected Goals (xG):</span> <b className="text-rose-300 font-mono">{Number(selectedPlayer.xG ?? 0).toFixed(2)}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Expected Assists (xA):</span> <b className="text-blue-300 font-mono">{Number(selectedPlayer.xA ?? 0).toFixed(2)}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">xG + xA (xGI):</span> <b className="text-amber-300 font-mono">{Number(selectedPlayer.xGI ?? 0).toFixed(2)}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Defensive Contrib (DC):</span> <b className="text-emerald-400 font-mono">{selectedPlayer.defensiveContribution ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Minutes:</span> <b className="text-white font-mono">{selectedPlayer.minutes ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Starts:</span> <b className="text-white font-mono">{selectedPlayer.starts ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Clean Sheets:</span> <b className="text-white font-mono">{selectedPlayer.cleanSheets ?? selectedPlayer.clean_sheets ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Bonus Points:</span> <b className="text-amber-300 font-mono">{selectedPlayer.bonus ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">BPS Score:</span> <b className="text-white font-mono">{selectedPlayer.bps ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Yellow Cards:</span> <b className="text-amber-400 font-mono">{selectedPlayer.yellowCards ?? selectedPlayer.yellow_cards ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Red Cards:</span> <b className="text-rose-500 font-mono">{selectedPlayer.redCards ?? selectedPlayer.red_cards ?? 0}</b></div>
                <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Own Goals:</span> <b className="text-purple-400 font-mono">{selectedPlayer.ownGoals ?? 0}</b></div>
                {(selectedPlayer.position === 'GKP' || selectedPlayer.position === 'GK') && (
                  <div className="flex justify-between py-1 border-b border-slate-900"><span className="text-slate-400">Saves:</span> <b className="text-white font-mono">{selectedPlayer.saves ?? 0}</b></div>
                )}
              </div>
            </div>

            {/* NEXT FIXTURES */}
            {selectedPlayer.next_3_gw && selectedPlayer.next_3_gw.length > 0 && (
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Next 3 Gameweeks</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPlayer.next_3_gw.map((f, i) => (
                    <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 ${f.difficulty <= 2 ? 'bg-emerald-600/90' : f.difficulty === 3 ? 'bg-slate-700' : 'bg-rose-600/90'}`}>
                      <span>GW{f.gw}:</span>
                      <span>{f.label}</span>
                      <span className="text-[10px] opacity-80">(FDR {f.difficulty})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-3">
              <a 
                href={`https://fantasy.premierleague.com/player/${selectedPlayer.id}/`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-center text-sm shadow-lg transition-all"
              >
                Buka Profil Resmi FPL ↗
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

      {/* FOOTER */}
      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">
        ERA SUPER LEAGUE • V6.2 Player Statistics • League ID 134820
      </footer>
    </main>
  );
}

