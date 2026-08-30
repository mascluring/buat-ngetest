'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles, Trophy, TrendingUp, Shield, BarChart2, Award } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const initials = (name: string) => name.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();

export default function ManagerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                <div className="text-2xl font-black text-white">GW {[...data.captainPerformance].sort((a,b) => b.captainPoints - a.captainPoints)[0].event}</div>
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
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>

            {/* DEF */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 2).map((p: any) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>

            {/* MID */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 3).map((p: any) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>

            {/* FWD */}
            <div className="flex justify-around my-4 relative z-10">
              {picksList.filter((p: any) => p.position <= 11 && p.elementType === 4).map((p: any) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>

            {/* BENCH */}
            <div className="mt-8 pt-4 border-t border-emerald-300/30 relative z-10 bg-black/40 rounded-xl p-3">
              <div className="text-xs uppercase font-bold text-emerald-200 mb-2">BENCH PLAYERS ({detail.benchPoints} PTS)</div>
              <div className="flex justify-around">
                {picksList.filter((p: any) => p.position > 11).map((p: any) => (
                  <PlayerCard key={p.id} player={p} isBench />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function PlayerCard({ player, isBench }: { player: any; isBench?: boolean }) {
  return (
    <div className={`player-card text-center flex flex-col items-center mx-1 ${isBench ? 'opacity-90' : ''}`}>
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
