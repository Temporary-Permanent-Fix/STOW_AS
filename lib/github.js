export async function uploadToGitHub(path, base64Content) {
  try {
    const r = await fetch(`/api/github`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: base64Content, message: `update ${path}` }),
    });
    return r.ok;
  } catch { return false; }
}

export async function downloadFromGitHub(path) {
  try {
    const r = await fetch(`/api/github?path=${encodeURIComponent(path)}`);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return new Uint8Array(buf);
  } catch { return null; }
}
