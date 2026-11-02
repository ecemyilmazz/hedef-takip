/**
 * Hedeflerim — oturum yenileme sunucusu (Cloudflare Worker)
 *
 * Ne yapar?
 *  - Google'dan alınan "yetki kodunu" erişim anahtarına çevirir (client secret burada, gizli kalır).
 *  - Uzun süreli yenileme anahtarını (refresh token) ŞİFRELEYİP tarayıcıya geri verir; hiçbir şey saklamaz.
 *  - Tarayıcı bu şifreli anahtarla, Google penceresi açmadan yeni erişim anahtarı alır.
 *  - Kullanıcı verilerine (Drive) hiç dokunmaz.
 *
 * Gerekli ayarlar (Cloudflare › Worker › Settings › Variables and Secrets):
 *  GOOGLE_CLIENT_ID      (metin)  : ...apps.googleusercontent.com
 *  GOOGLE_CLIENT_SECRET  (gizli)  : Google Cloud'daki client secret
 *  SESSION_KEY           (gizli)  : en az 32 karakterlik rastgele bir metin
 *  ALLOWED_ORIGINS       (metin)  : https://ecemyilmazz.github.io
 *
 * Güvenlik: oturumlar 90 gün sonra geçersiz olur; aynı IP'den dakikada en fazla 30 istek (LIMITER).
 */
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : null;
    const url = new URL(req.url);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors || {}) });

    if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'hedeflerim-auth', configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_KEY && allowed.length) });
    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors) return json({ error: 'origin_not_allowed' }, 403);
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_KEY) return json({ error: 'not_configured' }, 500);

    // istek sınırı (wrangler.toml'daki LIMITER; yoksa atlanır)
    if (env.LIMITER) {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'rate_limited' }, 429);
    }

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }

    try {
      if (url.pathname === '/exchange') {
        if (!body.code) return json({ error: 'no_code' }, 400);
        const t = await googleToken({ code: body.code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: 'postmessage', grant_type: 'authorization_code' });
        if (t.error) return json({ error: t.error }, 400);
        const session = t.refresh_token ? await seal(env, { rt: t.refresh_token, iat: Date.now() }) : null;
        return json({ access_token: t.access_token, expires_in: t.expires_in, scope: t.scope, session });
      }
      if (url.pathname === '/refresh') {
        const s = await unseal(env, body.session);
        if (!s || !s.rt) return json({ error: 'bad_session' }, 401);
        if (!s.iat || Date.now() - s.iat > SESSION_MAX_AGE_MS) return json({ error: 'session_expired' }, 401);
        const t = await googleToken({ refresh_token: s.rt, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' });
        if (t.error) return json({ error: t.error }, t.error === 'invalid_grant' ? 401 : 400);
        return json({ access_token: t.access_token, expires_in: t.expires_in, scope: t.scope });
      }
      if (url.pathname === '/revoke') {
        const s = await unseal(env, body.session);
        if (s && s.rt) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: s.rt }) });
        return json({ ok: true });
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error' }, 500);
    }
  }
};

async function googleToken(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  return r.json();
}
async function aesKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(env.SESSION_KEY)));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function seal(env, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), new TextEncoder().encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12);
  return b64u(out);
}
async function unseal(env, blob) {
  if (typeof blob !== 'string' || blob.length < 20 || blob.length > 4000) return null;
  try {
    const all = unb64u(blob);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await aesKey(env), all.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) { return null; }
}
