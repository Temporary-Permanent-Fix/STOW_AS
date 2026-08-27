import * as XLSX from 'xlsx';

const TYPE_COLORS = {
  VGP:'#2EA043', SP:'#6366F1', VV:'#D29922', REP:'#FF4B4B', SKL:'#3FB950',
  SKLSK:'#818CF8', AATSKL:'#F97316', AHUSKL:'#EC4899', PRR:'#8B949E', REM:'#6B7280',
};

const find = (headers, candidates) => candidates.find(c => headers.includes(c)) || null;

export function parseExcelRaw(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  if (!rows.length) return null;

  const h = Object.keys(rows[0]);
  const cols = {
    op:   find(h, ['Spustil','Potvrzovač','Confirmer']),
    qty:  find(h, ['Množství','Quantity']) || 'Množství',
    dok:  find(h, ['Doklad','Document']) || 'Doklad',
    prod: find(h, ['Produkt','Product']) || 'Produkt',
    sec:  find(h, ['Zdroj.lokace','Stanice lokace','SourceLocation']),
    date: find(h, ['BranchProcessingFinishTime','Konec Zpracování na Pob']),
  };
  cols.opLabel = cols.op === 'Potvrzovač' ? 'Potvrzovač' : (cols.op === 'Spustil' ? 'Spustil' : 'Operátor');

  rows.forEach(r => {
    r._type = String(r[cols.dok]||'').replace(/[0-9].*/,'');
    r._op = cols.op ? String(r[cols.op]||'') : 'N/A';
    r._qty = Number(r[cols.qty]) || 1;
    r._sec = cols.sec ? String(r[cols.sec]||'') : 'N/A';
    if (cols.sec === 'Zdroj.lokace') { const m = r._sec.match(/^(\d+[A-Z]+)/); r._sec = m ? m[1] : r._sec; }
    r._date = null;
    if (cols.date && r[cols.date]) { const d = new Date(r[cols.date]); if (!isNaN(d) && d.getFullYear()>2020) r._date = d; }
  });

  return { rows, cols };
}

export function analyzeRows(rows, cols) {
  if (!rows.length) return null;
  const fmtD = d => d ? `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}` : null;

  let dateMin=null, dateMax=null;
  rows.forEach(r => { if(r._date) { if(!dateMin||r._date<dateMin)dateMin=r._date; if(!dateMax||r._date>dateMax)dateMax=r._date; }});

  const typeMap = {};
  rows.forEach(r => {
    const t=r._type; if(!typeMap[t])typeMap[t]={jbl:0,dok:new Set(),qty:0,prod:new Set(),ops:new Set()};
    typeMap[t].jbl++; typeMap[t].dok.add(r[cols.dok]); typeMap[t].qty+=r._qty; typeMap[t].prod.add(r[cols.prod]); typeMap[t].ops.add(r._op);
  });
  const types = {};
  Object.entries(typeMap).forEach(([t,v])=>{
    types[t]={jbl:v.jbl,doklady:v.dok.size,qty:v.qty,produkty:v.prod.size,operatori:v.ops.size,pct:Math.round(v.jbl/rows.length*1000)/10,color:TYPE_COLORS[t]||'#666'};
  });

  const opMap={};
  rows.forEach(r=>{if(!opMap[r._op])opMap[r._op]={jbl:0,qty:0,types:{}};opMap[r._op].jbl++;opMap[r._op].qty+=r._qty;opMap[r._op].types[r._type]=(opMap[r._op].types[r._type]||0)+1;});
  const topOps=Object.entries(opMap).sort((a,b)=>b[1].jbl-a[1].jbl).slice(0,15).map(([name,v])=>{
    const dom=Object.entries(v.types).sort((a,b)=>b[1]-a[1])[0];
    return{name,jbl:v.jbl,qty:v.qty,ratio:Math.round(v.qty/v.jbl*10)/10,domType:dom[0],domCount:dom[1],color:TYPE_COLORS[dom[0]]||'#666'};
  });

  const allQ=rows.map(r=>r._qty),sorted=[...allQ].sort((a,b)=>a-b);
  const buckets=[
    {label:'1 ks',count:rows.filter(r=>r._qty===1).length},{label:'2–5 ks',count:rows.filter(r=>r._qty>=2&&r._qty<=5).length},
    {label:'6–20 ks',count:rows.filter(r=>r._qty>=6&&r._qty<=20).length},{label:'21–100 ks',count:rows.filter(r=>r._qty>=21&&r._qty<=100).length},
    {label:'100+ ks',count:rows.filter(r=>r._qty>100).length},
  ];

  const qtyPerType={};
  Object.keys(types).forEach(t=>{const v=rows.filter(r=>r._type===t).map(r=>r._qty).sort((a,b)=>a-b);if(!v.length)return;
    qtyPerType[t]={avg:Math.round(v.reduce((s,x)=>s+x,0)/v.length*10)/10,med:v[Math.floor(v.length/2)],max:v[v.length-1],total:v.reduce((s,x)=>s+x,0)};});

  const secMap={};rows.forEach(r=>{secMap[r._sec]=(secMap[r._sec]||0)+1;});
  const sections=Object.entries(secMap).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([n,c])=>({name:n,count:c}));

  const prodMap={};rows.forEach(r=>{const p=r[cols.prod];if(!prodMap[p])prodMap[p]={count:0,types:{}};prodMap[p].count++;prodMap[p].types[r._type]=(prodMap[p].types[r._type]||0)+1;});
  const topProducts=Object.entries(prodMap).sort((a,b)=>b[1].count-a[1].count).slice(0,15).map(([n,v])=>{
    const dom=Object.entries(v.types).sort((a,b)=>b[1]-a[1])[0];return{name:n,count:v.count,type:dom[0],color:TYPE_COLORS[dom[0]]||'#666'};});

  const prodPerType={},secPerType={};
  Object.keys(types).forEach(t=>{const tr=rows.filter(r=>r._type===t);
    const pm={},sm={};tr.forEach(r=>{pm[r[cols.prod]]=(pm[r[cols.prod]]||0)+1;sm[r._sec]=(sm[r._sec]||0)+1;});
    prodPerType[t]=Object.entries(pm).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>({name:n,count:c}));
    secPerType[t]=Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>({name:n,count:c}));});

  return{totalJbl:rows.length,totalQty:allQ.reduce((s,v)=>s+v,0),uniqueDoklady:new Set(rows.map(r=>r[cols.dok])).size,
    uniqueProdukty:new Set(rows.map(r=>r[cols.prod])).size,uniqueOps:new Set(rows.map(r=>r._op)).size,
    avgQty:Math.round(allQ.reduce((s,v)=>s+v,0)/rows.length*10)/10,medQty:sorted[Math.floor(sorted.length/2)],maxQty:sorted[sorted.length-1],
    dateMin:fmtD(dateMin),dateMax:fmtD(dateMax),opLabel:cols.opLabel,types,topOps,buckets,qtyPerType,sections,topProducts,prodPerType,secPerType,TYPE_COLORS};
}

export { TYPE_COLORS };
