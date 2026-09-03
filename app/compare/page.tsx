import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Crown, Trophy, TrendingUp } from 'lucide-react';
import { getEntry, getEntryHistory, getAllLeagueStandings } from '@/lib/fpl';
import CompareChart from './CompareChart';

const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(n);

export default async function Compare({searchParams}:{searchParams:Promise<{a?:string;b?:string}>}){
  const q=await searchParams;
  const aId=Number(q.a||0),bId=Number(q.b||0);
  const allData = await getAllLeagueStandings().catch(()=>null);
  const rows = allData?.standings ?? [];
  let a:any=null,b:any=null,ah:any=null,bh:any=null;
  if(aId&&bId&&aId!==bId){
    try{
      [a,b,ah,bh]=await Promise.all([getEntry(aId),getEntry(bId),getEntryHistory(aId),getEntryHistory(bId)]);
    }catch{}
  }
  const ac=ah?.current??[],bc=bh?.current??[];
  const len=Math.min(ac.length,bc.length);
  const gap=a&&b?(a.summary_overall_points??0)-(b.summary_overall_points??0):0;

  const nameA = a?.player_first_name || 'Manager A';
  const nameB = b?.player_first_name || 'Manager B';

  const chartData = [];
  for (let i = 0; i < len; i++) {
    const ga = ac[i];
    const gb = bc[i];
    const eventNum = ga?.event || gb?.event || (i + 1);
    chartData.push({
      gw: `GW${eventNum}`,
      [nameA]: ga?.total_points ?? ga?.points ?? 0,
      [nameB]: gb?.total_points ?? gb?.points ?? 0,
    });
  }

  return (
    <main>
      <header className="hero profile-hero">
        <div className="container hero-inner">
          <Link href="/" className="back-link"><ArrowLeft size={16}/> Kembali</Link>
          <div className="profile-title">
            <div className="eyebrow">ERA SUPER LEAGUE • V6.0</div>
            <h1>Compare Manager</h1>
            <p>Bandingkan performa dua manager dari Gameweek ke Gameweek.</p>
          </div>
        </div>
      </header>
      <div className="container page-shell">
        <section className="card compare-picker">
          <div>
            <div className="section-kicker">HEAD TO HEAD</div>
            <h2>Pilih dua manager</h2>
            <p>Selector mengambil seluruh manager dari klasemen aktif.</p>
          </div>
          <form className="compare-form">
            <select name="a" defaultValue={aId||''}>
              <option value="">Manager A</option>
              {rows.map((r:any)=><option key={r.entry} value={r.entry}>{r.rank}. {r.player_name} — {r.entry_name}</option>)}
            </select>
            <span>VS</span>
            <select name="b" defaultValue={bId||''}>
              <option value="">Manager B</option>
              {rows.map((r:any)=><option key={r.entry} value={r.entry}>{r.rank}. {r.player_name} — {r.entry_name}</option>)}
            </select>
            <button type="submit">Bandingkan <ArrowRightLeft size={15}/></button>
          </form>
        </section>

        {!a||!b||aId===bId?(
          <section className="card compare-empty">
            <TrendingUp size={28}/>
            <h2>Siap untuk dibandingkan</h2>
            <p>Pilih Manager A dan Manager B lalu tekan tombol Bandingkan.</p>
          </section>
        ):(
          <>
            <section className="compare-hero-grid">
              <CompareCard entry={a} label="MANAGER A"/>
              <div className="vs-badge">VS</div>
              <CompareCard entry={b} label="MANAGER B"/>
            </section>

            <section className="stats-grid">
              <Stat icon={<Trophy/>} value={fmt(Math.abs(gap))} label="Selisih overall points"/>
              <Stat icon={<Crown/>} value={gap>0?'Manager A':gap<0?'Manager B':'Seri'} label="Unggul poin"/>
              <Stat icon={<TrendingUp/>} value={`${fmt(Math.max(...ac.map((x:any)=>x.points),0))} vs ${fmt(Math.max(...bc.map((x:any)=>x.points),0))}`} label="Best GW points"/>
              <Stat icon={<ArrowRightLeft/>} value={`${fmt(ac.reduce((s:number,x:any)=>s+(x.event_transfers||0),0))} vs ${fmt(bc.reduce((s:number,x:any)=>s+(x.event_transfers||0),0))}`} label="Total transfers"/>
            </section>

            <section className="card chart-card p-6">
              <div className="analytics-head mb-4 flex justify-between items-center">
                <div>
                  <div className="section-kicker">POINTS BATTLE</div>
                  <h2 className="text-xl font-bold text-white">Performa Gameweek</h2>
                  <p className="text-xs text-slate-400">Garis menunjukkan poin kumulatif masing-masing manager di setiap GW.</p>
                </div>
              </div>
              <div className="chart-wrap bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <CompareChart data={chartData} nameA={nameA} nameB={nameB} />
              </div>
            </section>

            <section className="card table-card">
              <div className="table-head p-6 border-b border-slate-800">
                <div>
                  <div className="section-kicker">GW BY GW</div>
                  <h2 className="text-xl font-bold text-white">Perbandingan detail</h2>
                  <p className="text-xs text-slate-400">Selisih poin dan total poin setiap Gameweek.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="rank-table w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left">GW</th>
                      <th className="px-4 py-3 text-left">{a.player_first_name}</th>
                      <th className="px-4 py-3 text-left">{b.player_first_name}</th>
                      <th className="px-4 py-3 text-left">Selisih</th>
                      <th className="px-4 py-3 text-left">Total A</th>
                      <th className="px-4 py-3 text-left">Total B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(len)].reverse().map((_,i)=>{
                      const idx=len-1-i,ga=ac[idx],gb=bc[idx],d=ga.points-gb.points;
                      return (
                        <tr key={ga.event} className="border-t border-slate-800 hover:bg-slate-800/50">
                          <td className="px-4 py-3"><b>GW{ga.event}</b></td>
                          <td className="px-4 py-3">{ga.points}</td>
                          <td className="px-4 py-3">{gb.points}</td>
                          <td className={`px-4 py-3 font-semibold ${d>=0?'text-emerald-400':'text-rose-400'}`}>{d>0?'+':''}{d}</td>
                          <td className="px-4 py-3 font-medium">{fmt(ga.total_points)}</td>
                          <td className="px-4 py-3 font-medium">{fmt(gb.total_points)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="compare-links flex justify-between gap-4 mt-6">
              <Link href={`/manager/${a.id}`} className="text-cyan-400 hover:underline text-sm font-semibold">Profil {a.player_first_name} ↗</Link>
              <Link href={`/manager/${b.id}`} className="text-cyan-400 hover:underline text-sm font-semibold">Profil {b.player_first_name} ↗</Link>
            </div>
          </>
        )}

        <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.0 Compare • League ID 134820</footer>
      </div>
    </main>
  );
}

function CompareCard({entry,label}:{entry:any;label:string}){
  return (
    <div className="card compare-card p-6 bg-slate-900/90 border border-slate-700 rounded-xl">
      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      <h2 className="text-xl font-black text-white mt-1">{entry.player_first_name} {entry.player_last_name}</h2>
      <p className="text-xs text-cyan-400 mt-0.5">{entry.name}</p>
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800">
        <div>
          <div className="text-lg font-black text-white">#{fmt(entry.summary_overall_rank||0)}</div>
          <div className="text-[11px] text-slate-400 uppercase">overall rank</div>
        </div>
        <div>
          <div className="text-lg font-black text-emerald-400">{fmt(entry.summary_overall_points||0)}</div>
          <div className="text-[11px] text-slate-400 uppercase">points</div>
        </div>
      </div>
    </div>
  );
}

function Stat({icon,value,label}:{icon:any;value:string;label:string}){
  return (
    <div className="stat card p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-4">
      <div className="stat-icon p-3 bg-slate-800 text-cyan-400 rounded-lg">{icon}</div>
      <div>
        <div className="stat-value text-lg font-black text-white">{value}</div>
        <div className="stat-label text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );
}

