'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles, Trophy, TrendingUp, Shield, BarChart2, Award, ArrowLeftRight } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const initials = (name: string) => name.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();

export default function ManagerDetail({ params }: { params: { id: string } }) {
  const id = params?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const closePlayerPopup = () => setSelectedPlayer(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/manager/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat data manager');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return (
      <main className="container py-12">
        <div className="card analytics-loading">
          <RefreshCw className="spin mx-auto mb-2" size={24} />
          Memuat profil & riwayat perjalanan ranking manager #{id}...
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container page-shell py-12 text-center">
        <div className="card error-page">
          <h2>Manager ID #{id}</h2>
          <p className="text-red-400 my-4">{error}</p>
          <Link href="/" className="back-link dark">← Kembali ke Klasemen Utama</Link>
        </div>
      </main>
    );
  }

  const { entry, detail, currentGW, gwHistory = [], chipsUsed = [] } = data;
  const picksList = detail?.picksList || [];

  // Calculate transfer stats
  const totalTransfers = gwHistory.reduce((s: number, h: any) => s + (h.transfers || 0), 0);
  const totalTransferCost = gwHistory.reduce((s: number, h: any) => s + (h.transfersCost || 0), 0);
  const mostActiveGW = gwHistory.length > 0 ? [...gwHistory].sort((a, b) => b.transfers - a.transfers || a.event - b.event)[0] : null;
  const hitGWCount = gwHistory.filter((h: any) => h.transfersCost > 0).length;
  const transferHistory = gwHistory.filter((h: any) => h.transfers > 0);

  // Calculate highest & lowest rank
  const ranks = gwHistory.map((h: any) => h.overallRank).filter(Boolean);
  const bestRank = ranks.length ? Math.min(...ranks) : null;
  const worstRank = ranks.length ? Math.max(...ranks) : null;

  // Chart SVG coordinates calculation
  const chartHeight = 220;
  const chartWidth = 700;
  const padding = 30;

  let pointsPath = '';
  if (ranks.length > 1 && bestRank !== null && worstRank !== null) {
    const minR = bestRank;
    const maxR = worstRank === minR ? minR + 1 : worstRank;
    const pts = gwHistory.map((h: any, idx: number) => {
      const x = padding + (idx / (gwHistory.length - 1)) * (chartWidth - padding * 2);
      // Invert Y axis because lower rank = better rank (top of chart)
      const y = padding + ((h.overallRank - minR) / (maxR - minR)) * (chartHeight - padding * 2);
      return { x, y, gw: h.event, rank: h.overallRank, points: h.points };
    });

    pointsPath = pts.map((p: any, i: number) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  return (
    <main className="container page-shell py-8">
      <div className="my-4">
        <Link href="/" className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Kembali ke Klasemen Utama
        </Link>
      </div>

      {/* HEADER MANAGER PROFILE */}
      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xl font-black text-indigo-400 shadow-lg">
              {initials(entry.playerName || entry.name)}
            </div>
            <div>
              <div className="eyebrow text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
                FPL MANAGER PROFILE • GW{currentGW}
              </div>
              <h1 className="text-3xl font-black text-white">{entry.name}</h1>
              <p className="text-slate-400 text-sm mt-0.5">Manager: <b className="text-white">{entry.playerName}</b></p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Overall Rank</span>
              <span className="text-xl font-black text-amber-400">{entry.overallRank ? `#${fmt(entry.overallRank)}` : '—'}</span>
            </div>
            <div className="text-right bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 block font-semibold uppercase">Total Points</span>
              <span className="text-xl font-black text-emerald-400">{fmt(entry.overallPoints || 0)} pts</span>
            </div>
          </div>
        </div>
      </header>

      {/* RINGKASAN STATS TIM */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
        <div className="card p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Squad Value</span>
          <div className="text-xl font-black text-white mt-1">£{entry.teamValue}m <small className="text-slate-400 text-xs">(£{entry.bank}m)</small></div>
        </div>
        <div className="card p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Formasi GW{currentGW}</span>
          <div className="text-xl font-black text-cyan-400 mt-1">{detail.formation || '3-4-3'}</div>
        </div>
        <div className="card p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Best Overall Rank</span>
          <div className="text-xl font-black text-amber-400 mt-1">{bestRank ? `#${fmt(bestRank)}` : '—'}</div>
        </div>
        <div className="card p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Worst Overall Rank</span>
          <div className="text-xl font-black text-rose-400 mt-1">{worstRank ? `#${fmt(worstRank)}` : '—'}</div>
        </div>
      </div>

      {/* MANAGER PERFORMANCE INSIGHTS */}
      <section className="card p-6 my-6 bg-slate-900/90 border-slate-700">
        <div className="mb-6">
          <div className="section-kicker">MANAGER PERFORMANCE INSIGHTS</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-cyan-400" /> Insight Performa Manager
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Best Gameweek */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Best Gameweek</span>
            <div className="mt-2">
              {data.performanceInsights?.bestGameweek ? (
                <>
                  <div className="text-2xl font-black text-emerald-400">GW {data.performanceInsights.bestGameweek.event}</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.performanceInsights.bestGameweek.points} pts</div>
                </>
              ) : (
                <div className="text-sm text-slate-400 italic">Belum ada data</div>
              )}
            </div>
          </div>

          {/* 2. Worst Gameweek */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Worst Gameweek</span>
            <div className="mt-2">
              {data.performanceInsights?.worstGameweek ? (
                <>
                  <div className="text-2xl font-black text-rose-400">GW {data.performanceInsights.worstGameweek.event}</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.performanceInsights.worstGameweek.points} pts</div>
                </>
              ) : (
                <div className="text-sm text-slate-400 italic">Belum ada data</div>
              )}
            </div>
          </div>

          {/* 3. Most Productive Captain */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Most Productive Captain</span>
            <div className="mt-2">
              {data.performanceInsights?.productiveCaptain ? (
                <>
                  <div className="text-lg font-black text-amber-400 truncate">{data.performanceInsights.productiveCaptain.name}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    <b className="text-white">{data.performanceInsights.productiveCaptain.totalPoints} pts</b> • {data.performanceInsights.productiveCaptain.timesCaptained} kali menjadi captain
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 italic">Belum ada data kapten</div>
              )}
            </div>
          </div>

          {/* 4. Favorite Formation */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Favorite Formation</span>
            <div className="mt-2">
              {data.performanceInsights?.favoriteFormation ? (
                <>
                  <div className="text-2xl font-black text-cyan-400">{data.performanceInsights.favoriteFormation.formation}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    <b className="text-white">{data.performanceInsights.favoriteFormation.count} kali digunakan</b> ({data.performanceInsights.favoriteFormation.percentage}% dari total GW)
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 italic">Belum ada data formasi</div>
              )}
            </div>
          </div>

          {/* 5. Total Transfers */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Transfers</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-indigo-400">{data.performanceInsights?.totalTransfers ?? 0} transfer</div>
              <div className="text-xs text-slate-400 mt-0.5">Sepanjang musim</div>
            </div>
          </div>

          {/* 6. Transfer Cost */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Transfer Cost</span>
            <div className="mt-2">
              <div className={`text-2xl font-black ${(data.performanceInsights?.totalTransferCost || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(data.performanceInsights?.totalTransferCost || 0) > 0 ? `-${data.performanceInsights.totalTransferCost} pts` : '0 pts'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Total biaya transfer</div>
            </div>
          </div>
        </div>
      </section>

      {/* GRAFIK PERJALANAN RANKING (OVERALL RANK HISTORY) */}
      <section className="card chart-card my-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="section-kicker">RANK HISTORY</div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-amber-400" /> Grafik Perjalanan Ranking Overall
            </h2>
            <p className="text-xs text-slate-400">Visual pergerakan ranking Gameweek demi Gameweek (semakin ke atas semakin baik).</p>
          </div>
        </div>

        {gwHistory.length > 1 ? (
          <div className="chart-wrap bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-64 overflow-visible">
              <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} className="gridline" />
              <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} className="gridline" />
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} className="gridline" />

              {pointsPath && <path d={pointsPath} className="rank-line" />}

              {gwHistory.map((h: any, idx: number) => {
                const minR = bestRank || 1;
                const maxR = (worstRank === minR ? minR + 1 : worstRank) || 2;
                const x = padding + (idx / (gwHistory.length - 1)) * (chartWidth - padding * 2);
                const y = padding + ((h.overallRank - minR) / (maxR - minR)) * (chartHeight - padding * 2);

                return (
                  <g key={h.event} className="group">
                    <circle cx={x} cy={y} r="5" className="fill-amber-400 stroke-slate-900 stroke-2 hover:r-7 transition-all cursor-pointer" />
                    <text x={x} y={chartHeight - 8} textAnchor="middle" className="text-[10px] fill-slate-400 font-mono">
                      GW{h.event}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">Riwayat ranking belum tersedia.</div>
        )}
      </section>

      {/* RIWAYAT GAMEWEEK demi GAMEWEEK TABLE */}
      <section className="card table-card my-6">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="section-kicker">GAMEWEEK BREAKDOWN</div>
            <h2 className="text-xl font-bold text-white">Performa Gameweek demi Gameweek</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="rank-table w-full">
            <thead>
              <tr>
                <th className="text-center">GW</th>
                <th className="text-center">Points</th>
                <th className="text-center">Total Pts</th>
                <th className="text-center">GW Rank</th>
                <th className="text-center">Overall Rank</th>
                <th className="text-center">Transfers</th>
                <th className="text-center">Cost</th>
                <th className="text-center">Bench Pts</th>
                <th className="text-center">Team Value</th>
              </tr>
            </thead>
            <tbody>
              {gwHistory.map((h: any) => (
                <tr key={h.event}>
                  <td className="text-center font-bold text-cyan-400">GW{h.event}</td>
                  <td className="text-center font-bold text-white font-mono">{h.points}</td>
                  <td className="text-center font-bold text-amber-400 font-mono">{fmt(h.totalPoints)}</td>
                  <td className="text-center font-mono text-slate-300">#{fmt(h.rank)}</td>
                  <td className="text-center font-mono font-semibold text-slate-200">#{fmt(h.overallRank)}</td>
                  <td className="text-center font-mono">{h.transfers}</td>
                  <td className="text-center font-mono text-rose-400">{h.transfersCost > 0 ? `-${h.transfersCost}` : '0'}</td>
                  <td className="text-center font-mono text-slate-400">{h.benchPoints}</td>
                  <td className="text-center font-mono text-slate-300">£{h.value}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TRANSFER HISTORY */}
      <section className="card p-6 my-6">
        <div className="mb-6">
          <div className="section-kicker">TRANSFER HISTORY</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-cyan-400" /> Riwayat Transfer Manager
          </h2>
        </div>

        {data.transferHistory && data.transferHistory.length > 0 ? (
          <div className="space-y-4">
            {data.transferHistory.map((th: any) => (
              <div key={th.event} className="bg-slate-900 p-5 rounded-xl border border-slate-700/80 shadow-lg">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-cyan-400">GW {th.event}</span>
                    {th.chip === 'WILDCARD' && (
                      <span className="bg-purple-600/30 text-purple-300 border border-purple-500/50 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                        WILDCARD
                      </span>
                    )}
                    {th.chip === 'FREEHIT' && (
                      <span className="bg-amber-600/30 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                        FREE HIT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-300">Transfers: <b className="text-white">{th.transfers}</b></span>
                    <span className="text-slate-300">Cost: <b className={th.cost > 0 ? 'text-rose-400' : 'text-emerald-400'}>{th.cost > 0 ? `-${th.cost} pts` : '0 pts'}</b></span>
                  </div>
                </div>

                {th.isTemporary ? (
                  <div className="bg-slate-950/60 p-4 rounded-lg border border-amber-500/20 text-center py-6">
                    <p className="text-amber-300 font-bold mb-1">Temporary Squad (Free Hit)</p>
                    <p className="text-xs text-slate-400">Tidak ada permanent transfer pada Gameweek ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* OUT LIST */}
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-rose-950/50">
                      <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                        <span>🔴 OUT</span> ({th.transfersOut.length})
                      </div>
                      {th.transfersOut.length > 0 ? (
                        <div className="space-y-2">
                          {th.transfersOut.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded border border-slate-800 text-xs">
                              <span className="font-bold text-white">{p.name}</span>
                              <span className="text-slate-400 font-mono">{p.team} • {p.position}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2 text-center">Tidak ada pemain keluar</div>
                      )}
                    </div>

                    {/* IN LIST */}
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-emerald-950/50">
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                        <span>🟢 IN</span> ({th.transfersIn.length})
                      </div>
                      {th.transfersIn.length > 0 ? (
                        <div className="space-y-2">
                          {th.transfersIn.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded border border-slate-800 text-xs">
                              <span className="font-bold text-white">{p.name}</span>
                              <span className="text-slate-400 font-mono">{p.team} • {p.position}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2 text-center">Tidak ada pemain masuk</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 italic text-center py-6 bg-slate-900/50 rounded-xl border border-slate-800">
            Belum ada riwayat transfer yang tersedia.
          </div>
        )}
      </section>

      {/* CHIP HISTORY */}
      <section className="card p-6 my-6">
        <div className="mb-4">
          <div className="section-kicker">CHIP HISTORY</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={20} className="text-emerald-400" /> Riwayat penggunaan chip manager
          </h2>
        </div>
        
        {chipsUsed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...chipsUsed].sort((a, b) => a.event - b.event).map((c, i) => {
              const chipMap: Record<string, string> = {
                WILDCARD: 'Wildcard',
                FREEHIT: 'Free Hit',
                TRIPLE_CAPTAIN: 'Triple Captain',
                '3XC': 'Triple Captain',
                BBOOST: 'Bench Boost',
                ASSISTANT_MANAGER: 'Assistant Manager',
              };
              const displayName = chipMap[c.name] || c.name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());
              return (
                <div key={i} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex items-center gap-3">
                  <div className="bg-slate-800 p-2 rounded-md">
                    <Shield size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">{displayName}</div>
                    <div className="text-sm font-black text-white">GW {c.event}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-400 italic">Belum ada chip yang digunakan.</div>
        )}
      </section>

      {/* FORMATION FREQUENCY */}
      <section className="card p-6 my-6">
        <div className="mb-4">
          <div className="section-kicker">FORMATION FREQUENCY</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-400" /> Frekuensi Formasi
          </h2>
        </div>

        {data.formationFrequency && Object.keys(data.formationFrequency).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(data.formationFrequency)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([formation, count]) => (
                <div key={formation} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                  <span className="text-lg font-black text-cyan-400">{formation}</span>
                  <span className="text-sm font-bold text-slate-400">{(count as number)} GW</span>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-slate-400 italic">Data formasi tidak tersedia.</div>
        )}
      </section>

      {/* CAPTAIN PERFORMANCE */}
      <section className="card p-6 my-6">
        <div className="mb-6">
          <div className="section-kicker">CAPTAIN PERFORMANCE</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award size={20} className="text-rose-400" /> Riwayat performa kapten
          </h2>
        </div>

        {data.captainPerformance && data.captainPerformance.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Cap Points</div>
                <div className="text-2xl font-black text-white">{fmt(data.captainPerformance.reduce((s: number, c: any) => s + c.captainPoints, 0))}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Avg Cap Points</div>
                <div className="text-2xl font-black text-white">{(data.captainPerformance.reduce((s: number, c: any) => s + c.captainPoints, 0) / data.captainPerformance.length).toFixed(1)}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Best Captain</div>
                <div className="text-2xl font-black text-white truncate">{[...data.captainPerformance].sort((a,b) => b.captainPoints - a.captainPoints)[0].captainName}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Best Cap GW</div>
                <div className="text-2xl font-black text-white">
                  GW {[...data.captainPerformance].sort((a,b) => b.captainPoints - a.captainPoints)[0].event} • {[...data.captainPerformance].sort((a,b) => b.captainPoints - a.captainPoints)[0].captainPoints} pts
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.captainPerformance.map((c: any) => (
                <div key={c.event} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-black text-cyan-400">GW {c.event}</span>
                    <span className="text-sm font-bold text-white">{c.captainName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-400">Raw Points: <span className="text-white font-bold">{c.rawPoints} pts</span></div>
                    <div className="text-slate-400">Cap Points: <span className="text-white font-bold">{c.captainPoints} pts</span></div>
                    <div className="text-slate-400">Multiplier: <span className="text-white font-bold">x{c.multiplier}</span></div>
                    <div className="text-slate-400">Vice: <span className="text-white font-bold">{c.viceName}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-slate-400 italic">Data performa kapten tidak tersedia.</div>
        )}
      </section>

      {/* TRANSFER ACTIVITY */}
      <section className="card p-6 my-6">
        <div className="mb-6">
          <div className="section-kicker">TRANSFER ACTIVITY</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-amber-400" /> Ringkasan Aktivitas Transfer
          </h2>
        </div>

        {gwHistory.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Transfers</div>
                <div className="text-2xl font-black text-white">{totalTransfers}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Transfer Cost</div>
                <div className="text-2xl font-black text-white">{totalTransferCost > 0 ? `-${totalTransferCost} pts` : '0 pts'}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Most Active GW</div>
                <div className="text-2xl font-black text-white truncate">{mostActiveGW ? `GW ${mostActiveGW.event} • ${mostActiveGW.transfers} Transfers` : '—'}</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase font-semibold">Hit GW</div>
                <div className="text-2xl font-black text-white">{hitGWCount} GW</div>
              </div>
            </div>

            {transferHistory.length > 0 ? (
              <div className="table-scroll">
                <table className="rank-table w-full">
                  <thead>
                    <tr>
                      <th className="text-center">GW</th>
                      <th className="text-center">Transfers</th>
                      <th className="text-center">Transfer Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferHistory.map((h: any) => (
                      <tr key={h.event}>
                        <td className="text-center font-bold text-cyan-400">GW{h.event}</td>
                        <td className="text-center font-bold text-white font-mono">{h.transfers}</td>
                        <td className="text-center font-mono text-rose-400">{h.transfersCost > 0 ? `-${h.transfersCost} pts` : '0 pts'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-slate-400 italic">Belum ada aktivitas transfer.</div>
            )}
          </>
        ) : (
          <div className="text-slate-400 italic">Data aktivitas transfer belum tersedia.</div>
        )}
      </section>

      {/* SQUAD EVOLUTION SECTION (V5.9) */}
      <section className="card p-6 my-6 bg-slate-900/90 border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
          <div>
            <div className="section-kicker text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">SQUAD EVOLUTION</div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield size={20} className="text-cyan-400" /> Skuad & Riwayat Pemain
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Perjalanan skuad dan riwayat pemain sepanjang musim.</p>
          </div>
        </div>

        {data.squadEvolution && data.squadEvolution.players && data.squadEvolution.players.length > 0 ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Unique Players</div>
                <div className="text-2xl font-black text-white mt-1">{data.squadEvolution.summary.totalUniquePlayers} <span className="text-xs text-slate-400 font-normal">Players</span></div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Current Squad</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{data.squadEvolution.summary.currentSquadPlayers} <span className="text-xs text-slate-400 font-normal">Players</span></div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Transferred Out</div>
                <div className="text-2xl font-black text-rose-400 mt-1">{data.squadEvolution.summary.transferredOutPlayers} <span className="text-xs text-slate-400 font-normal">Players</span></div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 uppercase font-semibold">Most Loyal Player</div>
                <div className="text-lg font-black text-amber-400 mt-1 truncate" title={data.squadEvolution.summary.mostLoyalPlayer?.name || '—'}>
                  {data.squadEvolution.summary.mostLoyalPlayer?.name || '—'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {data.squadEvolution.summary.mostLoyalPlayer ? `${data.squadEvolution.summary.mostLoyalPlayer.longestStreak} GW longest streak` : '—'}
                </div>
              </div>
            </div>

            {/* Current Squad Grid */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Current Squad ({data.squadEvolution.players.filter((p: any) => p.status === 'CURRENT').length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {data.squadEvolution.players.filter((p: any) => p.status === 'CURRENT').map((p: any) => (
                  <div key={p.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-white text-sm truncate" title={p.name}>{p.name}</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">{p.position}</span>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">{p.team}</div>
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-1 pt-2 border-t border-slate-900">
                      <div className="flex justify-between">
                        <span className="text-slate-400">First:</span>
                        <b className="text-white">GW{p.firstEvent}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">In Squad:</span>
                        <b className="text-emerald-400">{p.gameweeksInSquad} GW</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Longest:</span>
                        <b className="text-amber-400">{p.longestStreak} GW</b>
                      </div>
                      <div className="pt-1 text-[10px] text-cyan-400 font-mono text-center bg-slate-900 py-0.5 rounded">
                        {p.periods.map((per: any) => per.start === per.end ? `GW${per.start}` : `GW${per.start}–GW${per.end}`).join(' • ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Former Players (Transferred Out) */}
            {data.squadEvolution.players.filter((p: any) => p.status === 'TRANSFERRED_OUT').length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Former Players ({data.squadEvolution.players.filter((p: any) => p.status === 'TRANSFERRED_OUT').length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {data.squadEvolution.players.filter((p: any) => p.status === 'TRANSFERRED_OUT').map((p: any) => (
                    <div key={p.id} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between opacity-85 hover:opacity-100 transition-opacity">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-200 text-sm truncate" title={p.name}>{p.name}</span>
                          <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded">{p.position}</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">{p.team}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-900/80">
                        <div className="flex justify-between">
                          <span className="text-slate-500">First / Last:</span>
                          <b className="text-slate-300">GW{p.firstEvent} – GW{p.lastEvent}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total GW:</span>
                          <b className="text-slate-300">{p.gameweeksInSquad} GW</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Longest:</span>
                          <b className="text-amber-400/80">{p.longestStreak} GW</b>
                        </div>
                        <div className="pt-1 text-[10px] text-slate-400 font-mono text-center bg-slate-900/60 py-0.5 rounded truncate" title={p.periods.map((per: any) => per.start === per.end ? `GW${per.start}` : `GW${per.start}–GW${per.end}`).join(' • ')}>
                          {p.periods.map((per: any) => per.start === per.end ? `GW${per.start}` : `GW${per.start}–GW${per.end}`).join(' • ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-slate-400 italic">Belum ada data evolusi skuad yang tersedia.</div>
        )}
      </section>

      {/* LAPANGAN VISUAL FORMASI GAMEWEEK BERJALAN */}
      {picksList.length > 0 && (
        <section className="card p-6 my-6">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-amber-400" /> Skuad & Formasi Gameweek {currentGW} ({detail.formation})
            </h2>
            <span className="text-xs text-slate-400 font-mono">Kapten: <b>{detail.captainName}</b> ({detail.captainPoints} pts)</span>
          </div>

          <div className="fpl-pitch relative rounded-2xl overflow-hidden p-6 border-2 border-emerald-400/40 shadow-2xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800">
            <div className="pitch-line pitch-goal-top" />
            <div className="pitch-line pitch-box-top" />
            <div className="pitch-line pitch-center-circle" />

            {/* GKP */}
            <div className="flex justify-center my-3 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 1).map((p: any) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
              ))}
            </div>

            {/* DEF */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 2).map((p: any) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
              ))}
            </div>

            {/* MID */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 3).map((p: any) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
              ))}
            </div>

            {/* FWD */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 4).map((p: any) => (
                <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
              ))}
            </div>

            {/* BENCH */}
            <div className="mt-8 pt-4 border-t border-emerald-300/30 relative z-10 bg-black/40 rounded-xl p-3">
              <div className="text-xs uppercase font-bold text-emerald-200 mb-2">BENCH PLAYERS ({detail.benchPoints} PTS)</div>
              <div className="flex justify-around">
                {picksList.filter((p: any) => p.position > 11).map((p: any) => (
                  <PlayerCard key={p.id} player={p} isBench onClick={() => setSelectedPlayer(p)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      {selectedPlayer && (
        <PlayerPopup 
          player={selectedPlayer} 
          onClose={closePlayerPopup} 
        />
      )}
      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.0 Manager Profile • League ID 134820</footer>
    </main>
  );
}

function PlayerPopup({ player, onClose }: { player: any, onClose: () => void }) {
  const { rows, officialRaw, calculatedRaw } = getPlayerBreakdownRows(player);
  const multiplier = player.multiplier || 1;
  const isCaptain = player.isCaptain;
  const isVice = player.isVice;
  const finalPoints = officialRaw * multiplier;
  const posLabel = player.positionName || (player.elementType === 1 ? 'GKP' : player.elementType === 2 ? 'DEF' : player.elementType === 3 ? 'MID' : 'FWD');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700/80 max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {posLabel}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  {player.teamShortName || player.teamName || ''}
                </span>
                {isCaptain && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">
                    {multiplier === 3 ? 'TRIPLE CAPTAIN (3x)' : 'CAPTAIN (2x)'}
                  </span>
                )}
                {isVice && !isCaptain && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    VICE CAPTAIN
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">{player.name}</h3>
            </div>
            {player.jerseyUrl && (
              <img 
                src={player.jerseyUrl} 
                alt="Jersey" 
                className="w-12 h-12 object-contain drop-shadow-md"
              />
            )}
          </div>
        </div>
        
        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Points Breakdown</h4>
          </div>
          
          <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 mb-3 font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
            <div className="col-span-6">Statistic</div>
            <div className="col-span-3 text-center">Value</div>
            <div className="col-span-3 text-right">Points</div>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-2 items-center py-0.5">
                <div className="col-span-6 text-slate-200 text-sm font-medium">{row.label}</div>
                <div className="col-span-3 text-center font-bold text-white text-sm">{row.value}</div>
                <div className={`col-span-3 text-right font-bold text-sm ${row.points < 0 ? 'text-rose-400' : row.points > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {row.points > 0 ? `+${row.points} pts` : row.points < 0 ? `${row.points} pts` : '0 pts'}
                </div>
              </div>
            ))}
          </div>

          {/* Points Summary */}
          <div className="mt-6 pt-4 border-t border-slate-800 space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
            {multiplier > 1 ? (
              <>
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span>Official Raw Points:</span>
                  <span className="font-semibold text-slate-200">{officialRaw} pts</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span>Captain Multiplier:</span>
                  <span className="font-bold text-amber-400">x{multiplier}</span>
                </div>
                <div className="flex justify-between items-center text-white pt-2 border-t border-slate-800">
                  <span className="font-bold text-sm uppercase tracking-wide">Final Points:</span>
                  <span className="font-black text-2xl text-emerald-400">{finalPoints} <span className="text-sm font-normal text-slate-300">pts</span></span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-white">
                <span className="font-bold text-sm uppercase tracking-wide">Official FPL Points:</span>
                <span className="font-black text-2xl text-emerald-400">{finalPoints} <span className="text-sm font-normal text-slate-300">pts</span></span>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-slate-950/80 border-t border-slate-800">
          <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-sm font-bold text-white transition-colors">Tutup</button>
        </div>
      </div>
    </div>
  );
}

interface PointBreakdownRow {
  key: string;
  label: string;
  value: number;
  points: number;
}

function getPlayerBreakdownRows(player: any): { rows: PointBreakdownRow[]; officialRaw: number; calculatedRaw: number } {
  const b = player.breakdown || {};
  const minutes = b.minutes ?? player.minutes ?? 0;
  const goalsScored = b.goalsScored ?? player.goals_scored ?? 0;
  const assists = b.assists ?? player.assists ?? 0;
  const cleanSheets = b.cleanSheets ?? player.clean_sheets ?? 0;
  const goalsConceded = b.goalsConceded ?? player.goals_conceded ?? 0;
  const ownGoals = b.ownGoals ?? player.own_goals ?? 0;
  const penaltiesSaved = b.penaltiesSaved ?? player.penalties_saved ?? 0;
  const penaltiesMissed = b.penaltiesMissed ?? player.penalties_missed ?? 0;
  const yellowCards = b.yellowCards ?? player.yellow_cards ?? 0;
  const redCards = b.redCards ?? player.red_cards ?? 0;
  const saves = b.saves ?? player.saves ?? 0;
  const bonus = b.bonus ?? player.bonus ?? 0;
  const dcValue = b.defensiveContributionValue ?? b.defensiveContribution ?? player.defensive_contribution ?? 0;
  const dcPoints = b.defensiveContributionPoints ?? player.defensive_contribution_points ?? 0;
  
  const elementType = player.elementType || 1; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  const isGkpOrDef = elementType === 1 || elementType === 2;
  const isMid = elementType === 3;

  const officialRaw = player.rawPoints ?? b.totalPoints ?? player.total_points ?? 0;

  // If explain exists from FPL live API, map fixtures to exact official breakdown
  const explain = player.explain || [];
  if (Array.isArray(explain) && explain.length > 0) {
    const explainStatMap = new Map<string, { value: number; points: number }>();
    explain.forEach((fixture: any) => {
      (fixture.stats || []).forEach((s: any) => {
        const id = s.identifier;
        const current = explainStatMap.get(id) || { value: 0, points: 0 };
        explainStatMap.set(id, {
          value: current.value + (s.value ?? 0),
          points: current.points + (s.points ?? 0),
        });
      });
    });

    const rows: PointBreakdownRow[] = [];

    // 1. Minutes (always show)
    const minStat = explainStatMap.get('minutes') || {
      value: minutes,
      points: minutes >= 60 ? 2 : minutes > 0 ? 1 : 0,
    };
    rows.push({
      key: 'minutes',
      label: 'Minutes played',
      value: minStat.value,
      points: minStat.points,
    });

    // 2. Goals scored
    const goalStat = explainStatMap.get('goals_scored');
    if (goalStat && (goalStat.value > 0 || goalStat.points !== 0)) {
      rows.push({
        key: 'goals_scored',
        label: 'Goals scored',
        value: goalStat.value,
        points: goalStat.points,
      });
    }

    // 3. Assists
    const assistStat = explainStatMap.get('assists');
    if (assistStat && (assistStat.value > 0 || assistStat.points !== 0)) {
      rows.push({
        key: 'assists',
        label: 'Assists',
        value: assistStat.value,
        points: assistStat.points,
      });
    }

    // 4. Clean Sheet
    const csStat = explainStatMap.get('clean_sheets');
    if (csStat && (csStat.value > 0 || csStat.points !== 0)) {
      rows.push({
        key: 'clean_sheets',
        label: 'Clean Sheet',
        value: csStat.value,
        points: csStat.points,
      });
    }

    // 5. Defensive Contribution
    const dcStat = explainStatMap.get('defensive_contribution');
    if (dcStat && (dcStat.value > 0 || dcStat.points !== 0)) {
      rows.push({
        key: 'defensive_contribution',
        label: 'Defensive Contribution',
        value: dcStat.value,
        points: dcStat.points,
      });
    } else if (dcValue > 0 && dcPoints > 0) {
      rows.push({
        key: 'defensive_contribution',
        label: 'Defensive Contribution',
        value: dcValue,
        points: dcPoints,
      });
    }

    // 6. Goals Conceded
    const gcStat = explainStatMap.get('goals_conceded');
    if (gcStat && (gcStat.value > 0 || gcStat.points !== 0)) {
      rows.push({
        key: 'goals_conceded',
        label: 'Goals Conceded',
        value: gcStat.value,
        points: gcStat.points,
      });
    }

    // 7. Saves
    const saveStat = explainStatMap.get('saves');
    if (saveStat && (saveStat.value > 0 || saveStat.points !== 0)) {
      rows.push({
        key: 'saves',
        label: 'Saves',
        value: saveStat.value,
        points: saveStat.points,
      });
    }

    // 8. Penalties Saved
    const psStat = explainStatMap.get('penalties_saved');
    if (psStat && (psStat.value > 0 || psStat.points !== 0)) {
      rows.push({
        key: 'penalties_saved',
        label: 'Penalties Saved',
        value: psStat.value,
        points: psStat.points,
      });
    }

    // 9. Penalties Missed
    const pmStat = explainStatMap.get('penalties_missed');
    if (pmStat && (pmStat.value > 0 || pmStat.points !== 0)) {
      rows.push({
        key: 'penalties_missed',
        label: 'Penalties Missed',
        value: pmStat.value,
        points: pmStat.points,
      });
    }

    // 10. Own Goals
    const ogStat = explainStatMap.get('own_goals');
    if (ogStat && (ogStat.value > 0 || ogStat.points !== 0)) {
      rows.push({
        key: 'own_goals',
        label: 'Own Goals',
        value: ogStat.value,
        points: ogStat.points,
      });
    }

    // 11. Yellow Cards
    const ycStat = explainStatMap.get('yellow_cards');
    if (ycStat && (ycStat.value > 0 || ycStat.points !== 0)) {
      rows.push({
        key: 'yellow_cards',
        label: 'Yellow Card',
        value: ycStat.value,
        points: ycStat.points,
      });
    }

    // 12. Red Cards
    const rcStat = explainStatMap.get('red_cards');
    if (rcStat && (rcStat.value > 0 || rcStat.points !== 0)) {
      rows.push({
        key: 'red_cards',
        label: 'Red Card',
        value: rcStat.value,
        points: rcStat.points,
      });
    }

    // 13. Bonus
    const bonusStat = explainStatMap.get('bonus');
    if (bonusStat && (bonusStat.value > 0 || bonusStat.points !== 0)) {
      rows.push({
        key: 'bonus',
        label: 'Bonus',
        value: bonusStat.value,
        points: bonusStat.points,
      });
    }

    const calculatedRaw = rows.reduce((sum, r) => sum + r.points, 0);
    return { rows, officialRaw, calculatedRaw };
  }

  // Fallback direct rule calculation
  const rows: PointBreakdownRow[] = [];

  // Minutes (always)
  const minPts = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
  rows.push({
    key: 'minutes',
    label: 'Minutes played',
    value: minutes,
    points: minPts,
  });

  // Goals
  if (goalsScored > 0) {
    const goalPts = goalsScored * (isGkpOrDef ? 6 : isMid ? 5 : 4);
    rows.push({
      key: 'goals_scored',
      label: 'Goals scored',
      value: goalsScored,
      points: goalPts,
    });
  }

  // Assists
  if (assists > 0) {
    rows.push({
      key: 'assists',
      label: 'Assists',
      value: assists,
      points: assists * 3,
    });
  }

  // Clean Sheet
  if (cleanSheets > 0 && minutes >= 60 && (isGkpOrDef || isMid)) {
    const csPts = isGkpOrDef ? cleanSheets * 4 : cleanSheets * 1;
    rows.push({
      key: 'clean_sheets',
      label: 'Clean Sheet',
      value: cleanSheets,
      points: csPts,
    });
  }

  // Defensive Contribution
  if (dcValue > 0 && dcPoints > 0) {
    rows.push({
      key: 'defensive_contribution',
      label: 'Defensive Contribution',
      value: dcValue,
      points: dcPoints,
    });
  }

  // Goals Conceded
  if (isGkpOrDef && goalsConceded >= 2 && minutes > 0) {
    const gcPts = -Math.floor(goalsConceded / 2);
    rows.push({
      key: 'goals_conceded',
      label: 'Goals Conceded',
      value: goalsConceded,
      points: gcPts,
    });
  }

  // Saves
  if (elementType === 1 && saves >= 3) {
    const savePts = Math.floor(saves / 3);
    rows.push({
      key: 'saves',
      label: 'Saves',
      value: saves,
      points: savePts,
    });
  }

  // Penalties Saved
  if (penaltiesSaved > 0) {
    rows.push({
      key: 'penalties_saved',
      label: 'Penalties Saved',
      value: penaltiesSaved,
      points: penaltiesSaved * 5,
    });
  }

  // Penalties Missed
  if (penaltiesMissed > 0) {
    rows.push({
      key: 'penalties_missed',
      label: 'Penalties Missed',
      value: penaltiesMissed,
      points: penaltiesMissed * -2,
    });
  }

  // Own Goals
  if (ownGoals > 0) {
    rows.push({
      key: 'own_goals',
      label: 'Own Goals',
      value: ownGoals,
      points: ownGoals * -2,
    });
  }

  // Yellow Cards
  if (yellowCards > 0) {
    rows.push({
      key: 'yellow_cards',
      label: 'Yellow Card',
      value: yellowCards,
      points: yellowCards * -1,
    });
  }

  // Red Cards
  if (redCards > 0) {
    rows.push({
      key: 'red_cards',
      label: 'Red Card',
      value: redCards,
      points: redCards * -3,
    });
  }

  // Bonus
  if (bonus > 0) {
    rows.push({
      key: 'bonus',
      label: 'Bonus',
      value: bonus,
      points: bonus,
    });
  }

  const calculatedRaw = rows.reduce((sum, r) => sum + r.points, 0);
  return { rows, officialRaw, calculatedRaw };
}

function PlayerCard({ player, isBench, onClick }: { player: any; isBench?: boolean; onClick?: () => void }) {
  return (
    <div 
      className={`player-card text-center flex flex-col items-center mx-1 ${isBench ? 'opacity-90' : ''} cursor-pointer transition-all duration-300 ease-out active:scale-95 active:shadow-[0_0_15px_rgba(255,255,255,0.5)]`} 
      onClick={onClick}
    >
      <div className="jersey-icon relative mb-1.5 flex justify-center items-center">
        {player.jerseyUrl ? (
          <img 
            src={player.jerseyUrl} 
            alt={player.teamShortName || 'Jersey'} 
            className="w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-lg transition-transform hover:scale-110" 
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 bg-emerald-900 rounded-full flex items-center justify-center">👕</div>
        )}
        {player.isCaptain && (
          <span className="absolute -top-1 -right-1 bg-black text-amber-400 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-md">
            C
          </span>
        )}
        {player.isVice && (
          <span className="absolute -top-1 -right-1 bg-slate-800 text-slate-200 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-300 shadow-md">
            V
          </span>
        )}
      </div>
      <div className="bg-slate-950/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-t border border-slate-700 max-w-[100px] truncate shadow">
        {player.name}
      </div>
      <div className="bg-emerald-400 text-slate-950 font-black text-[12px] px-2.5 py-0.5 rounded-b min-w-[42px] mt-[-1px] shadow-md border-x border-b border-emerald-500">
        {player.points}
      </div>
    </div>
  );
}
