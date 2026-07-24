'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = n => n != null ? n.toLocaleString('sk') : '—';
const BUCKET_COLORS = ['#2EA043','#6366F1','#D29922','#FF4B4B','#F85149'];

export default function StowDashboard({ data, suffix }) {
  if (!data) return null;
  const d = data;
  const obdobie = d.dateMin && d.dateMax ? ` · Obdobie: ${d.dateMin} – ${d.dateMax}` : '';
  const typesSorted = Object.entries(d.types).sort((a,b) => b[1].jbl - a[1].jbl);

  return (
    <div className="dashboard">
      <div className="info-bar">📂 {fmt(d.totalJbl)} JBL · {fmt(d.totalQty)} ks{obdobie}</div>

      {/* Hero + KPIs */}
      <div className="grid g2" style={{marginBottom:16}}>
        <div className="green-card">
          <small>CELKOVÉ JBL{suffix}</small>
          <h2>{fmt(d.totalJbl)}</h2>
          <p>{fmt(d.totalQty)} kusov celkovo</p>
        </div>
        <div>
          <div className="grid g3" style={{marginBottom:8}}>
            <MetricCard label="Unikátne doklady" value={fmt(d.uniqueDoklady)} />
            <MetricCard label="Unikátne produkty" value={fmt(d.uniqueProdukty)} />
            <MetricCard label={d.opLabel} value={fmt(d.uniqueOps)} />
          </div>
          <div className="grid g3">
            <MetricCard label="Priemer ks/JBL" value={d.avgQty} />
            <MetricCard label="Medián ks/JBL" value={d.medQty} />
            <MetricCard label="Max ks" value={fmt(d.maxQty)} />
          </div>
        </div>
      </div>

      {/* Type breakdown */}
      <div className="section-title">Rozdelenie podľa typu dokladu</div>
      <div style={{display:'flex',gap:2,marginBottom:12,borderRadius:6,overflow:'hidden'}}>
        {typesSorted.map(([t,v]) => (
          <div key={t} style={{flex:v.pct,background:v.color,padding:'6px 8px',fontSize:'.75rem',fontWeight:700,color:'#fff',minWidth:v.pct>3?0:'auto',overflow:'hidden',whiteSpace:'nowrap'}}>
            {v.pct > 4 ? `${t} ${v.pct}%` : t}
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(typesSorted.length,6)},1fr)`,gap:12}}>
        {typesSorted.slice(0,6).map(([t,v]) => (
          <div key={t} className="card type-card" style={{borderTopColor:v.color}}>
            <div className="hdr">
              <span className="dot" style={{color:v.color}}>● {t}</span>
              <span className="pct">{v.pct}%</span>
            </div>
            <div className="rows">
              <Row k="JBL" v={fmt(v.jbl)} /><Row k="Doklady" v={fmt(v.doklady)} />
              <Row k="Množstvo" v={fmt(v.qty)} /><Row k="Produkty" v={fmt(v.produkty)} />
              <Row k={d.opLabel} v={fmt(v.operatori)} />
            </div>
          </div>
        ))}
      </div>

      {/* Operators */}
      <div className="section-title">{d.opLabel} – Top 15</div>
      <div className="grid g6-4">
        <div className="card">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={[...d.topOps].reverse()} layout="vertical" margin={{left:0,right:40,top:5,bottom:5}}>
              <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={110} tick={{fill:'#C9D1D9',fontSize:11}} tickFormatter={n=>n.split(' ')[0]} />
              <Tooltip contentStyle={{background:'#161B22',border:'1px solid #30363D',color:'#E6EDF3'}} formatter={v=>[fmt(v),'JBL']} />
              <Bar dataKey="jbl" radius={[0,4,4,0]}>{[...d.topOps].reverse().map((o,i)=><Cell key={i} fill="#2EA043" />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p style={{fontWeight:600,marginBottom:8}}>JBL vs Množstvo – Top 5</p>
          {d.topOps.slice(0,5).map(o => (
            <div key={o.name} className="op-card">
              <div><span style={{fontWeight:600}}>{o.name.split(' ')[0]}</span><br/><span style={{color:'var(--text-muted)',fontSize:'.8rem'}}>⌀ {o.ratio} ks/JBL</span></div>
              <div style={{textAlign:'right'}}><span style={{color:'var(--accent)'}}>{fmt(o.jbl)} JBL</span><br/><span style={{color:'var(--text-muted)',fontSize:'.8rem'}}>{fmt(o.qty)} ks</span></div>
            </div>
          ))}
          <p style={{fontWeight:600,margin:'12px 0 8px'}}>Dominantný typ dokladu</p>
          {d.topOps.slice(0,10).map(o => (
            <div key={o.name} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0'}}>
              <span style={{width:100,fontSize:'.85rem'}}>{o.name.split(' ')[0]}</span>
              <span className="badge" style={{background:o.color}}>{o.domType}</span>
              <span style={{color:'var(--text-muted)',fontSize:'.85rem'}}>{fmt(o.domCount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="section-title">Analýza množstva</div>
      <div className="grid g2">
        <div className="card">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.buckets} layout="vertical" margin={{left:0,right:10,top:5,bottom:5}}>
              <XAxis type="number" hide /><YAxis dataKey="label" type="category" width={80} tick={{fill:'#C9D1D9',fontSize:12}} />
              <Tooltip contentStyle={{background:'#161B22',border:'1px solid #30363D',color:'#E6EDF3'}} formatter={v=>[fmt(v),'JBL']} />
              <Bar dataKey="count" radius={[0,4,4,0]}>{d.buckets.map((b,i)=><Cell key={i} fill={BUCKET_COLORS[i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <p style={{fontWeight:600,marginBottom:8}}>Množstvo podľa typu dokladu</p>
          <table style={{width:'100%',fontSize:'.85rem',borderCollapse:'collapse'}}>
            <thead><tr style={{color:'var(--text-muted)'}}><th style={{textAlign:'left',padding:4}}>Typ</th><th>Priemer</th><th>Medián</th><th>Max</th><th>Celkom</th></tr></thead>
            <tbody>{Object.entries(d.qtyPerType).sort((a,b)=>b[1].total-a[1].total).map(([t,v])=>(
              <tr key={t}><td style={{color:d.types[t]?.color||'#666',fontWeight:700}}>● {t}</td>
              <td style={{textAlign:'center'}}>{v.avg}</td><td style={{textAlign:'center'}}>{v.med}</td>
              <td style={{textAlign:'center',color:v.max>100?'var(--red)':'inherit',fontWeight:v.max>100?700:'normal'}}>{fmt(v.max)}</td>
              <td style={{textAlign:'center',color:'var(--text-muted)'}}>{fmt(v.total)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Sections */}
      <div className="section-title">Sekcie / Stanice – Top 15</div>
      <div className="grid g2">
        <div className="card">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={[...d.sections].reverse()} layout="vertical" margin={{left:0,right:40,top:5,bottom:5}}>
              <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={60} tick={{fill:'#C9D1D9',fontSize:11}} />
              <Tooltip contentStyle={{background:'#161B22',border:'1px solid #30363D',color:'#E6EDF3'}} formatter={v=>[fmt(v),'JBL']} />
              <Bar dataKey="count" fill="#2EA043" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p style={{fontWeight:600,marginBottom:8}}>Doklad × Sekcia</p>
          {typesSorted.slice(0,6).map(([t]) => d.secPerType[t]?.length > 0 && (
            <div key={t} style={{background:'var(--surface)',borderLeft:`3px solid ${d.types[t].color}`,borderRadius:'0 6px 6px 0',padding:'8px 12px',marginBottom:6}}>
              <span style={{color:d.types[t].color,fontWeight:700}}>● {t}</span>
              <div style={{color:'var(--text-muted)',fontSize:'.8rem',marginTop:4}}>{d.secPerType[t].map(s=>`${s.name} (${s.count})`).join(' · ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="section-title">Top 15 produktov</div>
      <div className="grid g6-4">
        <div className="card">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={[...d.topProducts].reverse()} layout="vertical" margin={{left:0,right:40,top:5,bottom:5}}>
              <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{fill:'#C9D1D9',fontSize:10}} />
              <Tooltip contentStyle={{background:'#161B22',border:'1px solid #30363D',color:'#E6EDF3'}} formatter={v=>[fmt(v),'JBL']} />
              <Bar dataKey="count" radius={[0,4,4,0]}>{[...d.topProducts].reverse().map((p,i)=><Cell key={i} fill={p.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p style={{fontWeight:600,marginBottom:8}}>Top 3 produkty podľa typu</p>
          {typesSorted.slice(0,5).map(([t]) => d.prodPerType[t]?.length > 0 && (
            <div key={t} style={{background:'var(--surface)',borderLeft:`3px solid ${d.types[t].color}`,borderRadius:'0 6px 6px 0',padding:'8px 12px',marginBottom:6}}>
              <span style={{color:d.types[t].color,fontWeight:700}}>● {t}</span>
              <div style={{color:'var(--text-muted)',fontSize:'.8rem',marginTop:4}}>{d.prodPerType[t].map(p=>`${p.name} (${p.count})`).join(' · ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return <div className="card metric-card"><div className="label">{label}</div><div className="value">{value}</div></div>;
}
function Row({ k, v }) {
  return <div className="row"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
