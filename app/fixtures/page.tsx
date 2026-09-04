'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const getTeamBadgeUrl = (shortName: string) => {
  const teamCodes: Record<string, string> = {
    ARS: '3', AVL: '7', BOU: '91', BRE: '94', BHA: '36',
    CHE: '8', COV: '9', CRY: '31', EVE: '11', FUL: '54',
    HUL: '88', IPS: '40', LEE: '2', LIV: '14', MCI: '43',
    MUN: '1', NEW: '4', NFO: '17', TOT: '6', SUN: '56'
  };
  const code = teamCodes[shortName?.toUpperCase()] || '1';
  return `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`;
};

function TeamBadge({ team }: { team: string }) {
  return (
    <img 
      src={getTeamBadgeUrl(team)} 
      alt={team} 
      className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" 
      loading="lazy" 
    />
  );
}

export default function FixturesPage() {
  const [gw, setGw] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const closePopup = () => setSelectedMatch(null);

  // Close popup on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const loadData = async (selectedGw?: number | null) => {
    setLoading(true);
    setError('');
    try {
      const url = selectedGw ? `/api/fixtures?gw=${selectedGw}` : `/api/fixtures`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat jadwal pertandingan');
      setData(json);
      if (selectedGw === undefined || selectedGw === null) {
        setGw(json.gw);
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat jadwal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(gw);
  }, [gw]);

  const formatDeadline = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `Tenggat Waktu: ${formatter.format(d).replace(/\./g, ':')} WIB`;
    } catch {
      return '';
    }
  };

  // Group fixtures by date
  const groupedFixtures = useMemo(() => {
    if (!data?.fixtures) return [];
    
    const groups: Record<string, any[]> = {};
    
    data.fixtures.forEach((f: any) => {
      const dateObj = new Date(f.kickoff_time);
      const dateStr = dateObj.toLocaleDateString('id-ID', { 
        timeZone: 'Asia/Jakarta', 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(f);
    });
    
    return Object.entries(groups).map(([date, matches]) => ({
      date,
      matches
    }));
  }, [data]);

  return (
    <main className="container page-shell py-8">
      <div className="my-4 flex items-center justify-between">
        <Link className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white" href="/">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Klasemen Utama
        </Link>
        <button 
          onClick={() => loadData(gw)} 
          disabled={loading}
          className="flex items-center gap-2 text-sm bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded text-slate-300 transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          Refresh
        </button>
      </div>

      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="eyebrow text-blue-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar size={14} /> JADWAL PERTANDINGAN
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Fixtures</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Jadwal pertandingan Premier League dan hasil skor secara real-time.
            </p>
            {data?.deadline && (
              <p className="text-sm text-emerald-400 mt-2 font-medium bg-emerald-500/10 inline-flex px-3 py-1 rounded-md border border-emerald-500/20">
                {formatDeadline(data.deadline)}
              </p>
            )}
          </div>
          
          {data?.events && (
            <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 shrink-0">
              <button 
                onClick={() => setGw(Math.max(1, (gw || 1) - 1))}
                disabled={(gw || 1) <= 1}
                className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <select 
                value={gw || ''} 
                onChange={(e) => setGw(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-center border-none focus:ring-0 cursor-pointer outline-none appearance-none px-4"
              >
                {data.events.map((e: any) => (
                  <option key={e.id} value={e.id} className="bg-slate-900">
                    {e.name} {e.is_current ? '(Current)' : e.is_next ? '(Next)' : ''}
                  </option>
                ))}
              </select>
              <button 
                onClick={() => setGw(Math.min(38, (gw || 1) + 1))}
                disabled={(gw || 1) >= 38}
                className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="card error-banner p-4 bg-rose-500/10 border-rose-500/40 text-rose-200 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <div>
              <b className="block text-rose-100 mb-1">Gagal memuat jadwal</b>
              <span className="text-sm opacity-90">{error}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && (!data?.fixtures || data.fixtures.length === 0) && !error && (
        <div className="card p-12 text-center text-slate-400 bg-slate-900/50 border border-slate-800">
          Jadwal tidak tersedia untuk gameweek ini.
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 bg-slate-900/50 border border-slate-800">
              <div className="skeleton h-6 w-48 mb-6 mx-auto rounded"></div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="skeleton h-16 w-full rounded-lg"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedFixtures.map((group, groupIdx) => (
            <div key={groupIdx} className="fixture-group">
              <h3 className="text-center font-bold text-slate-300 mb-4 sticky top-0 py-2 bg-[#0B1120]/95 backdrop-blur z-10 border-b border-slate-800">
                {group.date}
              </h3>
              
              <div className="space-y-3">
                {group.matches.map((match: any) => {
                  const matchTime = new Date(match.kickoff_time).toLocaleTimeString('id-ID', { 
                    timeZone: 'Asia/Jakarta', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }).replace(/\./g, ':');
                  
                  return (
                    <div 
                      key={match.id} 
                      className={`card p-3 md:p-4 bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between mx-auto max-w-3xl ${match.finished ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                      onClick={() => match.finished && setSelectedMatch(match)}
                    >
                      {/* Home Team */}
                      <div className="flex-1 flex items-center justify-end gap-3 md:gap-4 text-right">
                        <span className="font-bold text-sm md:text-base hidden sm:block">{match.homeTeam.name}</span>
                        <span className="font-bold text-base sm:hidden">{match.homeTeam.short_name}</span>
                        <TeamBadge team={match.homeTeam.short_name} />
                      </div>
                      
                      {/* Center Score / Time */}
                      <div className="flex-shrink-0 w-24 md:w-32 flex flex-col items-center justify-center">
                        {match.started ? (
                          <div className="bg-slate-800/80 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700 min-w-[70px] md:min-w-[90px] text-center shadow-inner">
                            <div className="text-xl md:text-2xl font-black tabular-nums tracking-wider text-white flex justify-center items-center gap-1.5 md:gap-2">
                              <span>{match.team_h_score ?? 0}</span>
                              <span className="text-slate-500 opacity-60 font-normal">-</span>
                              <span>{match.team_a_score ?? 0}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60 min-w-[70px] text-center">
                            <span className="text-sm md:text-base font-medium text-slate-400 tracking-wide">{matchTime}</span>
                          </div>
                        )}
                        {match.started && !match.finished_provisional && (
                          <span className="text-[10px] uppercase font-bold text-emerald-400 mt-1.5 tracking-wider animate-pulse flex items-center gap-1"><Clock size={10} /> Live</span>
                        )}
                        {match.finished_provisional && !match.finished && (
                          <span className="text-[10px] text-slate-400 mt-1.5">FT*</span>
                        )}
                        {match.finished && (
                          <span className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">FT</span>
                        )}
                      </div>
                      
                      {/* Away Team */}
                      <div className="flex-1 flex items-center justify-start gap-3 md:gap-4">
                        <TeamBadge team={match.awayTeam.short_name} />
                        <span className="font-bold text-sm md:text-base hidden sm:block">{match.awayTeam.name}</span>
                        <span className="font-bold text-base sm:hidden">{match.awayTeam.short_name}</span>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closePopup}>
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center font-bold text-lg text-white mb-4">Finished</div>
            <div className="flex justify-between items-center text-sm mb-4">
              <div className="font-bold">{selectedMatch.homeTeam.name}</div>
              <div className="font-black text-2xl">{selectedMatch.team_h_score} - {selectedMatch.team_a_score}</div>
              <div className="font-bold">{selectedMatch.awayTeam.name}</div>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              {selectedMatch.stats.map((s: any) => {
                if (s.h.length === 0 && s.a.length === 0) return null;
                
                const labels: Record<string, string> = {
                  goals_scored: '⚽ Gol',
                  assists: '👟 Assist',
                  bonus: '⭐ Bonus',
                  yellow_cards: '🟨 Kartu Kuning',
                  red_cards: '🟥 Kartu Merah'
                };
                
                if (!labels[s.identifier]) return null;

                return (
                  <div key={s.identifier}>
                    <div className="font-bold text-slate-400 text-xs uppercase mb-1">{labels[s.identifier]}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-right">
                        {s.h.map((h: any, i: number) => <div key={i}>{h.name} {h.value > 1 ? `(${h.value})` : ''}</div>)}
                      </div>
                      <div className="text-left">
                        {s.a.map((a: any, i: number) => <div key={i}>{a.name} {a.value > 1 ? `(${a.value})` : ''}</div>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={closePopup} className="w-full mt-6 bg-slate-800 py-2 rounded-lg text-sm font-semibold">Tutup</button>
          </div>
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.2 Fixtures • League ID 134820</footer>
    </main>
  );
}
