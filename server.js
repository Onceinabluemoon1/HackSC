// TrojanMatch server: serves the site and keeps the Gemini API key private.
// No dependencies. Run with: node server.js   (Node 18+)
// Set GEMINI_API_KEY in Replit Secrets (or a local .env file for testing).

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Load a local .env file if present (Replit uses Secrets instead).
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* no .env file */ }

const PORT = Number(process.env.PORT || process.argv[2] || 3000);
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].filter(Boolean))];
const ACTIONS = ['events', 'carpools', 'messages', 'clubs', 'dorms', 'game', 'signin', 'profile', 'menu'];

const SYSTEM = `You are Traveler, the friendly assistant inside TrojanMatch, a web app made by USC students for USC students (AI@USC hackathon prototype).

What TrojanMatch has:
- Home page: animated Trojan horse banner, a "Ride break" horse runner game that gallops past Doheny Library, Bovard Auditorium, Mudd Hall, Tommy Trojan, Von KleinSmid Center, and the LA Memorial Coliseum (tap or Space to jump over scooters, cones, textbooks), and preview cards of the three matching features. The preview cards show example data until the person signs in.
- Menu (button at the top left): Home, Event matching (with sub-tabs Carpools and Messages), Club matching, Dorm matching, and Play the horse game.
- Event matching: on-campus events from EngageSC picked for your interests and schedule, and finding people to go with so you never go alone.
- Carpools (under Event matching): ride requests to airports, concerts, trips, and events. Browse, filter by destination or type, or post your own request. Splitting rides saves money and is safer.
- Messages (under Event matching): group chats for events and rides you join, with a way to report problems.
- Club matching: enter your year, weekly time commitment, and interests (tap interest chips), then "Find My Clubs" ranks USC student orgs from EngageSC with a match percent. "Generate Random Interest" suggests something new to try.
- Dorm matching: find roommates who match sleep schedule, study habits, and social style. It is still being built.
- Sign in: top right, with name and an @usc.edu email. Prototype only: no password, info stays in the person's browser.
- Profile: click the avatar (initials) at the top right, then Edit profile. Fields: major, graduation month, graduation year. All optional and blank by default.
- Privacy: in this prototype, profiles are saved only in the person's own browser.

Rules:
- Answer in 1 to 4 short sentences, under 90 words, warm and casual but clear. No markdown headings or bullet lists.
- Focus on TrojanMatch and general USC student life. For unrelated requests, politely steer back.
- Never make up specific events, clubs, people, prices, dates, or live data. If you do not know, say so and point to the right part of the app.
- Never ask for passwords, ID numbers, or other sensitive personal info.
- If you know the user's profile, personalize naturally (for example mention their major or class year) but do not repeat it back word for word.
- End with exactly two extra lines:
FOLLOWUPS: two short follow-up questions the user might ask next, under 7 words each, separated by " | "
ACTIONS: up to 2 of these keywords, comma separated, that would help the user next: ${ACTIONS.join(', ')} (or "none")`;

// Simple per-IP rate limit so a shared demo key is not drained.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > 12;
}

async function askGemini(message, history, profile) {
  const contents = [...history, { role: 'user', text: message }].map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.text).slice(0, 1000) }]
  }));
  let lastErr;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM + profileNote(profile) }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (r.status === 404) { lastErr = new Error(`model ${model} not found`); continue; }
    if (!r.ok) throw new Error(`Gemini error ${r.status}`);
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('empty reply');
    const am = text.match(/^\s*ACTIONS:\s*(.*)$/im), fm = text.match(/^\s*FOLLOWUPS:\s*(.*)$/im);
    const actions = am ? am[1].split(',').map(s => s.trim().toLowerCase()).filter(a => ACTIONS.includes(a)).slice(0, 2) : [];
    const followups = fm ? fm[1].split('|').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(q => q && q.length < 60).slice(0, 2) : [];
    const cut = Math.min(...[am, fm].filter(Boolean).map(x => x.index), text.length);
    return { reply: text.slice(0, cut).trim(), actions, followups, model };
  }
  throw lastErr || new Error('no model available');
}

function profileNote(p) {
  if (!p || typeof p !== 'object') return '';
  const clean = v => String(v || '').replace(/[^\w .,'&-]/g, '').slice(0, 60).trim();
  const bits = [p.firstName && 'first name ' + clean(p.firstName), p.major && 'major ' + clean(p.major),
    (p.gradMonth || p.gradYear) && 'graduating ' + clean([p.gradMonth, p.gradYear].filter(Boolean).join(' '))].filter(Boolean);
  return bits.length ? `\n\nThe signed-in user's profile: ${bits.join(', ')}.` : '';
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const BLOCKED = new Set(['server.js', 'package.json', 'package-lock.json', 'replit.nix']);

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') return send(res, 200, { ai: !!API_KEY, model: MODELS[0] });

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    if (!API_KEY) return send(res, 503, { error: 'AI not configured' });
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (limited(ip)) return send(res, 429, { error: 'Too many messages. Try again in a minute.' });
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return send(res, 413, { error: 'Too long' }); }
    try {
      const { message, history, profile } = JSON.parse(raw || '{}');
      if (typeof message !== 'string' || !message.trim() || message.length > 500) return send(res, 400, { error: 'Bad message' });
      const hist = Array.isArray(history) ? history.slice(-8).filter(h => h && typeof h.text === 'string') : [];
      return send(res, 200, await askGemini(message.trim(), hist, profile));
    } catch (e) {
      console.error('chat failed:', e.message);
      return send(res, 502, { error: 'AI unavailable' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const parts = rel.split('/').filter(Boolean);
  if (parts.some(p => p.startsWith('.')) || BLOCKED.has(parts[0])) return send(res, 404, 'Not found', 'text/plain');
  const file = path.join(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`TrojanMatch running on port ${PORT} · AI ${API_KEY ? 'on (' + MODELS[0] + ')' : 'off: set GEMINI_API_KEY'}`);
});
