'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { parseExcelRaw, analyzeRows } from '../lib/excel';
import { uploadToGitHub, downloadFromGitHub } from '../lib/github';
import StowDashboard from '../components/StowDashboard';

const SLOTS = [
  { key:'stow', label:'📥 Prijímanie', path:'data/STOW.xlsx', suffix:' · PRIJÍMANIE' },
  { key:'confirm', label:'✅ Potvrdzovanie', path:'data/CONFIRM.xlsx', suffix:' · POTVRDZOVANIE' },
];

const fmtD = d => d.toISOString().slice(0,10);

export default function Home() {
  const [tab, setTab] = useState(0);
  const [raw, setRaw] = useState({});        // { stow: {rows,cols}, confirm: {rows,cols} }
  const [loading, setLoading] = useState({});
  const [fileNames, setFileNames] = useState({});
  const [sideOpen, setSideOpen] = useState(true);

  // Filters per slot
  const [filters, setFilters] = useState({
    stow:   { types:null, dateFrom:'', dateTo:'', qtyMin:'', qtyMax:'' },
    confirm:{ types:null, dateFrom:'', dateTo:'', qtyMin:'', qtyMax:'' },
  });

  // Load from GitHub
  useEffect(() => {
    SLOTS.forEach(async (slot) => {
      setLoading(p => ({ ...p, [slot.key]: true }));
      try {
        const buf = await downloadFromGitHub(slot.path);
        if (buf && buf.length > 100) {
          const parsed = parseExcelRaw(buf);
          if (parsed) {
            setRaw(p => ({ ...p, [slot.key]: parsed }));
            setFileNames(p => ({ ...p, [slot.key]: slot.path.split('/').pop() }));
          }
        }
      } catch (e) { console.warn(e); }
      setLoading(p => ({ ...p, [slot.key]: false }));
    });
  }, []);

  const [saveStatus, setSaveStatus] = useState({});

  const handleUpload = async (slotIdx, file) => {
    const slot = SLOTS[slotIdx];
    const buf = await file.arrayBuffer();
    const arr = new Uint8Array(buf);
    const parsed = parseExcelRaw(arr);
    if (!parsed) { alert('Nepodarilo sa spracovať súbor'); return; }
    setRaw(p => ({ ...p, [slot.key]: parsed }));
    setFileNames(p => ({ ...p, [slot.key]: file.name }));
    setFilters(p => ({ ...p, [slot.key]: { types:null, dateFrom:'', dateTo:'', qtyMin:'', qtyMax:'' } }));

    // Base64 pre veľké súbory (chunk approach)
    setSaveStatus(p => ({ ...p, [slot.key]: 'saving' }));
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const ok = await uploadToGitHub(slot.path, base64);
    setSaveStatus(p => ({ ...p, [slot.key]: ok ? 'saved' : 'error' }));
    setTimeout(() => setSaveStatus(p => ({ ...p, [slot.key]: null })), 3000);
  };

  // Get available types for current tab
  const currentSlot = SLOTS[tab];
  const currentRaw = raw[currentSlot.key];
  const currentFilter = filters[currentSlot.key];

  const availableTypes = useMemo(() => {
    if (!currentRaw) return [];
    const set = new Set(currentRaw.rows.map(r => r._type));
    return [...set].sort();
  }, [currentRaw]);

  // Date range from data
  const dateRange = useMemo(() => {
    if (!currentRaw) return { min: '', max: '' };
    let mn = null, mx = null;
    currentRaw.rows.forEach(r => {
      if (r._date) {
        if (!mn || r._date < mn) mn = r._date;
        if (!mx || r._date > mx) mx = r._date;
      }
    });
    return { min: mn ? fmtD(mn) : '', max: mx ? fmtD(mx) : '' };
  }, [currentRaw]);

  // Apply filters → analyzed data
  const filteredData = useMemo(() => {
    if (!currentRaw) return null;
    let rows = currentRaw.rows;
    const f = currentFilter;

    // Type filter
    if (f.types && f.types.length > 0) {
      rows = rows.filter(r => f.types.includes(r._type));
    }
    // Date filter
    if (f.dateFrom) {
      const from = new Date(f.dateFrom);
      rows = rows.filter(r => !r._date || r._date >= from);
    }
    if (f.dateTo) {
      const to = new Date(f.dateTo); to.setHours(23,59,59);
      rows = rows.filter(r => !r._date || r._date <= to);
    }
    // Qty filter
    if (f.qtyMin !== '') {
      const mn = Number(f.qtyMin);
      if (!isNaN(mn)) rows = rows.filter(r => r._qty >= mn);
    }
    if (f.qtyMax !== '') {
      const mx = Number(f.qtyMax);
      if (!isNaN(mx)) rows = rows.filter(r => r._qty <= mx);
    }

    if (!rows.length) return null;
    return analyzeRows(rows, currentRaw.cols);
  }, [currentRaw, currentFilter]);

  const updateFilter = (key, val) => {
    setFilters(p => ({ ...p, [currentSlot.key]: { ...p[currentSlot.key], [key]: val } }));
  };

  const toggleType = (t) => {
    setFilters(p => {
      const cur = p[currentSlot.key];
      let types = cur.types ? [...cur.types] : [...availableTypes];
      if (types.includes(t)) types = types.filter(x => x !== t);
      else types.push(t);
      return { ...p, [currentSlot.key]: { ...cur, types: types.length === availableTypes.length ? null : types } };
    });
  };

  const resetFilters = () => {
    setFilters(p => ({ ...p, [currentSlot.key]: { types:null, dateFrom:'', dateTo:'', qtyMin:'', qtyMax:'' } }));
  };

  const anyData = SLOTS.some(s => raw[s.key]);
  const activeTypes = currentFilter.types || availableTypes;
  const TC = { VGP:'#2EA043', SP:'#6366F1', VV:'#D29922', REP:'#FF4B4B', SKL:'#3FB950',
    SKLSK:'#818CF8', AATSKL:'#F97316', AHUSKL:'#EC4899', PRR:'#8B949E', REM:'#6B7280' };

  return (
    <>
      <header className="app-header">
        <span style={{ fontSize:'1.8rem' }}>📦</span>
        <h1>STOW AS Report</h1>
        <div style={{ flex:1 }} />
        <button onClick={() => setSideOpen(!sideOpen)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 14px', color:'var(--text)', cursor:'pointer', fontSize:'.85rem' }}>
          {sideOpen ? '✕ Skryť panel' : '⚙ Filtre & Upload'}
        </button>
      </header>

      <div style={{ display:'flex', minHeight:'calc(100vh - 60px)' }}>
        {/* Main content */}
        <div style={{ flex:1, overflow:'auto' }}>
          {anyData && (
            <div className="tabs">
              {SLOTS.map((slot, i) => raw[slot.key] && (
                <button key={slot.key} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
                  {slot.label} ({analyzeRows(raw[slot.key].rows, raw[slot.key].cols)?.totalJbl?.toLocaleString('sk') || 0} JBL)
                </button>
              ))}
            </div>
          )}

          {!anyData && !Object.values(loading).some(Boolean) && (
            <div style={{ textAlign:'center', padding:80, color:'var(--text-muted)' }}>
              Nahraj STOW AS Report (.xlsx) cez panel vpravo →
            </div>
          )}

          {filteredData && <StowDashboard data={filteredData} suffix={currentSlot.suffix} />}

          {currentRaw && !filteredData && (
            <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
              Žiadne dáta po filtrovaní. Skús upraviť filtre.
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {sideOpen && (
          <aside style={{ width:280, borderLeft:'1px solid var(--border)', background:'var(--surface)', padding:16, overflow:'auto', flexShrink:0 }}>

            {/* Upload sections */}
            <div style={{ fontSize:'.7rem', color:'var(--text-muted)', letterSpacing:2, fontWeight:700, marginBottom:8 }}>NAHRAŤ SÚBORY</div>
            {SLOTS.map((slot, i) => (
              <div key={slot.key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:4 }}>{slot.label}</div>
                <label style={{ display:'block', background:'var(--bg)', border:'1px dashed var(--border)', borderRadius:6, padding:'10px 8px', textAlign:'center', cursor:'pointer', fontSize:'.8rem', color: raw[slot.key] ? 'var(--accent)' : 'var(--text-muted)', transition:'border-color .2s' }}>
                  <input type="file" accept=".xlsx,.xls" style={{display:'none'}}
                    onChange={e => e.target.files[0] && handleUpload(i, e.target.files[0])} />
                  {loading[slot.key] ? '⏳ ...' :
                    saveStatus[slot.key] === 'saving' ? '💾 Ukladám...' :
                    saveStatus[slot.key] === 'saved' ? '✅ Uložené na server' :
                    saveStatus[slot.key] === 'error' ? '⚠ Chyba pri ukladaní' :
                    raw[slot.key] ? `✅ ${fileNames[slot.key]}` : '📂 Vyber súbor'}
                </label>
              </div>
            ))}

            {currentRaw && (<>
              <div style={{ borderTop:'1px solid var(--border)', margin:'16px 0', paddingTop:16 }}>
                <div style={{ fontSize:'.7rem', color:'var(--text-muted)', letterSpacing:2, fontWeight:700, marginBottom:8 }}>TYP DOKLADU</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {availableTypes.map(t => {
                    const isOn = activeTypes.includes(t);
                    return (
                      <button key={t} onClick={() => toggleType(t)}
                        style={{ background: isOn ? (TC[t]||'#666') : 'var(--bg)', border:`1px solid ${isOn ? (TC[t]||'#666') : 'var(--border)'}`,
                          borderRadius:4, padding:'3px 8px', fontSize:'.75rem', fontWeight:700, color: isOn ? '#fff' : 'var(--text-muted)', cursor:'pointer', transition:'all .15s' }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop:'1px solid var(--border)', margin:'16px 0', paddingTop:16 }}>
                <div style={{ fontSize:'.7rem', color:'var(--text-muted)', letterSpacing:2, fontWeight:700, marginBottom:8 }}>OBDOBIE</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="date" value={currentFilter.dateFrom || dateRange.min} min={dateRange.min} max={dateRange.max}
                    onChange={e => updateFilter('dateFrom', e.target.value)}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)', fontSize:'.8rem' }} />
                  <span style={{ color:'var(--text-muted)', fontSize:'.8rem' }}>–</span>
                  <input type="date" value={currentFilter.dateTo || dateRange.max} min={dateRange.min} max={dateRange.max}
                    onChange={e => updateFilter('dateTo', e.target.value)}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)', fontSize:'.8rem' }} />
                </div>
              </div>

              <div style={{ borderTop:'1px solid var(--border)', margin:'16px 0', paddingTop:16 }}>
                <div style={{ fontSize:'.7rem', color:'var(--text-muted)', letterSpacing:2, fontWeight:700, marginBottom:8 }}>MNOŽSTVO (ks)</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type="number" placeholder="od" value={currentFilter.qtyMin}
                    onChange={e => updateFilter('qtyMin', e.target.value)}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)', fontSize:'.8rem', width:60 }} />
                  <span style={{ color:'var(--text-muted)', fontSize:'.8rem' }}>–</span>
                  <input type="number" placeholder="do" value={currentFilter.qtyMax}
                    onChange={e => updateFilter('qtyMax', e.target.value)}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)', fontSize:'.8rem', width:60 }} />
                </div>
              </div>

              <button onClick={resetFilters}
                style={{ width:'100%', marginTop:12, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'8px', color:'var(--text-muted)', cursor:'pointer', fontSize:'.8rem' }}>
                ↺ Resetovať filtre
              </button>

              {filteredData && currentRaw && (
                <div style={{ marginTop:12, padding:'8px 10px', background:'var(--bg)', borderRadius:6, fontSize:'.75rem', color:'var(--text-muted)', border:'1px solid var(--border)' }}>
                  Zobrazených: <strong style={{color:'var(--accent)'}}>{filteredData.totalJbl.toLocaleString('sk')}</strong> z {currentRaw.rows.length.toLocaleString('sk')} JBL
                </div>
              )}
            </>)}
          </aside>
        )}
      </div>
    </>
  );
}
