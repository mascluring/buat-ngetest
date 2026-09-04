'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Search, 
  X, 
  Plus, 
  Crown, 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  Shield, 
  Zap, 
  Flame, 
  Check, 
  RotateCcw,
  Users,
  Target,
  Activity,
  Award
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer, 
  Legend, 
  Tooltip 
} from 'recharts';

export interface FixtureItem {
  gw: number;
  opponent: string;
  isHome: boolean;
  difficulty: number;
  label: string;
  isDGW?: boolean;
  isBlank?: boolean;
  fixtures?: {
    opponent: string;
    isHome: boolean;
    difficulty: number;
    label: string;
  }[];
}

export interface PlayerData {
  id: number;
  name: string;
  fullName: string;
  team: string;
  teamShortName: string;
  position: string;
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
  status: string;
  status_color: string;
  next_3_gw: FixtureItem[];
}

const PLAYER_COLORS = [
  { stroke: '#10b981', fill: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-600' },
  { stroke: '#06b6d4', fill: '#06b6d4', bg: 'bg-cyan-500/10', border: 'border-cyan-500', text: 'text-cyan-400', badge: 'bg-cyan-600' },
  { stroke: '#f59e0b', fill: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-400', badge: 'bg-amber-600' }
];

const getFdrBadgeClass = (fdr: number) => {
  switch (fdr) {
    case 1:
    case 2:
      return 'bg-emerald-700 text-emerald-100 border border-emerald-500';
    case 3:
      return 'bg-slate-700 text-slate-200 border border-slate-600';
    case 4:
      return 'bg-rose-700 text-rose-100 border border-rose-500';
    case 5:
      return 'bg-rose-950 text-rose-200 border border-rose-700 font-bold';
    default:
      return 'bg-slate-800 text-slate-300 border border-slate-700';
  }
};

function PlayerCompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [allPlayers, setAllPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected IDs (max 3)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Search dialog / slot picker state
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosFilter, setSelectedPosFilter] = useState<'ALL' | 'GKP' | 'DEF' | 'MID' | 'FWD'>('ALL');

  // 1. Fetch bulk player dataset once (O(1))
  useEffect(() => {
    let isMounted = true;
    const fetchPlayers = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/players', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setAllPlayers(data);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Gagal memuat data pemain');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlayers();
    return () => { isMounted = false; };
  }, []);

  // 2. Initialize from URL search params when players are loaded
  useEffect(() => {
    if (allPlayers.length === 0) return;

    const idsParam = searchParams.get('ids') || searchParams.get('p');
    if (idsParam) {
      const parsedIds = idsParam
        .split(',')
        .map(x => Number(x.trim()))
        .filter(id => !isNaN(id) && id > 0 && allPlayers.some(p => p.id === id));

      const uniqueIds = Array.from(new Set(parsedIds)).slice(0, 3);
      if (uniqueIds.length >= 1) {
        setSelectedIds(uniqueIds);
        return;
      }
    }

    // Default top 2 highest scoring players if no URL params
    if (selectedIds.length === 0) {
      const sortedByPoints = [...allPlayers].sort((a, b) => b.points - a.points);
      if (sortedByPoints.length >= 2) {
        setSelectedIds([sortedByPoints[0].id, sortedByPoints[1].id]);
      }
    }
  }, [allPlayers, searchParams]);

  // 3. Sync selected IDs with URL query params
  const updateUrlParams = (ids: number[]) => {
    if (ids.length === 0) {
      router.replace('/compare/player');
    } else {
      router.replace(`/compare/player?ids=${ids.join(',')}`);
    }
  };

  const handleAddPlayer = (player: PlayerData) => {
    if (selectedIds.includes(player.id)) return;

    let newIds: number[];
    if (activeSlotIndex !== null && activeSlotIndex < selectedIds.length) {
      // Replace existing slot
      newIds = [...selectedIds];
      newIds[activeSlotIndex] = player.id;
    } else {
      // Append to list (max 3)
      if (selectedIds.length >= 3) return;
      newIds = [...selectedIds, player.id];
    }

    setSelectedIds(newIds);
    updateUrlParams(newIds);
    setActiveSlotIndex(null);
    setSearchQuery('');
  };

  const handleRemoveSlot = (indexToRemove: number) => {
    const newIds = selectedIds.filter((_, idx) => idx !== indexToRemove);
    setSelectedIds(newIds);
    updateUrlParams(newIds);
  };

  const handleReset = () => {
    setSelectedIds([]);
    updateUrlParams([]);
  };

  // Selected player objects
  const selectedPlayers = useMemo(() => {
    return selectedIds
      .map(id => allPlayers.find(p => p.id === id))
      .filter((p): p is PlayerData => p !== undefined);
  }, [selectedIds, allPlayers]);

  // Filtered player list for modal/slot picker
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPlayers.filter(p => {
      if (selectedIds.includes(p.id)) return false; // Exclude already selected
      const matchPos = selectedPosFilter === 'ALL' || 
        p.position === selectedPosFilter || 
        (selectedPosFilter === 'GKP' && p.position === 'GK');
      
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        (p.fullName && p.fullName.toLowerCase().includes(q)) || 
        (p.teamShortName && p.teamShortName.toLowerCase().includes(q)) ||
        (p.team && p.team.toLowerCase().includes(q));

      return matchPos && matchSearch;
    }).slice(0, 30); // Top 30 results for fast UI
  }, [allPlayers, selectedIds, searchQuery, selectedPosFilter]);

  // Helper for computing winners across selected players
  // Returns array of indices that achieve the optimal value (supports ties)
  const getWinnerIndices = (values: number[], mode: 'high' | 'low' = 'high'): number[] => {
    if (values.length <= 1) return [];
    
    // If all values are 0 or identical, no highlight
    const allSame = values.every(v => v === values[0]);
    if (allSame) return [];

    const targetVal = mode === 'high' ? Math.max(...values) : Math.min(...values);
    return values
      .map((val, idx) => (val === targetVal ? idx : -1))
      .filter(idx => idx !== -1);
  };

  // Fixture Average FDR calculation
  const getAvgFDR = (fixtures: FixtureItem[]): number => {
    if (!fixtures || fixtures.length === 0) return 0;
    
    let totalDifficulty = 0;
    let validCount = 0;

    fixtures.forEach(gwItem => {
      if (gwItem.isBlank) return; // Exclude blanks from denominator

      if (gwItem.isDGW && gwItem.fixtures && gwItem.fixtures.length > 0) {
        gwItem.fixtures.forEach(f => {
          totalDifficulty += f.difficulty;
          validCount += 1;
        });
      } else if (gwItem.difficulty > 0) {
        totalDifficulty += gwItem.difficulty;
        validCount += 1;
      }
    });

    if (validCount === 0) return 0;
    return Number((totalDifficulty / validCount).toFixed(2));
  };

  // Comparison Insights computation
  const comparisonInsights = useMemo(() => {
    if (selectedPlayers.length < 2) return null;

    // 1. Points Leader
    const pointsLeader = [...selectedPlayers].sort((a, b) => b.points - a.points)[0];
    
    // 2. Best Underlying Stats (xGI)
    const xgiLeader = [...selectedPlayers].sort((a, b) => b.xGI - a.xGI)[0];

    // 3. Best Form
    const formLeader = [...selectedPlayers].sort((a, b) => b.form - a.form)[0];

    // 4. Best Fixtures (Lowest Avg FDR)
    const withFdr = selectedPlayers.map(p => ({
      player: p,
      avgFdr: getAvgFDR(p.next_3_gw)
    })).filter(x => x.avgFdr > 0);
    const fixtureLeader = withFdr.length > 0 
      ? [...withFdr].sort((a, b) => a.avgFdr - b.avgFdr)[0] 
      : null;

    // 5. Differential Pick (Lowest Ownership %)
    const differential = [...selectedPlayers].sort((a, b) => a.selectedBy - b.selectedBy)[0];

    return {
      pointsLeader,
      xgiLeader,
      formLeader,
      fixtureLeader,
      differential
    };
  }, [selectedPlayers]);

  // Radar Chart Normalized Data (0 to 100 scale)
  const radarChartData = useMemo(() => {
    if (selectedPlayers.length < 2) return [];

    const metricsConfig = [
      { key: 'points', label: 'Points', max: 200, unit: 'pts' },
      { key: 'goals', label: 'Goals', max: 20, unit: 'G' },
      { key: 'assists', label: 'Assists', max: 15, unit: 'A' },
      { key: 'xGI', label: 'xGI', max: 20, unit: '' },
      { key: 'defensiveContribution', label: 'Defensive', max: 40, unit: 'DC' },
      { key: 'form', label: 'Form', max: 10, unit: '' },
      { key: 'ictIndex', label: 'ICT Index', max: 200, unit: '' }
    ];

    return metricsConfig.map(m => {
      const row: any = { metric: m.label, rawUnit: m.unit };
      selectedPlayers.forEach((p, idx) => {
        const rawVal = Number((p as any)[m.key] ?? 0);
        const normalized = Math.min(100, Math.max(5, (rawVal / m.max) * 100));
        row[`p_${p.id}`] = Number(normalized.toFixed(1));
        row[`raw_${p.id}`] = rawVal;
      });
      return row;
    });
  }, [selectedPlayers]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* HERO HEADER */}
      <header className="hero profile-hero bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="container hero-inner max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link href="/" className="back-link inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
              <ArrowLeft size={16} /> Kembali ke Klasemen
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/player" className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors">
                Semua Pemain
              </Link>
            </div>
          </div>

          <div className="profile-title">
            <div className="eyebrow text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-1">
              ERA SUPER LEAGUE • V6.2
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Compare Center
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mt-1">
              Bandingkan performa manager liga atau analisis statistik 2 hingga 3 pemain FPL secara berdampingan.
            </p>
          </div>

          {/* TAB NAVIGATION: COMPARE MANAGER vs COMPARE PLAYER */}
          <div className="flex items-center gap-2 mt-6 p-1 bg-slate-900/90 rounded-xl border border-slate-800 w-fit">
            <Link 
              href="/compare" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <Users size={15} /> Compare Manager
            </Link>
            <button 
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all"
            >
              <BarChart3 size={15} /> Compare Player
            </button>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 mt-8 space-y-8">
        
        {/* PLAYER SELECTION SLOTS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
            <div>
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                HEAD TO HEAD COMPARISON
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Pilih 2 hingga 3 Pemain
              </h2>
              <p className="text-xs text-slate-400">
                Pilih minimal 2 pemain untuk melihat perbandingan statistik musim, underlying stats, dan jadwal fixture.
              </p>
            </div>

            {selectedPlayers.length > 0 && (
              <button 
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <RotateCcw size={13} /> Reset Pilihan
              </button>
            )}
          </div>

          {/* 3 PLAYER SLOTS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((slotIdx) => {
              const player = selectedPlayers[slotIdx];
              const slotColor = PLAYER_COLORS[slotIdx];

              if (player) {
                return (
                  <div 
                    key={`slot-${player.id}`} 
                    className={`relative p-4 rounded-xl border ${slotColor.border} ${slotColor.bg} flex flex-col justify-between transition-all`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-slate-950 ${slotColor.badge}`}>
                          {slotIdx + 1}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-950/80 rounded border border-slate-700 text-slate-300 font-bold">
                          {player.position} • {player.teamShortName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setActiveSlotIndex(slotIdx);
                            setSearchQuery('');
                          }}
                          className="px-2 py-1 text-[11px] font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                          title="Ganti Pemain"
                        >
                          Ganti
                        </button>
                        <button 
                          onClick={() => handleRemoveSlot(slotIdx)}
                          className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          title="Hapus Pemain"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-lg font-black text-white truncate">{player.name}</h3>
                      <div className="text-xs text-slate-400 truncate">{player.fullName}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
                      <div>
                        <div className="text-xs font-bold text-slate-400">PRICE</div>
                        <div className="text-sm font-black text-white">£{player.price.toFixed(1)}m</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400">POINTS</div>
                        <div className={`text-sm font-black ${slotColor.text}`}>{player.points}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400">FORM</div>
                        <div className="text-sm font-black text-amber-400">{player.form.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Empty Slot Card
              return (
                <button
                  key={`empty-slot-${slotIdx}`}
                  onClick={() => {
                    setActiveSlotIndex(slotIdx);
                    setSearchQuery('');
                  }}
                  className={`p-6 rounded-xl border border-dashed border-slate-800 hover:border-cyan-500/60 bg-slate-950/40 hover:bg-cyan-500/5 flex flex-col items-center justify-center text-center group transition-all min-h-[150px]`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-400 flex items-center justify-center mb-2 transition-colors">
                    <Plus size={20} />
                  </div>
                  <div className="text-sm font-bold text-slate-300 group-hover:text-white">
                    {slotIdx === 0 ? 'Pilih Pemain 1' : slotIdx === 1 ? 'Pilih Pemain 2' : '+ Tambah Pemain 3 (Opsional)'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Klik untuk mencari nama atau tim
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* LOADING & EMPTY STATES */}
        {loading ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400 mb-3"></div>
            <p className="text-sm text-slate-400">Memuat data pemain untuk perbandingan...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-2xl text-center">
            <p className="text-rose-300 font-bold mb-2">Terjadi Kesalahan</p>
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        ) : selectedPlayers.length < 2 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-cyan-400 mb-3">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Siap Untuk Dibandingkan</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Pilih minimal 2 pemain pada slot di atas untuk melihat perbandingan statistik mendalam, underlying stats, dan radar performa.
            </p>
          </div>
        ) : (
          <>
            {/* COMPARISON INSIGHTS */}
            {comparisonInsights && (
              <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Flame size={18} className="text-amber-400" />
                  <h3 className="text-base font-bold text-white">Comparison Insights</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                    DATA-DRIVEN
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Points Leader */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Crown size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Points Leader</div>
                      <div className="text-sm font-black text-white">
                        {comparisonInsights.pointsLeader.name} ({comparisonInsights.pointsLeader.points} pts)
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium">Memimpin total FPL Points musim ini</div>
                    </div>
                  </div>

                  {/* Best Underlying Stats */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Target size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Best Underlying (xGI)</div>
                      <div className="text-sm font-black text-white">
                        {comparisonInsights.xgiLeader.name} ({comparisonInsights.xgiLeader.xGI.toFixed(2)})
                      </div>
                      <div className="text-[11px] text-cyan-400 font-medium">Memiliki expected goal involvements tertinggi</div>
                    </div>
                  </div>

                  {/* Best Form */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Best Form</div>
                      <div className="text-sm font-black text-white">
                        {comparisonInsights.formLeader.name} (Form {comparisonInsights.formLeader.form.toFixed(1)})
                      </div>
                      <div className="text-[11px] text-amber-400 font-medium">Performa terkini paling konsisten</div>
                    </div>
                  </div>

                  {/* Fixture Advantage */}
                  {comparisonInsights.fixtureLeader && (
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Better Upcoming Fixtures</div>
                        <div className="text-sm font-black text-white">
                          {comparisonInsights.fixtureLeader.player.name} (Avg FDR {comparisonInsights.fixtureLeader.avgFdr.toFixed(2)})
                        </div>
                        <div className="text-[11px] text-indigo-400 font-medium">Jadwal 3 GW ke depan paling ringan</div>
                      </div>
                    </div>
                  )}

                  {/* Differential Option */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Activity size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Differential Pick</div>
                      <div className="text-sm font-black text-white">
                        {comparisonInsights.differential.name} ({comparisonInsights.differential.selectedBy.toFixed(1)}%)
                      </div>
                      <div className="text-[11px] text-purple-400 font-medium">Pilihan dengan tingkat kepemilikan terendah</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* RADAR CHART VISUALIZATION */}
            {radarChartData.length > 0 && (
              <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                      VISUAL ATTRIBUTE COMPARISON
                    </div>
                    <h3 className="text-lg font-bold text-white">Radar Performa Relatif</h3>
                    <p className="text-xs text-slate-400">
                      Metrik dinormalisasi ke skala 0–100 untuk membandingkan profil pemain secara berimbang.
                    </p>
                  </div>
                </div>

                <div className="w-full h-[320px] sm:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="metric" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const dataItem = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5">
                                <div className="font-bold text-white border-b border-slate-800 pb-1">{label}</div>
                                {selectedPlayers.map((p, i) => {
                                  const raw = dataItem[`raw_${p.id}`];
                                  const color = PLAYER_COLORS[i];
                                  return (
                                    <div key={p.id} className="flex items-center justify-between gap-4">
                                      <span className="font-medium" style={{ color: color.stroke }}>{p.name}:</span>
                                      <span className="font-bold text-white font-mono">{raw} {dataItem.rawUnit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                      {selectedPlayers.map((p, i) => {
                        const color = PLAYER_COLORS[i];
                        return (
                          <Radar
                            key={p.id}
                            name={p.name}
                            dataKey={`p_${p.id}`}
                            stroke={color.stroke}
                            fill={color.fill}
                            fillOpacity={0.25}
                            strokeWidth={2}
                          />
                        );
                      })}
                      <Legend 
                        formatter={(value) => <span className="text-xs font-bold text-slate-200">{value}</span>}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* CORE COMPARISON TABLE */}
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    HEAD-TO-HEAD MATRIX
                  </div>
                  <h3 className="text-lg font-bold text-white">Tabel Perbandingan Statistik</h3>
                  <p className="text-xs text-slate-400">
                    Pemain dengan nilai terbaik otomatis disorot dengan highlight hijau.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  {/* PLAYER HEADER ROW */}
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-1/4">
                        Statistik
                      </th>
                      {selectedPlayers.map((p, i) => {
                        const color = PLAYER_COLORS[i];
                        return (
                          <th key={p.id} className="p-4 text-left border-l border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-slate-950 ${color.badge}`}>
                                {i + 1}
                              </span>
                              <div>
                                <div className="text-sm font-black text-white truncate max-w-[140px]">{p.name}</div>
                                <div className="text-[11px] font-mono text-slate-400">{p.teamShortName} • {p.position}</div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {/* SECTION: FPL PERFORMANCE */}
                    <tr className="bg-slate-950/90 border-t border-b border-slate-800">
                      <td colSpan={selectedPlayers.length + 1} className="px-4 py-2 text-[11px] font-black tracking-widest text-cyan-400 uppercase">
                        A. Performa FPL
                      </td>
                    </tr>
                    <MetricRow 
                      label="Total FPL Points" 
                      sub="Total akumulasi poin musim ini"
                      values={selectedPlayers.map(p => p.points)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.points), 'high')}
                      formatter={v => `${v} pts`}
                    />
                    <MetricRow 
                      label="Goals Scored" 
                      sub="Jumlah gol musim ini"
                      values={selectedPlayers.map(p => p.goals)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.goals), 'high')}
                    />
                    <MetricRow 
                      label="Assists" 
                      sub="Jumlah assist musim ini"
                      values={selectedPlayers.map(p => p.assists)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.assists), 'high')}
                    />
                    <MetricRow 
                      label="Bonus Points" 
                      sub="Total bonus points yang diperoleh"
                      values={selectedPlayers.map(p => p.bonus)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.bonus), 'high')}
                    />
                    <MetricRow 
                      label="BPS (Bonus Point System)" 
                      sub="Skor performa BPS akumulatif"
                      values={selectedPlayers.map(p => p.bps)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.bps), 'high')}
                    />

                    {/* SECTION: UNDERLYING STATS */}
                    <tr className="bg-slate-950/90 border-t border-b border-slate-800">
                      <td colSpan={selectedPlayers.length + 1} className="px-4 py-2 text-[11px] font-black tracking-widest text-cyan-400 uppercase">
                        B. Underlying Performance
                      </td>
                    </tr>
                    <MetricRow 
                      label="Expected Goals (xG)" 
                      sub="Peluang kualitas gol yang tercipta"
                      values={selectedPlayers.map(p => p.xG)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.xG), 'high')}
                      formatter={v => v.toFixed(2)}
                    />
                    <MetricRow 
                      label="Expected Assists (xA)" 
                      sub="Kualitas peluang assist yang dibuat"
                      values={selectedPlayers.map(p => p.xA)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.xA), 'high')}
                      formatter={v => v.toFixed(2)}
                    />
                    <MetricRow 
                      label="Expected Goal Involvements (xGI)" 
                      sub="Kombinasi xG + xA"
                      values={selectedPlayers.map(p => p.xGI)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.xGI), 'high')}
                      formatter={v => v.toFixed(2)}
                    />

                    {/* SECTION: DEFENSIVE */}
                    <tr className="bg-slate-950/90 border-t border-b border-slate-800">
                      <td colSpan={selectedPlayers.length + 1} className="px-4 py-2 text-[11px] font-black tracking-widest text-cyan-400 uppercase">
                        C. Pertahanan & Disiplin
                      </td>
                    </tr>
                    <MetricRow 
                      label="Defensive Contribution (DC)" 
                      sub="Kontribusi aksi bertahan (Tackles, Blocks, Interceptions)"
                      values={selectedPlayers.map(p => p.defensiveContribution)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.defensiveContribution), 'high')}
                    />
                    <MetricRow 
                      label="Clean Sheets" 
                      sub="Jumlah laga tanpa kebobolan"
                      values={selectedPlayers.map(p => p.cleanSheets)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.cleanSheets), 'high')}
                    />
                    <MetricRow 
                      label="Yellow Cards" 
                      sub="Kartu kuning (Lebih sedikit lebih baik)"
                      values={selectedPlayers.map(p => p.yellowCards)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.yellowCards), 'low')}
                    />
                    <MetricRow 
                      label="Red Cards" 
                      sub="Kartu merah (Lebih sedikit lebih baik)"
                      values={selectedPlayers.map(p => p.redCards)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.redCards), 'low')}
                    />
                    <MetricRow 
                      label="Own Goals" 
                      sub="Gol bunuh diri (Lebih sedikit lebih baik)"
                      values={selectedPlayers.map(p => p.ownGoals)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.ownGoals), 'low')}
                    />

                    {/* SECTION: PLAYING TIME */}
                    <tr className="bg-slate-950/90 border-t border-b border-slate-800">
                      <td colSpan={selectedPlayers.length + 1} className="px-4 py-2 text-[11px] font-black tracking-widest text-cyan-400 uppercase">
                        D. Waktu Bermain
                      </td>
                    </tr>
                    <MetricRow 
                      label="Minutes Played" 
                      sub="Total menit bermain di lapangan"
                      values={selectedPlayers.map(p => p.minutes)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.minutes), 'high')}
                      formatter={v => `${v}'`}
                    />
                    <MetricRow 
                      label="Starts" 
                      sub="Jumlah tampil sebagai starter (XI pertama)"
                      values={selectedPlayers.map(p => p.starts)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.starts), 'high')}
                    />

                    {/* SECTION: MARKET & FORM */}
                    <tr className="bg-slate-950/90 border-t border-b border-slate-800">
                      <td colSpan={selectedPlayers.length + 1} className="px-4 py-2 text-[11px] font-black tracking-widest text-cyan-400 uppercase">
                        E. Pasar & Form
                      </td>
                    </tr>
                    <MetricRow 
                      label="Price" 
                      sub="Harga resmi saat ini"
                      values={selectedPlayers.map(p => p.price)}
                      winnerIndices={[]} // Neutral
                      formatter={v => `£${v.toFixed(1)}m`}
                    />
                    <MetricRow 
                      label="Selected %" 
                      sub="Persentase kepemilikan oleh manajer FPL"
                      values={selectedPlayers.map(p => p.selectedBy)}
                      winnerIndices={[]} // Neutral
                      formatter={v => `${v.toFixed(1)}%`}
                    />
                    <MetricRow 
                      label="Form" 
                      sub="Rata-rata poin beberapa laga terakhir"
                      values={selectedPlayers.map(p => p.form)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.form), 'high')}
                      formatter={v => v.toFixed(1)}
                    />
                    <MetricRow 
                      label="ICT Index" 
                      sub="Influence, Creativity, and Threat Index"
                      values={selectedPlayers.map(p => p.ictIndex)}
                      winnerIndices={getWinnerIndices(selectedPlayers.map(p => p.ictIndex), 'high')}
                      formatter={v => v.toFixed(1)}
                    />
                  </tbody>
                </table>
              </div>
            </section>

            {/* NEXT 3 GAMEWEEKS FIXTURES COMPARISON */}
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    UPCOMING SCHEDULE
                  </div>
                  <h3 className="text-lg font-bold text-white">Next 3 Gameweeks & FDR</h3>
                  <p className="text-xs text-slate-400">
                    Jadwal 3 pertandingan mendatang beserta tingkat kesulitan (FDR 1 = Termudah, FDR 5 = Tersulit).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {selectedPlayers.map((p, i) => {
                  const color = PLAYER_COLORS[i];
                  const avgFdr = getAvgFDR(p.next_3_gw);
                  const isBestSchedule = selectedPlayers.length > 1 && 
                    avgFdr > 0 && 
                    avgFdr === Math.min(...selectedPlayers.map(sp => getAvgFDR(sp.next_3_gw)).filter(x => x > 0));

                  return (
                    <div 
                      key={`fix-${p.id}`} 
                      className={`p-4 rounded-xl bg-slate-950/80 border ${isBestSchedule ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'border-slate-800'} space-y-3`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-slate-950 ${color.badge}`}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-white text-sm truncate">{p.name}</span>
                        </div>
                        {isBestSchedule && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Check size={11} /> Jadwal Termudah
                          </span>
                        )}
                      </div>

                      {/* FIXTURE LIST */}
                      <div className="space-y-2 pt-2">
                        {p.next_3_gw && p.next_3_gw.length > 0 ? (
                          p.next_3_gw.map((fix, fIdx) => {
                            if (fix.isBlank) {
                              return (
                                <div 
                                  key={fIdx} 
                                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                                >
                                  <div className="text-xs font-mono font-bold text-slate-400">
                                    GW{fix.gw}
                                  </div>
                                  <span className="text-xs font-mono italic px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                                    BLANK (No Fixture)
                                  </span>
                                </div>
                              );
                            }

                            if (fix.isDGW && fix.fixtures && fix.fixtures.length > 0) {
                              return (
                                <div 
                                  key={fIdx} 
                                  className="p-2.5 rounded-lg bg-slate-900 border border-purple-500/30 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-bold text-purple-400">
                                      GW{fix.gw} • DOUBLE GAMEWEEK
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    {fix.fixtures.map((subFix, sIdx) => (
                                      <div key={sIdx} className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-white">{subFix.label}</span>
                                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${getFdrBadgeClass(subFix.difficulty)}`}>
                                          FDR {subFix.difficulty}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div 
                                key={fIdx} 
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-400">
                                    GW{fix.gw}
                                  </span>
                                  <span className="text-xs font-bold text-white">
                                    {fix.label}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${getFdrBadgeClass(fix.difficulty)}`}>
                                  FDR {fix.difficulty}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500 italic text-center py-4">
                            Tidak ada data fixture mendatang
                          </div>
                        )}
                      </div>

                      {/* AVERAGE FDR */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Average FDR (Next 3 GW):</span>
                        <span className={`font-mono font-bold ${isBestSchedule ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {avgFdr > 0 ? avgFdr.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* MODAL / CANDIDATE PLAYER PICKER */}
        {activeSlotIndex !== null && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* MODAL HEADER */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Pilih Pemain untuk Slot {activeSlotIndex + 1}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cari berdasarkan nama pemain atau klub Premier League
                  </p>
                </div>
                <button 
                  onClick={() => setActiveSlotIndex(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* SEARCH & FILTERS */}
              <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/50">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama pemain (contoh: Salah, Palmer, Haaland)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* POSITION CHIPS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(['ALL', 'GKP', 'DEF', 'MID', 'FWD'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setSelectedPosFilter(pos)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedPosFilter === pos 
                          ? 'bg-cyan-500 text-slate-950' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* PLAYER LIST RESULTS */}
              <div className="overflow-y-auto p-2 flex-1 divide-y divide-slate-800/50">
                {filteredCandidates.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Tidak ditemukan pemain yang sesuai dengan pencarian "{searchQuery}"
                  </div>
                ) : (
                  filteredCandidates.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayer(player)}
                      className="w-full p-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-0.5 bg-slate-800 group-hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 rounded border border-slate-700">
                          {player.position}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white group-hover:text-cyan-300 truncate">
                            {player.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {player.team} ({player.teamShortName})
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-white">
                          £{player.price.toFixed(1)}m
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400 font-bold">
                          {player.points} pts
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// Sub-component for individual metric row in table
function MetricRow({
  label,
  sub,
  values,
  winnerIndices,
  formatter = (v: number) => `${v}`
}: {
  label: string;
  sub?: string;
  values: number[];
  winnerIndices: number[];
  formatter?: (v: number) => string;
}) {
  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
      <td className="p-4">
        <div className="text-xs font-bold text-white">{label}</div>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </td>
      {values.map((val, idx) => {
        const isWinner = winnerIndices.includes(idx);
        return (
          <td 
            key={idx} 
            className={`p-4 border-l border-slate-800 font-mono text-xs ${
              isWinner 
                ? 'bg-emerald-500/10 text-emerald-300 font-bold' 
                : 'text-slate-300 font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>{formatter(val)}</span>
              {isWinner && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400" />
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

export default function PlayerComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Memuat Player Comparison...
      </div>
    }>
      <PlayerCompareContent />
    </Suspense>
  );
}
