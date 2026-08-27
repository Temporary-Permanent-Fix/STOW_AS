import { NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

function getConfig() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  return { token, repo, branch, ok: !!(token && repo) };
}

async function ghApi(path, opts = {}) {
  const { token, repo } = getConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
  });
}

// GET /api/github?path=data/STOW.xlsx → returns file bytes
// GET /api/github?check=1 → returns config status
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  // Debug/check endpoint
  if (searchParams.get('check')) {
    const cfg = getConfig();
    return NextResponse.json({
      hasToken: !!cfg.token,
      tokenPrefix: cfg.token ? cfg.token.slice(0, 8) + '...' : null,
      repo: cfg.repo,
      branch: cfg.branch,
      configured: cfg.ok,
    });
  }

  const path = searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const cfg = getConfig();

  // Strategy 1: Try loading from local filesystem (works for files committed in repo)
  const localPath = join(process.cwd(), path);
  if (existsSync(localPath)) {
    try {
      const buf = readFileSync(localPath);
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Source': 'local' },
      });
    } catch (e) { /* fall through to GitHub */ }
  }

  // Strategy 2: Fetch from GitHub API
  if (!cfg.ok) {
    return NextResponse.json({ error: 'GitHub not configured' }, { status: 503 });
  }

  try {
    const r = await ghApi(path);
    if (r.status === 404) return NextResponse.json(null, { status: 404 });
    if (!r.ok) return NextResponse.json({ error: `GitHub ${r.status}` }, { status: r.status });

    const j = await r.json();
    if (j.content) {
      const buf = Buffer.from(j.content, 'base64');
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Source': 'github-api' },
      });
    }
    // For large files, use download_url
    if (j.download_url) {
      const dl = await fetch(j.download_url);
      const buf = Buffer.from(await dl.arrayBuffer());
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Source': 'github-download' },
      });
    }
    return NextResponse.json({ error: 'no content' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/github { path, content (base64), message }
export async function PUT(req) {
  const cfg = getConfig();
  if (!cfg.ok) {
    return NextResponse.json({
      error: 'GitHub not configured. Set GH_TOKEN and GH_REPO in Vercel Environment Variables.',
    }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { path, content, message } = body;
  if (!path || !content) {
    return NextResponse.json({ error: 'path and content required' }, { status: 400 });
  }

  try {
    // Get existing sha (needed for updates)
    let sha;
    const existing = await ghApi(path);
    if (existing.ok) {
      const j = await existing.json();
      sha = j.sha;
    }

    const payload = {
      message: message || `update ${path}`,
      content,
      branch: cfg.branch,
    };
    if (sha) payload.sha = sha;

    const r = await ghApi(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error(`GitHub PUT ${path} failed:`, r.status, errText);
      return NextResponse.json({
        error: `GitHub API error ${r.status}`,
        detail: errText.slice(0, 200),
      }, { status: r.status });
    }

    // Also save locally so it's immediately available
    try {
      const localPath = join(process.cwd(), path);
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, Buffer.from(content, 'base64'));
    } catch { /* local save is best-effort */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('GitHub upload error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
