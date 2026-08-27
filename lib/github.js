export async function uploadToGitHub(path, base64Content) {
  try {
    const r = await fetch('/api/github', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: base64Content, message: `update ${path}` }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      console.error('💾 GitHub upload failed:', r.status, err);
      return { ok: false, error: err.error || `HTTP ${r.status}`, detail: err.detail };
    }
    return { ok: true };
  } catch (e) {
    console.error('💾 GitHub upload error:', e);
    return { ok: false, error: e.message };
  }
}

export async function downloadFromGitHub(path) {
  try {
    const r = await fetch(`/api/github?path=${encodeURIComponent(path)}`);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 100) return null; // too small, probably error JSON
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function checkGitHubConfig() {
  try {
    const r = await fetch('/api/github?check=1');
    return await r.json();
  } catch {
    return { configured: false };
  }
}
