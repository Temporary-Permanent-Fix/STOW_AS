import * as XLSX from 'xlsx';

const TYPE_COLORS = {
  VGP:'#2EA043', SP:'#6366F1', VV:'#D29922', REP:'#FF4B4B', SKL:'#3FB950',
  SKLSK:'#818CF8', AATSKL:'#F97316', AHUSKL:'#EC4899', PRR:'#8B949E', REM:'#6B7280',
};

const OPERATOR_COLS = ['Spustil','Potvrzovač','Confirmer','Operator'];
const QTY_COL = ['Množství','Quantity','Qty'];
const DOKLAD_COL = ['Doklad','Document'];
const PRODUCT_COL = ['Produkt','Product'];
const SECTION_COLS = ['Zdroj.lokace','Stanice lokace','SourceLocation','Station'];
const DATE_COLS = ['BranchProcessingFinishTime','Konec Zpracování na Pob','FinishTime'];

function findCol(headers, candidates) {
  return candidates.find(c => headers.includes(c)) || null;
}

export function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  if (!rows.length) return null;

  const headers = Object.keys(rows[0]);
  const opCol = findCol(headers, OPERATOR_COLS);
  const qtyCol = findCol(headers, QTY_COL) || 'Množství';
  const dokCol = findCol(headers, DOKLAD_COL) || 'Doklad';
  const prodCol = findCol(headers, PRODUCT_COL) || 'Produkt';
  const secCol = findCol(headers, SECTION_COLS);
  const dateCol = findCol(headers, DATE_COLS);

  const opLabel = opCol === 'Potvrzovač' ? 'Potvrzovač' : (opCol === 'Spustil' ? 'Spustil' : 'Operátor');

  // Extract doklad type
  rows.forEach(r => {
    r._type = (String(r[dokCol] || '')).replace(/[0-9].*/,'');
    r._op = opCol ? String(r[opCol] || '') : 'N/A';
    r._qty = Number(r[qtyCol]) || 1;
    r._sec = secCol ? String(r[secCol] || '') : 'N/A';
    if (secCol === 'Zdroj.lokace') {
      const m = r._sec.match(/^(\d+[A-Z]+)/);
      r._sec = m ? m[1] : r._sec;
    }
    r._date = dateCol ? r[dateCol] : null;
  });

  // Date range
  let dateMin = null, dateMax = null;
  rows.forEach(r => {
    if (r._date) {
      const d = new Date(r._date);
      if (!isNaN(d) && d.getFullYear() > 2020) {
        if (!dateMin || d < dateMin) dateMin = d;
        if (!dateMax || d > dateMax) dateMax = d;
      }
    }
  });
  const fmtDate = d => d ? `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}` : null;

  // Type breakdown
  const typeMap = {};
  rows.forEach(r => {
    const t = r._type;
    if (!typeMap[t]) typeMap[t] = { jbl:0, doklady:new Set(), qty:0, produkty:new Set(), ops:new Set() };
    typeMap[t].jbl++;
    typeMap[t].doklady.add(r[dokCol]);
    typeMap[t].qty += r._qty;
    typeMap[t].produkty.add(r[prodCol]);
    typeMap[t].ops.add(r._op);
  });
  const types = {};
  Object.entries(typeMap).forEach(([t,v]) => {
    types[t] = { jbl:v.jbl, doklady:v.doklady.size, qty:v.qty, produkty:v.produkty.size,
      operatori:v.ops.size, pct: Math.round(v.jbl/rows.length*1000)/10, color: TYPE_COLORS[t]||'#666' };
  });

  // Top operators
  const opMap = {};
  rows.forEach(r => {
    if (!opMap[r._op]) opMap[r._op] = { jbl:0, qty:0, types:{} };
    opMap[r._op].jbl++;
    opMap[r._op].qty += r._qty;
    opMap[r._op].types[r._type] = (opMap[r._op].types[r._type]||0) + 1;
  });
  const topOps = Object.entries(opMap)
    .sort((a,b) => b[1].jbl - a[1].jbl).slice(0,15)
    .map(([name,v]) => {
      const domType = Object.entries(v.types).sort((a,b)=>b[1]-a[1])[0];
      return { name, jbl:v.jbl, qty:v.qty, ratio:Math.round(v.qty/v.jbl*10)/10,
        domType:domType[0], domCount:domType[1], color:TYPE_COLORS[domType[0]]||'#666' };
    });

  // Qty buckets
  const buckets = [
    { label:'1 ks', count:rows.filter(r=>r._qty===1).length },
    { label:'2–5 ks', count:rows.filter(r=>r._qty>=2&&r._qty<=5).length },
    { label:'6–20 ks', count:rows.filter(r=>r._qty>=6&&r._qty<=20).length },
    { label:'21–100 ks', count:rows.filter(r=>r._qty>=21&&r._qty<=100).length },
    { label:'100+ ks', count:rows.filter(r=>r._qty>100).length },
  ];

  // Qty per type
  const qtyPerType = {};
  Object.keys(types).forEach(t => {
    const vals = rows.filter(r=>r._type===t).map(r=>r._qty).sort((a,b)=>a-b);
    if (!vals.length) return;
    qtyPerType[t] = {
      avg: Math.round(vals.reduce((s,v)=>s+v,0)/vals.length*10)/10,
      med: vals[Math.floor(vals.length/2)],
      max: vals[vals.length-1],
      total: vals.reduce((s,v)=>s+v,0),
    };
  });

  // Sections
  const secMap = {};
  rows.forEach(r => { secMap[r._sec] = (secMap[r._sec]||0)+1; });
  const sections = Object.entries(secMap).sort((a,b)=>b[1]-a[1]).slice(0,15)
    .map(([name,count])=>({name,count}));

  // Top products
  const prodMap = {};
  rows.forEach(r => {
    const p = r[prodCol];
    if (!prodMap[p]) prodMap[p] = {count:0, types:{}};
    prodMap[p].count++;
    prodMap[p].types[r._type] = (prodMap[p].types[r._type]||0)+1;
  });
  const topProducts = Object.entries(prodMap).sort((a,b)=>b[1].count-a[1].count).slice(0,15)
    .map(([name,v]) => {
      const dom = Object.entries(v.types).sort((a,b)=>b[1]-a[1])[0];
      return {name, count:v.count, type:dom[0], color:TYPE_COLORS[dom[0]]||'#666'};
    });

  // Prod per type (top 3)
  const prodPerType = {};
  Object.keys(types).forEach(t => {
    const pm = {};
    rows.filter(r=>r._type===t).forEach(r => { pm[r[prodCol]] = (pm[r[prodCol]]||0)+1; });
    prodPerType[t] = Object.entries(pm).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>({name:n,count:c}));
  });

  // Sec per type (top 3)
  const secPerType = {};
  Object.keys(types).forEach(t => {
    const sm = {};
    rows.filter(r=>r._type===t).forEach(r => { sm[r._sec] = (sm[r._sec]||0)+1; });
    secPerType[t] = Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>({name:n,count:c}));
  });

  const allQty = rows.map(r=>r._qty);
  const sorted = [...allQty].sort((a,b)=>a-b);

  return {
    totalJbl: rows.length,
    totalQty: allQty.reduce((s,v)=>s+v,0),
    uniqueDoklady: new Set(rows.map(r=>r[dokCol])).size,
    uniqueProdukty: new Set(rows.map(r=>r[prodCol])).size,
    uniqueOps: new Set(rows.map(r=>r._op)).size,
    avgQty: Math.round(allQty.reduce((s,v)=>s+v,0)/rows.length*10)/10,
    medQty: sorted[Math.floor(sorted.length/2)],
    maxQty: sorted[sorted.length-1],
    dateMin: fmtDate(dateMin), dateMax: fmtDate(dateMax),
    opLabel, types, topOps, buckets, qtyPerType,
    sections, topProducts, prodPerType, secPerType,
    TYPE_COLORS,
  };
}

export { TYPE_COLORS };
