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
} from 'lucide-react';
import ScoreTrendChart from './ScoreTrendChart';
import type { LeaguePerformanceInsightsResponse } from '@/app/api/league-insights/route';
import {
  getLeagueOwnershipSummary,
  type LeagueOwnershipSummary,
  type PlayerOwnershipStats,
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
        const managers = Object.values(json.details).map((d: any) => ({
          entry: d.entry,
          picks: d.picksList || [],
        }));
        const summary = getLeagueOwnershipSummary(managers);
        setOwnershipSummary(summary);
      }
    } catch {
      setOwnershipSummary(null);
    } finally {
      setOwnershipLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadInsights();
    loadOwnership();
  }, []);

  const perf = insightsData?.performanceInsights;

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
