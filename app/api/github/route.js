import { NextResponse } from 'next/server';

const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO;
const branch = process.env.GH_BRANCH || 'main';

async function ghFetch(path, opts = {}) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', ...opts.headers };
  return fetch(url, { ...opts, headers });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  try {
    const r = await ghFetch(path);
    if (r.status === 404) return NextResponse.json(null);
    const j = await r.json();
    if (j.content) {
      const buf = Buffer.from(j.content, 'base64');
      return new NextResponse(buf, { headers: { 'Content-Type': 'application/octet-stream' } });
    }
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const { path, content, message } = await req.json();
  if (!path || !content) return NextResponse.json({ error: 'path+content required' }, { status: 400 });

  try {
    // Get existing sha
    let sha;
    const existing = await ghFetch(path);
    if (existing.ok) {
      const j = await existing.json();
      sha = j.sha;
    }

    const body = { message: message || `update ${path}`, content, branch };
    if (sha) body.sha = sha;

    const r = await ghFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: err }, { status: r.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
