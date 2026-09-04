'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { ArrowDown, ArrowUp, RefreshCw, Zap, Trophy, PlayCircle, CheckCircle2, CircleDashed } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const initials = (name: string) => name.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();

async function fetchWithConcurrency(tasks: (() => Promise<any>)[], limit: number) {
  const results: any[] = [];
  const executing: Promise<any>[] = [];
  
  for (const task of tasks) {
    const p = task().then(res => {
      executing.splice(executing.indexOf(p), 1);
      return res;
    });
    executing.push(p);
    results.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

export default function LiveCenter() {
  const [leagueData, setLeagueData] = useState<any>(null);
  const [managersLive, setManagersLive] = useState<Record<number, any>>({});
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingLive, setLoadingLive] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadLeague = async () => {
    try {
      setLoadingLeague(true);
      const res = await fetch('/api/live/league');
      const data = await res.json();
      if (data.ok) {
        setLeagueData(data);
        return data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeague(false);
    }
    return null;
  };

  const loadLiveManagers = async (league: any) => {
    if (!league?.managers) return;
    setLoadingLive(true);
    
    const tasks = league.managers.map((m: any) => async () => {
      try {
        const res = await fetch(`/api/live/manager/${m.entryId}`);
        const data = await res.json();
        
        setManagersLive(prev => ({
          ...prev,
          [m.entryId]: {
            ...data,
            // Calculate previousTotal and liveTotalPoints
            previousTotal: m.totalPoints - m.eventPoints,
            liveTotalPoints: (m.totalPoints - m.eventPoints) + (data.live?.liveGWPoints || 0)
          }
        }));
      } catch (e) {
        setManagersLive(prev => ({
          ...prev,
          [m.entryId]: { ok: false, isLiveUnavailable: true }
        }));
      }
    });

    await fetchWithConcurrency(tasks, 5);
    setLastUpdated(new Date());
    setLoadingLive(false);
  };

  const refreshData = async () => {
    const lg = await loadLeague();
    if (lg) {
      await loadLiveManagers(lg);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    if (isAutoRefresh && leagueData && !leagueData.eventStatus?.finished) {
      intervalRef.current = setInterval(() => {
        if (!loadingLive) {
          refreshData();
        }
      }, 60000);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoRefresh, leagueData, loadingLive]);

  // Derived state
  const managersWithRank = (leagueData?.managers || []).map((m: any) => {
    const liveData = managersLive[m.entryId];
    return {
      ...m,
      liveData: liveData || null,
      liveTotalPoints: liveData?.liveTotalPoints ?? m.totalPoints
    };
  });

  // Sort and assign ranks
  managersWithRank.sort((a: any, b: any) => b.liveTotalPoints - a.liveTotalPoints);
  
  let currentRank = 1;
  managersWithRank.forEach((m: any, idx: number) => {
    if (idx > 0 && m.liveTotalPoints === managersWithRank[idx - 1].liveTotalPoints) {
      m.liveRank = managersWithRank[idx - 1].liveRank;
    } else {
      m.liveRank = currentRank;
    }
    currentRank++;
    m.movement = m.previousRank ? m.previousRank - m.liveRank : null;
  });

  // Insights
  let highestGW = { score: -1, name: '' };
  let bestCaptain = { score: -1, name: '', manager: '' };

  managersWithRank.forEach((m: any) => {
    if (m.liveData?.ok) {
      if (m.liveData.live.liveGWPoints > highestGW.score) {
        highestGW = { score: m.liveData.live.liveGWPoints, name: m.entryName };
      }
      if (m.liveData.captain && m.liveData.captain.points > bestCaptain.score) {
        bestCaptain = { score: m.liveData.captain.points, name: m.liveData.captain.name, manager: m.entryName };
      }
    }
  });

  return (
    <main className="container py-12">
      {/* Hero */}
      <section className="mb-8 p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Zap size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-black px-2 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-widest flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${leagueData?.eventStatus?.finished ? 'bg-slate-500' : 'bg-rose-500 animate-pulse'}`}></span>
                {leagueData?.eventStatus?.finished ? 'FINAL' : leagueData?.eventStatus?.isCurrent ? 'LIVE' : 'UPCOMING'} GAMEWEEK CENTER
              </span>
              {leagueData && !leagueData.eventStatus?.finished && (
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                  PROVISIONAL LIVE DATA
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
              Gameweek {leagueData?.currentGW || '-'}
            </h1>
            <p className="text-slate-400 font-medium">
              Real-time rank & points updates. Live points bersifat provisional dan dapat berubah karena bonus, auto-substitution, atau pembaruan data FPL.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="text-sm text-slate-400">
              Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '...'}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAutoRefresh} 
                  onChange={e => setIsAutoRefresh(e.target.checked)}
                  disabled={leagueData?.eventStatus?.finished}
                  className="accent-rose-500 w-4 h-4"
                />
                Auto Refresh (60s)
              </label>
              <button 
                onClick={refreshData} 
                disabled={loadingLeague || loadingLive}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingLive ? 'animate-spin text-rose-400' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Highest Live GW Score</div>
          <div className="text-xl font-black text-white">{highestGW.score >= 0 ? `${highestGW.score} pts` : '—'}</div>
          <div className="text-sm font-medium text-emerald-400">{highestGW.name || '—'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Current Live Leader</div>
          <div className="text-xl font-black text-white">{managersWithRank[0]?.liveTotalPoints ? `${managersWithRank[0].liveTotalPoints} pts` : '—'}</div>
          <div className="text-sm font-medium text-emerald-400">{managersWithRank[0]?.entryName || '—'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Best Captain</div>
          <div className="text-xl font-black text-white">{bestCaptain.score >= 0 ? `${bestCaptain.name} (${bestCaptain.score} pts)` : '—'}</div>
          <div className="text-sm font-medium text-amber-400">{bestCaptain.manager || '—'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Managers Loaded</div>
          <div className="text-xl font-black text-white">{Object.keys(managersLive).filter(k => managersLive[Number(k)]?.ok).length} / {managersWithRank.length || 0}</div>
          <div className="text-sm font-medium text-slate-400">Total Participants</div>
        </div>
      </div>

      {/* Table */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4 w-16 text-center">+/-</th>
                <th className="p-4">Manager</th>
                <th className="p-4 text-center">Live GW</th>
                <th className="p-4 text-center">Total</th>
                <th className="p-4">Captain</th>
                <th className="p-4 text-center">Played</th>
                <th className="p-4">Player Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800/50">
              {managersWithRank.map((m: any) => (
                <tr key={m.entryId} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 text-center font-black text-white">{m.liveRank}</td>
                  <td className="p-4 text-center">
                    {m.movement === null || m.movement === 0 ? (
                      <span className="text-slate-500 font-black">—</span>
                    ) : m.movement > 0 ? (
                      <span className="text-emerald-400 font-bold flex items-center justify-center gap-0.5"><ArrowUp size={14}/> {m.movement}</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center justify-center gap-0.5"><ArrowDown size={14}/> {Math.abs(m.movement)}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs font-black text-slate-300">
                        {initials(m.managerName || m.entryName)}
                      </div>
                      <div>
                        <Link href={`/manager/${m.entryId}`} className="font-bold text-white hover:text-cyan-400 transition-colors">
                          {m.entryName}
                        </Link>
                        <div className="text-xs text-slate-400">{m.managerName}</div>
                      </div>
                    </div>
                  </td>
                  
                  {m.liveData && !m.liveData.isLiveUnavailable ? (
                    <>
                      <td className="p-4 text-center">
                        <div className="font-black text-lg text-emerald-400">{m.liveData.live.liveGWPoints}</div>
                        {m.liveData.live.transferCost > 0 && (
                          <div className="text-[10px] font-bold text-rose-400 uppercase">-{m.liveData.live.transferCost} Hits</div>
                        )}
                      </td>
                      <td className="p-4 text-center font-black text-white text-lg">{m.liveTotalPoints}</td>
                      <td className="p-4">
                        {m.liveData.captain ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{m.liveData.captain.name}</span>
                            <span className="text-xs font-black text-amber-400">({m.liveData.captain.points} pts)</span>
                            {m.liveData.captain.multiplier === 3 && <span className="text-[9px] font-black bg-amber-400 text-black px-1 py-0.5 rounded">TC</span>}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-300">
                        {m.liveData.playedCount} / {m.liveData.totalActivePlayers}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 text-emerald-400" title="Playing">
                            <PlayCircle size={14} /> {m.liveData.playersStatus.playing}
                          </div>
                          <div className="flex items-center gap-1 text-slate-400" title="Finished">
                            <CheckCircle2 size={14} /> {m.liveData.playersStatus.finished}
                          </div>
                          <div className="flex items-center gap-1 text-cyan-400" title="Not Started">
                            <CircleDashed size={14} /> {m.liveData.playersStatus.notStarted}
                          </div>
                        </div>
                      </td>
                    </>
                  ) : m.liveData?.isLiveUnavailable ? (
                    <td colSpan={5} className="p-4 text-center text-rose-400 font-bold text-sm bg-rose-500/5">
                      Live Data Unavailable. Retry later.
                    </td>
                  ) : (
                    <td colSpan={5} className="p-4 text-center">
                      <div className="flex justify-center">
                        <RefreshCw size={20} className="animate-spin text-slate-600" />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {managersWithRank.length === 0 && !loadingLeague && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    Belum ada data klasemen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.2 Live Center • League ID 134820</footer>
    </main>
  );
}
