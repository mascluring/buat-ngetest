'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import ScoreTrendChart from './ScoreTrendChart';
import type { LeaguePerformanceInsightsResponse } from '@/app/api/league-insights/route';

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

  useEffect(() => {
    loadAnalytics();
    loadInsights();
  }, []);

  const perf = insightsData?.performanceInsights;

  if (loading && !data) {
    return (
      <main>
        <section className="hero">
          <div className="container hero-inner">
            <Link href="/" className="back-link">
              ← Kembali ke klasemen
            </Link>
            <div className="profile-title">
              <div className="eyebrow">ERA SUPER LEAGUE • V6.3</div>
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
            <div className="eyebrow">2026 / 27 • ANALYTICS • V6.3</div>
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
            }}
            disabled={loading || insightsLoading}
          >
            <RefreshCw size={14} className={loading || insightsLoading ? 'spin' : ''} /> Refresh
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
            <div className="section-kicker">V6.3 ANALYTICS — LEAGUE COMMAND CENTER</div>
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

        <footer>ERA SUPER LEAGUE • Analytics V6.3 • League ID 134820</footer>
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
