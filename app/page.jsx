'use client';
import { useState, useEffect, useRef } from 'react';
import { parseExcel } from '../lib/excel';
import { uploadToGitHub, downloadFromGitHub } from '../lib/github';
import StowDashboard from '../components/StowDashboard';

const SLOTS = [
  { key: 'stow', label: '📥 Prijímanie', path: 'data/STOW.xlsx', suffix: ' · PRIJÍMANIE' },
  { key: 'confirm', label: '✅ Potvrdzovanie', path: 'data/CONFIRM.xlsx', suffix: ' · POTVRDZOVANIE' },
];

export default function Home() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [fileNames, setFileNames] = useState({});
  const refs = useRef({});

  // Load from GitHub on mount
  useEffect(() => {
    SLOTS.forEach(async (slot) => {
      setLoading(p => ({ ...p, [slot.key]: true }));
      try {
        const buf = await downloadFromGitHub(slot.path);
        if (buf && buf.length > 100) {
          const parsed = parseExcel(buf);
          if (parsed) {
            setData(p => ({ ...p, [slot.key]: parsed }));
            setFileNames(p => ({ ...p, [slot.key]: slot.path.split('/').pop() }));
          }
        }
      } catch (e) { console.warn(`Failed to load ${slot.path}:`, e); }
      setLoading(p => ({ ...p, [slot.key]: false }));
    });
  }, []);

  const handleUpload = async (slotIdx, file) => {
    const slot = SLOTS[slotIdx];
    const buf = await file.arrayBuffer();
    const arr = new Uint8Array(buf);

    // Parse
    const parsed = parseExcel(arr);
    if (!parsed) { alert('Nepodarilo sa spracovať súbor'); return; }
    setData(p => ({ ...p, [slot.key]: parsed }));
    setFileNames(p => ({ ...p, [slot.key]: file.name }));

    // Upload to GitHub
    const base64 = btoa(String.fromCharCode(...arr));
    const ok = await uploadToGitHub(slot.path, base64);
    if (ok) console.log(`✅ ${file.name} uložený do GitHub`);
  };

  const activeTabs = SLOTS.filter(s => data[s.key] || loading[s.key]);
  const anyData = SLOTS.some(s => data[s.key]);

  return (
    <>
      <header className="app-header">
        <span style={{ fontSize: '1.8rem' }}>📦</span>
        <h1>STOW AS Report</h1>
      </header>

      {/* Upload area */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SLOTS.map((slot, i) => (
          <div key={slot.key} style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{slot.label}</div>
            <label className="upload-area" style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: 0 }}>
              <input type="file" accept=".xlsx,.xls" ref={el => refs.current[slot.key] = el}
                onChange={e => e.target.files[0] && handleUpload(i, e.target.files[0])} />
              {loading[slot.key] ? '⏳ Načítavam...' :
                data[slot.key] ? `✅ ${fileNames[slot.key]} · ${data[slot.key].totalJbl.toLocaleString('sk')} JBL` :
                '📂 Nahraj .xlsx'}
            </label>
          </div>
        ))}
      </div>

      {!anyData && !Object.values(loading).some(Boolean) && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Nahraj aspoň jeden STOW AS Report (.xlsx)
        </div>
      )}

      {anyData && (
        <>
          <div className="tabs">
            {SLOTS.map((slot, i) => data[slot.key] && (
              <button key={slot.key} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
                {slot.label} ({data[slot.key].totalJbl.toLocaleString('sk')} JBL)
              </button>
            ))}
          </div>
          {SLOTS.map((slot, i) => data[slot.key] && tab === i && (
            <StowDashboard key={slot.key} data={data[slot.key]} suffix={slot.suffix} />
          ))}
        </>
      )}
    </>
  );
}
