'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Crown,
  RefreshCw,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  Award,
  AlertTriangle,
  Flame,
  Target,
  BarChart2,
  TrendingDown,
  ChevronRight,
  Shield,
  Radar,
  Search,
  Filter,
  Swords,
  ArrowRightLeft,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import ScoreTrendChart from './ScoreTrendChart';
import type { LeaguePerformanceInsightsResponse } from '@/app/api/league-insights/route';
import {
  getLeagueOwnershipSummary,
  calculateSquadOverlap,
  calculateLeagueOverlapMatrix,
  calculateLeagueEfficiencyOverview,
  buildCurrentGWManagerDetail,
  type LeagueOwnershipSummary,
  type PlayerOwnershipStats,
  type ManagerWithPicks,
  type SquadOverlapResult,
  type LeagueEfficiencyOverview,
  type CurrentGWManagerSquadDetail,
  type ManagerEfficiencySummary,
} from '@/lib/league-analytics';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

type Row = {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  total: number;
  event_total: number;
  movement: number | null;
};

type Analytics = {
  current: number | null;
  finishedGameweeks: number;
  movementReady: boolean;
  totalManagers: number;
  averageTotal: number;
  leader: Row | null;
  top10: Row[];
  standings: Row[];
  risers: Row[];
  fallers: Row[];
  biggestRiser: Row | null;
  biggestFaller: Row | null;
  highestGWScore: Row | null;
  maxTotal: number;
  currentEvent: any;
  lastUpdated: string;
};

export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // V6.3 League Performance Insights state (independent lifecycle)
  const [insightsData, setInsightsData] = useState<LeaguePerformanceInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState('');

  // V6.4 League Effective Ownership & Differential Radar state
  const [ownershipSummary, setOwnershipSummary] = useState<LeagueOwnershipSummary | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(true);
  const [ownershipSearch, setOwnershipSearch] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'core' | 'differential' | 'GKP' | 'DEF' | 'MID' | 'FWD'>('all');
  const [ownershipSort, setOwnershipSort] = useState<'eo' | 'own' | 'points' | 'name'>('eo');

  // V6.4 Phase 2 Head-to-Head Squad Overlap state
  const [managersWithPicks, setManagersWithPicks] = useState<ManagerWithPicks[]>([]);
  const [selectedManagerAId, setSelectedManagerAId] = useState<number | string | ''>('');
  const [selectedManagerBId, setSelectedManagerBId] = useState<number | string | ''>('');
  const [showMatrix, setShowMatrix] = useState(false);

  // V6.4 Phase 3 Squad Efficiency & Bench Analysis state
  const [picksDetails, setPicksDetails] = useState<Record<string | number, any> | null>(null);
  const [picksMeta, setPicksMeta] = useState<{ isFinished: boolean; dataChecked: boolean; currentGW: number }>({
    isFinished: true,
    dataChecked: true,
    currentGW: 1,
  });
  const [selectedEfficiencyManagerId, setSelectedEfficiencyManagerId] = useState<number | string | ''>('');
  const [efficiencySort, setEfficiencySort] = useState<'efficiency' | 'bench' | 'lineup' | 'rank'>('efficiency');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/analytics', { cache: 'no-store' });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) throw new Error(json?.error || `API error ${r.status}`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Analytics tidak dapat dimuat');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const r = await fetch('/api/league-insights', { cache: 'no-store' });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) throw new Error(json?.error || `API error ${r.status}`);
      setInsightsData(json);
    } catch (e: any) {
      setInsightsError(e?.message || 'Gagal memuat League Performance Insights.');
      setInsightsData(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadOwnership = async () => {
    setOwnershipLoading(true);
    try {
      const r = await fetch('/api/league-picks', { cache: 'no-store' });
      const json = await r.json().catch(() => null);
      if (r.ok && json?.details) {
        // Build standings lookup map from json.standings and data?.standings
        const standingsMap = new Map<string, any>();
        if (Array.isArray(json.standings)) {
          json.standings.forEach((s: any) => {
            if (s?.entry) standingsMap.set(String(s.entry), s);
          });
        }
        if (Array.isArray(data?.standings)) {
          data.standings.forEach((s: any) => {
            if (s?.entry && !standingsMap.has(String(s.entry))) {
              standingsMap.set(String(s.entry), s);
            }
          });
        }

        const rawManagers: ManagerWithPicks[] = Object.values(json.details).map((d: any) => {
          const st = standingsMap.get(String(d.entry));
          const managerName = d.player_name || st?.player_name || `Manager #${d.entry}`;
          const teamName = d.entry_name || st?.entry_name || '';
          const rank = typeof d.rank === 'number' && d.rank > 0
            ? d.rank
            : typeof st?.rank === 'number'
            ? st.rank
            : 999;

          return {
            entry: d.entry,
            name: managerName,
            teamName: teamName,
            rank: rank,
            picks: d.picksList || [],
          };
        }).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

        setManagersWithPicks(rawManagers);
        if (rawManagers.length >= 2) {
          setSelectedManagerAId((prev) => (prev !== '' ? prev : rawManagers[0].entry));
          setSelectedManagerBId((prev) => (prev !== '' ? prev : rawManagers[1].entry));
        }
        if (rawManagers.length >= 1) {
          setSelectedEfficiencyManagerId((prev) => (prev !== '' ? prev : rawManagers[0].entry));
        }

        setPicksDetails(json.details);
        setPicksMeta({
          isFinished: Boolean(json.isFinished ?? true),
          dataChecked: Boolean(json.dataChecked ?? true),
          currentGW: typeof json.current === 'number' ? json.current : 1,
        });

        const summary = getLeagueOwnershipSummary(rawManagers);
        setOwnershipSummary(summary);
      }
    } catch {
      setOwnershipSummary(null);
      setManagersWithPicks([]);
      setPicksDetails(null);
    } finally {
      setOwnershipLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadInsights();
    loadOwnership();
  }, []);

  // Synchronize manager names and team names if data.standings updates or arrives
  useEffect(() => {
    if (!data?.standings || data.standings.length === 0 || managersWithPicks.length === 0) return;
    const standingsMap = new Map<string, any>();
    data.standings.forEach((s: any) => {
      if (s?.entry) standingsMap.set(String(s.entry), s);
    });

    setManagersWithPicks((prev) => {
      let changed = false;
      const updated = prev.map((m) => {
        const s = standingsMap.get(String(m.entry));
        if (s) {
          const newName = s.player_name || m.name;
          const newTeam = s.entry_name || m.teamName;
          const newRank = typeof s.rank === 'number' ? s.rank : m.rank;
          if (newName !== m.name || newTeam !== m.teamName || newRank !== m.rank) {
            changed = true;
            return {
              ...m,
              name: newName,
              teamName: newTeam,
              rank: newRank,
            };
          }
        }
        return m;
      });
      return changed ? updated : prev;
    });
  }, [data?.standings]);

  const perf = insightsData?.performanceInsights;

  const managerA = useMemo(() => {
    return managersWithPicks.find((m) => String(m.entry) === String(selectedManagerAId)) || null;
  }, [managersWithPicks, selectedManagerAId]);

  const managerB = useMemo(() => {
    return managersWithPicks.find((m) => String(m.entry) === String(selectedManagerBId)) || null;
  }, [managersWithPicks, selectedManagerBId]);

  const overlapResult: SquadOverlapResult | null = useMemo(() => {
    if (!managerA || !managerB) return null;
    return calculateSquadOverlap(managerA, managerB);
  }, [managerA, managerB]);

  const leagueMatrixData = useMemo(() => {
    if (managersWithPicks.length < 2) return null;
    return calculateLeagueOverlapMatrix(managersWithPicks);
  }, [managersWithPicks]);

  const leagueEfficiencyOverview: LeagueEfficiencyOverview | null = useMemo(() => {
    if (!insightsData?.managerHistories || insightsData.managerHistories.length === 0) {
      return null;
    }
    return calculateLeagueEfficiencyOverview(
      insightsData.managerHistories,
      picksDetails || undefined,
      picksMeta.currentGW,
      picksMeta.isFinished
    );
  }, [insightsData?.managerHistories, picksDetails, picksMeta.currentGW, picksMeta.isFinished]);

  const sortedEfficiencyManagers = useMemo(() => {
    if (!leagueEfficiencyOverview?.managerSummaries) return [];
    const list = [...leagueEfficiencyOverview.managerSummaries];
    if (efficiencySort === 'efficiency') {
      return list.sort((a, b) => {
        if (a.averageEfficiency === null && b.averageEfficiency === null) return 0;
        if (a.averageEfficiency === null) return 1;
        if (b.averageEfficiency === null) return -1;
        return b.averageEfficiency - a.averageEfficiency;
      });
    }
    if (efficiencySort === 'bench') {
      return list.sort((a, b) => b.totalBenchPoints - a.totalBenchPoints);
    }
    if (efficiencySort === 'lineup') {
      return list.sort((a, b) => {
        const aLineup = a.gameweekHistory.reduce((acc, h) => acc + (h.lineupPoints ?? 0), 0);
        const bLineup = b.gameweekHistory.reduce((acc, h) => acc + (h.lineupPoints ?? 0), 0);
        return bLineup - aLineup;
      });
    }
    if (efficiencySort === 'rank') {
      return list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }
    return list;
  }, [leagueEfficiencyOverview?.managerSummaries, efficiencySort]);

  const currentManagerDetail: CurrentGWManagerSquadDetail | null = useMemo(() => {
    if (!picksDetails || !selectedEfficiencyManagerId) return null;
    const standingsMap = new Map<string, any>();
    if (Array.isArray(data?.standings)) {
      data.standings.forEach((s: any) => {
        if (s?.entry) standingsMap.set(String(s.entry), s);
      });
    }
    return buildCurrentGWManagerDetail(
      selectedEfficiencyManagerId,
      picksDetails,
      standingsMap,
      picksMeta.isFinished,
      picksMeta.dataChecked
    );
  }, [picksDetails, selectedEfficiencyManagerId, data?.standings, picksMeta.isFinished, picksMeta.dataChecked]);

  const filteredPlayers = useMemo(() => {
    if (!ownershipSummary?.players) return [];
    let list = [...ownershipSummary.players];

    // Filter by category or position
    if (ownershipFilter === 'core') {
      list = list.filter((p) => p.category === 'Core');
    } else if (ownershipFilter === 'differential') {
      list = list.filter((p) => p.category === 'Differential');
    } else if (['GKP', 'DEF', 'MID', 'FWD'].includes(ownershipFilter)) {
      list = list.filter((p) => p.position === ownershipFilter);
    }

    // Search query
    if (ownershipSearch.trim()) {
      const q = ownershipSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.playerName.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (ownershipSort === 'eo') {
        return b.effectiveOwnership - a.effectiveOwnership;
      }
      if (ownershipSort === 'own') {
        return b.ownership - a.ownership;
      }
      if (ownershipSort === 'points') {
        return (b.points ?? 0) - (a.points ?? 0);
      }
      return a.playerName.localeCompare(b.playerName);
    });

    return list;
  }, [ownershipSummary, ownershipFilter, ownershipSearch, ownershipSort]);

  if (loading && !data) {
    return (
      <main>
        <section className="hero">
          <div className="container hero-inner">
            <Link href="/" className="back-link">
              ← Kembali ke klasemen
            </Link>
            <div className="profile-title">
              <div className="eyebrow">ERA SUPER LEAGUE • V6.4</div>
              <h1>League Analytics</h1>
            </div>
          </div>
        </section>
        <div className="container page-shell">
          <div className="analytics-loading card flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            <span className="animate-pulse">Memuat data dan menghitung analytics…</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-top">
            <div className="brand-pill">
              <Trophy size={15} /> ERA SUPER LEAGUE
            </div>
            <div className="id-pill">
              LEAGUE ID <b>134820</b>
            </div>
          </div>
          <div className="profile-title">
            <div className="eyebrow">2026 / 27 • ANALYTICS • V6.4</div>
            <h1>
              League <span>Analytics</span>
            </h1>
            <p>Dashboard performa komprehensif dan insight historis Era Super League.</p>
          </div>
          <div className="hero-meta">
            <span>
              <i /> FPL Data
            </span>
            <span>GW {data?.current ?? '—'}</span>
            <span>{fmt(data?.totalManagers ?? 0)} manager</span>
            {data?.lastUpdated && (
              <span className="opacity-70">
                Updated: {new Date(data.lastUpdated).toLocaleTimeString('id-ID')}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="container page-shell">
        {error && (
          <div className="card error-banner">
            <b>Data FPL sedang tidak tersedia. Silakan coba lagi.</b>
            <span>{error}</span>
            <button onClick={loadAnalytics}>Coba lagi</button>
          </div>
        )}

        <div className="analytics-toolbar">
          <Link href="/" className="back-link dark">
            <ArrowLeft size={14} /> Klasemen Utama
          </Link>
          <button
            onClick={() => {
              loadAnalytics();
              loadInsights();
              loadOwnership();
            }}
            disabled={loading || insightsLoading || ownershipLoading}
          >
            <RefreshCw size={14} className={loading || insightsLoading || ownershipLoading ? 'spin' : ''} /> Refresh
            Semua
          </button>
        </div>

        {/* OVERVIEW STATS */}
        <div className="stats-grid">
          <Stat icon={<Users />} value={fmt(data?.totalManagers ?? 0)} label="Total managers" />
          <Stat icon={<Calendar />} value={String(data?.current ?? '—')} label="Current GW" />
          <Stat
            icon={<Zap />}
            value={fmt(data?.currentEvent?.average_entry_score ?? 0)}
            label="Average GW Pts"
          />
          <Stat
            icon={<TrendingUp />}
            value={fmt(data?.highestGWScore?.event_total ?? 0)}
            label="Highest GW Score"
          />
          <Stat icon={<Crown />} value={data?.leader?.player_name || '—'} label="League Leader" />
        </div>

        {/* TOP PERFORMERS CARD */}
        <section className="card my-4 p-6">
          <div className="section-kicker">TOP PERFORMERS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">Highest GW Score</div>
              <div className="text-xl font-bold">{data?.highestGWScore?.player_name || '—'}</div>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">League Leader</div>
              <div className="text-xl font-bold">{data?.leader?.player_name || '—'}</div>
            </div>
          </div>
        </section>

        {/* V6.3 LEAGUE PERFORMANCE INSIGHTS SECTION */}
        <section className="card my-6 p-6 border border-slate-700 bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
            <div>
              <div className="section-kicker flex items-center gap-1.5 text-indigo-400">
                <Sparkles size={14} />
                <span>V6.3 LEAGUE PERFORMANCE INSIGHTS</span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">
                Insight Historis & Dinamika Liga
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Evaluasi performa komparatif, konsistensi, dan pergerakan seluruh manager lintas
                Gameweek.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {perf?.summary && (
                <>
                  <span className="text-xs px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-full font-medium">
                    {perf.summary.completedGameweeks} GW Dianalisis
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full font-medium">
                    {perf.summary.managersAnalyzed} Manager
                  </span>
                </>
              )}
              <button
                onClick={loadInsights}
                disabled={insightsLoading}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh League Insights saja"
              >
                <RefreshCw size={12} className={insightsLoading ? 'spin' : ''} /> Refresh Insight
              </button>
            </div>
          </div>

          {/* INSIGHTS CONTENT STATES */}
          {insightsLoading && !insightsData && (
            <div className="p-8 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="animate-pulse text-sm">
                Mengambil riwayat seluruh manajer & menghitung dinamika liga (V6.3)...
              </span>
            </div>
          )}

          {insightsError && (
            <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <b className="block text-sm">Gagal memuat League Performance Insights.</b>
                  <span className="text-xs text-rose-400/80">{insightsError}</span>
                </div>
              </div>
              <button
                onClick={loadInsights}
                className="text-xs px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!insightsLoading && !insightsError && (!perf || perf.summary.completedGameweeks < 1) && (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
              Belum ada data Gameweek yang cukup untuk League Performance Insights.
            </div>
          )}

          {perf && perf.summary.completedGameweeks >= 1 && (
            <div className="space-y-6">
              {/* NARRATIVE CARD */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/50 via-slate-900/80 to-slate-900/80 border border-indigo-500/40 shadow-lg">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles size={15} />
                  <span>LEAGUE INSIGHT</span>
                </div>
                <p className="text-slate-200 text-sm md:text-base leading-relaxed">
                  {perf.narrative}
                </p>
              </div>

              {/* 7 INSIGHT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* 1. Best Gameweek */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-amber-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">🏆 Best Gameweek</span>
                    <span className="text-[11px] text-slate-500">Rata-rata tertinggi</span>
                  </div>
                  {perf.bestGameweek ? (
                    <div>
                      <div className="text-2xl font-black text-white">
                        GW {perf.bestGameweek.event}
                      </div>
                      <div className="text-xs text-amber-400/90 font-medium mt-1">
                        {perf.bestGameweek.averagePoints} pts rata-rata liga
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">Belum cukup data</div>
                  )}
                </div>

                {/* 2. Toughest Gameweek */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-rose-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">📉 Toughest Gameweek</span>
                    <span className="text-[11px] text-slate-500">Rata-rata terendah</span>
                  </div>
                  {perf.worstGameweek ? (
                    <div>
                      <div className="text-2xl font-black text-white">
                        GW {perf.worstGameweek.event}
                      </div>
                      <div className="text-xs text-rose-400/90 font-medium mt-1">
                        {perf.worstGameweek.averagePoints} pts rata-rata liga
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">Belum cukup data</div>
                  )}
                </div>

                {/* 3. Best Weekly Score */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-emerald-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">⭐ Best Weekly Score</span>
                    <span className="text-[11px] text-slate-500">Skor individu rekor</span>
                  </div>
                  {perf.bestWeeklyPerformance ? (
                    <div>
                      <div className="text-xl font-bold text-white truncate">
                        {perf.bestWeeklyPerformance.managerName}
                      </div>
                      <div className="text-xs text-emerald-400/90 font-semibold mt-1">
                        {perf.bestWeeklyPerformance.points} pts{' '}
                        <span className="text-slate-400 font-normal">
                          (GW {perf.bestWeeklyPerformance.event})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">Belum cukup data</div>
                  )}
                </div>

                {/* 4. Biggest Rank Gain */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-cyan-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">📈 Biggest Rank Gain</span>
                    <span className="text-[11px] text-slate-500">Lompatan posisi</span>
                  </div>
                  {perf.biggestRankGain ? (
                    <div>
                      <div className="text-lg font-bold text-white truncate">
                        {perf.biggestRankGain.managerName}
                      </div>
                      <div className="text-xs text-cyan-400 font-bold mt-1">
                        ↑ {perf.biggestRankGain.movement} posisi{' '}
                        <span className="text-slate-400 font-normal">
                          (ke Rank {perf.biggestRankGain.toRank} • GW{perf.biggestRankGain.event})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        *Reconstructed rank dari total poin
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-slate-400">Belum ada lompatan</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Mulai tersedia saat perbandingan GW aktif.
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Most Consistent */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-violet-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">🎯 Most Consistent</span>
                    <span className="text-[11px] text-slate-500">Std dev terkecil</span>
                  </div>
                  {perf.mostConsistentManager ? (
                    <div>
                      <div className="text-lg font-bold text-white truncate">
                        {perf.mostConsistentManager.managerName}
                      </div>
                      <div className="text-xs text-violet-300 font-semibold mt-1">
                        Std Dev: {perf.mostConsistentManager.standardDeviation} pts{' '}
                        <span className="text-slate-400 font-normal">
                          (Rata-rata: {perf.mostConsistentManager.averagePoints})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-400">
                        Minimal 3 Gameweek diperlukan
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Sample size guard untuk variansi poin.
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Most Volatile */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-amber-500 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">⚡ Most Volatile</span>
                    <span className="text-[11px] text-slate-500">Fluktuasi tertinggi</span>
                  </div>
                  {perf.mostVolatileManager ? (
                    <div>
                      <div className="text-lg font-bold text-white truncate">
                        {perf.mostVolatileManager.managerName}
                      </div>
                      <div className="text-xs text-amber-400 font-semibold mt-1">
                        Std Dev: {perf.mostVolatileManager.standardDeviation} pts{' '}
                        <span className="text-slate-400 font-normal">
                          (Rata-rata: {perf.mostVolatileManager.averagePoints})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-400">
                        Minimal 3 Gameweek diperlukan
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Sample size guard untuk variansi poin.
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. League Competitiveness */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors sm:col-span-2 lg:col-span-3 xl:col-span-2">
                  <div className="flex items-center justify-between gap-2 text-sky-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5">🏁 League Competitiveness</span>
                    <span className="text-[11px] text-slate-500">Gap Leader vs Top 5</span>
                  </div>
                  {perf.competitiveness ? (
                    <div>
                      <div className="text-xl font-bold text-white">
                        {perf.competitiveness.value} pts margin
                      </div>
                      <div className="text-xs text-sky-300/90 font-medium mt-1">
                        {perf.competitiveness.label}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">Belum cukup data</div>
                  )}
                </div>
              </div>

              {/* SCORE TREND CHART */}
              {perf.scoreTrend && perf.scoreTrend.length > 0 && (
                <div className="p-5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        TREN SKOR GAMEWEEK LIGA
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Perbandingan rata-rata, skor tertinggi, dan skor terendah seluruh manager per
                        pekan
                      </div>
                    </div>
                  </div>
                  <ScoreTrendChart data={perf.scoreTrend} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* V6.4 LEAGUE EFFECTIVE OWNERSHIP & DIFFERENTIAL RADAR */}
        <section className="card feature-card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="section-kicker flex items-center gap-1.5">
                <Radar size={13} className="text-cyan-400" />
                <span>V6.4 RADAR ANALYTICS</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">
                League Effective Ownership &amp; Differential Radar
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Petakan konsensus manajer, perisai ranking (Shield Picks), dan pemain pembeda (Differentials) di Era Super League.
              </p>
            </div>
            {ownershipSummary && (
              <div className="text-xs bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-full text-slate-300 font-medium">
                {ownershipSummary.totalManagers} Manajer • {ownershipSummary.players.length} Pemain Unik Terdaftar
              </div>
            )}
          </div>

          {ownershipLoading && !ownershipSummary ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-cyan-400" />
              <span>Menghitung Effective Ownership &amp; Radar Differential…</span>
            </div>
          ) : !ownershipSummary ? (
            <div className="p-6 text-center text-slate-500 italic">
              Data kepemilikan pemain sedang tidak tersedia.
            </div>
          ) : (
            <div className="space-y-6">
              {/* 4 SUMMARY RADAR CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Top Owned Player */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-cyan-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5"><Crown size={14} /> Top Owned Player</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">CORE</span>
                  </div>
                  {ownershipSummary.mostOwnedPlayer ? (
                    <div>
                      <div className="text-lg font-black text-white truncate">
                        {ownershipSummary.mostOwnedPlayer.playerName}
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        {ownershipSummary.mostOwnedPlayer.team} • {ownershipSummary.mostOwnedPlayer.position}
                      </div>
                      <div className="text-xl font-black text-cyan-300">
                        {ownershipSummary.mostOwnedPlayer.ownership}%
                        <span className="text-xs font-normal text-slate-400 ml-1.5">
                          ({ownershipSummary.mostOwnedPlayer.ownerCount}/{ownershipSummary.totalManagers})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Paling banyak dimiliki di liga
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">—</div>
                  )}
                </div>

                {/* 2. Highest EO / Consensus Shield Pick */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-emerald-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5"><Shield size={14} /> Highest Effective Own</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">SHIELD</span>
                  </div>
                  {ownershipSummary.highestEOPlayer ? (
                    <div>
                      <div className="text-lg font-black text-white truncate">
                        {ownershipSummary.highestEOPlayer.playerName}
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        {ownershipSummary.highestEOPlayer.team} • {ownershipSummary.highestEOPlayer.position}
                      </div>
                      <div className="text-xl font-black text-emerald-400">
                        {ownershipSummary.highestEOPlayer.effectiveOwnership}%
                        <span className="text-xs font-normal text-slate-400 ml-1.5">EO</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {ownershipSummary.highestEOPlayer.captainCount} manajer kapten ({ownershipSummary.highestEOPlayer.tripleCaptainCount > 0 ? `${ownershipSummary.highestEOPlayer.tripleCaptainCount} TC` : '0 TC'})
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">—</div>
                  )}
                </div>

                {/* 3. Top Differential Pick */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-amber-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5"><Target size={14} /> Top Differential</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 font-bold">&lt;15%</span>
                  </div>
                  {ownershipSummary.topDifferential ? (
                    <div>
                      <div className="text-lg font-black text-white truncate">
                        {ownershipSummary.topDifferential.playerName}
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        {ownershipSummary.topDifferential.team} • {ownershipSummary.topDifferential.position}
                      </div>
                      <div className="text-xl font-black text-amber-300">
                        {ownershipSummary.topDifferential.ownership}%
                        <span className="text-xs font-normal text-slate-400 ml-1.5">
                          ({ownershipSummary.topDifferential.ownerCount}/{ownershipSummary.totalManagers})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {typeof ownershipSummary.topDifferential.points === 'number'
                          ? `${ownershipSummary.topDifferential.points} pts pekan ini`
                          : 'Peluang panjat ranking'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">—</div>
                  )}
                </div>

                {/* 4. Consensus Structure */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-indigo-400 text-xs font-semibold mb-2">
                    <span className="flex items-center gap-1.5"><Users size={14} /> Consensus Split</span>
                    <span className="text-[10px] text-slate-500">Struktur Liga</span>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-cyan-300 font-semibold">Core (&gt;60%):</span>
                      <strong className="text-white font-bold">{ownershipSummary.corePlayers.length} pemain</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-amber-300 font-semibold">Differential (&lt;15%):</span>
                      <strong className="text-white font-bold">{ownershipSummary.differentialPlayers.length} pemain</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="text-slate-400">Standard (15-60%):</span>
                      <strong className="text-slate-300 font-bold">{ownershipSummary.standardPlayers.length} pemain</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                      Total pool: {ownershipSummary.players.length} pemain
                    </div>
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTERS CONTROLS */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={ownershipSearch}
                    onChange={(e) => setOwnershipSearch(e.target.value)}
                    placeholder="Cari nama pemain, klub, atau posisi..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {ownershipSearch && (
                    <button
                      onClick={() => setOwnershipSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setOwnershipFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      ownershipFilter === 'all'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Semua ({ownershipSummary.players.length})
                  </button>
                  <button
                    onClick={() => setOwnershipFilter('core')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      ownershipFilter === 'core'
                        ? 'bg-cyan-400 text-slate-950 shadow'
                        : 'bg-slate-900 text-cyan-400/90 hover:text-cyan-300 border border-slate-800'
                    }`}
                  >
                    Core ({ownershipSummary.corePlayers.length})
                  </button>
                  <button
                    onClick={() => setOwnershipFilter('differential')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      ownershipFilter === 'differential'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-slate-900 text-amber-400/90 hover:text-amber-300 border border-slate-800'
                    }`}
                  >
                    Diff ({ownershipSummary.differentialPlayers.length})
                  </button>
                  {(['GKP', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setOwnershipFilter(pos)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                        ownershipFilter === pos
                          ? 'bg-slate-200 text-slate-950 shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={ownershipSort}
                    onChange={(e: any) => setOwnershipSort(e.target.value)}
                    className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="eo">Sort: Effective Ownership (EO ↓)</option>
                    <option value="own">Sort: Total Ownership (% ↓)</option>
                    <option value="points">Sort: Poin Pekan Ini (Pts ↓)</option>
                    <option value="name">Sort: Nama Pemain (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* TABLE RADAR */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">#</th>
                      <th className="py-3 px-3">Pemain</th>
                      <th className="py-3 px-2 text-center w-14">Pos</th>
                      <th className="py-3 px-3">League Ownership</th>
                      <th className="py-3 px-3 text-center">Starting</th>
                      <th className="py-3 px-3 text-center">Captains</th>
                      <th className="py-3 px-3 text-right">Effective Own (EO)</th>
                      <th className="py-3 px-3 text-right w-16">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                          Tidak ada pemain yang sesuai kriteria pencarian / filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((p, idx) => {
                        const isShield = p.effectiveOwnership >= 80;
                        const isOver100 = p.effectiveOwnership >= 100;
                        return (
                          <tr
                            key={p.playerId}
                            className="hover:bg-slate-900/60 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-sm">
                                  {p.playerName}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {p.team}
                                </span>
                                {p.category === 'Core' && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 tracking-wider">
                                    CORE
                                  </span>
                                )}
                                {p.category === 'Differential' && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 tracking-wider">
                                    DIFF
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  p.position === 'GKP'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                    : p.position === 'DEF'
                                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                    : p.position === 'MID'
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {p.position}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      p.category === 'Core'
                                        ? 'bg-cyan-400'
                                        : p.category === 'Differential'
                                        ? 'bg-amber-400'
                                        : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${Math.min(100, p.ownership)}%` }}
                                  />
                                </div>
                                <span className="font-mono font-semibold text-slate-200">
                                  {p.ownership}%
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({p.ownerCount}/{ownershipSummary.totalManagers})
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                              {p.startingOwnership}%
                              <span className="text-[10px] text-slate-500 block">
                                {p.starterCount} starter
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {p.captainCount > 0 ? (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded text-[11px]">
                                  {p.captainCount} C
                                  {p.tripleCaptainCount > 0 && (
                                    <span className="text-[9px] text-cyan-300 font-extrabold ml-0.5">
                                      ({p.tripleCaptainCount} TC)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-600 font-mono">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`font-mono font-black text-sm px-2 py-0.5 rounded ${
                                  isOver100
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                    : isShield
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                                    : 'text-slate-200'
                                }`}
                              >
                                {p.effectiveOwnership}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                              {typeof p.points === 'number' ? p.points : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* RADAR METHODOLOGY NOTE */}
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <strong className="text-slate-300">Formula Metrik:</strong> Effective Ownership (EO) = Starting Ownership (%) + Captain Exposure (%).
                  Pemain dengan EO &gt; 100% berarti poin mereka berdampak ganda terhadap rata-rata mini-league jika dikapteni banyak manajer.
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  Core: &gt;60% • Differential: &lt;15%
                </div>
              </div>
            </div>
          )}
        </section>

        {/* V6.4 PHASE 2: HEAD-TO-HEAD SQUAD OVERLAP & RIVAL SIMILARITY MATRIX */}
        <section className="card feature-card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="section-kicker flex items-center gap-1.5">
                <Swords size={13} className="text-amber-400" />
                <span>V6.4 RIVAL ANALYSIS</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">
                Head-to-Head Squad Overlap
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Compare squad similarity across Era Super League managers.
              </p>
            </div>
            {managersWithPicks.length > 0 && (
              <div className="text-xs bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-full text-slate-300 font-medium flex items-center gap-2">
                <UserCheck size={13} className="text-emerald-400" />
                <span>{managersWithPicks.length} Manajer Siap Dibandingkan</span>
              </div>
            )}
          </div>

          {ownershipLoading && managersWithPicks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-amber-400" />
              <span>Memuat data squad manajer Era Super League…</span>
            </div>
          ) : managersWithPicks.length < 2 ? (
            <div className="p-6 text-center text-slate-500 italic">
              Data squad manajer belum tersedia untuk perbandingan head-to-head.
            </div>
          ) : (
            <div className="space-y-6">
              {/* MANAGER SELECTOR */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Selector Manager A */}
                  <div>
                    <label className="block text-[11px] font-bold tracking-wider text-cyan-400 uppercase mb-1.5">
                      Manager A
                    </label>
                    <select
                      value={selectedManagerAId}
                      onChange={(e) => setSelectedManagerAId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-cyan-400"
                    >
                      {managersWithPicks.map((m) => (
                        <option key={`a-${m.entry}`} value={m.entry}>
                          #{m.rank ?? '—'} — {m.name} ({m.teamName || 'Team'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center pt-2 md:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = selectedManagerAId;
                        setSelectedManagerAId(selectedManagerBId);
                        setSelectedManagerBId(temp);
                      }}
                      title="Tukar posisi Manager A dan Manager B"
                      className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-400/60 transition-all flex items-center justify-center shadow"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                  </div>

                  {/* Selector Manager B */}
                  <div>
                    <label className="block text-[11px] font-bold tracking-wider text-rose-400 uppercase mb-1.5">
                      Manager B
                    </label>
                    <select
                      value={selectedManagerBId}
                      onChange={(e) => setSelectedManagerBId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-rose-400"
                    >
                      {managersWithPicks.map((m) => (
                        <option
                          key={`b-${m.entry}`}
                          value={m.entry}
                          disabled={String(m.entry) === String(selectedManagerAId)}
                        >
                          #{m.rank ?? '—'} — {m.name} ({m.teamName || 'Team'}) {String(m.entry) === String(selectedManagerAId) ? '— (Terpilih di A)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* HEAD-TO-HEAD HEADER */}
              {managerA && managerB && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Manager A */}
                    <div className="text-center sm:text-left flex-1 min-w-0">
                      <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                          #{managerA.rank ?? '—'}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                          Manager A
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-white truncate">
                        {managerA.name}
                      </div>
                      <div className="text-sm font-medium text-slate-400 truncate">
                        {managerA.teamName || 'Era Super League'}
                      </div>
                    </div>

                    {/* VS Badge */}
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-xs shadow-inner">
                        vs
                      </div>
                    </div>

                    {/* Manager B */}
                    <div className="text-center sm:text-right flex-1 min-w-0">
                      <div className="flex items-center justify-center sm:justify-end gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                          Manager B
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 font-mono">
                          #{managerB.rank ?? '—'}
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-white truncate">
                        {managerB.name}
                      </div>
                      <div className="text-sm font-medium text-slate-400 truncate">
                        {managerB.teamName || 'Era Super League'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OVERLAP SUMMARY & NARRATIVE */}
              {overlapResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* OVERLAP CARD */}
                  <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-300 truncate mb-1" title={`${overlapResult.managerAName} vs ${overlapResult.managerBName}`}>
                        {overlapResult.managerAName} vs {overlapResult.managerBName}
                      </div>
                      <div className="flex items-baseline gap-3 my-2">
                        <span className="text-3xl md:text-4xl font-black text-white font-mono">
                          {overlapResult.overlapPercentage}%
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Squad Overlap
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {overlapResult.overlapCount} dari {Math.min(overlapResult.squadASize, overlapResult.squadBSize) || 15} pemain sama
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 mt-3 mb-2">
                        <div
                          className={`h-full transition-all duration-500 ${
                            overlapResult.overlapPercentage >= 80
                              ? 'bg-emerald-400'
                              : overlapResult.overlapPercentage >= 60
                              ? 'bg-cyan-400'
                              : overlapResult.overlapPercentage >= 40
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, overlapResult.overlapPercentage))}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block truncate">Unik {overlapResult.managerAName}:</span>
                        <strong className="text-cyan-300 font-mono text-sm">{overlapResult.uniqueToAPlayers.length} pemain</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block truncate">Unik {overlapResult.managerBName}:</span>
                        <strong className="text-rose-300 font-mono text-sm">{overlapResult.uniqueToBPlayers.length} pemain</strong>
                      </div>
                    </div>
                  </div>

                  {/* RIVAL INSIGHT NARRATIVE */}
                  <div className="lg:col-span-2 bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                        <Sparkles size={14} />
                        <span>Rival Insight</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        {overlapResult.managerAName} vs {overlapResult.managerBName}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                        {overlapResult.narrative}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        Basis: <strong className="text-slate-300">Set-Intersection</strong> berdasar <code>playerId</code> resmi FPL.
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Denominator: min({overlapResult.squadASize}, {overlapResult.squadBSize}) squad
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* COMMON & UNIQUE PLAYERS GRID */}
              {overlapResult && (
                <div className="space-y-4">
                  {/* COMMON PLAYERS PANEL */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          Common Players ({overlapResult.commonPlayers.length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400">Dimiliki bersama oleh kedua manajer</span>
                    </div>

                    {overlapResult.commonPlayers.length === 0 ? (
                      <div className="text-xs text-slate-500 italic p-3 text-center">
                        Tidak ada pemain yang sama antara kedua squad (0% overlap).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {overlapResult.commonPlayers.map((p) => {
                          const posBg =
                            p.position === 'GKP'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              : p.position === 'DEF'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                              : p.position === 'MID'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-950/80 text-rose-300 border-rose-500/40';

                          return (
                            <div
                              key={`common-${p.id}`}
                              className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${posBg}`}>
                                  {p.position}
                                </span>
                                <div className="truncate">
                                  <span className="text-xs font-bold text-slate-200 truncate block">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{p.team}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {p.isCaptainA && (
                                  <span className="text-[9px] font-black px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-400/60" title={`Kapten Manager A (${overlapResult.managerAName})`}>
                                    C(A)
                                  </span>
                                )}
                                {p.isCaptainB && (
                                  <span className="text-[9px] font-black px-1 rounded bg-rose-950 text-rose-300 border border-rose-400/60" title={`Kapten Manager B (${overlapResult.managerBName})`}>
                                    C(B)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* UNIQUE PLAYERS COMPARISON (SIDE BY SIDE) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ONLY MANAGER A */}
                    <div className="bg-slate-900/70 border border-cyan-900/40 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <h4 className="text-sm font-bold text-cyan-200 uppercase tracking-wider truncate">
                            Only {overlapResult.managerAName} ({overlapResult.uniqueToAPlayers.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-cyan-400/80 font-mono font-bold">Manager A</span>
                      </div>

                      {overlapResult.uniqueToAPlayers.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-4 text-center">
                          Tidak ada pemain unik (squad 100% identik).
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {overlapResult.uniqueToAPlayers.map((p) => {
                            const posBg =
                              p.position === 'GKP'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : p.position === 'DEF'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                                : p.position === 'MID'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-950/80 text-rose-300 border-rose-500/40';

                            return (
                              <div
                                key={`uniq-a-${p.id}`}
                                className="bg-slate-950/70 border border-slate-800/80 hover:border-cyan-800/60 px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${posBg}`}>
                                    {p.position}
                                  </span>
                                  <span className="text-xs font-bold text-slate-200 truncate">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{p.team}</span>
                                </div>
                                {p.isCaptain && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">
                                    CAPTAIN
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ONLY MANAGER B */}
                    <div className="bg-slate-900/70 border border-rose-900/40 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          <h4 className="text-sm font-bold text-rose-200 uppercase tracking-wider truncate">
                            Only {overlapResult.managerBName} ({overlapResult.uniqueToBPlayers.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-rose-400/80 font-mono font-bold">Manager B</span>
                      </div>

                      {overlapResult.uniqueToBPlayers.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-4 text-center">
                          Tidak ada pemain unik (squad 100% identik).
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {overlapResult.uniqueToBPlayers.map((p) => {
                            const posBg =
                              p.position === 'GKP'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : p.position === 'DEF'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                                : p.position === 'MID'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-950/80 text-rose-300 border-rose-500/40';

                            return (
                              <div
                                key={`uniq-b-${p.id}`}
                                className="bg-slate-950/70 border border-slate-800/80 hover:border-rose-800/60 px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${posBg}`}>
                                    {p.position}
                                  </span>
                                  <span className="text-xs font-bold text-slate-200 truncate">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{p.team}</span>
                                </div>
                                {p.isCaptain && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">
                                    CAPTAIN
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* LEAGUE-WIDE RIVAL MATRIX & LEAGUE INSIGHTS (SECTIONS 10 & 11) */}
              {leagueMatrixData && (
                <div className="pt-2">
                  {/* 3 LEAGUE INSIGHTS CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/* Most Similar Rival */}
                    {leagueMatrixData.insights.mostSimilarPair && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!leagueMatrixData.insights.mostSimilarPair) return;
                          setSelectedManagerAId(leagueMatrixData.insights.mostSimilarPair.managerA.id);
                          setSelectedManagerBId(leagueMatrixData.insights.mostSimilarPair.managerB.id);
                        }}
                        className="text-left bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-3.5 rounded-xl transition-all group"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                            Most Similar Rival
                          </span>
                          <span className="font-mono text-emerald-300 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            {leagueMatrixData.insights.mostSimilarPair.overlapPercentage}% ({leagueMatrixData.insights.mostSimilarPair.overlapCount}/15)
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                          {leagueMatrixData.insights.mostSimilarPair.managerA.name}
                          {leagueMatrixData.insights.mostSimilarPair.managerA.team ? ` — ${leagueMatrixData.insights.mostSimilarPair.managerA.team}` : ''}
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          vs {leagueMatrixData.insights.mostSimilarPair.managerB.name}
                          {leagueMatrixData.insights.mostSimilarPair.managerB.team ? ` — ${leagueMatrixData.insights.mostSimilarPair.managerB.team}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Klik untuk bandingkan pair ini ↗</div>
                      </button>
                    )}

                    {/* Most Different Rival */}
                    {leagueMatrixData.insights.mostDifferentPair && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!leagueMatrixData.insights.mostDifferentPair) return;
                          setSelectedManagerAId(leagueMatrixData.insights.mostDifferentPair.managerA.id);
                          setSelectedManagerBId(leagueMatrixData.insights.mostDifferentPair.managerB.id);
                        }}
                        className="text-left bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-3.5 rounded-xl transition-all group"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-bold text-rose-400 uppercase tracking-wider text-[10px]">
                            Most Different Rival
                          </span>
                          <span className="font-mono text-rose-300 font-bold bg-rose-950 px-1.5 py-0.2 rounded border border-rose-500/30">
                            {leagueMatrixData.insights.mostDifferentPair.overlapPercentage}% ({leagueMatrixData.insights.mostDifferentPair.overlapCount}/15)
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white truncate group-hover:text-rose-300 transition-colors">
                          {leagueMatrixData.insights.mostDifferentPair.managerA.name}
                          {leagueMatrixData.insights.mostDifferentPair.managerA.team ? ` — ${leagueMatrixData.insights.mostDifferentPair.managerA.team}` : ''}
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          vs {leagueMatrixData.insights.mostDifferentPair.managerB.name}
                          {leagueMatrixData.insights.mostDifferentPair.managerB.team ? ` — ${leagueMatrixData.insights.mostDifferentPair.managerB.team}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Klik untuk bandingkan pair ini ↗</div>
                      </button>
                    )}

                    {/* Most Unique Manager */}
                    {leagueMatrixData.insights.mostUniqueManager && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!leagueMatrixData.insights.mostUniqueManager) return;
                          setSelectedManagerAId(leagueMatrixData.insights.mostUniqueManager.id);
                        }}
                        className="text-left bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-3.5 rounded-xl transition-all group"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                            Most Unique Manager
                          </span>
                          <span className="font-mono text-amber-300 font-bold bg-amber-950 px-1.5 py-0.2 rounded border border-amber-500/30">
                            Rata² {leagueMatrixData.insights.mostUniqueManager.averageOverlap}%
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                          {leagueMatrixData.insights.mostUniqueManager.name}
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          {leagueMatrixData.insights.mostUniqueManager.team || 'Era Super League'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Paling sedikit memiliki squad overlap di liga</div>
                      </button>
                    )}
                  </div>

                  {/* SQUAD SIMILARITY MATRIX TABLE (COLLAPSIBLE) */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowMatrix((v) => !v)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          Squad Similarity Matrix ({managersWithPicks.length} × {managersWithPicks.length})
                        </span>
                        <span className="text-xs text-slate-400 hidden sm:inline">
                          • Matriks simetris perbandingan antar semua manajer
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium">
                        <span>{showMatrix ? 'Sembunyikan' : 'Buka Matriks'}</span>
                        {showMatrix ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {showMatrix && (
                      <div className="p-4 border-t border-slate-800 space-y-3">
                        <p className="text-xs text-slate-400">
                          Matriks dihitung secara in-memory (zero extra network calls). Klik nilai sel untuk memuat perbandingan kedua manajer di atas.
                        </p>
                        <div className="overflow-x-auto max-h-[480px]">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800">
                              <tr>
                                <th className="p-2 text-slate-400 font-bold sticky left-0 bg-slate-950 z-20 min-w-[150px]">
                                  Manager
                                </th>
                                {leagueMatrixData.matrix.map((row) => {
                                  const shortName = row.managerName.split(' ')[0] || row.managerName;
                                  return (
                                    <th
                                      key={`col-${row.managerId}`}
                                      className="p-2 text-center text-slate-300 font-medium min-w-[70px] whitespace-nowrap"
                                      title={`${row.managerName} (${row.teamName || 'Team'}) — Rank #${row.rank ?? '—'}`}
                                    >
                                      <div className="text-[11px] font-bold text-slate-200 truncate max-w-[76px] mx-auto">
                                        {shortName}
                                      </div>
                                      <div className="text-[9px] text-slate-500 font-mono">
                                        #{row.rank ?? '—'}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {leagueMatrixData.matrix.map((row) => (
                                <tr key={`row-${row.managerId}`} className="hover:bg-slate-800/30">
                                  <td
                                    className="p-2 font-medium text-slate-200 sticky left-0 bg-slate-900/95 z-10 border-r border-slate-800 truncate max-w-[180px]"
                                    title={`${row.managerName} (${row.teamName || 'Team'}) — Rank #${row.rank ?? '—'}`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-slate-500 font-mono text-[10px]">#{row.rank ?? '—'}</span>
                                      <span className="font-bold text-slate-200 truncate text-xs">{row.managerName}</span>
                                    </div>
                                    {row.teamName && (
                                      <div className="text-[10px] text-slate-400 truncate pl-3">
                                        {row.teamName}
                                      </div>
                                    )}
                                  </td>
                                  {row.overlaps.map((cell) => {
                                    const isSelf = String(cell.targetManagerId) === String(row.managerId);
                                    if (isSelf) {
                                      return (
                                        <td key={`c-${row.managerId}-${cell.targetManagerId}`} className="p-2 text-center text-slate-600 font-mono">
                                          —
                                        </td>
                                      );
                                    }

                                    const pct = cell.overlapPercentage;
                                    const heatClass =
                                      pct >= 80
                                        ? 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950 font-black'
                                        : pct >= 60
                                        ? 'text-cyan-300 bg-cyan-950/30 hover:bg-cyan-950 font-bold'
                                        : pct >= 40
                                        ? 'text-amber-300 bg-amber-950/20 hover:bg-amber-950'
                                        : 'text-slate-400 hover:bg-slate-800/50';

                                    const targetMgr = managersWithPicks.find((m) => String(m.entry) === String(cell.targetManagerId));
                                    const targetLabel = targetMgr ? `${targetMgr.name}` : 'Manager';

                                    return (
                                      <td key={`c-${row.managerId}-${cell.targetManagerId}`} className="p-1 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedManagerAId(row.managerId);
                                            setSelectedManagerBId(cell.targetManagerId);
                                          }}
                                          title={`Bandingkan ${row.managerName} vs ${targetLabel}: ${cell.overlapPercentage}% (${cell.overlapCount} pemain)`}
                                          className={`w-full py-1 rounded text-[11px] font-mono transition-colors ${heatClass}`}
                                        >
                                          {pct}%
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* V6.4 PHASE 3 — SQUAD EFFICIENCY & BENCH ANALYSIS */}
        <section className="card feature-card p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
            <div>
              <div className="section-kicker flex items-center gap-1.5 text-cyan-400">
                <Activity size={14} />
                <span>V6.4 SQUAD EFFICIENCY & BENCH ANALYSIS</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Starting XI Efficiency & Bench Analysis
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                Analisis matematis pemanfaatan starting XI dan kedalaman poin cadangan (bench). Poin cadangan merepresentasikan proteksi dan squad depth manajer tanpa bias pejoratif.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {picksMeta.isFinished && picksMeta.dataChecked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 size={13} />
                  GW {picksMeta.currentGW} Final
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/30">
                  <AlertTriangle size={13} />
                  GW {picksMeta.currentGW} Sedang Berlangsung (Data Sementara)
                </span>
              )}
            </div>
          </div>

          {insightsLoading && !leagueEfficiencyOverview ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-3">
              <RefreshCw className="animate-spin text-cyan-400" size={20} />
              <span>Memproses analitika Squad Efficiency & Bench liga...</span>
            </div>
          ) : !leagueEfficiencyOverview ? (
            <div className="text-center py-8 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 p-6">
              <AlertTriangle className="mx-auto text-amber-400 mb-2" size={28} />
              <p className="text-sm font-semibold text-white">Data Efficiency Liga Belum Tersedia</p>
              <p className="text-xs text-slate-400 mt-1">
                Data historis gameweek sedang disinkronisasikan dari server FPL.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. OVERVIEW STAT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* League Average Starting XI Efficiency */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">
                      Rata² Efisiensi Liga
                    </span>
                    <Percent size={14} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {leagueEfficiencyOverview.leagueAverageEfficiency !== null
                      ? `${leagueEfficiencyOverview.leagueAverageEfficiency}%`
                      : 'N/A'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Rata-rata starting XI reguler liga (eksklusi Bench Boost)
                  </div>
                </div>

                {/* Highest Efficiency Manager */}
                {leagueEfficiencyOverview.highestEfficiencyManager && (
                  <button
                    type="button"
                    onClick={() => {
                      if (leagueEfficiencyOverview.highestEfficiencyManager) {
                        setSelectedEfficiencyManagerId(
                          leagueEfficiencyOverview.highestEfficiencyManager.managerId
                        );
                      }
                    }}
                    className="text-left bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                          Efisiensi Tertinggi Liga
                        </span>
                        <span className="font-mono text-emerald-300 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          {leagueEfficiencyOverview.highestEfficiencyManager.value}%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        #{leagueEfficiencyOverview.highestEfficiencyManager.rank} —{' '}
                        {leagueEfficiencyOverview.highestEfficiencyManager.managerName}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {leagueEfficiencyOverview.highestEfficiencyManager.teamName || '—'}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                      <span>Efisiensi starting XI terbaik</span>
                      <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform">Inspeksi ↗</span>
                    </div>
                  </button>
                )}

                {/* Lowest Efficiency Manager */}
                {leagueEfficiencyOverview.lowestEfficiencyManager && (
                  <button
                    type="button"
                    onClick={() => {
                      if (leagueEfficiencyOverview.lowestEfficiencyManager) {
                        setSelectedEfficiencyManagerId(
                          leagueEfficiencyOverview.lowestEfficiencyManager.managerId
                        );
                      }
                    }}
                    className="text-left bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                          Efisiensi Terendah Liga
                        </span>
                        <span className="font-mono text-amber-300 font-bold bg-amber-950 px-1.5 py-0.2 rounded border border-amber-500/30">
                          {leagueEfficiencyOverview.lowestEfficiencyManager.value}%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                        #{leagueEfficiencyOverview.lowestEfficiencyManager.rank} —{' '}
                        {leagueEfficiencyOverview.lowestEfficiencyManager.managerName}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {leagueEfficiencyOverview.lowestEfficiencyManager.teamName || '—'}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                      <span>Rasio starting XI terendah</span>
                      <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform">Inspeksi ↗</span>
                    </div>
                  </button>
                )}

                {/* Total & Average Bench Points */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-bold text-purple-400 uppercase tracking-wider text-[10px]">
                        Total Poin Cadangan
                      </span>
                      <Layers size={14} className="text-purple-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                      {fmt(leagueEfficiencyOverview.totalLeagueBenchPoints)} pts
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5 border-t border-slate-800/60 pt-2">
                    <div>Rata-rata {leagueEfficiencyOverview.leagueAverageBenchPoints} pts / manajer / GW</div>
                    {leagueEfficiencyOverview.highestBenchManager && (
                      <div className="text-[10px] text-purple-300 font-medium truncate">
                        Most Bench Points: #{leagueEfficiencyOverview.highestBenchManager.rank} {leagueEfficiencyOverview.highestBenchManager.managerName} ({leagueEfficiencyOverview.highestBenchManager.value} pts)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. EFFICIENCY TREND ACROSS GAMEWEEKS */}
              {leagueEfficiencyOverview.gameweekTrends.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <TrendingUp size={16} className="text-cyan-400" />
                        Tren Starting XI Efficiency per Gameweek
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Rata-rata rasio Starting XI vs Poin Cadangan liga dari pekan ke pekan (tidak memplot nilai null).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {leagueEfficiencyOverview.gameweekTrends.map((trend) => {
                      const effVal = trend.averageEfficiency;
                      const hasEff = typeof effVal === 'number';
                      const pct = hasEff ? Math.min(100, Math.max(0, effVal)) : 0;

                      return (
                        <div
                          key={`trend-gw-${trend.gameweek}`}
                          className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-lg flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-200">
                              Gameweek {trend.gameweek}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                !hasEff
                                  ? 'bg-slate-800 text-slate-400'
                                  : effVal >= 80
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : effVal >= 70
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {hasEff ? `${effVal}%` : 'N/A'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                            <div
                              className={`h-full transition-all ${
                                !hasEff
                                  ? 'bg-slate-700'
                                  : effVal >= 80
                                  ? 'bg-emerald-400'
                                  : effVal >= 70
                                  ? 'bg-cyan-400'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 font-mono">
                            <span>Lineup: {trend.averageLineupPoints} pts</span>
                            <span>Bench: {trend.averageBenchPoints} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. MANAGER EFFICIENCY LEADERBOARD TABLE */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Award size={16} className="text-cyan-400" />
                      Leaderboard Starting XI Efficiency Manajer
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Peringkat pemanfaatan starting XI manajer Era Super League sepanjang musim.
                    </p>
                  </div>

                  {/* Sort filters */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-400 mr-1 text-[11px]">Urutkan:</span>
                    <button
                      type="button"
                      onClick={() => setEfficiencySort('efficiency')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        efficiencySort === 'efficiency'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Efisiensi (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiencySort('bench')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        efficiencySort === 'bench'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Poin Bench
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiencySort('lineup')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        efficiencySort === 'lineup'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Poin Lineup
                    </button>
                    <button
                      type="button"
                      onClick={() => setEfficiencySort('rank')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${
                        efficiencySort === 'rank'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      League Rank
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3 min-w-[200px]">Manager</th>
                        <th className="p-3 text-center">GWs</th>
                        <th className="p-3 text-right">Rata² Lineup</th>
                        <th className="p-3 text-right">Poin Bench (Total / Rata²)</th>
                        <th className="p-3 text-center min-w-[120px]">Starting XI Efficiency</th>
                        <th className="p-3 text-center">Best GW</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortedEfficiencyManagers.map((m, idx) => {
                        const isSelected = String(m.managerId) === String(selectedEfficiencyManagerId);
                        const avgLineup =
                          m.gameweekHistory.length > 0
                            ? Number(
                                (
                                  m.gameweekHistory.reduce((a, b) => a + (b.lineupPoints ?? 0), 0) /
                                  m.gameweekHistory.length
                                ).toFixed(1)
                              )
                            : 0;

                        const eff = m.averageEfficiency;
                        const hasEff = typeof eff === 'number';

                        return (
                          <tr
                            key={`eff-row-${m.managerId}`}
                            className={`transition-colors ${
                              isSelected ? 'bg-cyan-950/30' : 'hover:bg-slate-800/30'
                            }`}
                          >
                            <td className="p-3 text-center font-mono text-slate-500 font-bold">
                              {idx + 1}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-slate-500 font-mono text-[10px]">
                                  #{m.rank}
                                </span>
                                <span className="font-bold text-slate-200 text-xs">
                                  {m.managerName}
                                </span>
                              </div>
                              {m.teamName && (
                                <div className="text-[10px] text-slate-400 truncate pl-3">
                                  {m.teamName}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-slate-400">
                              {m.eligibleGWCount}/{m.gameweekHistory.length}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-slate-200">
                              {avgLineup} pts
                            </td>
                            <td className="p-3 text-right font-mono text-slate-300">
                              <span className="font-bold text-purple-300">{m.totalBenchPoints} pts</span>
                              <span className="text-slate-500 text-[10px] ml-1">
                                ({m.averageBenchPoints}/GW)
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded text-xs font-mono font-bold ${
                                  !hasEff
                                    ? 'bg-slate-800 text-slate-400'
                                    : eff >= 80
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : eff >= 70
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {hasEff ? `${eff}%` : 'N/A'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-[11px] text-slate-400">
                              {m.bestEfficiencyGW ? (
                                <span>
                                  GW{m.bestEfficiencyGW.gameweek} ({m.bestEfficiencyGW.efficiency}%)
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedEfficiencyManagerId(m.managerId)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-cyan-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                                }`}
                              >
                                {isSelected ? 'Dipilih' : 'Inspeksi'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. CURRENT GAMEWEEK SQUAD INSPECTOR */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                      <Target size={16} className="text-cyan-400" />
                      Current Gameweek Squad Inspector (GW {picksMeta.currentGW})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rincian 11 starter dan 4 pemain cadangan beserta multiplier, status auto-sub, dan kontribusi poin.
                    </p>
                  </div>

                  {/* Manager Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 whitespace-nowrap">Pilih Manajer:</label>
                    <select
                      value={selectedEfficiencyManagerId}
                      onChange={(e) => setSelectedEfficiencyManagerId(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 max-w-[260px] truncate"
                    >
                      {managersWithPicks.map((m) => (
                        <option key={`mgr-eff-select-${m.entry}`} value={m.entry}>
                          #{m.rank} — {m.name} {m.teamName ? `(${m.teamName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!currentManagerDetail ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Pilih manajer untuk melihat rincian squad GW {picksMeta.currentGW}.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Manager Summary Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Selected XI
                        </div>
                        <div className="text-base font-bold text-slate-200 mt-0.5 font-mono">
                          {currentManagerDetail.selectedXI} pemain
                        </div>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Scoring Players
                        </div>
                        <div className="text-base font-bold text-slate-200 mt-0.5 font-mono">
                          {currentManagerDetail.finalScoringXI} pemain
                        </div>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Lineup Points (Gross)
                        </div>
                        <div className="text-base font-bold text-cyan-400 mt-0.5 font-mono">
                          {currentManagerDetail.lineupPoints !== null ? `${currentManagerDetail.lineupPoints} pts` : '—'}
                        </div>
                        {currentManagerDetail.transferCost > 0 ? (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Hit: -{currentManagerDetail.transferCost} | Net: {currentManagerDetail.netGameweekPoints} pts
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Net: {currentManagerDetail.netGameweekPoints ?? currentManagerDetail.lineupPoints} pts
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Bench Points
                        </div>
                        <div className="text-base font-bold text-purple-400 mt-0.5 font-mono">
                          {currentManagerDetail.rawBenchPoints !== null ? `${currentManagerDetail.rawBenchPoints} pts` : '0 pts'}
                        </div>
                        {currentManagerDetail.rawBenchPoints !== null && currentManagerDetail.rawBenchPoints < 0 && (
                          <div className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                            Raw negative: {currentManagerDetail.rawBenchPoints}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Starting XI Efficiency
                        </div>
                        <div className="text-base font-bold mt-0.5 font-mono">
                          {currentManagerDetail.isBenchBoostActive ? (
                            <span className="text-amber-300">N/A</span>
                          ) : currentManagerDetail.startingXIEfficiency !== null ? (
                            <span className={currentManagerDetail.startingXIEfficiency >= 80 ? 'text-emerald-400' : 'text-slate-200'}>
                              {currentManagerDetail.startingXIEfficiency}%
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Active Chip
                        </div>
                        <div className="text-base font-bold mt-0.5 font-mono">
                          {currentManagerDetail.activeChip ? (
                            <span className="text-emerald-400 font-bold">
                              {currentManagerDetail.activeChip}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">None</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notice for Bench Boost or Provisional Data */}
                    {currentManagerDetail.isBenchBoostActive && (
                      <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                        <Zap size={16} className="shrink-0 text-emerald-400" />
                        <span>
                          <b>Bench Boost Aktif:</b> Poin seluruh 4 pemain cadangan otomatis dihitung ke total skor Gameweek oleh FPL. Rasio Starting XI Efficiency berstatus <b>N/A (exempt)</b>.
                        </span>
                      </div>
                    )}

                    {currentManagerDetail.isTripleCaptainActive && (
                      <div className="bg-cyan-950/40 border border-cyan-500/40 p-3 rounded-lg text-xs text-cyan-300 flex items-center gap-2">
                        <Crown size={16} className="shrink-0 text-cyan-400" />
                        <span>
                          <b>Triple Captain Aktif:</b> Multiplier kapten bernilai 3x lipat pada gameweek ini.
                        </span>
                      </div>
                    )}

                    {!currentManagerDetail.isFinished && (
                      <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                        <span>
                          <b>Gameweek Sedang Berlangsung:</b> Automatic substitutions FPL akan difinalisasi setelah seluruh laga pekan ini tuntas.
                        </span>
                      </div>
                    )}

                    {/* TWO SQUAD LISTS: STARTING XI vs BENCH */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* STARTING XI (11 PLAYERS) */}
                      <div className="lg:col-span-8 bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            Starting XI ({currentManagerDetail.startingXI.length} Pemain)
                          </span>
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            Total: {currentManagerDetail.startingXI.reduce((sum, p) => sum + p.points, 0)} pts
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800 font-bold">
                              <tr>
                                <th className="py-2 pr-2">Pos</th>
                                <th className="py-2 px-2">Player</th>
                                <th className="py-2 px-2 text-center">Menit</th>
                                <th className="py-2 px-2 text-center">Mult</th>
                                <th className="py-2 px-2 text-right">Raw</th>
                                <th className="py-2 pl-2 text-right">Poin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40 font-mono">
                              {currentManagerDetail.startingXI.map((player) => (
                                <tr key={`starter-${player.playerId}`} className="hover:bg-slate-900/40">
                                  <td className="py-2 pr-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        player.position === 'GKP'
                                          ? 'bg-amber-950 text-amber-300'
                                          : player.position === 'DEF'
                                          ? 'bg-blue-950 text-blue-300'
                                          : player.position === 'MID'
                                          ? 'bg-emerald-950 text-emerald-300'
                                          : 'bg-rose-950 text-rose-300'
                                      }`}
                                    >
                                      {player.position}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-200 font-sans">
                                        {player.playerName}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-sans">
                                        {player.teamShort}
                                      </span>
                                      {player.isCaptain && (
                                        <span className="bg-amber-400 text-slate-950 font-black px-1 rounded text-[9px]">
                                          C
                                        </span>
                                      )}
                                      {player.isViceCaptain && (
                                        <span className="bg-slate-700 text-slate-300 font-bold px-1 rounded text-[9px]">
                                          V
                                        </span>
                                      )}
                                      {player.wasSubbedIn && (
                                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold px-1 rounded text-[9px]">
                                          SUB IN
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-400">
                                    {player.minutes}'
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-400">
                                    {player.multiplier}x
                                  </td>
                                  <td className="py-2 px-2 text-right text-slate-400">
                                    {player.rawPoints}
                                  </td>
                                  <td className="py-2 pl-2 text-right font-bold text-cyan-300">
                                    {player.points} pts
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* BENCH (4 PLAYERS) */}
                      <div className="lg:col-span-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            Cadangan / Bench ({currentManagerDetail.bench.length})
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-400">
                            {currentManagerDetail.benchPointsRaw ?? 0} pts
                          </span>
                        </div>

                        <div className="space-y-2 font-mono">
                          {currentManagerDetail.bench.map((player) => (
                            <div
                              key={`bench-${player.playerId}`}
                              className="bg-slate-900/50 border border-slate-800/60 p-2.5 rounded-lg flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] text-slate-500 font-bold w-12 shrink-0">
                                  {player.benchOrder === 1
                                    ? 'GKP Sub'
                                    : `Sub ${player.benchOrder - 1}`}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                    player.position === 'GKP'
                                      ? 'bg-amber-950 text-amber-300'
                                      : player.position === 'DEF'
                                      ? 'bg-blue-950 text-blue-300'
                                      : player.position === 'MID'
                                      ? 'bg-emerald-950 text-emerald-300'
                                      : 'bg-rose-950 text-rose-300'
                                  }`}
                                >
                                  {player.position}
                                </span>
                                <div className="truncate">
                                  <div className="font-bold text-slate-200 font-sans truncate text-xs">
                                    {player.playerName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    {player.teamShort} • {player.minutes}'
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-xs font-bold text-purple-300">
                                  {player.rawPoints} pts
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {currentManagerDetail.isBenchBoostActive ? '1x (BB)' : '0x'}
                                </div>
                                {player.wasSubbedOut && (
                                  <span className="bg-rose-950 text-rose-300 border border-rose-500/40 font-bold px-1 rounded text-[9px]">
                                    SUB OUT
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-2 font-sans">
                          ℹ️ Urutan bench (Sub 1–3) menentukan prioritas automatic substitution jika starter tidak bermain.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* POWER RANKING & SEASON PULSE */}
        <div className="analytics-feature-grid">
          <section className="card feature-card">
            <div className="section-kicker">POWER RANKING</div>
            <h2>Top 10 Era Super League</h2>
            <p>Urutan berdasarkan total poin.</p>
            <div className="power-list">
              {(data?.top10 ?? []).map((r, i) => (
                <Link href={`/manager/${r.entry}`} key={r.entry} className="power-row">
                  <span className="power-pos">{String(i + 1).padStart(2, '0')}</span>
                  <span className="avatar">{initials(r.player_name || r.entry_name)}</span>
                  <span className="power-name">
                    <b>{r.player_name}</b>
                    <small>{r.entry_name}</small>
                  </span>
                  <span className="power-track">
                    <i
                      style={{
                        width: `${Math.max(8, (r.total / (data?.maxTotal || 1)) * 100)}%`,
                      }}
                    />
                  </span>
                  <strong>{fmt(r.total)}</strong>
                </Link>
              ))}
            </div>
          </section>

          <section className="card feature-card">
            <div className="section-kicker">SEASON PULSE</div>
            <h2>Momentum ranking</h2>
            <p>Perubahan posisi sejak update terakhir.</p>
            <div className="momentum-grid">
              <Momentum
                title="Biggest Riser"
                row={data?.biggestRiser}
                up
                ready={data?.movementReady}
              />
              <Momentum
                title="Biggest Faller"
                row={data?.biggestFaller}
                ready={data?.movementReady}
              />
            </div>
          </section>
        </div>

        {/* ROADMAP / NEXT INSIGHTS */}
        <section className="card roadmap mt-6">
          <div>
            <div className="section-kicker">V6.4 ANALYTICS — LEAGUE COMMAND CENTER</div>
            <h2>Insight berikutnya</h2>
            <div className="roadmap-tags">
              <span>Captain Performance</span>
              <span>Chip Usage</span>
              <span>Transfer Activity</span>
              <span>Ranking History</span>
              <span>Manager Performance Score</span>
            </div>
          </div>
        </section>

        <footer>ERA SUPER LEAGUE • Analytics V6.4 • League ID 134820</footer>
      </div>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="stat card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Momentum({
  title,
  row,
  up = false,
  ready = false,
}: {
  title: string;
  row?: Row | null;
  up?: boolean;
  ready?: boolean;
}) {
  const d = row?.movement ?? 0;
  return (
    <div className="momentum-card">
      <span>{title}</span>
      {!ready ? (
        <>
          <b>Mulai tersedia GW2</b>
          <small>Belum ada perbandingan ranking.</small>
        </>
      ) : (
        <>
          <b>{row?.player_name || '—'}</b>
          <small>{row?.entry_name || '—'}</small>
          <strong className={d > 0 ? 'up' : 'down'}>
            {d > 0 ? '↑' : '↓'} {Math.abs(d)} posisi
          </strong>
        </>
      )}
    </div>
  );
}
