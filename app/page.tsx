'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { ArrowDown, ArrowUp, Crown, Medal, RefreshCw, Search, Trophy, Users, Zap, BarChart3, Sparkles, X, ChevronDown, ChevronUp, TrendingUp, Calendar } from 'lucide-react';

const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(n);
const initials=(name:string)=>name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
type Row={entry:number;entry_name:string;player_name:string;rank:number;last_rank:number;total:number;event_total:number};
type PickPlayer={id:number;name:string;elementType:number;teamCode:number;teamShortName:string;jerseyUrl:string;position:number;multiplier:number;isCaptain:boolean;isVice:boolean;points:number;rawPoints:number;minutes:number;goals_scored:number;assists:number;saves:number;clean_sheets:number;bonus:number;yellow_cards:number;red_cards:number;own_goals:number};
type Detail={
  entry:number;
  captainName:string;
  viceName:string;
  captainPoints:number;
  vicePoints:number;
  lineupPoints:number;
  benchPoints:number;
  bonusPoints:number;
  transfersCost:number;
  netPoints:number;
  teamValue:string;
  bankValue:string;
  formation:string;
  chip:string|null;
  playedCount:number;
  totalPicks:number;
  totalGamesCount:number;
  picksList?:PickPlayer[];
};
type Data={league:any;standings:Row[];details?:Record<number,Detail>;hasNext:boolean;page:number;current:number};

export default function Home(){
 const [data,setData]=useState<Data|null>(null),[analytics,setAnalytics]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[sort,setSort]=useState<'rank'|'gw'|'total'|'move'>('rank');
 const [expandedEntry, setExpandedEntry] = useState<number|null>(null);
 const [viewMode, setViewMode] = useState<'pitch'|'list'>('pitch');
 const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
 const closePlayerPopup = () => setSelectedPlayer(null);

 const load=async(p=page)=>{setLoading(true);setError('');try{
    const [r1, r2] = await Promise.all([
      fetch(`/api/league-picks?page=${p}`,{cache:'no-store'}),
      fetch('/api/analytics',{cache:'no-store'})
    ]);
    const json1 = await r1.json().catch(()=>null);
    const json2 = await r2.json().catch(()=>null);
    if(!r1.ok||!json1?.ok)throw new Error(json1?.error||`API error ${r1.status}`);
    setData(json1);
    setAnalytics(json2);
  }catch(e:any){setError(e?.message||'Data FPL tidak dapat dimuat');setData(null)}finally{setLoading(false)}};
 useEffect(()=>{load(page)},[page]);
 const movementReady=(data?.current??1)>=2;
 const movement=(r:Row)=>movementReady && r.last_rank > 0 ? r.last_rank-r.rank : null;
 const rows=useMemo(()=>{const q=query.trim().toLowerCase();const a=(data?.standings??[]).filter(r=>`${r.player_name} ${r.entry_name}`.toLowerCase().includes(q));return [...a].sort((x,y)=>sort==='gw'?y.event_total-x.event_total:sort==='total'?y.total-x.total:sort==='move'?((movement(y)??0)-(movement(x)??0)):x.rank-y.rank)},[data,query,sort]);
 const top=data?.standings?.[0]; const avg=data?.standings?.length?Math.round(data.standings.reduce((s,r)=>s+r.total,0)/data.standings.length):0;
 const bestGW=data?.standings?.reduce((a,r)=>!a||r.event_total>a.event_total?r:a,null as any);
 const riser = analytics?.biggestRiser;
 const faller = analytics?.biggestFaller;
 const top10=(data?.standings??[]).slice(0,10);

 const toggleExpand = (entryId: number) => {
   setExpandedEntry(prev => prev === entryId ? null : entryId);
 };

 return <main>
  <section className="hero"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="container hero-inner">
   <div className="hero-top"><div className="brand-pill"><Trophy size={15}/> FANTASY PREMIER LEAGUE</div><div className="id-pill">LEAGUE ID <b>134820</b></div></div>
   <div className="hero-copy"><div className="eyebrow">2026 / 27 • CLASSIC LEAGUE • V6.2</div><h1>ERA <span>SUPER</span> LEAGUE</h1><p>Command center untuk memantau klasemen, momentum ranking, performa Gameweek, dan manager terbaik dalam satu dashboard.</p></div>
   <div className="hero-meta"><span><i/> Live FPL Data</span><span>Gameweek {data?.current??'—'}</span><span>FPL API • retry 3x</span></div>
  </div></section>
  <div className="container page-shell">
   {error&&<div className="card error-banner"><b>FPL data belum tersedia</b><span>{error}</span><small>Server akan mencoba lagi saat Refresh atau deployment berikutnya.</small><button onClick={()=>load(page)}>Coba lagi</button></div>}
   <div className="stats-grid"><Stat icon={<Users/>} value={fmt(data?.league?.total_entries??data?.standings?.length??0)} label="Total manager"/><Stat icon={<Trophy/>} value={fmt(avg)} label="Rata-rata Total Poin"/><Stat icon={<Crown/>} value={top?fmt(top.total):'—'} label="Poin pemuncak"/><Stat icon={<Zap/>} value={analytics?.highestGWScore?fmt(analytics.highestGWScore.event_total):'—'} label="Highest GW score"/></div>
   <div className="insight-grid"><Insight title="Leader" name={top?.player_name||'—'} sub={top?`${top.entry_name} • ${fmt(top.total)} pts`:'—'} rank="01"/><Insight title="Biggest Riser" name={riser?.player_name||'—'} sub={!movementReady?'Mulai tersedia GW2':riser?`Naik ${fmt((movement(riser) as number))} posisi`:'Tidak ada kenaikan'} rank="↑"/><Insight title="Biggest Faller" name={faller?.player_name||'—'} sub={!movementReady?'Mulai tersedia GW2':faller?`Turun ${fmt(Math.abs(movement(faller) as number))} posisi`:'Tidak ada penurunan'} rank="↓"/></div>
   <section className="card analytics-card"><div className="analytics-head"><div><div className="section-kicker">SEASON SNAPSHOT</div><h2>Momentum klasemen</h2><p>Visual ringkas Top 10 pada halaman aktif dan jarak poin mereka.</p></div><Link className="view-all" href="https://fantasy.premierleague.com/en/leagues/134820/standings/c" target="_blank">Buka FPL ↗</Link></div><div className="bars">{top10.map((r,i)=>{
              const colors = [
                '#f59e0b', // Rank 1 (Amber)
                '#f59e0b', // Rank 2
                '#f59e0b', // Rank 3
                '#6366f1', // Rank 4
                '#6366f1', // Rank 5
                '#6366f1', // Rank 6
                '#10b981', // Rank 7
                '#10b981', // Rank 8
                '#10b981', // Rank 9
                '#10b981', // Rank 10
              ];
              return (
                <div className="bar-row" key={r.entry}>
                  <span className="bar-rank">{r.rank}</span>
                  <div className="bar-label">
                    <b>{r.player_name||r.entry_name}</b>
                    <small>{fmt(r.total)} pts</small>
                  </div>
                  <div className="bar-track">
                    <span style={{
                      width:`${Math.max(8, top?.total ? r.total/top.total*100 : 0)}%`,
                      backgroundColor: colors[i] || '#f59e0b'
                    }}/>
                  </div>
                </div>
              );
            })}</div></section>
   <section className="card table-card"><div className="table-head"><div><div className="section-kicker">LIVE STANDINGS</div><h2>Klasemen Era Super League</h2><p>50 manager per halaman • klik formasi untuk membuka Pitch View / Popup susunan pemain.</p></div><div className="search-wrap"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari manager atau tim..."/></div></div>
    <div className="compare-quick">
    <Link href="/player" className="compare-button text-purple-300 border-purple-500/40 bg-purple-500/10">
      <Users size={14}/> Player
    </Link>
    <Link href="/compare" className="compare-button text-indigo-300 border-indigo-500/40 bg-indigo-500/10">
      <BarChart3 size={14}/> Compare
    </Link>
    <Link href="/fixtures" className="compare-button text-blue-300 border-blue-500/40 bg-blue-500/10">
      <Calendar size={14}/> Fixtures
    </Link><Link href="/price-changes" className="compare-button text-emerald-300 border-emerald-500/40 bg-emerald-500/10"><TrendingUp size={14}/> Price Changes</Link><Link href="/top-performers" className="compare-button text-amber-300 border-amber-500/40 bg-amber-500/10"><Trophy size={14}/> GW Top Performers</Link><Link href="/live" className="compare-button text-rose-300 border-rose-500/40 bg-rose-500/10"><Zap size={14}/> Live Center</Link><Link href="/analytics" className="compare-button"><Sparkles size={14}/> League Analytics</Link></div><div className="sorts"><span>Urutkan:</span>{(['rank','gw','total','move'] as const).map(s=><button key={s} className={sort===s?'active':''} onClick={()=>setSort(s)}>{s==='rank'?'Rank':s==='gw'?'GW Points':s==='total'?'Total':'Movement'}</button>)}</div>
    <div className="table-scroll"><table className="rank-table">
     <thead>
      <tr>
       <th rowSpan={2} className="w-16 text-center">Rank</th>
       <th rowSpan={2}>Team</th>
       <th colSpan={6} className="text-center group-header">Gameweek</th>
       <th rowSpan={2} className="text-center">Season</th>
       <th rowSpan={2} className="text-center">Move</th>
      </tr>
      <tr className="sub-header">
       <th className="text-center">Lineup</th>
       <th className="text-center">Bench</th>
       <th className="text-center">Captain (Vice)</th>
       <th className="text-center">Bonus</th>
       <th className="text-center">Transfers</th>
       <th className="text-center">Net</th>
      </tr>
     </thead>
     <tbody>
      {loading?Array.from({length:8}).map((_,i)=><tr key={i}><td colSpan={10}><div className="skeleton"/></td></tr>):rows.map(r=>{
        const detail = data?.details?.[r.entry];
        const lineupPoints = detail?.lineupPoints ?? r.event_total;
        const playedCount = detail?.playedCount ?? 0;
        const totalPicks = detail?.totalPicks ?? 11;
        const totalGamesCount = detail?.totalGamesCount ?? 11;
        const chipName = detail?.chip;
        const isExpanded = expandedEntry === r.entry;
        
        return (
         <Fragment key={r.entry}>
         <tr className={`${r.rank<=3?'podium-row':''} ${isExpanded?'bg-slate-800/80':''}`}>
          <td className="pos text-center">{r.rank===1?<Medal className="gold"/>:r.rank===2?<Medal className="silver"/>:r.rank===3?<Medal className="bronze"/>:<b>{r.rank}</b>}</td>
          <td>
           <div className="manager">
            <Link href={`/manager/${r.entry}`} className="avatar hover:opacity-80 transition-opacity">
              {initials(r.player_name||r.entry_name)}
            </Link>
            <div className="manager-info">
             <Link href={`/manager/${r.entry}`} className="hover:underline flex items-center gap-1.5">
              <b>{r.entry_name} <small className="text-slate-400 hover:text-cyan-300">({r.player_name||'Manager'})</small></b>
             </Link>
             <div className="chip-row">
              <span className="chip chip-gray">£{detail?.teamValue || '100.0'}m (£{detail?.bankValue || '0.0'})</span>
              <button 
                onClick={() => toggleExpand(r.entry)} 
                className={`chip chip-dark chip-interactive ${isExpanded ? 'bg-indigo-600 text-white' : ''}`}
                title="Klik untuk membuka Pitch View / Popup Skuad"
              >
                {detail?.formation || '3-4-3'} {isExpanded ? <ChevronUp size={12} className="ml-1 inline" /> : <ChevronDown size={12} className="ml-1 inline" />}
              </button>
              <span className="chip chip-cyan">{playedCount} / {totalPicks} Players ({totalGamesCount} Games)</span>
              <span className="chip chip-emerald">{detail?.captainName || '—'} ({detail?.viceName || '—'})</span>
              {chipName && <span className="chip chip-yellow">{chipName}</span>}
             </div>
            </div>
           </div>
          </td>
          <td className="text-center font-mono">{lineupPoints}</td>
          <td className="text-center font-mono text-muted">{detail?.benchPoints ?? 0}</td>
          <td className="text-center font-mono text-muted">{detail ? `${detail.captainPoints} (${detail.vicePoints})` : '—'}</td>
          <td className="text-center font-mono text-muted">{detail?.bonusPoints ?? 0}</td>
          <td className="text-center font-mono text-muted">{detail ? (detail.transfersCost > 0 ? `-${detail.transfersCost}` : '0') : '0'}</td>
          <td className="text-center font-mono font-bold">{detail?.netPoints ?? r.event_total}</td>
          <td className="total text-center font-bold text-amber-400">{fmt(r.total)}</td>
          <td className="text-center"><Movement d={movement(r)}/></td>
         </tr>

         {/* POPUP / PITCH VIEW EXPANDER ROW */}
         {isExpanded && (
           <tr key={`expand-${r.entry}`} className="expand-pitch-row">
             <td colSpan={10} className="p-0 border-b border-indigo-500/30">
               <div className="pitch-container p-6 bg-slate-950/90 text-white">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b border-purple-800">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-lg">{r.entry_name}</span>
                     <span className="text-sm text-purple-300">({r.player_name})</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="pitch-toggle-group">
                       <button className={`toggle-btn ${viewMode==='pitch'?'active':''}`} onClick={() => setViewMode('pitch')}>Pitch View</button>
                       <button className={`toggle-btn ${viewMode==='list'?'active':''}`} onClick={() => setViewMode('list')}>List View</button>
                     </div>
                     <button onClick={() => setExpandedEntry(null)} className="p-1 hover:bg-purple-800 rounded">
                       <X size={18} />
                     </button>
                   </div>
                 </div>

                 {/* LAPANGAN HIJAU PITCH VIEW */}
                 {viewMode === 'pitch' ? (
                   <PitchView detail={detail} picksList={detail?.picksList || []} onPlayerClick={(p) => setSelectedPlayer(p)} />
                 ) : (
                   <ListView picksList={detail?.picksList || []} />
                 )}
               </div>
             </td>
           </tr>
         )}
         </Fragment>
        );
      })}{!loading&&!rows.length&&<tr><td colSpan={10} className="empty">Tidak ada manager yang cocok.</td></tr>}
     </tbody>
    </table></div>
    <div className="pager"><span>Halaman <b>{page}</b>{data?.hasNext?' • lanjut untuk melihat 50 berikutnya':''}</span><div><button disabled={page===1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Prev</button><button disabled={!data?.hasNext||loading} onClick={()=>setPage(p=>p+1)}>Next →</button><button className="refresh" onClick={()=>load(page)} disabled={loading}><RefreshCw size={14} className={loading?'spin':''}/> Refresh</button></div></div>
   </section>
   <div className="v3-note"><Sparkles size={16}/><div><b>V6.0 Interactive Pitch View</b><span>Formasi dapat diklik langsung untuk membuka visual pitch view lapangan dan perhitungan poin real-time.</span></div></div>
   <footer>ERA SUPER LEAGUE • V6.0 Dashboard • League ID 134820 • Data from Fantasy Premier League</footer>
  </div>
 </main>
}

function StatRow({ label, value, points }: { label: string; value: number; points: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-center">
      <div className="text-slate-200">{label}</div>
      <div className="text-center font-bold text-white">{value}</div>
      <div className="text-right font-bold text-emerald-400">{points} pts</div>
    </div>
  );
}

// Komponen Pitch View Lapangan Hijau persis seperti gambar FPL
function PitchView({ detail, picksList, onPlayerClick }: { detail?: Detail; picksList: PickPlayer[]; onPlayerClick: (p: PickPlayer) => void }) {
  const starters = picksList.filter(p => p.position <= 11);
  const bench = picksList.filter(p => p.position > 11);

  const gkp = starters.filter(p => p.elementType === 1);
  const def = starters.filter(p => p.elementType === 2);
  const mid = starters.filter(p => p.elementType === 3);
  const fwd = starters.filter(p => p.elementType === 4);

  return (
    <div className="fpl-pitch relative rounded-2xl overflow-hidden p-6 border-2 border-emerald-400/40 shadow-2xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800">
      {/* Garis Lapangan */}
      <div className="pitch-line pitch-goal-top" />
      <div className="pitch-line pitch-box-top" />
      <div className="pitch-line pitch-center-circle" />

      {/* GKP */}
      <div className="flex justify-center my-3 relative z-10">
        {gkp.map(p => <PlayerCard key={p.id} player={p} onClick={() => onPlayerClick(p)} />)}
      </div>

      {/* DEF */}
      <div className="flex justify-around my-4 relative z-10">
        {def.map(p => <PlayerCard key={p.id} player={p} onClick={() => onPlayerClick(p)} />)}
      </div>

      {/* MID */}
      <div className="flex justify-around my-4 relative z-10">
        {mid.map(p => <PlayerCard key={p.id} player={p} onClick={() => onPlayerClick(p)} />)}
      </div>

      {/* FWD */}
      <div className="flex justify-around my-4 relative z-10">
        {fwd.map(p => <PlayerCard key={p.id} player={p} onClick={() => onPlayerClick(p)} />)}
      </div>

      {/* BENCH SECTION */}
      {bench.length > 0 && (
        <div className="mt-8 pt-4 border-t border-emerald-300/30 relative z-10 bg-black/40 rounded-xl p-3">
          <div className="text-xs uppercase font-bold text-emerald-200 mb-2">BENCH PLAYERS ({detail?.benchPoints || 0} PTS)</div>
          <div className="flex justify-around">
            {bench.map(p => <PlayerCard key={p.id} player={p} isBench onClick={() => onPlayerClick(p)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerPopup({ player, onClose }: { player: PickPlayer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-800">
          <h3 className="text-2xl font-black text-white">{player.name}</h3>
        </div>
        
        <div className="p-6">
          <h4 className="text-lg font-bold text-white mb-4">Points breakdown</h4>
          
          <div className="grid grid-cols-3 gap-2 text-sm text-slate-400 mb-2 font-semibold uppercase tracking-wider">
            <div>Statistic</div>
            <div className="text-center">Value</div>
            <div className="text-right">Points</div>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <StatRow label="Minutes played" value={player.minutes} points={player.minutes >= 60 ? 2 : player.minutes > 0 ? 1 : 0} />
            <StatRow label="Goals scored" value={player.goals_scored} points={player.goals_scored * 4} />
            <StatRow label="Assists" value={player.assists} points={player.assists * 3} />
            <StatRow label="Clean sheets" value={player.clean_sheets} points={player.elementType >= 2 ? 4 : 6} />
            <StatRow label="Saves" value={player.elementType === 1 ? player.saves : 0} points={player.elementType === 1 ? Math.floor(player.saves / 3) : 0} />
            <StatRow label="Bonus" value={player.bonus} points={player.bonus} />
            <StatRow label="Def. contrib" value={player.goals_scored + player.assists} points={(player.goals_scored * 4) + (player.assists * 3)} />
            <StatRow label="Yellow Cards (YC)" value={player.yellow_cards} points={player.yellow_cards * -1} />
            <StatRow label="Red Cards (xA)" value={player.red_cards} points={player.red_cards * -3} />
            <StatRow label="Own Goals" value={player.own_goals} points={player.own_goals * -2} />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center text-white">
            <span className="font-bold text-lg">Total Points:</span>
            <span className="font-black text-2xl">{player.points}</span>
          </div>
        </div>
        
        <div className="p-4 bg-slate-800">
          <button onClick={onClose} className="w-full bg-slate-700 py-2 rounded-lg text-sm font-semibold text-white hover:bg-slate-600">Tutup</button>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ player, isBench, onClick }: { player: PickPlayer; isBench?: boolean; onClick?: () => void }) {
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

function ListView({ picksList }: { picksList: PickPlayer[] }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 text-left">
      <table className="w-full text-xs text-slate-200">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="py-2">POS</th>
            <th className="py-2">PLAYER</th>
            <th className="py-2 text-center">ROLE</th>
            <th className="py-2 text-center">MINS</th>
            <th className="py-2 text-right">POINTS</th>
          </tr>
        </thead>
        <tbody>
          {picksList.map(p => (
            <tr key={p.id} className="border-b border-slate-800">
              <td className="py-2 font-mono">{p.position <= 11 ? `S${p.position}` : `B${p.position-11}`}</td>
              <td className="py-2 font-bold">{p.name}</td>
              <td className="py-2 text-center">{p.isCaptain ? 'Captain (C)' : p.isVice ? 'Vice (V)' : 'Starter'}</td>
              <td className="py-2 text-center font-mono">{p.minutes}'</td>
              <td className="py-2 text-right font-mono font-bold text-amber-400">{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({icon,value,label}:{icon:any;value:string;label:string}){return <div className="stat card"><div className="stat-icon">{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>}
function Insight({title,name,sub,rank}:{title:string;name:string;sub:string;rank:string}){return <div className="insight card"><div><span>{title}</span><b>{name}</b><small>{sub}</small></div><strong>{rank}</strong></div>}
function Movement({d}:{d:number|null}){
  if (d === null || d === 0) return <span className="movement flat">—</span>;
  if (d > 0) return <span className="movement up"><ArrowUp size={14}/> {d}</span>;
  return <span className="movement down"><ArrowDown size={14}/> {Math.abs(d)}</span>;
}
