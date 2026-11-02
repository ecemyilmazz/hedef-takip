'use strict';
/* Hedeflerim — kişisel hedef takibi.
 * Giriş: Google Identity Services (token istemcisi)
 * Depolama: kullanıcının kendi Google Drive'ındaki gizli uygulama klasörü (appDataFolder)
 *   config.json            → listeler ve hedefler
 *   day-YYYY-MM-DD.json    → o günün kayıtları
 * Ayrıca her şey önce telefonda/bilgisayarda (localStorage) saklanır, sonra Drive'a eşitlenir.
 */

const CLIENT_ID = (window.HEDEF_CONFIG || {}).googleClientId || '';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPES = 'openid email profile ' + DRIVE_SCOPE;
const DAY_START_HOUR = 4; // gece 04:00'e kadar yapılan kayıtlar bir önceki güne yazılır

/* ================= yardımcılar ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hmOf = (t) => pad(t.getHours()) + ':' + pad(t.getMinutes());
const nowHM = () => hmOf(new Date());
const minsAgoHM = (m) => hmOf(new Date(Date.now() - m * 60000));
const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
function logicalDate(d = new Date()) { const x = new Date(d); if (x.getHours() < DAY_START_HOUR) x.setDate(x.getDate() - 1); return x; }
const todayKey = () => keyOf(logicalDate());
function dateObj(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(key, n) { const x = dateObj(key); x.setDate(x.getDate() + n); return keyOf(x); }
const toMin = (s) => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function diffMin(a, b) { const x = toMin(a), y = toMin(b); if (x == null || y == null) return null; let d = y - x; if (d < 0) d += 1440; return d; }
const durText = (n) => (n >= 60 ? Math.floor(n / 60) + ' sa ' + (n % 60) + ' dk' : n + ' dk');
const fmt1 = (x) => x.toFixed(1).replace('.', ',');
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_D3 = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_M3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function longDate(key) { const d = dateObj(key); return TR_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + TR_MONTHS[d.getMonth()]; }

/* ================= ikonlar ================= */
const P = {
  drop: 'M12 3c3.5 4.2 6 7.6 6 10.5a6 6 0 0 1-12 0C6 10.6 8.5 7.2 12 3z',
  egg: 'M12 3c3.3 0 6 5.2 6 10a6 6 0 0 1-12 0c0-4.8 2.7-10 6-10z',
  avocado: 'M12 3c-3 0-4.6 4.2-5.6 8-1.1 4.4 1.4 10 5.6 10s6.7-5.6 5.6-10C16.6 7.2 15 3 12 3zM12 12.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  wheat: 'M12 21V7M12 11c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 11c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4zM12 15.5c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 15.5c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4zM12 7c-1-1.2-1-2.8 0-4 1 1.2 1 2.8 0 4z',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  bread: 'M6 11.2A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 18 11.2V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM10 9l1.5-1.5M13 10.5l1.5-1.5',
  turk: 'M6 9h10v4a5 5 0 0 1-10 0zM16 10h1.5a2 2 0 0 1 0 4H16M4 19.5h14',
  filtre: 'M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5c-.6.8-.6 1.7 0 2.5M12.5 3.5c-.6.8-.6 1.7 0 2.5',
  cay: 'M8 4h8c0 3-1.6 4.5-1.6 7s1.6 3.5 1.6 6.5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 17.5C8 14.5 9.6 13.5 9.6 11S8 7 8 4zM5 21h14',
  cicek: 'M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 9.5V4M12 14.5V20M9.5 12H4M14.5 12H20M10.2 10.2L6.3 6.3M13.8 13.8l3.9 3.9M13.8 10.2l3.9-3.9M10.2 13.8l-3.9 3.9',
  bardak: 'M6 4h12l-1.6 15.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z',
  kapsul: 'M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 7l7 7',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  leaf: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7',
  fish: 'M3 12c3-4 7-5.5 10-5.5 3.5 0 6 2.5 8 5.5-2 3-4.5 5.5-8 5.5-3 0-7-1.5-10-5.5zM3 12L1.5 8.5M3 12l-1.5 3.5M16.5 11h.01',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chart: 'M5 20V11M12 20V5M19 20v-6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  pencil: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6L6 18',
  walk: 'M8 3.5c1.4 0 2.2 1.6 2 3.5-.2 1.7-1 3-2.2 3-1.3 0-2-1.3-1.9-3 .1-1.9.8-3.5 2.1-3.5zM6.3 12.5h3.4l-.3 2.2a1.6 1.6 0 0 1-3.2-.2zM16 9.5c1.4 0 2.1 1.6 1.9 3.5-.2 1.7-1 3-2.2 3-1.3 0-2-1.3-1.9-3 .1-1.9.9-3.5 2.2-3.5zM14.2 18.5h3.4l-.3 1.8a1.6 1.6 0 0 1-3.2-.1z',
  run: 'M14 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM6 20l3.5-4 2.5 1.5 1-4.5 3 2.5h3M9 10l3-2.5 3 1 1.5 3',
  pilates: 'M4 18h16M12 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM6 15l4-5 4 2 4-2',
  yoga: 'M12 3.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM12 9v5M7 11.5l5-2 5 2M5 19c2-1.5 4.5-2.5 7-2.5s5 1 7 2.5M8 16.5l4-2.5 4 2.5',
  gym: 'M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11',
  bike: 'M6 13a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM18 13a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM6 16.5l4-7h5l3 7M10 9.5L8.5 6.5H7M15 9.5l-1.5-3H16',
  swim: 'M3 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M3 13c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M15 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM7 10l4-3 3 2.5',
  mekik: 'M4 19h16M7 19l3-5 4 1M15 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM10 14l4-3',
  sinav: 'M3 18h18M5 16l6-3 8 1M19 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM8 14.5V18M17 14v4',
  squat: 'M12 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 8v5l-4 2 2 5M12 13l4 2-2 5M8 10h8',
  timer: 'M12 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM12 11v3l2 1M10 3h4M12 3v3',
  dot: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12l3 3 5-6',
  book: 'M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  flame: 'M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z',
  star: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  brief: 'M4 8h16v11H4zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 13h16',
  coin: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM14.5 9c-.5-.9-1.4-1.4-2.5-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2-.5-2.5-1.4M12 6v1.6M12 16.4V18',
  target: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  plate: 'M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 5v5a2 2 0 0 0 2 2V20M22 5v15',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  cloud: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z',
  ban: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM5.6 5.6l12.8 12.8',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  play: 'M8 5.5v13l11-6.5z',
  stop: 'M6 6h12v12H6z',
  lang: 'M4 5h9M8.5 3v2M6 5c0 4 2.5 7 6 8.5M11 5c-.5 3.5-3 7-7 9M13 20l4-9 4 9M14.5 17h5',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  piggy: 'M5 11a7 6 0 0 1 12-3h2v3l2 1v3h-2.5a7 6 0 0 1-2.5 2.5V20h-3v-2a8 8 0 0 1-3 0v2H7v-2.8A6 6 0 0 1 5 11zM15 10h.01',
  cart: 'M3 4h2l2.5 11h11L21 7H6.2M9 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM18 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2z',
  car: 'M5 16h14M6 16l1.5-5h9L18 16M6 16v3h2v-3M16 16v3h2v-3M8.5 13.5h.01M15.5 13.5h.01',
  shirt: 'M8 4l-4 3 2 3 2-1v11h8V9l2 1 2-3-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13.5h.01',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3 15.5a1.6 1.6 0 0 1 2.4-2.1L8 16'
};
const EMOJI = {
  drop: '💧', egg: '🍳', avocado: '🥑', wheat: '🌾', cube: '🍬', bread: '🥐', turk: '☕', filtre: '🫘', cay: '🫖', cicek: '🌼', bardak: '🥤',
  kapsul: '💊', sun: '🌞', leaf: '🌿', fish: '🐟', moon: '🌙', heart: '💗', flame: '🔥', star: '⭐', brief: '💼', coin: '💰', target: '🎯',
  plate: '🍽️', walk: '🚶‍♀️', run: '🏃‍♀️', pilates: '🤸‍♀️', yoga: '🧘‍♀️', gym: '🏋️‍♀️', bike: '🚴‍♀️', swim: '🏊‍♀️', mekik: '🔥', sinav: '💪', squat: '🍑', timer: '⏱️',
  dot: '✨', book: '📚', lang: '🗣️', code: '💻', music: '🎵', pencil: '📝', piggy: '🐷', cart: '🛒', car: '🚗', shirt: '👗', wallet: '👛', repeat: '📳',
  sparkle: '✨', zap: '⚡', scissors: '✂️', hand: '💅', home: '☀️', grid: '🌸', chart: '📊', sliders: '⚙️'
};
function ic(name, size = 22, sw = 1.8, extra = '') {
  const em = EMOJI[name] || EMOJI_BY_PATH[name] || (!P[name] && typeof name === 'string' && name.length <= 8 && !/^[Mm][\d. ]/.test(name) ? name : null);
  if (em) return `<span class="emo" style="font-size:${Math.round(size * 1.02)}px" aria-hidden="true">${em}</span>`;
  const d = P[name] || name;
  if (/fill="currentColor"/.test(extra)) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${d}"/></svg>`;
}
const FACE = 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 10h.01M15 10h.01';
const MOODS = [
  { label: 'Çok kötü', fg: '#B91C1C', bg: '#FEE2E2', d: FACE + 'M8.5 16.5c1-1.5 2.2-2 3.5-2s2.5.5 3.5 2' },
  { label: 'Kötü', fg: '#C2410C', bg: '#FFEDD5', d: FACE + 'M9 16c.9-.7 1.9-1 3-1s2.1.3 3 1' },
  { label: 'İdare eder', fg: '#4B5563', bg: '#F3F4F6', d: FACE + 'M9 15.5h6' },
  { label: 'İyi', fg: '#0F766E', bg: '#CCFBF1', d: FACE + 'M9 14.5c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2' },
  { label: 'Harika', fg: '#15803D', bg: '#DCFCE7', d: FACE + 'M8 14c1 1.8 2.3 2.7 4 2.7s3-.9 4-2.7' }
];
const COLORS = {
  blue: ['#1D4ED8', '#DBEAFE'], orange: ['#C2410C', '#FFEDD5'], olive: ['#4D7C0F', '#ECFCCB'], amber: ['#A16207', '#FEF3C7'],
  pink: ['#BE185D', '#FCE7F3'], purple: ['#6D28D9', '#EDE9FE'], brown: ['#78350F', '#F5EBDD'], stone: ['#44403C', '#F5F5F4'],
  rust: ['#9A3412', '#FFEDD5'], violet: ['#7E22CE', '#F3E8FF'], sky: ['#0369A1', '#E0F2FE'], yellow: ['#A16207', '#FEF9C3'],
  green: ['#15803D', '#DCFCE7'], cyan: ['#0E7490', '#CFFAFE'], teal: ['#0F766E', '#CCFBF1'], indigo: ['#3730A3', '#EEF2FF'], gray: ['#4B5563', '#F3F4F6']
};
const col = (name) => COLORS[name] || COLORS.gray;
const MOOD_EMOJI = ['😣', '😕', '😐', '🙂', '😄'];
const EMOJI_BY_PATH = {}; MOODS.forEach((m, i) => { EMOJI_BY_PATH[m.d] = MOOD_EMOJI[i]; });
// bakım maddeleri için ada göre emoji
function careEmoji(it) {
  const n = (it.name || '').toLocaleLowerCase('tr');
  if (n.includes('saç mask')) return '💆‍♀️'; if (n.includes('yüz mask')) return '🧖‍♀️'; if (n.includes('manikür')) return '💅'; if (n.includes('pedikür')) return '🦶';
  if (n.includes('titreşim') || n.includes('platform')) return '📳'; if (n.includes('koltuk')) return '🌸'; if (n === 'kol' || n.includes('kol ')) return '💪';
  if (n.includes('yüz')) return '🌷'; if (n.includes('bacak')) return '🦵'; if (n.includes('saç')) return '💇‍♀️';
  return it.group === 'Lazer' ? '⚡' : '✨';
}

/* ================= sabit tanımlar ================= */
const NUTS = [
  { k: 'p', name: 'Protein', short: 'Protein', color: 'orange', limit: false, icon: 'egg' },
  { k: 'y', name: 'Sağlıklı yağ', short: 'Yağ', color: 'olive', limit: false, icon: 'avocado' },
  { k: 'c', name: 'Kompleks karbonhidrat', short: 'Kompleks karb.', color: 'amber', limit: false, icon: 'wheat' },
  { k: 's', name: 'Rafine şeker', short: 'Rafine şeker', color: 'pink', limit: true, icon: 'cube' },
  { k: 'u', name: 'Rafine un', short: 'Rafine un', color: 'purple', limit: true, icon: 'bread' }
];
const MEALS = [
  { id: 'k', name: 'Kahvaltı' }, { id: 'o', name: 'Öğle' }, { id: 'a', name: 'Akşam' }
];
const SNACK_TYPES = ['Meyve', 'Kuruyemiş', 'Yoğurt', 'Tatlı', 'Atıştırmalık', 'Diğer'];
// ana öğünler + ara öğünler (eski sabit "Ara öğün" kaydı da dahil)
function eats(d) {
  const out = MEALS.map((m) => { const r = (d.meals || {})[m.id] || {}; return { name: m.name, time: r.time, skip: !!r.skip, marks: r.marks || {}, main: m.id }; });
  const lx = (d.meals || {}).x;
  if (lx && !lx.skip && (lx.time || Object.values(lx.marks || {}).some(Boolean))) out.push({ name: 'Ara öğün', time: lx.time, skip: false, marks: lx.marks || {} });
  (d.snacks || []).forEach((sn) => out.push({ name: sn.name || 'Ara öğün', time: sn.t, skip: false, marks: sn.marks || {}, snack: sn.id }));
  return out;
}
const nutCount = (d, k) => eats(d).filter((e) => !e.skip && e.marks[k]).length;
function snackSelect(sn) {
  const opts = SNACK_TYPES.includes(sn.name) ? SNACK_TYPES : [sn.name].concat(SNACK_TYPES);
  return `<select class="field" style="min-width:0;flex:1 1 auto;height:36px" data-change="snackName" data-id="${esc(sn.id)}" aria-label="Ara öğün türü">${opts.map((o) => `<option ${o === sn.name ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
}
function snackChips(sn, h) {
  return NUTS.map((nu) => { const on = !!(sn.marks || {})[nu.k]; const [fg, bg] = col(nu.color); return `<button type="button" class="nut ${nu.limit ? 'limit' : ''}" style="${h ? 'height:' + h + 'px;' : ''}${on ? `background:${bg};color:${fg};border-color:${fg}` : ''}" data-act="snackMark" data-id="${esc(sn.id)}" data-k="${nu.k}" aria-pressed="${on}" aria-label="${esc(sn.name)}: ${nu.name}">${ic(nu.icon, 17)}</button>`; });
}
function snackAddButtons() {
  return `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="sub" style="font-weight:700;margin-right:2px">+ Ara öğün:</span>${SNACK_TYPES.map((t) => `<button type="button" class="pill" style="height:34px" data-act="snackAdd" data-v="${t}">${t}</button>`).join('')}</div>`;
}
const FEELINGS = ['Enerjik', 'Huzurlu', 'Motive', 'Yorgun', 'Stresli', 'Kaygılı'];
const INTENS = ['Hafif', 'Orta', 'Zor'];
const GOAL_ICONS = ['target', 'book', 'lang', 'code', 'brief', 'star', 'music', 'pencil', 'coin', 'piggy', 'cart', 'heart', 'leaf', 'moon', 'flame', 'clock'];
const GOAL_COLORS = ['blue', 'purple', 'amber', 'teal', 'pink', 'sky'];

function defaultConfig() {
  return {
    v: 1, updatedAt: 0, waterGoal: 8,
    profile: { sex: 'f', height: null, birth: '', activity: 1.375 },
    money: {
      categories: [
        { id: 'market', name: 'Market', icon: 'cart', color: 'green', limit: 0 },
        { id: 'yemek', name: 'Dışarıda yemek', icon: 'plate', color: 'orange', limit: 0 },
        { id: 'kahve', name: 'Kahve', icon: 'turk', color: 'brown', limit: 0 },
        { id: 'ulasim', name: 'Ulaşım', icon: 'car', color: 'sky', limit: 0 },
        { id: 'giyim', name: 'Giyim', icon: 'shirt', color: 'purple', limit: 0 },
        { id: 'bakim', name: 'Kişisel bakım', icon: 'heart', color: 'pink', limit: 0 },
        { id: 'eglence', name: 'Eğlence', icon: 'music', color: 'violet', limit: 0 },
        { id: 'ev', name: 'Ev', icon: 'home', color: 'teal', limit: 0 },
        { id: 'saglik', name: 'Sağlık', icon: 'kapsul', color: 'cyan', limit: 0 },
        { id: 'diger', name: 'Diğer', icon: 'dot', color: 'gray', limit: 0 }
      ],
      recurring: [], savings: [], savingsLog: []
    },
    care: { weekly: [], todos: [] },
    nutGoals: { p: 3, y: 2, c: 3, s: 0, u: 1 },
    sportGoal: { pilGoal: 2, pilMin: 40, weekMin: 150, pilDays: [1, 4], pilTime: '20:00' },
    drinks: [
      { id: 'turk', name: 'Türk kahvesi', icon: 'turk', color: 'brown', variants: ['Tek', 'Duble'], coffee: true },
      { id: 'filtre', name: 'Filtre kahve', icon: 'filtre', color: 'stone', coffee: true },
      { id: 'cay', name: 'Çay', icon: 'cay', color: 'rust' },
      { id: 'pasiflora', name: 'Pasifloralı çay', icon: 'cicek', color: 'violet' }
    ],
    supps: [
      { id: 'mg', name: 'Magnezyum', icon: 'kapsul', color: 'sky' },
      { id: 'd', name: 'D vitamini', icon: 'sun', color: 'yellow' },
      { id: 'fol', name: 'Folik asit', icon: 'leaf', color: 'green' },
      { id: 'om', name: 'Omega-3', icon: 'fish', color: 'cyan' }
    ],
    acts: [
      { id: 'walk', name: 'Yürüyüş', icon: 'walk' }, { id: 'pilates', name: 'Pilates', icon: 'pilates' },
      { id: 'run', name: 'Koşu', icon: 'run' }, { id: 'yoga', name: 'Yoga', icon: 'yoga' },
      { id: 'gym', name: 'Fitness', icon: 'gym' }, { id: 'bike', name: 'Bisiklet', icon: 'bike' }, { id: 'swim', name: 'Yüzme', icon: 'swim' }
    ],
    moves: [
      { id: 'mekik', name: 'Mekik', icon: 'mekik', unit: 'tekrar' }, { id: 'sinav', name: 'Şınav', icon: 'sinav', unit: 'tekrar' },
      { id: 'squat', name: 'Squat', icon: 'squat', unit: 'tekrar' }, { id: 'plank', name: 'Plank', icon: 'timer', unit: 'sn' }
    ],
    areas: [
      { id: 'meslek', name: 'Meslek', sub: 'Kariyer ve iş hedeflerin', icon: 'brief', color: 'blue', examples: 'örn. haftalık proje adımı, yeni beceri', goals: [] },
      { id: 'kisisel', name: 'Kişisel gelişim', sub: 'Öğrenme, okuma, alışkanlıklar', icon: 'star', color: 'purple', examples: 'örn. günde 20 sayfa, dil pratiği', goals: [] },
      { id: 'maddi', name: 'Maddi', sub: 'Birikim, harcama, bütçe', icon: 'coin', color: 'amber', examples: 'örn. aylık birikim, harcama limiti', goals: [] },
      { id: 'bakim', name: 'Bakım', sub: 'Lazer, manikür, kişisel bakım, yapılacaklar', icon: 'sparkle', color: 'pink', examples: 'örn. lazer, manikür, saç kesimi', goals: [] }
    ], careAreaAdded: true
  };
}
function upgradeConfig(c) {
  const d = defaultConfig();
  const out = Object.assign({}, d, c || {});
  ['nutGoals', 'sportGoal', 'profile', 'money', 'care'].forEach((k) => { out[k] = Object.assign({}, d[k], (c || {})[k] || {}); });
  ['drinks', 'supps', 'acts', 'moves', 'areas'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = d[k]; });
  if (!out.careAreaAdded) { if (!out.areas.some((a) => a.id === 'bakim')) out.areas = out.areas.concat([d.areas.find((a) => a.id === 'bakim')]); out.careAreaAdded = true; }
  out.care = Object.assign({ weekly: [], todos: [] }, out.care || {});
  return out;
}
function blankDay(key) {
  return { date: key, updatedAt: 0, mood: null, sleep: {}, water: [], drinks: [], supps: {}, meals: {}, snacks: [], notes: [], sport: [], reps: [], goals: {}, expenses: [], care: [] };
}

/* ================= durum ================= */
const S = {
  user: null, token: null, tokenExp: 0,
  config: null, days: {}, fileIds: {}, remoteMod: {}, dirty: new Set(),
  sync: 'idle', loadedRemote: false,
  route: location.hash.slice(1) || 'home',
  ui: { drafts: {}, feel: {}, insSel: null, ng: { icon: 'target', type: 'count', color: 'blue', target: 1, limit: false }, open: {} },
  sport: { mode: 'idle', act: 'walk', start: '', end: '', intensity: 1, feel: null }
};
const tokenOk = () => S.token && Date.now() < S.tokenExp;
const getDay = (k) => S.days[k] || blankDay(k);
const dayName = (k) => 'day-' + k + '.json';

function lsKey() { return 'ht:data:' + S.user.email; }
function saveLocal() {
  if (!S.user) return;
  try {
    localStorage.setItem(lsKey(), JSON.stringify({ config: S.config, days: S.days, fileIds: S.fileIds, remoteMod: S.remoteMod, dirty: [...S.dirty] }));
    localStorage.setItem('ht:sport:' + S.user.email, JSON.stringify(S.sport));
  } catch (e) { /* depolama dolu ya da kapalı */ }
}
function loadLocal() {
  S.config = null; S.days = {}; S.fileIds = {}; S.remoteMod = {}; S.dirty = new Set();
  try {
    const o = JSON.parse(localStorage.getItem(lsKey()) || 'null');
    if (o) { S.config = o.config; S.days = o.days || {}; S.fileIds = o.fileIds || {}; S.remoteMod = o.remoteMod || {}; S.dirty = new Set(o.dirty || []); }
    const sp = JSON.parse(localStorage.getItem('ht:sport:' + S.user.email) || 'null');
    if (sp) S.sport = Object.assign(S.sport, sp);
  } catch (e) { /* yok say */ }
  if (!S.config) { S.config = defaultConfig(); S.dirty.add('config.json'); }
  S.config = upgradeConfig(S.config);
}

let syncTimer = null;
function markDirty(name) {
  S.dirty.add(name); saveLocal();
  clearTimeout(syncTimer); syncTimer = setTimeout(sync, 1200);
  setSync(tokenOk() ? 'pending' : 'needsAuth');
}
function mutDay(key, fn) {
  const d = S.days[key] ? S.days[key] : blankDay(key);
  fn(d); d.updatedAt = Date.now(); S.days[key] = d;
  markDirty(dayName(key)); render();
}
function mutCfg(fn) { fn(S.config); S.config.updatedAt = Date.now(); markDirty('config.json'); render(); }

/* ================= Google girişi ================= */
let tokenClient = null, lastAuthTry = 0;
window.__gisLoaded = initGis;
function initGis() {
  if (tokenClient || !CLIENT_ID || !(window.google && google.accounts && google.accounts.oauth2)) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES, callback: onToken,
    error_callback: () => { setSync(S.dirty.size ? 'needsAuth' : 'idle'); }
  });
  render();
}
function requestToken() {
  if (!tokenClient) { toast('Google bağlantısı henüz yüklenmedi, birkaç saniye sonra tekrar dene.'); return; }
  lastAuthTry = Date.now();
  const opts = { prompt: '' };
  if (S.user && S.user.email) opts.login_hint = S.user.email;
  tokenClient.requestAccessToken(opts);
}
async function onToken(resp) {
  if (!resp || resp.error) { setSync('needsAuth'); return; }
  if (!google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
    toast('Verilerini Drive’a kaydedebilmek için izin ekranındaki Drive kutusunu işaretlemelisin.');
    setSync('needsAuth'); return;
  }
  S.token = resp.access_token; S.tokenExp = Date.now() + (Number(resp.expires_in || 3600) - 120) * 1000;
  try {
    const info = await (await api('https://www.googleapis.com/oauth2/v3/userinfo')).json();
    const u = { email: info.email, name: info.given_name || info.name || '', picture: info.picture || '' };
    const switched = !S.user || S.user.email !== u.email;
    S.user = u; localStorage.setItem('ht:lastUser', JSON.stringify(u));
    if (switched) loadLocal();
    render();
    await loadRemote();
    applySetupLink();
  } catch (e) { handleErr(e); }
}
function signOut() {
  if (!confirm('Çıkış yapılsın mı? Eşitlenmemiş kayıt varsa önce eşitlenir.')) return;
  const finish = () => {
    try { if (S.token && window.google) google.accounts.oauth2.revoke(S.token, () => {}); } catch (e) { /* yok say */ }
    try { localStorage.removeItem(lsKey()); localStorage.removeItem('ht:sport:' + S.user.email); localStorage.removeItem('ht:lastUser'); } catch (e) { /* yok say */ }
    S.user = null; S.token = null; S.tokenExp = 0; S.loadedRemote = false; location.hash = ''; render();
  };
  if (S.dirty.size && tokenOk()) sync().then(finish); else finish();
}

/* ================= Drive ================= */
async function api(url, opts = {}) {
  const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + S.token }) }));
  if (r.status === 401) { S.token = null; throw new Error('auth'); }
  if (!r.ok) throw new Error('http ' + r.status);
  return r;
}
async function driveList() {
  let files = [], pageToken = '';
  do {
    const u = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime)' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const j = await (await api(u)).json();
    files = files.concat(j.files || []); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return files;
}
async function driveRead(id) { return (await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media')).json(); }
async function driveCreate(name, obj) {
  const b = 'htb' + Date.now();
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
  return (await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body })).json();
}
async function driveUpdate(id, obj) {
  return (await api('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media&fields=id,modifiedTime', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })).json();
}
async function pool(items, n, fn) { const q = items.slice(); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }

function uniq(arr) { const seen = new Set(); return arr.filter((x) => { const k = JSON.stringify(x); if (seen.has(k)) return false; seen.add(k); return true; }); }
function mergeDay(local, remote) {
  // iki cihazda aynı gün değiştiyse: listeleri birleştir, tekil alanlarda yerel olanı tut
  const out = Object.assign({}, remote, local);
  ['water', 'drinks', 'notes', 'sport', 'reps', 'snacks', 'expenses', 'care'].forEach((k) => { out[k] = uniq([...(remote[k] || []), ...(local[k] || [])]); });
  out.water.sort(); ['drinks', 'reps'].forEach((k) => out[k].sort((a, b) => String(a.t).localeCompare(String(b.t))));
  out.supps = Object.assign({}, remote.supps || {}, local.supps || {});
  out.meals = Object.assign({}, remote.meals || {}, local.meals || {});
  out.goals = Object.assign({}, remote.goals || {}, local.goals || {});
  out.sleep = Object.assign({}, remote.sleep || {}, local.sleep || {});
  out.updatedAt = Date.now();
  return out;
}
function applyRemote(name, remote) {
  if (name === 'config.json') {
    if (!S.dirty.has(name) || (remote.updatedAt || 0) > (S.config.updatedAt || 0)) { S.config = upgradeConfig(remote); S.dirty.delete(name); }
    return;
  }
  const k = name.slice(4, 14);
  if (!S.days[k] || !S.dirty.has(name)) S.days[k] = remote;
  else S.days[k] = mergeDay(S.days[k], remote);
}
async function loadRemote() {
  if (!tokenOk()) return;
  setSync('loading');
  try {
    const files = await driveList();
    const byName = {};
    files.forEach((f) => { if (!byName[f.name] || f.modifiedTime > byName[f.name].modifiedTime) byName[f.name] = f; });
    const since = addDays(todayKey(), -200);
    const want = Object.keys(byName).filter((n) => n === 'config.json' || (n.startsWith('day-') && n.slice(4, 14) >= since));
    await pool(want, 6, async (n) => {
      const f = byName[n]; S.fileIds[n] = f.id;
      const haveLocal = n === 'config.json' ? !!S.config : !!S.days[n.slice(4, 14)];
      if (S.remoteMod[n] === f.modifiedTime && haveLocal) return;
      applyRemote(n, await driveRead(f.id)); S.remoteMod[n] = f.modifiedTime;
    });
    if (!byName['config.json']) S.dirty.add('config.json');
    Object.keys(S.days).forEach((k) => { if (!byName[dayName(k)]) { delete S.fileIds[dayName(k)]; S.dirty.add(dayName(k)); } });
    S.loadedRemote = true; saveLocal(); render();
    await sync();
  } catch (e) { handleErr(e); }
}
let syncing = false;
async function sync() {
  if (syncing || !S.user) return;
  if (!S.dirty.size) { setSync(tokenOk() ? 'ok' : 'idle'); return; }
  if (!tokenOk()) { setSync('needsAuth'); return; }
  if (!navigator.onLine) { setSync('offline'); return; }
  syncing = true; setSync('saving');
  try {
    for (const n of [...S.dirty]) {
      const data = n === 'config.json' ? S.config : S.days[n.slice(4, 14)];
      if (!data) { S.dirty.delete(n); continue; }
      const meta = S.fileIds[n] ? await driveUpdate(S.fileIds[n], data) : await driveCreate(n, data);
      S.fileIds[n] = meta.id; S.remoteMod[n] = meta.modifiedTime; S.dirty.delete(n); saveLocal();
    }
    setSync('ok');
  } catch (e) { handleErr(e); } finally { syncing = false; }
}
function handleErr(e) {
  console.warn(e);
  if (e && e.message === 'auth') setSync('needsAuth');
  else if (!navigator.onLine) setSync('offline');
  else setSync('error');
}
function setSync(s) { S.sync = s; document.querySelectorAll('.sync').forEach((el) => { el.outerHTML = syncChip(); }); }
function syncChip() {
  const m = {
    idle: ['', 'cloud', 'Drive'], ok: ['', 'check', 'Drive’a kaydedildi'], pending: ['', 'clock', 'Kaydediliyor…'], saving: ['', 'cloud', 'Kaydediliyor…'],
    loading: ['', 'cloud', 'Yükleniyor…'], offline: ['warn', 'cloud', 'Çevrimdışı · cihazda saklandı'],
    needsAuth: ['warn', 'cloud', 'Eşitlemek için dokun'], error: ['err', 'info', 'Kaydedilemedi · tekrar dene']
  }[S.sync] || ['', 'cloud', 'Drive'];
  const clickable = S.sync === 'needsAuth' || S.sync === 'error' || S.sync === 'offline';
  return clickable
    ? `<button type="button" class="sync ${m[0]}" data-act="reauth">${ic(m[1], 16, 2)}${m[2]}</button>`
    : `<span class="sync ${m[0]}" role="status">${ic(m[1], 16, 2)}${m[2]}</span>`;
}

/* ================= hesaplar ================= */
function sleepMinutes(key) { return diffMin(getDay(addDays(key, -1)).sleep.bed, getDay(key).sleep.wake); }
function dayMood(d) {
  if (d.mood != null) return d.mood + 1;
  const xs = (d.notes || []).map((n) => n.mood).filter((x) => x != null);
  return xs.length ? avg(xs) + 1 : null;
}
function coffeeIds() { return new Set(S.config.drinks.filter((x) => x.coffee).map((x) => x.id)); }
function stats(k) {
  const d = S.days[k]; if (!d) return null;
  const m = d.meals || {};
  const kb = m.k;
  const bk = kb ? (kb.skip ? false : (kb.time || Object.values(kb.marks || {}).some(Boolean) ? true : null)) : null;
  const ev = eats(d);
  const mealsKnown = ev.some((e) => e.skip || e.time || Object.values(e.marks).some(Boolean));
  const sugar = ev.filter((e) => !e.skip && e.marks.s).length;
  const cids = coffeeIds();
  const coffees = (d.drinks || []).filter((x) => cids.has(x.id));
  const sl = sleepMinutes(k);
  const bed = (d.sleep || {}).bed;
  return {
    mood: dayMood(d), sleepH: sl != null ? sl / 60 : null, bk, sugar: mealsKnown ? sugar : null,
    coffee: (d.drinks || []).length || coffees.length ? coffees.length : null,
    lateCoffee: (d.drinks || []).length ? coffees.some((x) => x.t && x.t >= '15:00') : null,
    mg: Object.keys(d.supps || {}).length ? (d.supps.mg != null) : null,
    bedEarly: bed ? bed >= '12:00' : null,
    sportMin: (d.sport || []).reduce((s, x) => s + (x.min || 0), 0), hasSport: (d.sport || []).length > 0,
    water: (d.water || []).length,
    spend: (d.expenses || []).length ? daySpend(d) : 0, stressSpend: (d.expenses || []).filter((e) => e.why === 'stres' || e.why === 'plansiz').reduce((a, e) => a + e.amount, 0)
  };
}
const ACTIVITY = [[1.2, 'Hareketsiz (masa başı)'], [1.375, 'Hafif aktif (haftada 1–3 gün spor)'], [1.55, 'Orta aktif (haftada 3–5 gün)'], [1.725, 'Çok aktif (haftada 6–7 gün)']];
const fmtK = (n) => Math.round(n).toLocaleString('tr-TR');
function latestWeight() { const ks = Object.keys(S.days).sort().reverse(); for (const k of ks) { const w = S.days[k].weight; if (w) return { w, k }; } return null; }
function ageFrom(b) { if (!b) return null; const [y, m, d] = b.split('-').map(Number); const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--; return a; }
function bmrInfo() {
  const p = S.config.profile || {}; const lw = latestWeight(); const age = ageFrom(p.birth);
  if (!lw || !p.height || age == null) return { ready: false, lw, age, p };
  const v = 10 * lw.w + 6.25 * p.height - 5 * age + (p.sex === 'm' ? 5 : -161);
  return { ready: true, bmr: v, tdee: v * (p.activity || 1.375), lw, age, p };
}
function profileFields(p, weightVal) {
  return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
    ${weightVal !== undefined ? `<label class="col label" style="gap:4px">Kilo (kg)<input class="field" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${esc(weightVal ?? '')}" data-change="weight"></label>` : ''}
    <label class="col label" style="gap:4px">Boy (cm)<input class="field" type="number" inputmode="numeric" min="100" max="250" value="${esc(p.height || '')}" data-change="prof" data-field="height"></label>
    <label class="col label" style="gap:4px">Doğum tarihi<input class="field" type="date" value="${esc(p.birth || '')}" data-change="prof" data-field="birth"></label>
    <label class="col label" style="gap:4px">Cinsiyet<select class="field" data-change="prof" data-field="sex"><option value="f" ${p.sex !== 'm' ? 'selected' : ''}>Kadın</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Erkek</option></select></label>
  </div>
  <label class="col label" style="gap:4px">Hareket düzeyi<select class="field" data-change="prof" data-field="activity">${ACTIVITY.map(([v, l]) => `<option value="${v}" ${Number(p.activity || 1.375) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
}
// pilates günü geçtiyse ve işaretlenmediyse uyarı
function pilatesBanner() {
  const sg = S.config.sportGoal; const days = sg.pilDays || [];
  const now = new Date(); const k = todayKey(); const d = getDay(k);
  if (!days.includes(dateObj(k).getDay())) return '';
  if ((d.sport || []).some((e) => e.act === 'pilates') || d.pilSkip) return '';
  const due = (toMin(sg.pilTime || '20:00') || 0) + (sg.pilMin || 40);
  let nowM = now.getHours() * 60 + now.getMinutes(); if (now.getHours() < DAY_START_HOUR) nowM += 1440;
  if (nowM < due) return '';
  return `<div class="banner" role="status">${ic('pilates', 18, 1.9)}<span class="grow">Bugün ${esc(sg.pilTime || '20:00')} pilatesine gittin mi?</span><button type="button" class="btn btn-sport btn-sm" data-act="sportQuick">Evet, gittim</button><button type="button" class="btn btn-ghost btn-sm" data-act="pilSkip">Hayır</button></div>`;
}
function weekKeys(key) { const d = dateObj(key); const dow = (d.getDay() + 6) % 7; const mon = addDays(key, -dow); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }

/* ================= görünüm parçaları ================= */
function navBar() {
  const items = [['home', 'grid', 'Alanlar'], ['today', 'home', 'Bugün'], ['sport', 'run', 'Spor'], ['insights', 'chart', 'İçgörüler'], ['settings', 'sliders', 'Ayarlar']];
  const cur = S.route.startsWith('area:') ? 'home' : S.route;
  return `<nav class="nav" aria-label="Ana menü"><div class="brand"><span class="logo">${ic('target', 17, 2)}</span>Hedeflerim</div>${items.map(([r, i, l]) =>
    `<a href="#${r}" ${cur === r ? 'aria-current="page"' : ''}>${ic(i, 20, cur === r ? 2 : 1.8)}${l}</a>`).join('')}
    <div class="nav-foot">${syncChip()}<div class="row" style="gap:8px">${S.user.picture ? `<img src="${esc(S.user.picture)}" alt="" width="28" height="28" style="border-radius:99px" referrerpolicy="no-referrer">` : ''}<div class="col" style="min-width:0"><span style="font-size:12.5px;font-weight:700">${esc(S.user.name || '')}</span><span class="sub" style="font-size:11px;overflow:hidden;text-overflow:ellipsis">${esc(S.user.email)}</span></div></div></div></nav>`;
}
function topBar(title, sub, extra = '') {
  return `<header class="top"><div class="col" style="gap:2px">${sub ? `<span class="date">${esc(sub)}</span>` : ''}<h1>${esc(title)}</h1></div><div class="row" style="gap:8px;flex-wrap:wrap">${extra}${syncChip()}</div></header>`;
}
function healthTabs(cur) {
  return `<nav class="subnav" aria-label="Sağlık bölümleri"><a href="#home">${ic('chevL', 16, 2)}Alanlar</a><a href="#today" ${cur === 'today' ? 'aria-current="page"' : ''}>Günlük</a><a href="#sport" ${cur === 'sport' ? 'aria-current="page"' : ''}>Spor</a></nav>`;
}
function icoBox(icon, color, size = 34, isz = 18) {
  const [fg, bg] = col(color);
  return `<div class="chip-ic" style="width:${size}px;height:${size}px;background:${bg};color:${fg}">${ic(icon, isz)}</div>`;
}
function addRow(draft, act, placeholder) {
  return `<div class="row divider" style="gap:8px"><input class="field dashed grow" type="text" data-draft="${draft}" value="${esc(S.ui.drafts[draft] || '')}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><button type="button" class="btn btn-dark btn-sm" data-act="${act}">Ekle</button></div>`;
}

/* ---------- giriş ---------- */
function viewLogin() {
  const noId = !CLIENT_ID;
  return `<div class="login"><div class="box">
    <div class="chip-ic" style="width:56px;height:56px;border-radius:18px;background:#111827;color:#fff">${ic('target', 24, 2)}</div>
    <div class="col" style="gap:6px"><h1 style="font-size:28px;font-weight:800;letter-spacing:-.02em">Hedeflerim</h1>
    <p style="color:#4B5563;font-size:15px;line-height:1.5">Su, öğün, uyku, mod, spor ve diğer hedeflerin tek yerde. Verilerin <b>kendi Google Drive’ında</b>, sadece bu uygulamanın erişebildiği gizli bir klasörde saklanır.</p></div>
    ${noId
      ? `<p style="background:#FFFBEB;border:1.5px solid #FDE68A;color:#92400E;border-radius:14px;padding:12px;font-size:14px;line-height:1.5"><b>Kurulum eksik:</b> <code>config.js</code> dosyasına Google istemci kimliği eklenmemiş. README’deki adımları izle.</p>`
      : `<button type="button" class="gbtn" data-act="signin"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Google ile giriş yap</button>`}
    <p style="font-size:12px;color:#4B5563;line-height:1.5">Giriş yaparken Google senden “uygulamaya ait verileri Drive’da görme ve yönetme” izni ister. Uygulama Drive’ındaki diğer dosyalarını göremez.</p>
  </div></div>`;
}

/* ---------- alanlar ---------- */
function viewHomeDesktop() {
  const k = todayKey(); const d = getDay(k); const c = S.config;
  const sl = sleepMinutes(k); const bi = bmrInfo();
  const wk = weekKeys(k); const pil = wk.reduce((s2, x) => s2 + (getDay(x).sport || []).filter((e) => e.act === 'pilates').length, 0);
  const marks = eats(d).reduce((s2, e) => s2 + (e.skip ? 0 : Object.values(e.marks).filter(Boolean).length), 0);
  const mood = d.mood != null ? MOODS[d.mood] : null;
  const mini = (icon, color, label, value, sub) => { const [fg, bg] = col(color); return `<div class="mini"><span class="chip-ic" style="width:30px;height:30px;border-radius:9px;background:${bg};color:${fg}">${ic(icon, 16, 2)}</span><div class="col" style="min-width:0"><span class="mini-l">${label}</span><span class="mini-v">${value}</span>${sub ? `<span class="mini-s">${sub}</span>` : ''}</div></div>`; };
  const health = `<a class="area area-wide" href="#today"><div class="row" style="gap:12px">${icoBox('heart', 'teal', 42, 22)}<div class="col grow"><span style="font-size:18px;font-weight:800">Sağlık</span><span class="sub" style="font-size:13px">Beslenme · Su · Uyku · Spor · Mod</span></div><span class="area-open">Aç ${ic('chevR', 14, 2.2)}</span></div>
    <div class="minis">${[
      mini('drop', 'blue', 'Su', d.water.length + ' / ' + c.waterGoal, 'bardak'),
      mini('moon', 'indigo', 'Dün gece uyku', sl != null ? durText(sl) : '—', d.sleep.wake ? 'kalkış ' + esc(d.sleep.wake) : ''),
      mini('heart', mood ? 'teal' : 'gray', 'Mod', mood ? mood.label : '—', d.notes.length ? d.notes.length + ' not' : ''),
      mini('egg', 'orange', 'Öğün işaretleri', String(marks), eats(d).filter((e) => e.time && !e.skip).length + ' öğün'),
      mini('pilates', 'orange', 'Pilates bu hafta', pil + ' / ' + c.sportGoal.pilGoal, ''),
      mini('flame', 'orange', 'Bazal', bi.ready ? fmtK(bi.bmr) + ' kcal' : '—', bi.ready ? '~' + fmtK(bi.tdee) + ' toplam' : '')
    ].join('')}</div></a>`;
  const areas = c.areas.map((a) => {
    if (a.id === 'bakim') { const cw = S.config.care.weekly || []; const cdone = cw.filter((it) => careWeek(it, k).done >= (it.perWeek || 1)).length; const copen = (S.config.care.todos || []).filter((t) => !t.done).length; const list = cw.slice(0, 6).map((it) => { const w = careWeek(it, k); const ok = w.done >= (it.perWeek || 1); return `<div class="row" style="gap:8px;min-height:28px"><span class="chip-ic" style="width:24px;height:24px;border-radius:7px;background:#FCE7F3;color:#BE185D">${ic(careEmoji(it), 13, 2)}</span><span class="grow" style="font-size:13px;font-weight:600">${esc(it.name)}</span><span style="font-size:12px;font-weight:700;color:${ok ? '#15803D' : '#B45309'}">${ok ? '✓ ' : ''}${w.done}/${it.perWeek || 1}</span></div>`; }).join(''); return `<a class="area" href="#area:bakim"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 38, 20)}<div class="col grow"><span style="font-size:16px;font-weight:800">${esc(a.name)}</span><span class="sub">Bu hafta ${cdone}/${cw.length} tamam · ${copen} yapılacak</span></div><span class="area-open">Aç ${ic('chevR', 14, 2.2)}</span></div>${list ? `<div class="col" style="gap:2px">${list}</div>` : `<div class="area-empty"><span>${esc(a.examples || '')}</span><b style="color:#BE185D">+ Ekle</b></div>`}</a>`; }
    if (a.id === 'maddi') { const ms = moneySummary(k); return `<a class="area" href="#area:maddi"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 38, 20)}<div class="col grow"><span style="font-size:16px;font-weight:800">${esc(a.name)}</span><span class="sub">Harcama · Bütçe · Birikim</span></div><span class="area-open">Aç ${ic('chevR', 14, 2.2)}</span></div><div class="minis" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="mini"><div class="col"><span class="mini-l">Bugün</span><span class="mini-v">${fmtTL(daySpend(d))}</span></div></div><div class="mini"><div class="col"><span class="mini-l">Bu ay</span><span class="mini-v">${fmtTL(ms.spent)}</span></div></div><div class="mini"><div class="col"><span class="mini-l">Kalan</span><span class="mini-v" style="color:${ms.left < 0 ? '#B91C1C' : '#111827'}">${ms.income ? fmtTL(ms.left) : '—'}</span></div></div><div class="mini"><div class="col"><span class="mini-l">Birikim (bu ay)</span><span class="mini-v">${fmtTL(ms.savedMonth)}</span></div></div></div></a>`; }
    const gs = a.goals || []; const [fg] = col(a.color); const done = gs.filter((g) => goalDone(g, d)).length;
    const list = gs.slice(0, 5).map((g) => { const v = goalVal(g, d); const ok = goalDone(g, d); const [gf, gb] = col(g.color || a.color);
      return `<div class="row" style="gap:8px;min-height:30px"><span class="chip-ic" style="width:26px;height:26px;border-radius:8px;background:${gb};color:${gf}">${ic(g.icon, 14, 2)}</span><span class="grow" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</span><span style="font-size:12px;font-weight:700;color:${ok ? '#15803D' : '#6B7280'}">${g.type === 'check' ? (ok ? '✓ yapıldı' : 'bekliyor') : v.n + ' / ' + (g.limit ? '≤' : '') + g.target + ' ' + esc(g.unit || '')}</span></div>`; }).join('');
    return `<a class="area" href="#area:${esc(a.id)}"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 38, 20)}<div class="col grow"><span style="font-size:16px;font-weight:800">${esc(a.name)}</span><span class="sub">${esc(a.sub || '')}</span></div><span class="area-open">Aç ${ic('chevR', 14, 2.2)}</span></div>
      ${gs.length ? `<div class="row" style="gap:10px"><div class="bar grow" style="height:6px"><div style="height:6px;width:${Math.round(done / gs.length * 100)}%;background:${fg}"></div></div><span class="sub" style="font-weight:700;color:#111827">${done}/${gs.length} bugün</span></div><div class="col" style="gap:2px">${list}</div>${gs.length > 5 ? `<span class="sub">+${gs.length - 5} hedef daha</span>` : ''}`
        : `<div class="area-empty"><span>${esc(a.examples || 'Henüz hedef yok')}</span><b style="color:${fg}">+ Hedef ekle</b></div>`}</a>`;
  }).join('');
  // son 7 gün düzen tablosu
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(k, i - 6));
  const sg = c.sportGoal;
  const rows = [
    { label: 'Su hedefi', icon: 'drop', color: 'blue', f: (x) => { const dd = S.days[x]; if (!dd) return null; return (dd.water || []).length >= c.waterGoal; } },
    { label: 'Mod kaydı', icon: 'heart', color: 'teal', f: (x) => { const dd = S.days[x]; if (!dd) return null; return dd.mood != null || (dd.notes || []).some((n) => n.mood != null); } },
    { label: 'Uyku 7 sa+', icon: 'moon', color: 'indigo', f: (x) => { const m = sleepMinutes(x); return m == null ? null : m >= 420; } },
    { label: 'Pilates', icon: 'pilates', color: 'orange', f: (x) => { const dd = getDay(x); const did = (dd.sport || []).some((e) => e.act === 'pilates'); if (did) return true; return (sg.pilDays || []).includes(dateObj(x).getDay()) && x < k ? false : null; } },
    { label: 'Rafine şeker yok', icon: 'cube', color: 'pink', f: (x) => { const dd = S.days[x]; if (!dd) return null; const ev = eats(dd); if (!ev.some((e) => e.time || Object.values(e.marks).some(Boolean))) return null; return !ev.some((e) => !e.skip && e.marks.s); } }
  ].concat(c.areas.flatMap((a) => (a.goals || []).map((g) => ({ label: g.name, icon: g.icon, color: g.color || a.color, f: (x) => (S.days[x] ? goalDone(g, getDay(x)) : null) }))))
   .concat((c.care.weekly || []).map((it) => ({ label: it.name, icon: careEmoji(it), color: 'pink', f: (x) => ((getDay(x).care || []).some((l) => l.item === it.id) ? true : null) })));
  const streak = `<section class="card" aria-label="Son 7 gün"><div class="card-h"><h2>Son 7 gün</h2><span class="hint">dolu = tuttu · boş = tutmadı · nokta = kayıt yok</span></div>
    <div class="streak"><span></span>${days7.map((x) => { const dt = dateObj(x); return `<span class="st-h ${x === k ? 'today' : ''}">${TR_D3[dt.getDay()]}<b>${dt.getDate()}</b></span>`; }).join('')}
    ${rows.map((r) => { const [fg, bg] = col(r.color); return `<span class="st-l"><span style="color:${fg};display:flex">${ic(r.icon, 15, 2)}</span><span>${esc(r.label)}</span></span>${days7.map((x) => { const v = r.f(x); return `<span class="st-c" title="${esc(r.label)} · ${esc(longDate(x))}: ${v == null ? 'kayıt yok' : v ? 'tuttu' : 'tutmadı'}">${v == null ? '<i></i>' : `<em style="${v ? `background:${fg};border-color:${fg}` : `border-color:${bg === '#F3F4F6' ? '#D1D5DB' : fg};opacity:.45`}"></em>`}</span>`; }).join('')}`; }).join('')}</div></section>`;
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  return `<header class="dtop"><div class="col" style="gap:2px"><span class="date">${esc(longDate(k))}</span><h1>${greet}${S.user.name ? ', ' + esc(S.user.name) : ''}</h1></div></header>
    ${pilatesBanner()}${careBanner()}
    <div class="dash"><div class="dash-col">${health}<div class="dash-2">${areas}</div></div>
    <div class="dash-col">${streak}<section class="card" aria-label="Yeni alan"><div class="card-h"><h2>Yeni alan</h2><span class="hint">örn. İlişkiler, Ev, Hobi</span></div><div class="row" style="gap:8px">${addAreaForm()}</div></section></div></div>`;
}
function viewHome() {
  if (isDesktop()) return viewHomeDesktop();
  const k = todayKey(); const d = getDay(k); const c = S.config;
  const pilWeek = weekKeys(k).reduce((s, x) => s + (getDay(x).sport || []).filter((e) => e.act === 'pilates').length, 0);
  const sl = sleepMinutes(k);
  const mood = d.mood != null ? MOODS[d.mood].label : '—';
  const chips = [
    ['drop', '#1D4ED8', 'Su ' + d.water.length + '/' + c.waterGoal],
    ['moon', '#3730A3', 'Uyku ' + (sl != null ? durText(sl) : '—')],
    ['pilates', '#C2410C', 'Pilates ' + pilWeek + '/' + c.sportGoal.pilGoal],
    ['heart', '#4B5563', 'Mod ' + mood]
  ];
  const bi = bmrInfo(); if (bi.ready) chips.push(['flame', '#C2410C', 'Bazal ' + fmtK(bi.bmr) + ' kcal']);
  const health = `<a class="area" href="#today"><div class="row" style="gap:12px">${icoBox('heart', 'teal', 42, 22)}<div class="col grow"><span style="font-size:18px;font-weight:800">Sağlık</span><span class="sub" style="font-size:13px">Beslenme · Su · Uyku · Spor · Mod</span></div>${ic('chevR', 17, 2, 'style="color:#6B7280"')}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px">${chips.map(([i, f, t]) => `<span class="tag"><span style="color:${f};display:flex">${ic(i, 16, 2)}</span>${esc(t)}</span>`).join('')}</div></a>`;
  const others = c.areas.map((a) => {
    if (a.id === 'bakim') { const cw = S.config.care.weekly || []; const cdone = cw.filter((it) => careWeek(it, k).done >= (it.perWeek || 1)).length; const copen = (S.config.care.todos || []).filter((t) => !t.done).length; return `<a class="area" href="#area:bakim"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 42, 22)}<div class="col grow"><span style="font-size:18px;font-weight:800">${esc(a.name)}</span><span class="sub" style="font-size:13px">${esc(a.sub || '')}</span></div>${ic('chevR', 18, 2, 'style="color:#6B7280"')}</div><div class="row" style="flex-wrap:wrap;gap:6px"><span class="tag">Bu hafta ${cdone}/${cw.length} bakım</span><span class="tag">${copen} yapılacak</span></div></a>`; }
    if (a.id === 'maddi') { const ms = moneySummary(k); return `<a class="area" href="#area:maddi"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 42, 22)}<div class="col grow"><span style="font-size:18px;font-weight:800">${esc(a.name)}</span><span class="sub" style="font-size:13px">Harcama · Bütçe · Birikim</span></div>${ic('chevR', 18, 2, 'style="color:#6B7280"')}</div><div class="row" style="flex-wrap:wrap;gap:6px"><span class="tag">Bugün ${fmtTL(daySpend(d))}</span><span class="tag">Bu ay ${fmtTL(ms.spent)}</span>${ms.income ? `<span class="tag">Kalan ${fmtTL(ms.left)}</span>` : ''}</div></a>`; }
    const gs = a.goals || [];
    const done = gs.filter((g) => goalDone(g, d)).length;
    const body = gs.length
      ? `<div class="row" style="gap:10px"><div class="bar grow"><div style="width:${Math.round(done / gs.length * 100)}%;background:${col(a.color)[0]}"></div></div><span class="sub" style="font-weight:700;color:#111827">${done}/${gs.length} bugün</span></div>`
      : `<div class="row" style="justify-content:space-between;border:1.5px dashed #D1D5DB;border-radius:14px;padding:10px 12px"><span class="sub" style="font-size:13px">${esc(a.examples || '')}</span><span style="font-size:13px;font-weight:700;color:${col(a.color)[0]};white-space:nowrap">Hedef ekle</span></div>`;
    return `<a class="area" href="#area:${esc(a.id)}"><div class="row" style="gap:12px">${icoBox(a.icon, a.color, 42, 22)}<div class="col grow"><span style="font-size:18px;font-weight:800">${esc(a.name)}</span><span class="sub" style="font-size:13px">${esc(a.sub || '')}</span></div>${ic('chevR', 17, 2, 'style="color:#6B7280"')}</div>${body}</a>`;
  }).join('');
  return `${topBar('Alanlarım', longDate(k))}
    ${pilatesBanner()}${careBanner()}<p style="color:#4B5563;font-size:14px;margin-top:-8px">Merhaba${S.user.name ? ' ' + esc(S.user.name) : ''}. Hayatının her alanı için ayrı hedefler.</p>
    <div class="grid-cards grid-areas">${health}${others}</div>
    <div class="row" style="gap:8px">${addAreaForm()}</div>`;
}
function addAreaForm() {
  return `<input class="field dashed grow" type="text" data-draft="newArea" value="${esc(S.ui.drafts.newArea || '')}" placeholder="Yeni alan ekle (örn. İlişkiler)" aria-label="Yeni alan adı"><button type="button" class="btn btn-dark btn-sm" data-act="addArea">Ekle</button>`;
}

/* ---------- alan (meslek / kişisel / maddi) ---------- */
function goalVal(g, d) { return (d.goals || {})[g.id] || { n: 0, times: [] }; }
function goalDone(g, d) { const v = goalVal(g, d); if (g.type === 'check') return v.n > 0; return g.limit ? v.n <= g.target : v.n >= g.target; }
/* ---------- maddi ---------- */
const WHY = [['ihtiyac', 'İhtiyaç', 'teal'], ['istek', 'İstek', 'amber'], ['stres', 'Stres / duygusal', 'pink'], ['plansiz', 'Plansız', 'purple']];
const fmtTL = (n) => Math.round(n || 0).toLocaleString('tr-TR') + ' ₺';
const monthPrefix = (k) => k.slice(0, 7);
function monthLabel(k) { const d = dateObj(k); return TR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function daySpend(d) { return (d.expenses || []).reduce((s2, e) => s2 + (e.amount || 0), 0); }
function monthExpenses(k) { const pre = monthPrefix(k); const out = []; Object.keys(S.days).filter((x) => x.startsWith(pre)).forEach((x) => (S.days[x].expenses || []).forEach((e) => out.push(Object.assign({ day: x }, e)))); return out; }
function moneySummary(k) {
  const m = S.config.money; const ex = monthExpenses(k);
  const income = m.recurring.filter((r) => r.kind === 'income').reduce((s2, r) => s2 + r.amount, 0);
  const fixed = m.recurring.filter((r) => r.kind === 'fixed').reduce((s2, r) => s2 + r.amount, 0);
  const spent = ex.reduce((s2, e) => s2 + e.amount, 0);
  const savedMonth = m.savingsLog.filter((l) => l.date.startsWith(monthPrefix(k))).reduce((s2, l) => s2 + l.amount, 0);
  const left = income - fixed - spent - savedMonth;
  const dt = dateObj(k); const dim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); const daysLeft = dim - dt.getDate() + 1;
  return { income, fixed, spent, savedMonth, left, daysLeft, perDay: left > 0 ? left / daysLeft : 0, ex };
}
function viewMoney() {
  const k = todayKey(); const d = getDay(k); const m = S.config.money; const ms = moneySummary(k); const ui = S.ui.mx || (S.ui.mx = { cat: 'market', why: null });
  const cat = (id) => m.categories.find((x) => x.id === id) || { name: 'Diğer', icon: 'dot', color: 'gray' };
  // hızlı harcama
  const catBtns = m.categories.map((c2) => { const on = ui.cat === c2.id; const [fg, bg] = col(c2.color); return `<button type="button" class="mcat" data-act="mxCat" data-v="${esc(c2.id)}" aria-pressed="${on}" style="${on ? `background:${bg};border-color:${fg};color:${fg}` : ''}">${ic(c2.icon, 18, 1.8)}<span>${esc(c2.name)}</span></button>`; }).join('');
  const whyBtns = WHY.map(([id, l, c2]) => { const on = ui.why === id; const [fg, bg] = col(c2); return `<button type="button" class="pill" style="height:34px;${on ? `background:${bg};border-color:${fg};color:${fg}` : ''}" data-act="mxWhy" data-v="${id}" aria-pressed="${on}">${l}</button>`; }).join('');
  const todayList = (d.expenses || []).slice().reverse().map((e) => { const c2 = cat(e.cat); const w = WHY.find((x) => x[0] === e.why);
    return `<div class="row">${icoBox(c2.icon, c2.color)}<div class="col grow"><span class="name">${esc(c2.name)}${e.note ? ' · ' + esc(e.note) : ''}</span><span class="sub">${esc(e.t)}${w ? ' · ' + w[1] : ''}</span></div><b style="font-size:14px">${fmtTL(e.amount)}</b><button type="button" class="btn-icon" style="border:0;color:#6B7280" data-act="mxDel" data-id="${esc(e.id)}" aria-label="Harcamayı sil">${ic('x', 15, 2)}</button></div>`; }).join('');
  const secAdd = `<section class="card" aria-label="Harcama ekle"><div class="card-h"><h2>Harcama ekle</h2><span class="hint">Saatiyle kaydedilir</span></div>
    <div class="row" style="gap:8px"><label class="sr" for="mx-amount">Tutar</label><div class="money-in"><input id="mx-amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" data-draft="mxAmount" value="${esc(S.ui.drafts.mxAmount || '')}"><span>₺</span></div>
      <input class="field grow" type="text" data-draft="mxNote" value="${esc(S.ui.drafts.mxNote || '')}" placeholder="Not (isteğe bağlı)" aria-label="Not"></div>
    <div class="mcats">${catBtns}</div>
    <div class="col" style="gap:6px"><span class="label">Bu harcama… <span class="sub" style="font-weight:500">(isteğe bağlı)</span></span><div class="row" style="gap:6px;flex-wrap:wrap">${whyBtns}</div></div>
    <button type="button" class="btn btn-dark" data-act="mxAdd">${ic('plus', 18, 2.4)}Kaydet</button>
    <div class="col divider" style="gap:10px"><div class="card-h"><span class="label">Bugün</span><b style="font-size:14px">${fmtTL(daySpend(d))}</b></div>${todayList || '<p class="empty">Bugün harcama yok.</p>'}</div></section>`;
  // ay özeti
  const avail = ms.income - ms.fixed - ms.savedMonth;
  const pct = avail > 0 ? Math.round(ms.spent / avail * 100) : 0;
  const secMonth = `<section class="card" aria-label="Ay özeti"><div class="card-h"><h2>${esc(monthLabel(k))}</h2><span class="hint">${ms.daysLeft} gün kaldı</span></div>
    ${ms.income ? `<div class="msum"><div><span>Gelir</span><b>${fmtTL(ms.income)}</b></div><div><span>Sabit giderler</span><b>−${fmtTL(ms.fixed)}</b></div><div><span>Birikime ayrılan</span><b>−${fmtTL(ms.savedMonth)}</b></div><div><span>Harcanan</span><b>−${fmtTL(ms.spent)}</b></div></div>
      <div class="bar" style="height:10px"><div style="height:10px;width:${clamp(pct, 0, 100)}%;background:${pct > 100 ? '#B91C1C' : pct > 80 ? '#D97706' : '#15803D'}"></div></div>
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><span style="font-size:22px;font-weight:800;color:${ms.left < 0 ? '#B91C1C' : '#111827'}">${fmtTL(ms.left)} <span class="sub" style="font-size:13px;font-weight:600">${ms.left < 0 ? 'aşıldı' : 'kaldı'}</span></span><span class="sub" style="font-size:13px">${ms.left > 0 ? 'Günde ~' + fmtTL(ms.perDay) + ' harcayabilirsin' : ''}</span></div>`
      : `<div class="col" style="gap:4px"><span style="font-size:22px;font-weight:800">${fmtTL(ms.spent)}</span><span class="sub">bu ay harcandı · Kalanı görmek için aşağıya gelirini ekle</span></div>`}</section>`;
  // kategoriler ve limitler
  const byCat = {}; ms.ex.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const catRows = m.categories.slice().sort((a2, b2) => (byCat[b2.id] || 0) - (byCat[a2.id] || 0)).map((c2) => { const sp = byCat[c2.id] || 0; const lim = c2.limit || 0; const p2 = lim ? sp / lim * 100 : 0; const [fg] = col(c2.color);
    const barC = lim ? (p2 > 100 ? '#B91C1C' : p2 >= 80 ? '#D97706' : fg) : fg; const maxSp = Math.max(1, ...Object.values(byCat));
    return `<div class="col" style="gap:5px"><div class="row" style="gap:8px">${icoBox(c2.icon, c2.color, 28, 15)}<span class="grow" style="font-size:13px;font-weight:700">${esc(c2.name)}</span><span style="font-size:13px;font-weight:800;color:${lim && p2 > 100 ? '#B91C1C' : '#111827'}">${fmtTL(sp)}</span><label class="row sub" style="gap:4px">/ <input class="field" style="width:84px;height:32px;font-size:12.5px;padding:0 8px" type="number" inputmode="numeric" min="0" placeholder="limit" value="${lim || ''}" data-change="mxLimit" data-id="${esc(c2.id)}" aria-label="${esc(c2.name)} aylık limit"> ₺</label></div>
      <div class="bar" style="height:6px"><div style="height:6px;width:${clamp(lim ? p2 : sp / maxSp * 100, 0, 100)}%;background:${barC}"></div></div>${lim && p2 >= 80 ? `<span class="sub" style="color:${p2 > 100 ? '#B91C1C' : '#B45309'};font-weight:700">${p2 > 100 ? 'Limit ' + fmtTL(sp - lim) + ' aşıldı' : 'Limitin %' + Math.round(p2) + '’i doldu'}</span>` : ''}</div>`; }).join('');
  const secCats = `<section class="card" aria-label="Kategoriler"><div class="card-h"><h2>Kategoriler ve limitler</h2><span class="hint">bu ay · limit boşsa sınırsız</span></div>${catRows}
    <div class="row divider" style="gap:8px"><input class="field dashed grow" type="text" data-draft="mxNewCat" value="${esc(S.ui.drafts.mxNewCat || '')}" placeholder="Yeni kategori (örn. Evcil hayvan)" aria-label="Yeni kategori adı"><button type="button" class="btn btn-dark btn-sm" data-act="mxAddCat">Ekle</button></div></section>`;
  // duygu dağılımı
  const byWhy = {}; ms.ex.forEach((e) => { if (e.why) byWhy[e.why] = (byWhy[e.why] || 0) + e.amount; }); const whyTotal = Object.values(byWhy).reduce((a2, b2) => a2 + b2, 0);
  const secWhy = `<section class="card" aria-label="Harcama nedenleri"><div class="card-h"><h2>Neden harcadım?</h2><span class="hint">bu ay · işaretlenenler</span></div>${whyTotal ? `<div class="stack">${WHY.filter(([id]) => byWhy[id]).map(([id, l, c2]) => `<span style="width:${byWhy[id] / whyTotal * 100}%;background:${col(c2)[0]}" title="${l}: ${fmtTL(byWhy[id])}"></span>`).join('')}</div>
    <div class="col" style="gap:6px">${WHY.map(([id, l, c2]) => `<div class="row" style="gap:8px;font-size:13px"><span style="width:10px;height:10px;border-radius:3px;background:${col(c2)[0]}"></span><span class="grow">${l}</span><b>${fmtTL(byWhy[id] || 0)}</b><span class="sub" style="width:40px;text-align:right">%${whyTotal ? Math.round((byWhy[id] || 0) / whyTotal * 100) : 0}</span></div>`).join('')}</div>` : '<p class="empty">Harcama eklerken “İhtiyaç / İstek / Stres / Plansız” seçersen dağılım burada görünür.</p>'}</section>`;
  // birikim
  const saved = (gid) => m.savingsLog.filter((l) => l.goal === gid).reduce((a2, l) => a2 + l.amount, 0);
  const goals = m.savings.map((g) => { const sv = saved(g.id); const p2 = g.target ? sv / g.target * 100 : 0; let need = '';
    if (g.deadline && sv < g.target) { const dl = dateObj(g.deadline); const now = dateObj(k); const months = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth()); need = 'Ayda ~' + fmtTL((g.target - sv) / months) + ' gerekiyor'; }
    return `<div class="col" style="gap:6px;padding-bottom:12px;border-bottom:1px solid var(--line2)"><div class="row" style="gap:8px">${icoBox('piggy', 'amber', 30, 16)}<div class="col grow"><span class="name">${esc(g.name)}</span><span class="sub">${g.deadline ? 'Hedef tarih: ' + esc(longDate(g.deadline).split(', ')[1]) + ' ' + g.deadline.slice(0, 4) : 'Tarih yok'}${need ? ' · ' + need : ''}</span></div><button type="button" class="btn-icon" style="border:0;color:#6B7280" data-act="mxGoalDel" data-id="${esc(g.id)}" aria-label="Birikim hedefini sil">${ic('x', 15, 2)}</button></div>
      <div class="row" style="justify-content:space-between"><b style="font-size:16px">${fmtTL(sv)}</b><span class="sub">/ ${fmtTL(g.target)} · %${Math.round(p2)}</span></div><div class="bar" style="height:8px"><div style="height:8px;width:${clamp(p2, 0, 100)}%;background:#B45309"></div></div>
      <div class="row" style="gap:6px"><input class="field" style="width:120px" type="number" inputmode="decimal" min="0" placeholder="Tutar" data-draft="mxSave_${esc(g.id)}" value="${esc(S.ui.drafts['mxSave_' + g.id] || '')}" aria-label="${esc(g.name)} için eklenecek tutar"><button type="button" class="btn btn-sm" style="background:#B45309;color:#fff" data-act="mxSave" data-id="${esc(g.id)}">${ic('plus', 14, 2.6)}Biriktirdim</button></div></div>`; }).join('');
  const secSave = `<section class="card" aria-label="Birikim hedefleri"><div class="card-h"><h2>Birikim hedefleri</h2><span class="hint">${m.savings.length ? 'bu ay ' + fmtTL(ms.savedMonth) + ' ayrıldı' : ''}</span></div>${goals || '<p class="empty">Henüz birikim hedefi yok.</p>'}
    <div class="col" style="gap:8px"><span class="label">Yeni birikim hedefi</span><div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr);gap:6px"><input class="field" type="text" data-draft="mxGoalName" value="${esc(S.ui.drafts.mxGoalName || '')}" placeholder="örn. Tatil" aria-label="Hedef adı"><input class="field" type="number" inputmode="numeric" min="0" data-draft="mxGoalTarget" value="${esc(S.ui.drafts.mxGoalTarget || '')}" placeholder="Tutar ₺" aria-label="Hedef tutar"><input class="field" type="date" data-draft="mxGoalDate" value="${esc(S.ui.drafts.mxGoalDate || '')}" aria-label="Hedef tarih"></div><button type="button" class="btn btn-ghost btn-sm" data-act="mxGoalAdd">${ic('plus', 14, 2.4)}Hedef ekle</button></div></section>`;
  // gelir ve sabit giderler
  const rec = (kind) => m.recurring.filter((r) => r.kind === kind).map((r) => `<div class="row" style="gap:8px;min-height:36px">${icoBox(kind === 'income' ? 'wallet' : 'repeat', kind === 'income' ? 'green' : 'gray', 28, 15)}<span class="grow" style="font-size:13px;font-weight:600">${esc(r.name)}${r.day ? ` <span class="sub">· her ayın ${r.day}’i</span>` : ''}</span><b style="font-size:13px;color:${kind === 'income' ? '#15803D' : '#111827'}">${kind === 'income' ? '+' : '−'}${fmtTL(r.amount)}</b><button type="button" class="btn-icon" style="border:0;color:#6B7280;width:32px;height:32px" data-act="mxRecDel" data-id="${esc(r.id)}" aria-label="Sil">${ic('x', 14, 2)}</button></div>`).join('');
  const rk = S.ui.mxRecKind || 'fixed';
  const secRec = `<section class="card" aria-label="Gelir ve sabit giderler"><div class="card-h"><h2>Gelir ve sabit giderler</h2><span class="hint">her ay tekrarlar</span></div>
    <span class="label">Gelir</span>${rec('income') || '<p class="sub">Henüz gelir eklenmedi.</p>'}
    <span class="label" style="margin-top:4px">Sabit giderler</span>${rec('fixed') || '<p class="sub">Kira, faturalar, abonelikler…</p>'}
    <div class="col divider" style="gap:8px"><div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" data-act="mxRecKind" data-v="income" aria-pressed="${rk === 'income'}">Gelir</button><button type="button" data-act="mxRecKind" data-v="fixed" aria-pressed="${rk === 'fixed'}">Sabit gider</button></div>
      <div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) 70px;gap:6px"><input class="field" type="text" data-draft="mxRecName" value="${esc(S.ui.drafts.mxRecName || '')}" placeholder="${rk === 'income' ? 'örn. Maaş' : 'örn. Kira'}" aria-label="Ad"><input class="field" type="number" inputmode="numeric" min="0" data-draft="mxRecAmount" value="${esc(S.ui.drafts.mxRecAmount || '')}" placeholder="Tutar ₺" aria-label="Tutar"><input class="field" type="number" inputmode="numeric" min="1" max="31" data-draft="mxRecDay" value="${esc(S.ui.drafts.mxRecDay || '')}" placeholder="Gün" aria-label="Ayın günü"></div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="mxRecAdd">${ic('plus', 14, 2.4)}Ekle</button></div></section>`;
  const tabs = `<nav class="subnav"><a href="#home">${ic('chevL', 16, 2)}Alanlar</a></nav>`;
  if (!isDesktop()) return `${tabs}${topBar('Maddi', monthLabel(k))}<div class="grid-cards">${secAdd}${secMonth}${secCats}${secWhy}${secSave}${secRec}</div>`;
  const kpi = (icon, color, label, value, sub) => { const [fg, bg] = col(color); return `<div class="kpi"><div class="row" style="gap:8px"><span class="chip-ic" style="width:28px;height:28px;border-radius:8px;background:${bg};color:${fg}">${ic(icon, 15, 2)}</span><span class="kpi-l">${label}</span></div><div class="kpi-v">${value}</div><div class="kpi-s">${sub}</div></div>`; };
  const kpis = [kpi('wallet', 'gray', 'Bugün', fmtTL(daySpend(d)), (d.expenses || []).length + ' harcama'), kpi('cart', 'orange', 'Bu ay harcanan', fmtTL(ms.spent), ms.ex.length + ' harcama'),
    kpi('coin', ms.left < 0 ? 'pink' : 'green', 'Kalan', ms.income ? fmtTL(ms.left) : '—', ms.income ? (ms.left > 0 ? 'günde ~' + fmtTL(ms.perDay) : 'bütçe aşıldı') : 'gelir eklenmedi'),
    kpi('piggy', 'amber', 'Bu ay birikim', fmtTL(ms.savedMonth), m.savings.length + ' hedef'), kpi('heart', 'pink', 'Stres harcaması', fmtTL(byWhy.stres || 0), 'bu ay')].join('');
  return `${tabs}<header class="dtop"><div class="col" style="gap:2px"><span class="date">${esc(monthLabel(k))} · ${ms.daysLeft} gün kaldı</span><h1>Maddi</h1></div></header>
    <div class="kpis">${kpis}</div><div class="dash"><div class="dash-col">${secAdd}${secCats}</div><div class="dash-col">${secMonth}${secWhy}${secSave}${secRec}</div></div>`;
}
/* ---------- bakım ---------- */
function careWeek(item, k) {
  const wk = weekKeys(k); const logs = [];
  wk.forEach((x) => (getDay(x).care || []).forEach((l) => { if (l.item === item.id) logs.push(Object.assign({ day: x }, l)); }));
  return { wk, logs, done: logs.length };
}
function careLast(item, k) {
  const keys = Object.keys(S.days).filter((x) => x <= k).sort().reverse();
  for (const x of keys) { const l = (S.days[x].care || []).filter((y) => y.item === item.id); if (l.length) return x; }
  return null;
}
function careBanner() {
  const k = todayKey(); const dow = dateObj(k).getDay(); if (![5, 6, 0].includes(dow)) return '';
  const miss = (S.config.care.weekly || []).filter((it) => careWeek(it, k).done < (it.perWeek || 1));
  if (!miss.length) return '';
  return `<div class="banner" role="status" style="background:#FDF2F8;border-color:#F9A8D4;color:#9D174D">${ic('sparkle', 18, 1.9)}<span class="grow">Bu hafta henüz yapılmadı: <b>${miss.map((x) => esc(x.name)).join(', ')}</b></span>${S.route === 'area:bakim' ? '' : `<a class="btn btn-sm" style="background:#BE185D;color:#fff;text-decoration:none" href="#area:bakim">Bakım’a git</a>`}</div>`;
}
function viewCare() {
  const k = todayKey(); const c = S.config.care; const groups = {};
  (c.weekly || []).forEach((it) => { (groups[it.group || 'Düzenli bakım'] = groups[it.group || 'Düzenli bakım'] || []).push(it); });
  const ago = (x) => { if (!x) return 'Henüz yapılmadı'; const n = Math.round((dateObj(k) - dateObj(x)) / 86400000); return n === 0 ? 'Son: bugün' : n === 1 ? 'Son: dün' : 'Son: ' + n + ' gün önce'; };
  const item = (it) => {
    const w = careWeek(it, k); const per = it.perWeek || 1; const ok = w.done >= per; const doneToday = (getDay(k).care || []).some((l) => l.item === it.id);
    const dots = w.wk.map((x, i) => { const n = w.logs.filter((l) => l.day === x).length; return `<span class="cdot ${n ? 'on' : ''} ${x === k ? 'today' : ''}" title="${TR_D3[(i + 1) % 7]}${n ? ': yapıldı' : ''}">${TR_D3[(i + 1) % 7].slice(0, 2)}</span>`; }).join('');
    return `<div class="care-row"><div class="row" style="gap:10px">${icoBox(careEmoji(it), it.color || 'pink', 34, 18)}<div class="col grow"><span class="name">${esc(it.name)}</span><span class="sub">${ago(careLast(it, k))} · hedef haftada ${per}</span></div>
      <span class="care-st" style="color:${ok ? '#15803D' : '#B45309'}">${ok ? ic('check', 14, 2.6) : ''}${w.done}/${per}</span><button type="button" class="btn-icon" style="border:0;color:#9CA3AF;width:28px;height:28px" data-act="careItemDel" data-id="${esc(it.id)}" aria-label="${esc(it.name)} sil">${ic('x', 13, 2)}</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><div class="cdots">${dots}</div><span class="grow"></span>
      ${doneToday ? `<button type="button" class="btn btn-ghost btn-sm" data-act="careUndo" data-id="${esc(it.id)}">Geri al</button>` : ''}
      <button type="button" class="btn btn-sm" style="background:#BE185D;color:#fff" data-act="careDo" data-id="${esc(it.id)}">${ic('check', 14, 2.6)}Yaptım</button>
</div></div>`;
  };
  const weeklySecs = Object.keys(groups).map((g) => { const its = groups[g]; const done = its.filter((it) => careWeek(it, k).done >= (it.perWeek || 1)).length;
    return `<section class="card" aria-label="${esc(g)}"><div class="card-h"><h2>${esc(g)}</h2><span class="hint">bu hafta ${done}/${its.length} tamam</span></div>${its.map(item).join('')}</section>`; }).join('');
  const groupOpts = Array.from(new Set(['Lazer', 'Kişisel bakım', 'Maskeler', 'Vücut'].concat(Object.keys(groups))));
  const addWeekly = `<section class="card" aria-label="Yeni düzenli bakım"><div class="card-h"><h2>Yeni düzenli bakım</h2><span class="hint">örn. lazer bölgesi, maske, manikür</span></div>
    <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 92px;gap:6px"><input class="field" type="text" data-draft="careName" value="${esc(S.ui.drafts.careName || '')}" placeholder="Ad (örn. Bacak)" aria-label="Bakım adı">
    <select class="field" data-draft="careGroup" aria-label="Grup">${groupOpts.map((g) => `<option ${(S.ui.drafts.careGroup || 'Lazer') === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <label class="row sub" style="gap:4px"><input class="field" style="width:48px;padding:0 6px" type="number" min="1" max="14" data-draft="carePer" value="${esc(S.ui.drafts.carePer || '1')}" aria-label="Haftada kaç kez">/hf</label></div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="careAdd">${ic('plus', 14, 2.4)}Ekle</button></section>`;
  const open = (c.todos || []).filter((t) => !t.done); const done = (c.todos || []).filter((t) => t.done).sort((a, b) => String(b.doneDate).localeCompare(String(a.doneDate))).slice(0, 8);
  const todo = (t) => `<div class="row todo ${t.done ? 'done' : ''}"><button type="button" class="tcheck" data-act="todoToggle" data-id="${esc(t.id)}" aria-pressed="${!!t.done}" aria-label="${esc(t.text)} ${t.done ? 'yapılmadı olarak işaretle' : 'yapıldı olarak işaretle'}">${t.done ? ic('check', 14, 2.8) : ''}</button><div class="col grow"><span style="font-size:14px;font-weight:600">${esc(t.text)}</span>${t.done ? `<span class="sub">${esc(longDate(t.doneDate))}</span>` : ''}</div><button type="button" class="btn-icon" style="border:0;color:#9CA3AF;width:32px;height:32px" data-act="todoDel" data-id="${esc(t.id)}" aria-label="Sil">${ic('x', 14, 2)}</button></div>`;
  const secTodo = `<section class="card" aria-label="Yapılacaklar"><div class="card-h"><h2>Yapılacaklar</h2><span class="hint">${open.length} bekliyor</span></div>
    <div class="row" style="gap:8px"><input class="field grow" type="text" data-draft="todoText" value="${esc(S.ui.drafts.todoText || '')}" placeholder="örn. Saçımı kestirmek" aria-label="Yeni yapılacak"><button type="button" class="btn btn-dark btn-sm" data-act="todoAdd">Ekle</button></div>
    ${open.map(todo).join('') || '<p class="empty">Yapmak istediğin bakımları buraya not al.</p>'}
    ${done.length ? `<div class="col divider" style="gap:6px"><span class="label">Yapıldı</span>${done.map(todo).join('')}</div>` : ''}</section>`;
  const tabs = `<nav class="subnav"><a href="#home">${ic('chevL', 16, 2)}Alanlar</a></nav>`;
  const empty = (c.weekly || []).length ? '' : `<section class="card"><p class="empty">Henüz düzenli bakım yok. Aşağıdan ekleyebilirsin.</p></section>`;
  if (!isDesktop()) return `${tabs}${topBar('Bakım', longDate(k))}${careBanner()}<div class="grid-cards">${empty}${weeklySecs}${secTodo}${addWeekly}</div>`;
  return `${tabs}<header class="dtop"><div class="col" style="gap:2px"><span class="date">${esc(longDate(k))}</span><h1>Bakım</h1></div></header>${careBanner()}
    <div class="dash"><div class="dash-col">${empty}${weeklySecs}${addWeekly}</div><div class="dash-col">${secTodo}</div></div>`;
}
function viewArea(id) {
  if (id === 'maddi') return viewMoney();
  if (id === 'bakim') return viewCare();
  const a = S.config.areas.find((x) => x.id === id);
  if (!a) return `${topBar('Bulunamadı', '')}<a href="#home">Alanlara dön</a>`;
  const k = todayKey(); const d = getDay(k); const [fg, bg] = col(a.color);
  const goals = (a.goals || []).map((g) => {
    const v = goalVal(g, d); const [gf, gb] = col(g.color || a.color);
    const status = g.type === 'check'
      ? (v.n ? 'Yapıldı · ' + (v.times[0] || '') : 'Bugün yapılmadı')
      : (g.limit ? 'En fazla ' : 'Hedef ') + g.target + ' ' + esc(g.unit || '') + (v.times.length ? ' · ' + v.times.join(', ') : '');
    const ctrl = g.type === 'check'
      ? `<button type="button" class="btn btn-sm" data-act="goalCheck" data-area="${esc(a.id)}" data-goal="${esc(g.id)}" aria-pressed="${v.n ? 'true' : 'false'}" style="background:${v.n ? gf : '#fff'};color:${v.n ? '#fff' : '#374151'};border:1.5px solid ${v.n ? gf : '#E5E7EB'}">${ic('check', 16, 2.6)}Yaptım</button>`
      : `<button type="button" class="btn-icon" data-act="goalDec" data-goal="${esc(g.id)}" aria-label="${esc(g.name)} azalt">${ic('minus', 16, 2.2)}</button><span style="min-width:44px;text-align:center;font-size:20px;font-weight:800">${v.n}</span><button type="button" class="btn btn-sm" data-act="goalInc" data-goal="${esc(g.id)}" style="background:${gf};color:#fff" aria-label="${esc(g.name)} bir ekle">${ic('plus', 16, 2.6)}1</button>`;
    return `<div class="card" style="gap:10px"><div class="row">${`<div class="chip-ic" style="background:${gb};color:${gf};${g.limit ? 'border:1.5px dashed ' + gf : ''}">${ic(g.icon, 18)}</div>`}<div class="col grow"><span class="name">${esc(g.name)}</span><span class="sub">${status}</span></div>
      <button type="button" class="btn-icon" data-act="goalDel" data-area="${esc(a.id)}" data-goal="${esc(g.id)}" aria-label="${esc(g.name)} hedefini sil" style="border:0;color:#6B7280">${ic('x', 16, 2)}</button></div>
      <div class="row" style="justify-content:flex-end;gap:6px">${ctrl}</div></div>`;
  }).join('');
  return `<nav class="subnav"><a href="#home">${ic('chevL', 16, 2)}Alanlar</a></nav>
    ${topBar(a.name, longDate(k))}
    ${goals ? `<div class="grid-cards">${goals}</div>` : `<div class="card"><p class="empty">Bu alanda henüz hedef yok. Aşağıdan ilk hedefini ekle.</p></div>`}
    ${goalForm(a)}
    <button type="button" class="btn-link" data-act="areaDel" data-area="${esc(a.id)}" style="align-self:flex-start;color:#991B1B">Bu alanı sil</button>`;
}
function goalForm(a) {
  const ng = S.ui.ng; const [fg, bg] = col(ng.color);
  return `<section class="card" aria-label="Yeni hedef"><div class="card-h"><h2>Yeni hedef</h2><span class="hint">${esc(a.name)}</span></div>
    <label class="label" for="ng-name">Hedef adı</label>
    <input id="ng-name" class="field" type="text" data-draft="ngName" value="${esc(S.ui.drafts.ngName || '')}" placeholder="örn. Kitap oku">
    <span class="label">Sembol</span>
    <div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px">${GOAL_ICONS.map((i) => `<button type="button" class="nut" style="height:44px;${ng.icon === i ? `background:${bg};color:${fg};border-color:${fg}` : ''}" data-act="ngIcon" data-v="${i}" aria-pressed="${ng.icon === i}" aria-label="Sembol ${i}">${ic(i, 17)}</button>`).join('')}</div>
    <span class="label">Renk</span>
    <div class="row" style="gap:10px">${GOAL_COLORS.map((c) => `<button type="button" data-act="ngColor" data-v="${c}" aria-label="Renk ${c}" aria-pressed="${ng.color === c}" style="width:40px;height:40px;border-radius:99px;border:3px solid ${ng.color === c ? col(c)[0] : 'transparent'};background:${col(c)[0]};box-shadow:inset 0 0 0 3px #fff;padding:0"></button>`).join('')}</div>
    <span class="label">Takip şekli</span>
    <div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" data-act="ngType" data-v="count" aria-pressed="${ng.type === 'count'}">Sayaç (sayfa, dk, TL…)</button><button type="button" data-act="ngType" data-v="check" aria-pressed="${ng.type === 'check'}">Evet / Hayır</button></div>
    ${ng.type === 'count' ? `<div class="row" style="gap:8px"><label class="label" for="ng-target" style="flex-shrink:0">Günlük hedef</label><input id="ng-target" class="field" style="width:90px" type="number" min="0" inputmode="numeric" data-draft="ngTarget" value="${esc(S.ui.drafts.ngTarget || '1')}"><input class="field grow" type="text" data-draft="ngUnit" value="${esc(S.ui.drafts.ngUnit || '')}" placeholder="birim (sayfa, dk…)" aria-label="Birim"></div>
    <label class="row" style="gap:8px;font-size:14px;min-height:44px"><input type="checkbox" data-act="ngLimit" ${ng.limit ? 'checked' : ''} style="width:20px;height:20px">Sınırlama hedefi (en fazla)</label>` : ''}
    <button type="button" class="btn btn-dark" data-act="goalAdd" data-area="${esc(a.id)}">${ic('check', 16, 2.4)}Hedefi kaydet</button></section>`;
}

/* ---------- bugün ---------- */
const DESKTOP_MQ = window.matchMedia('(min-width: 1024px)');
const isDesktop = () => DESKTOP_MQ.matches;
if (DESKTOP_MQ.addEventListener) DESKTOP_MQ.addEventListener('change', () => { document.documentElement.classList.toggle('is-desktop', isDesktop()); render(); });
document.documentElement.classList.toggle('is-desktop', isDesktop());

function dayAgenda(k) {
  const d = getDay(k); const c = S.config; const out = [];
  const add = (t, icon, color, text) => { if (t) { let m = toMin(t); if (m < DAY_START_HOUR * 60) m += 1440; out.push({ m, t, icon, color, text }); } };
  add(d.sleep.wake, 'sun', '#B45309', 'Uyandım');
  d.water.forEach((t) => add(t, 'drop', '#1D4ED8', '1 bardak su'));
  d.drinks.forEach((e) => { const dk = c.drinks.find((x) => x.id === e.id) || { name: 'İçecek', icon: 'bardak', color: 'gray' }; add(e.t, dk.icon, col(dk.color)[0], dk.name + (e.v ? ' (' + e.v + ')' : '')); });
  MEALS.forEach((m) => { const r = d.meals[m.id]; if (r && !r.skip && r.time) { const marks = NUTS.filter((n) => (r.marks || {})[n.k]).map((n) => n.short.toLowerCase()); add(r.time, m.id === 'k' ? 'egg' : 'plate', '#C2410C', m.name + (marks.length ? ': ' + marks.join(', ') : '')); } });
  (d.snacks || []).forEach((sn) => { const marks = NUTS.filter((n) => (sn.marks || {})[n.k]).map((n) => n.short.toLowerCase()); add(sn.t, 'leaf', '#15803D', 'Ara öğün · ' + sn.name + (marks.length ? ': ' + marks.join(', ') : '')); });
  Object.entries(d.supps).forEach(([id, t]) => { const sp = c.supps.find((x) => x.id === id) || { name: id, icon: 'kapsul', color: 'sky' }; add(t, sp.icon, col(sp.color)[0], sp.name); });
  d.sport.forEach((l) => { const a = c.acts.find((x) => x.id === l.act) || { name: l.name, icon: 'dot' }; add(l.start || l.end, a.icon, '#C2410C', a.name + ' · ' + durText(l.min || 0)); });
  d.reps.forEach((r) => { const mv = c.moves.find((x) => x.id === r.id) || { name: 'Hareket', icon: 'dot', unit: '' }; add(r.t, mv.icon, '#C2410C', mv.name + ' ' + r.n + ' ' + mv.unit); });
  d.notes.forEach((n) => { const m = n.mood != null ? MOODS[n.mood] : null; add(n.t, m ? m.d : 'pencil', m ? m.fg : '#4B5563', (m ? m.label : 'Not') + (n.text ? ' — ' + n.text : '')); });
  add(d.sleep.bed, 'moon', '#3730A3', 'Yattım');
  return out.sort((a, b) => a.m - b.m);
}
function viewTodayDesktop(k) {
  const d = getDay(k); const c = S.config; const goal = c.waterGoal; const n = d.water.length;
  const sl = sleepMinutes(k); const bi = bmrInfo();
  const wk = weekKeys(k); const pil = wk.reduce((s2, x) => s2 + (getDay(x).sport || []).filter((e) => e.act === 'pilates').length, 0);
  const wMin = wk.reduce((s2, x) => s2 + (getDay(x).sport || []).reduce((a, e) => a + (e.min || 0), 0), 0);
  const mood = d.mood != null ? MOODS[d.mood] : null;
  const turk = c.drinks.find((x) => x.id === 'turk'); const cay = c.drinks.find((x) => x.id === 'cay');
  const quick = [
    ['wake', 'sun', 'Uyandım', '', d.sleep.wake], ['bed', 'moon', 'Yatıyorum', '', d.sleep.bed], ['waterAdd', 'drop', '1 bardak su', '', ''],
    turk ? ['drinkAdd', turk.icon, 'Türk kahvesi', 'data-id="turk" data-v="Tek"', ''] : null,
    cay ? ['drinkAdd', cay.icon, 'Çay', 'data-id="cay" data-v=""', ''] : null,
    ['sportQuick', 'pilates', 'Pilates ' + c.sportGoal.pilMin + ' dk', '', '']
  ].filter(Boolean).map(([a, i, l, extra, done]) => `<button type="button" class="qbtn" data-act="${a}" ${extra}>${ic(i, 16, 1.9)}<span>${l}</span>${done ? `<em>${esc(done)}</em>` : ''}</button>`).join('');
  const kpi = (icon, color, label, value, sub, bar) => { const [fg, bg] = col(color); return `<div class="kpi"><div class="row" style="gap:8px"><span class="chip-ic" style="width:28px;height:28px;border-radius:8px;background:${bg};color:${fg}">${ic(icon, 15, 2)}</span><span class="kpi-l">${label}</span></div><div class="kpi-v">${value}</div>${bar != null ? `<div class="bar" style="height:5px"><div style="height:5px;width:${clamp(bar, 0, 100)}%;background:${fg}"></div></div>` : ''}<div class="kpi-s">${sub}</div></div>`; };
  const kpis = [
    kpi('drop', 'blue', 'Su', `${n}<small> / ${goal} bardak</small>`, n ? 'Son: ' + esc(d.water[n - 1] || '') : 'Henüz yok', n / goal * 100),
    kpi('moon', 'indigo', 'Uyku', sl != null ? durText(sl) : '—', d.sleep.wake ? 'Kalkış ' + esc(d.sleep.wake) : 'Uyandım’a dokun', sl != null ? sl / 480 * 100 : null),
    kpi('heart', mood ? 'teal' : 'gray', 'Mod', mood ? mood.label : '—', d.notes.length ? d.notes.length + ' not' : 'Not yok', null),
    kpi('flame', 'orange', 'Bazal metabolizma', bi.ready ? fmtK(bi.bmr) + '<small> kcal</small>' : '—', bi.ready ? 'Toplam ~' + fmtK(bi.tdee) + ' kcal' : 'Vücut bilgilerini gir', null),
    kpi('pilates', 'orange', 'Bu hafta spor', `${pil}<small> / ${c.sportGoal.pilGoal} pilates</small>`, wMin + ' / ' + c.sportGoal.weekMin + ' dk', wMin / Math.max(1, c.sportGoal.weekMin) * 100)
  ].join('');
  const g = c.nutGoals;
  const head = NUTS.map((nu) => `<th scope="col"><span class="mt-h" style="color:${col(nu.color)[0]}">${ic(nu.icon, 15, 1.9)}${nu.short}</span></th>`).join('');
  const body = MEALS.map((m) => {
    const r = d.meals[m.id] || {}; const marks = r.marks || {}; const skip = !!r.skip;
    const cells = skip ? `<td colspan="${NUTS.length}"><div class="skip-box" style="height:36px">${ic('ban', 16, 1.9)}Bu öğünü atladım</div></td>`
      : NUTS.map((nu) => { const on = !!marks[nu.k]; const [fg, bg] = col(nu.color); return `<td><button type="button" class="nut ${nu.limit ? 'limit' : ''}" style="height:36px;${on ? `background:${bg};color:${fg};border-color:${fg}` : ''}" data-act="mark" data-meal="${m.id}" data-k="${nu.k}" aria-pressed="${on}" aria-label="${m.name}: ${nu.name}">${ic(nu.icon, 17)}</button></td>`; }).join('');
    return `<tr><th scope="row">${m.name}</th><td>${skip ? '' : `<input class="field time" style="height:36px;width:104px" type="time" value="${esc(r.time || '')}" data-change="mealTime" data-meal="${m.id}" aria-label="${m.name} saati">`}</td>${cells}<td style="text-align:right"><button type="button" class="btn btn-sm" style="height:36px;background:${skip ? '#111827' : '#fff'};color:${skip ? '#fff' : '#374151'};border:1px solid ${skip ? '#111827' : '#E8EAEE'}" data-act="mealSkip" data-meal="${m.id}" aria-pressed="${skip}">Yemedim</button></td></tr>`;
  }).join('') + (d.snacks || []).map((sn) => `<tr><th scope="row"><div class="row" style="gap:6px">${ic('leaf', 15, 1.9, 'style="color:#15803D"')}${snackSelect(sn)}</div></th><td><input class="field time" style="height:36px;width:104px" type="time" value="${esc(sn.t || '')}" data-change="snackTime" data-id="${esc(sn.id)}" aria-label="Ara öğün saati"></td>${snackChips(sn, 36).map((b) => `<td>${b}</td>`).join('')}<td style="text-align:right"><button type="button" class="btn-icon" style="height:36px;width:36px;border:0;color:#6B7280" data-act="snackDel" data-id="${esc(sn.id)}" aria-label="Ara öğünü sil">${ic('x', 15, 2)}</button></td></tr>`).join('')
    + `<tr><td colspan="${NUTS.length + 3}" style="text-align:left;padding-top:6px">${snackAddButtons()}</td></tr>`;
  const foot = NUTS.map((nu) => { const cnt = nutCount(d, nu.k); const gv = g[nu.k]; const ok = nu.limit ? cnt <= gv : cnt >= gv; return `<td><span style="font-weight:800;color:${nu.limit ? (ok ? '#15803D' : '#B91C1C') : (ok ? '#15803D' : '#374151')}">${cnt}</span><span class="sub"> / ${nu.limit ? '≤' : ''}${gv}</span></td>`; }).join('');
  const meals = `<section class="card" aria-label="Öğünler"><div class="card-h"><h2>Öğünler</h2><span class="hint">Yediklerine dokun · kesik çerçeve = sınırlanan</span></div>
    <div class="scroll-x"><table class="mtable"><thead><tr><th scope="col">Öğün</th><th scope="col">Saat</th>${head}<th></th></tr></thead><tbody>${body}</tbody><tfoot><tr><th scope="row">Günün dengesi</th><td></td>${foot}<td></td></tr></tfoot></table></div></section>`;
  const agenda = dayAgenda(k);
  const flow = `<section class="card" aria-label="Bugünün akışı"><div class="card-h"><h2>Bugünün akışı</h2><span class="hint">${agenda.length} kayıt</span></div>${agenda.length ? `<ol class="flow">${agenda.map((a) => `<li><b>${esc(a.t)}</b><span class="flow-ic" style="color:${a.color}">${ic(a.icon, 15, 1.9)}</span><span class="flow-t">${esc(a.text)}</span></li>`).join('')}</ol>` : '<p class="empty">Kayıt yaptıkça gün burada saat sırasıyla birikir.</p>'}</section>`;
  return `<header class="dtop"><div class="col" style="gap:2px"><span class="date">${esc(longDate(k))}</span><h1>Bugün</h1></div><div class="quick" role="toolbar" aria-label="Hızlı kayıt">${quick}</div></header>
    ${pilatesBanner()}<div class="kpis">${kpis}</div>
    <div class="dash"><div class="dash-col">${meals}<div class="dash-2">${cardDrinks(k)}${cardSupps(k)}</div></div>
    <div class="dash-col">${cardMood(k)}${flow}${cardSleep(k)}${cardBody(k)}</div></div>`;
}
function viewToday() {
  const k = todayKey();
  if (isDesktop()) return viewTodayDesktop(k);
  return `${healthTabs('today')}${topBar('Bugün', longDate(k))}${pilatesBanner()}
    <div class="grid-cards">${cardSleep(k)}${cardBody(k)}${cardWater(k)}${cardDrinks(k)}${cardSupps(k)}${cardMood(k)}${cardBalance(k)}${cardMeals(k)}</div>`;
}
function cardSleep(k) {
  const d = getDay(k); const prev = getDay(addDays(k, -1));
  const bedT = d.sleep.bed || ''; const wake = d.sleep.wake || ''; const prevBed = prev.sleep.bed || '';
  const sl = diffMin(prevBed, wake);
  const sum = sl != null ? 'Dün gece ' + durText(sl) : 'Tek dokunuşla kaydet';
  const b = (on, onBg, offBg, onBd, offBd, offFg) => `border:1.5px solid ${on ? onBd : offBd};background:${on ? onBg : offBg};color:${on ? '#fff' : offFg}`;
  return `<section class="card" aria-label="Uyku"><div class="card-h"><h2>Uyku</h2><span class="hint" style="font-weight:600">${sum}</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <button type="button" data-act="wake" style="height:60px;border-radius:14px;display:flex;align-items:center;gap:10px;padding:0 12px;text-align:left;${b(!!wake, '#B45309', '#FFFBEB', '#B45309', '#FDE68A', '#92400E')}" aria-label="Uyandım: şu anki saati kaydet">${ic('sun', 22)}<span class="col" style="gap:2px"><span style="font-size:15px;font-weight:800">Uyandım</span><span style="font-size:13px;font-weight:600">${wake || 'Dokun, saat yazılsın'}</span></span></button>
      <button type="button" data-act="bed" style="height:60px;border-radius:14px;display:flex;align-items:center;gap:10px;padding:0 12px;text-align:left;${b(!!bedT, '#312E81', '#EEF2FF', '#312E81', '#C7D2FE', '#3730A3')}" aria-label="Yatıyorum: şu anki saati kaydet">${ic('moon', 22)}<span class="col" style="gap:2px"><span style="font-size:15px;font-weight:800">Yatıyorum</span><span style="font-size:13px;font-weight:600">${bedT || 'Dokun, saat yazılsın'}</span></span></button>
    </div>
    <details data-keep="sleepFix" ${S.ui.open.sleepFix ? 'open' : ''}><summary>Saatleri düzelt</summary><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
      <label class="col sub" style="gap:4px">Dün yatış<input class="field time" type="time" value="${prevBed}" data-change="prevBed"></label>
      <label class="col sub" style="gap:4px">Bugün kalkış<input class="field time" type="time" value="${wake}" data-change="wake"></label>
      <label class="col sub" style="gap:4px">Bu gece yatış<input class="field time" type="time" value="${bedT}" data-change="bed"></label>
    </div></details></section>`;
}
function cardBody(k) {
  const b = bmrInfo(); const p = b.p; const today = getDay(k).weight;
  if (!b.ready) {
    return `<section class="card" aria-label="Vücut"><div class="card-h"><h2>Vücut</h2><span class="hint">Bazal metabolizma için bilgilerini gir</span></div>
      ${profileFields(p, today ?? (b.lw ? b.lw.w : ''))}
      <p class="sub">Bilgiler girildikçe otomatik kaydedilir. Kilo her gün ayrı kaydedilir, böylece değişimi görebilirsin.</p></section>`;
  }
  const act = (ACTIVITY.find(([v]) => v === Number(p.activity || 1.375)) || ACTIVITY[1])[1];
  const lwDate = dateObj(b.lw.k);
  return `<section class="card" aria-label="Vücut"><div class="card-h"><h2>Vücut</h2><span class="hint">${b.age} yaş · ${p.height} cm</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <div class="col" style="gap:2px;background:#FFF7ED;border-radius:12px;padding:10px 12px"><span class="sub" style="font-weight:600;color:#9A3412">Bazal metabolizma</span><span style="font-size:22px;font-weight:800;color:#9A3412">${fmtK(b.bmr)}<span style="font-size:12px;font-weight:600"> kcal/gün</span></span><span class="sub">Hiç hareket etmesen</span></div>
      <div class="col" style="gap:2px;background:#F3F5F7;border-radius:12px;padding:10px 12px"><span class="sub" style="font-weight:600">Günlük toplam</span><span style="font-size:22px;font-weight:800">~${fmtK(b.tdee)}<span style="font-size:12px;font-weight:600"> kcal</span></span><span class="sub">${esc(act.split(' (')[0])}</span></div>
    </div>
    <div class="row" style="gap:8px"><label class="label" for="w-today" style="flex-shrink:0">Bugünkü kilo</label><input id="w-today" class="field" style="width:96px" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${esc(today ?? '')}" placeholder="${esc(b.lw.w)}" data-change="weight"><span class="sub grow">kg · son ölçüm ${esc(String(b.lw.w).replace('.', ','))} kg, ${lwDate.getDate()} ${TR_M3[lwDate.getMonth()]}</span></div>
    <details data-keep="bodyFix" ${S.ui.open.bodyFix ? 'open' : ''}><summary>Bilgilerimi düzenle</summary><div class="col" style="gap:8px;margin-top:8px">${profileFields(p)}</div></details>
    <p class="sub">Mifflin-St Jeor formülüyle tahmindir; gerçek değer ±%10 farklı olabilir. Kilo değiştikçe güncellenir.</p></section>`;
}
function cardWater(k) {
  const d = getDay(k); const goal = S.config.waterGoal; const n = d.water.length;
  const glasses = Array.from({ length: Math.max(goal, n) }, (_, i) => {
    const on = i < n;
    return `<button type="button" class="glass" data-act="glass" data-i="${i}" aria-label="${i + 1}. bardak" style="color:${on ? '#1D4ED8' : '#9CA3AF'}"><svg width="22" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M7.1 10h9.8l-1 9.3a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4z" fill="${on ? '#60A5FA' : 'none'}" stroke="none"/><path d="M6 3.5h12l-1.7 15.8a2 2 0 0 1-2 1.7H9.7a2 2 0 0 1-2-1.7z"/></svg></button>`;
  }).join('');
  return `<section class="card" aria-label="Su"><div class="row" style="gap:12px">${icoBox('drop', 'blue', 36, 18)}<div class="col grow"><span style="font-size:17px;font-weight:700">Su</span><span class="sub" style="font-size:13px">Günlük hedef ${goal} bardak</span></div><span style="font-size:24px;font-weight:800;color:#1D4ED8">${n}<span style="font-size:16px;color:#4B5563;font-weight:600">/${goal}</span></span></div>
    <div class="bar"><div style="width:${Math.min(100, Math.round(n / goal * 100))}%;background:#2563EB"></div></div>
    <div class="glasses">${glasses}</div>
    ${n ? `<div class="row sub" style="align-items:flex-start;gap:6px;line-height:1.5">${ic('clock', 14, 2)}<span>${d.water.map((t) => esc(t || 'saat yok')).join(' · ')}</span></div>` : ''}
    <div class="row" style="gap:10px"><button type="button" class="btn btn-ghost" data-act="waterUndo">${ic('minus', 16, 2.2)}Geri al</button><button type="button" class="btn btn-blue grow" data-act="waterAdd">${ic('plus', 16, 2.4)}1 bardak içtim</button></div></section>`;
}
function cardDrinks(k) {
  const d = getDay(k);
  const rows = S.config.drinks.map((dk) => {
    const mine = d.drinks.filter((e) => e.id === dk.id);
    let summary = 'Bugün yok';
    if (mine.length) summary = dk.variants ? dk.variants.map((v) => { const xs = mine.filter((e) => e.v === v); return xs.length ? v + ': ' + xs.map((e) => e.t).join(', ') : null; }).filter(Boolean).join(' · ') : mine.length + ' · ' + mine.map((e) => e.t).join(', ');
    const fg = col(dk.color)[0];
    const adds = (dk.variants || [null]).map((v) => `<button type="button" class="btn btn-sm" data-act="drinkAdd" data-id="${esc(dk.id)}" data-v="${esc(v || '')}" aria-label="${esc(dk.name)} ${esc(v || '')} ekle" style="background:${fg};color:#fff;min-width:44px;padding:0 10px">${ic('plus', 14, 2.6)}${esc(v || '')}</button>`).join('');
    return `<div class="row" style="min-height:48px">${icoBox(dk.icon, dk.color)}<div class="col grow"><span class="name">${esc(dk.name)}</span><span class="sub">${esc(summary)}</span></div><button type="button" class="btn-icon" style="width:40px" data-act="drinkUndo" data-id="${esc(dk.id)}" aria-label="${esc(dk.name)} geri al">${ic('minus', 16, 2.2)}</button>${adds}</div>`;
  }).join('');
  return `<section class="card" aria-label="Diğer içecekler"><div class="card-h"><h2>Diğer içecekler</h2><span class="hint">${d.drinks.length ? 'Bugün ' + d.drinks.length + ' içecek' : 'Kahve, çay ve diğerleri'}</span></div>${rows}${addRow('newDrink', 'addDrink', 'Yeni içecek ekle (örn. Ayran)')}</section>`;
}
function cardSupps(k) {
  const d = getDay(k); const list = S.config.supps;
  const taken = list.filter((s) => d.supps[s.id] != null).length;
  const rows = list.map((sp) => {
    const t = d.supps[sp.id]; const on = t != null; const fg = col(sp.color)[0];
    return `<div class="row" style="min-height:48px;gap:8px">${icoBox(sp.icon, sp.color)}<div class="col grow"><span class="name">${esc(sp.name)}</span><span class="sub">${on ? 'Alındı' : 'Alınmadı'}</span></div>
      ${on ? `<input class="field time" style="width:96px" type="time" value="${esc(t)}" data-change="suppTime" data-id="${esc(sp.id)}" aria-label="${esc(sp.name)} alma saati">` : ''}
      <button type="button" class="btn btn-sm" data-act="suppToggle" data-id="${esc(sp.id)}" aria-pressed="${on}" style="background:${on ? fg : '#fff'};color:${on ? '#fff' : '#374151'};border:1.5px solid ${on ? fg : '#E5E7EB'}">${ic('check', 14, 2.8)}Aldım</button></div>`;
  }).join('');
  return `<section class="card" aria-label="Takviyeler"><div class="card-h"><h2>Takviyeler</h2><span class="hint">${taken} / ${list.length} alındı</span></div>${rows}${addRow('newSupp', 'addSupp', 'Yeni takviye ekle (örn. B12)')}</section>`;
}
function cardMood(k) {
  const d = getDay(k);
  const faces = MOODS.map((m, i) => { const on = d.mood === i; return `<button type="button" class="face" data-act="mood" data-i="${i}" aria-pressed="${on}" style="${on ? `background:${m.bg};border-color:${m.fg};color:${m.fg}` : ''}">${ic(m.d, 24, 1.7)}<span style="${on ? 'color:' + m.fg : ''}">${m.label}</span></button>`; }).join('');
  const tags = FEELINGS.map((f) => `<button type="button" class="pill" data-act="feel" data-v="${f}" aria-pressed="${!!S.ui.feel[f]}">${f}</button>`).join('');
  const notes = d.notes.slice().reverse().map((n) => {
    const m = n.mood != null ? MOODS[n.mood] : null;
    const meta = [n.t, m ? m.label : null].concat(n.tags || []).filter(Boolean).join(' · ');
    return `<div class="row" style="align-items:flex-start"><div class="chip-ic" style="width:30px;height:30px;background:${m ? m.bg : '#F3F4F6'};color:${m ? m.fg : '#4B5563'}">${ic(m ? m.d : 'pencil', 18, 1.7)}</div><div class="col grow" style="gap:2px"><span class="sub" style="font-weight:600">${esc(meta)}</span><span style="font-size:14px;line-height:1.45;white-space:pre-line">${esc(n.text || '—')}</span></div><button type="button" class="btn-icon" style="border:0;color:#6B7280" data-act="noteDel" data-id="${esc(n.id)}" aria-label="Notu sil">${ic('x', 16, 2)}</button></div>`;
  }).join('');
  return `<section class="card" aria-label="Mod ve notlar"><div class="card-h"><h2>Modum</h2><span class="hint">${d.mood != null ? 'Şu an: ' + MOODS[d.mood].label : 'Bugün nasıl hissediyorsun?'}</span></div>
    <div class="faces">${faces}</div><div class="row" style="flex-wrap:wrap;gap:6px">${tags}</div>
    <label class="label" for="note">Şu an ne oluyor?</label>
    <textarea id="note" class="field" rows="3" data-draft="note" placeholder="Aklından geçeni ya da o an olanı yaz…">${esc(S.ui.drafts.note || '')}</textarea>
    <button type="button" class="btn btn-dark" data-act="noteAdd">${ic('pencil', 16, 2)}Not ekle</button>
    <div class="col divider" style="gap:10px">${notes || '<p class="empty">Bugün henüz not yok. Yazdıkların saatiyle burada listelenir.</p>'}</div></section>`;
}
function cardBalance(k) {
  const d = getDay(k); const g = S.config.nutGoals;
  const cells = NUTS.map((nu) => {
    const c = nutCount(d, nu.k);
    const [fg, bg] = col(nu.color); const goal = g[nu.k];
    const value = nu.limit ? c + ' / ≤' + goal : c + ' / ' + goal;
    const status = nu.limit ? (c > goal ? '#B91C1C' : '#15803D') : (c >= goal ? '#15803D' : '#374151');
    return `<div class="col" style="align-items:center;gap:6px;text-align:center"><div class="chip-ic" style="width:36px;height:36px;border-radius:11px;background:${bg};color:${fg};border:1.5px ${nu.limit ? 'dashed' : 'solid'} ${fg}">${ic(nu.icon, 18)}</div><span style="font-size:11px;font-weight:600;line-height:1.2;color:#374151;min-height:26px">${nu.short}</span><span style="font-size:13px;font-weight:800;color:${status}">${value}</span></div>`;
  }).join('');
  return `<section class="card" aria-label="Günün dengesi"><div class="card-h"><h2>Günün dengesi</h2><span class="hint">öğün sayısı / hedef</span></div><div class="nuts">${cells}</div>
    <div class="row divider sub" style="gap:14px;font-size:11px"><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:4px;border:1.5px solid #4B5563"></span>Hedeflenen</span><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:4px;border:1.5px dashed #4B5563"></span>Sınırlanan</span></div></section>`;
}
function cardMeals(k) {
  const d = getDay(k);
  const rows = MEALS.map((m) => {
    const r = d.meals[m.id] || {}; const marks = r.marks || {}; const skip = !!r.skip;
    const n = Object.values(marks).filter(Boolean).length;
    const summary = skip ? 'Yemedim' : (!r.time ? 'Saati gir' : (n ? n + ' işaret' : 'Ne yedin?'));
    const chips = NUTS.map((nu) => { const on = !!marks[nu.k]; const [fg, bg] = col(nu.color); return `<button type="button" class="nut ${nu.limit ? 'limit' : ''}" data-act="mark" data-meal="${m.id}" data-k="${nu.k}" aria-pressed="${on}" aria-label="${m.name}: ${nu.name}" style="${on ? `background:${bg};color:${fg};border-color:${fg}` : ''}">${ic(nu.icon, 18)}</button>`; }).join('');
    return `<div class="col" style="gap:10px;padding:12px 0;border-top:1px solid #F0F1F3"><div class="row" style="gap:8px"><div class="col grow"><span style="font-size:15px;font-weight:700">${m.name}</span><span class="sub">${summary}</span></div>
      ${skip ? '' : `<input class="field time" type="time" value="${esc(r.time || '')}" data-change="mealTime" data-meal="${m.id}" aria-label="${m.name} saati">`}
      <button type="button" class="btn btn-sm" data-act="mealSkip" data-meal="${m.id}" aria-pressed="${skip}" style="flex-shrink:0;background:${skip ? '#111827' : '#fff'};color:${skip ? '#fff' : '#374151'};border:1.5px solid ${skip ? '#111827' : '#E5E7EB'}">Yemedim</button></div>
      ${skip ? `<div class="skip-box">${ic('ban', 16, 1.9)}Bu öğünü atladım</div>` : `<div class="nuts">${chips}</div>`}</div>`;
  }).join('');
  const snacks = (d.snacks || []).map((sn) => `<div class="col" style="gap:10px;padding:12px 0;border-top:1px solid #F0F1F3"><div class="row" style="gap:8px"><span style="color:#15803D;display:flex">${ic('leaf', 16, 1.9)}</span>${snackSelect(sn)}<input class="field time" type="time" value="${esc(sn.t || '')}" data-change="snackTime" data-id="${esc(sn.id)}" aria-label="Ara öğün saati"><button type="button" class="btn-icon" style="border:0;color:#6B7280" data-act="snackDel" data-id="${esc(sn.id)}" aria-label="Ara öğünü sil">${ic('x', 15, 2)}</button></div><div class="nuts">${snackChips(sn).join('')}</div></div>`).join('');
  return `<section class="card" aria-label="Öğünler" style="gap:4px"><div class="card-h" style="margin-bottom:6px"><h2>Öğünler</h2><span class="hint">Yediklerine dokun</span></div>${rows}${snacks}<div style="padding-top:12px;border-top:1px solid #F0F1F3">${snackAddButtons()}</div></section>`;
}

/* ---------- spor ---------- */
function viewSport() {
  const k = todayKey(); const d = getDay(k); const c = S.config; const sg = c.sportGoal; const sp = S.sport;
  const wk = weekKeys(k);
  const pil = wk.reduce((s, x) => s + (getDay(x).sport || []).filter((e) => e.act === 'pilates').length, 0);
  const wMin = wk.reduce((s, x) => s + (getDay(x).sport || []).reduce((a, e) => a + (e.min || 0), 0), 0);
  const week = wk.map((x, i) => {
    const done = (getDay(x).sport || []).length > 0; const isT = x === k;
    return `<div aria-label="${TR_D3[(i + 1) % 7]}: ${done ? 'spor yapıldı' : 'kayıt yok'}"><span class="dot" style="background:${done ? '#C2410C' : '#fff'};border-color:${done || isT ? '#C2410C' : '#E5E7EB'}">${done ? ic('check', 16, 2.8) : ''}</span><span style="${isT ? 'font-weight:800' : ''}">${isT ? 'Bugün' : TR_D3[(i + 1) % 7]}</span></div>`;
  }).join('');
  const act = c.acts.find((a) => a.id === sp.act) || c.acts[0];
  const acts = c.acts.map((a) => `<button type="button" class="act" data-act="sportAct" data-id="${esc(a.id)}" aria-pressed="${a.id === act.id}">${ic(a.icon, 20)}<span>${esc(a.name)}</span></button>`).join('');
  let control = '';
  if (sp.mode === 'idle') {
    control = `<div class="col" style="gap:8px"><button type="button" class="btn btn-sport" style="height:52px;border-radius:14px;font-size:15px;font-weight:800" data-act="sportStart">${ic('play', 18, 0, 'fill="currentColor"')}Başladım · ${esc(act.name)}</button>
      <button type="button" class="btn" style="height:52px;border-radius:16px;border:1.5px solid #FDBA74;background:#FFF7ED;color:#9A3412" data-act="sportQuick">${ic('pilates', 17, 1.9)}Pilates yaptım · ${sg.pilMin} dk</button>
      <button type="button" class="btn-link" data-act="sportManual">Unuttum, sonradan ekle</button></div>`;
  } else if (sp.mode === 'running') {
    control = `<div class="col" style="gap:10px;background:#FFF7ED;border:1.5px solid #FDBA74;border-radius:18px;padding:14px"><div class="row"><span style="width:10px;height:10px;border-radius:99px;background:#C2410C"></span><span class="name grow" style="font-size:15px">${esc(act.name)} sürüyor</span><span class="sub" style="font-size:13px">başlangıç ${esc(sp.start)}</span></div>
      <div class="row" style="gap:8px"><button type="button" class="btn btn-ghost" style="height:56px" data-act="sportCancel">Vazgeç</button><button type="button" class="btn btn-dark grow" style="height:56px;font-size:17px;font-weight:800" data-act="sportFinish">${ic('stop', 16, 0, 'fill="currentColor"')}Bitirdim</button></div></div>`;
  } else {
    const dm = diffMin(sp.start, sp.end);
    control = `<div class="col" style="gap:14px;border:1.5px solid #E5E7EB;border-radius:18px;padding:14px"><div class="card-h"><span class="name" style="font-size:15px">${esc(act.name)} · kaydı tamamla</span><span style="font-size:15px;font-weight:800;color:#C2410C">${dm ? durText(dm) : '— dk'}</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><label class="col label" style="gap:4px">Başlangıç<input class="field" type="time" value="${esc(sp.start)}" data-change="sportStartT"></label><label class="col label" style="gap:4px">Bitiş<input class="field" type="time" value="${esc(sp.end)}" data-change="sportEndT"></label></div>
      <span class="label">Ne kadar zorladı?</span><div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">${INTENS.map((t, i) => `<button type="button" data-act="sportInt" data-i="${i}" aria-pressed="${sp.intensity === i}">${t}</button>`).join('')}</div>
      <span class="label">Sonra nasıl hissettin?</span><div class="faces">${MOODS.map((m, i) => { const on = sp.feel === i; return `<button type="button" class="face" style="padding:8px 0;${on ? `background:${m.bg};border-color:${m.fg};color:${m.fg}` : ''}" data-act="sportFeel" data-i="${i}" aria-pressed="${on}" aria-label="${m.label}">${ic(m.d, 20, 1.7)}</button>`; }).join('')}</div>
      <div class="row" style="gap:8px"><button type="button" class="btn btn-ghost" data-act="sportCancel">Vazgeç</button><button type="button" class="btn btn-sport grow" data-act="sportSave">Kaydet</button></div></div>`;
  }
  const moves = c.moves.map((mv) => {
    const sets = d.reps.filter((r) => r.id === mv.id); const total = sets.reduce((s, r) => s + r.n, 0);
    const steps = mv.unit === 'sn' ? [30, 60] : [5, 10, 20];
    return `<div class="col" style="gap:8px;padding-bottom:12px;border-bottom:1px solid #F0F1F3"><div class="row">${icoBox(mv.icon, 'orange')}<div class="col grow"><span class="name">${esc(mv.name)}</span><span class="sub">${sets.length ? sets.length + ' set · ' + sets.map((r) => r.t).join(', ') : 'Bugün yok · birim: ' + mv.unit}</span></div><span style="font-size:20px;font-weight:800">${total}${mv.unit === 'sn' && total ? ' sn' : ''}</span></div>
      <div class="row" style="gap:6px"><button type="button" class="btn-icon" data-act="repUndo" data-id="${esc(mv.id)}" aria-label="${esc(mv.name)} son seti geri al">${ic('minus', 16, 2.2)}</button>${steps.map((n) => `<button type="button" class="btn btn-sport btn-sm grow" style="font-weight:800" data-act="repAdd" data-id="${esc(mv.id)}" data-n="${n}" aria-label="${esc(mv.name)} ${n} ${mv.unit} ekle">+${n}${mv.unit === 'sn' ? ' sn' : ''}</button>`).join('')}</div></div>`;
  }).join('');
  const log = d.sport.slice().reverse().map((l) => {
    const a = c.acts.find((x) => x.id === l.act) || { name: l.name, icon: 'dot' }; const m = l.feel != null ? MOODS[l.feel] : null;
    return `<div class="row">${icoBox(a.icon, 'orange')}<div class="col grow"><span class="name">${esc(a.name || l.name)}</span><span class="sub">${l.start && l.end ? esc(l.start) + '–' + esc(l.end) + ' · ' : ''}${durText(l.min || 0)} · ${INTENS[l.intensity ?? 1]}</span></div>${m ? `<span class="chip-ic" style="width:30px;height:30px;background:${m.bg};color:${m.fg}" title="Sonra: ${m.label}">${ic(m.d, 18, 1.7)}</span>` : ''}<button type="button" class="btn-icon" style="border:0;color:#6B7280" data-act="sportDel" data-id="${esc(l.id)}" aria-label="Kaydı sil">${ic('x', 16, 2)}</button></div>`;
  }).join('');
  const unit = S.ui.newUnit || 'tekrar';
  const secWeek = `    <section class="card" aria-label="Bu hafta"><div class="card-h"><h2>Bu hafta</h2><span class="hint">Hedef: Pilates ${sg.pilGoal} × ${sg.pilMin} dk</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div class="col" style="gap:6px"><span style="font-size:24px;font-weight:800">${pil}<span style="font-size:15px;color:#4B5563;font-weight:600"> / ${sg.pilGoal} pilates</span></span><div class="bar"><div style="width:${Math.min(100, Math.round(pil / sg.pilGoal * 100))}%;background:#C2410C"></div></div></div>
        <div class="col" style="gap:6px"><span style="font-size:24px;font-weight:800">${wMin}<span style="font-size:15px;color:#4B5563;font-weight:600"> / ${sg.weekMin} dk</span></span><div class="bar"><div style="width:${Math.min(100, Math.round(wMin / sg.weekMin * 100))}%;background:#C2410C"></div></div></div>
      </div><div class="week7">${week}</div></section>`;
  const secAct = `    <section class="card" aria-label="Aktivite"><h2 style="font-size:17px;font-weight:700">Ne yapıyorsun?</h2><div class="acts">${acts}<button type="button" class="act" style="border-style:dashed" data-act="toggleOpen" data-v="newAct">${ic('plus', 18, 2.2)}<span>Ekle</span></button></div>
      ${S.ui.open.newAct ? `<div class="row" style="gap:8px"><input class="field grow" type="text" data-draft="newAct" value="${esc(S.ui.drafts.newAct || '')}" placeholder="örn. Dans, Tenis" aria-label="Yeni aktivite adı"><button type="button" class="btn btn-dark btn-sm" data-act="addAct">Ekle</button></div>` : ''}
      ${control}</section>`;
  const secMoves = `    <section class="card" aria-label="Tekrarlı hareketler"><div class="card-h"><h2>Tekrarlı hareketler</h2><span class="hint">Her dokunuş bir set, saatiyle</span></div>${moves}
      <div class="row" style="gap:8px"><input class="field dashed grow" type="text" data-draft="newMove" value="${esc(S.ui.drafts.newMove || '')}" placeholder="Yeni hareket (örn. Lunge)" aria-label="Yeni hareket adı"><button type="button" class="btn btn-dark btn-sm" data-act="addMove">Ekle</button></div>
      <div class="row sub" style="gap:8px">Birim:${[['tekrar', 'Tekrar'], ['sn', 'Saniye']].map(([v, l]) => `<button type="button" class="pill" style="height:36px" data-act="newUnit" data-v="${v}" aria-pressed="${unit === v}">${l}</button>`).join('')}</div></section>`;
  const secLog = `    <section class="card" aria-label="Bugünkü aktiviteler"><div class="card-h"><h2>Bugün</h2><span class="hint">${d.sport.length ? d.sport.length + ' aktivite · ' + durText(d.sport.reduce((s, x) => s + (x.min || 0), 0)) : 'Kayıt yok'}</span></div>${log || '<p class="empty">Bugün henüz aktivite yok. Başladığında tek dokunuş yeter.</p>'}</section>`;
  if (!isDesktop()) return `${healthTabs('sport')}${topBar('Spor', longDate(k))}${pilatesBanner()}<div class="grid-cards">${secWeek}${secAct}${secMoves}${secLog}</div>`;
  // ---------- masaüstü ----------
  const activeDays = wk.filter((x) => (getDay(x).sport || []).length).length;
  const todayMin = d.sport.reduce((s2, x) => s2 + (x.min || 0), 0);
  const repTotal = d.reps.reduce((s2, r) => s2 + (r.n || 0), 0);
  const kpi = (icon, color, label, value, sub, bar) => { const [fg, bg] = col(color); return `<div class="kpi"><div class="row" style="gap:8px"><span class="chip-ic" style="width:28px;height:28px;border-radius:8px;background:${bg};color:${fg}">${ic(icon, 15, 2)}</span><span class="kpi-l">${label}</span></div><div class="kpi-v">${value}</div>${bar != null ? `<div class="bar" style="height:5px"><div style="height:5px;width:${clamp(bar, 0, 100)}%;background:${fg}"></div></div>` : ''}<div class="kpi-s">${sub}</div></div>`; };
  const kpis = [
    kpi('pilates', 'orange', 'Bu hafta pilates', `${pil}<small> / ${sg.pilGoal} seans</small>`, (sg.pilDays || []).map((x) => TR_D3[x]).join(' · ') + ' ' + esc(sg.pilTime || ''), pil / Math.max(1, sg.pilGoal) * 100),
    kpi('clock', 'orange', 'Haftalık süre', `${wMin}<small> / ${sg.weekMin} dk</small>`, wMin >= sg.weekMin ? 'Hedef tamam' : (sg.weekMin - wMin) + ' dk kaldı', wMin / Math.max(1, sg.weekMin) * 100),
    kpi('check', 'green', 'Aktif gün', `${activeDays}<small> / 7 gün</small>`, 'Bu hafta', activeDays / 7 * 100),
    kpi('run', 'orange', 'Bugün', todayMin ? durText(todayMin) : '—', d.sport.length ? d.sport.length + ' aktivite' : 'Henüz yok', null),
    kpi('mekik', 'orange', 'Bugün tekrar', repTotal ? String(repTotal) : '—', d.reps.length ? d.reps.length + ' set' : 'Henüz yok', null)
  ].join('');
  // haftalık takvim: her gün yapılanlar + planlanan pilates
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const cal = wk.map((x, i) => {
    const dd = getDay(x); const dow = (i + 1) % 7; const isT = x === k; const past = x < k;
    const items = (dd.sport || []).map((l) => { const a = c.acts.find((y) => y.id === l.act) || { name: l.name, icon: 'dot' }; return `<div class="wk-item done">${ic(a.icon, 14, 1.9)}<span>${esc(a.name)}</span><b>${l.min || 0} dk</b></div>`; });
    const repsN = (dd.reps || []).reduce((s2, r) => s2 + (r.n || 0), 0);
    if (repsN) items.push(`<div class="wk-item done">${ic('mekik', 14, 1.9)}<span>Tekrar</span><b>${repsN}</b></div>`);
    const planned = (sg.pilDays || []).includes(dow) && !(dd.sport || []).some((e) => e.act === 'pilates');
    if (planned) items.push(`<div class="wk-item ${past || (isT && nowM > (toMin(sg.pilTime || '20:00') || 0) + (sg.pilMin || 40)) || dd.pilSkip ? 'missed' : 'plan'}">${ic('pilates', 14, 1.9)}<span>Pilates</span><b>${dd.pilSkip ? 'gitmedim' : esc(sg.pilTime || '')}</b></div>`);
    const dt = dateObj(x);
    return `<div class="wk-day ${isT ? 'today' : ''}"><div class="wk-h"><span>${TR_D3[dow]}</span><b>${dt.getDate()}</b></div>${items.join('') || '<span class="wk-empty">—</span>'}</div>`;
  }).join('');
  // son 6 hafta toplam dakika
  const weeks = Array.from({ length: 6 }, (_, j) => { const ks = weekKeys(addDays(k, -7 * (5 - j))); const m = ks.reduce((s2, x) => s2 + (getDay(x).sport || []).reduce((a, e) => a + (e.min || 0), 0), 0); return { m, label: dateObj(ks[0]).getDate() + ' ' + TR_M3[dateObj(ks[0]).getMonth()], cur: j === 5 }; });
  const maxW = Math.max(sg.weekMin, ...weeks.map((w) => w.m), 1) * 1.15;
  const trend = `<section class="card" aria-label="Son 6 hafta"><div class="card-h"><h2>Son 6 hafta</h2><span class="hint">haftalık dakika · çizgi = hedef</span></div>
    <div class="wbars" role="img" aria-label="Son 6 haftanın spor dakikaları: ${weeks.map((w) => w.label + ' ' + w.m + ' dk').join(', ')}"><span class="wplot"><span class="wgoal" style="bottom:${Math.round(sg.weekMin / maxW * 100)}%"></span></span>${weeks.map((w) => `<div class="wbar" title="${w.label} haftası: ${w.m} dk"><b>${w.m || ''}</b><span style="height:${Math.max(2, Math.round(w.m / maxW * 100))}%;background:${w.cur ? '#C2410C' : '#FDBA74'}"></span><em>${w.label}</em></div>`).join('')}</div></section>`;
  const quickBar = `<div class="quick" role="toolbar" aria-label="Hızlı kayıt"><button type="button" class="qbtn" data-act="sportQuick">${ic('pilates', 16, 1.9)}<span>Pilates yaptım · ${sg.pilMin} dk</span></button>${sp.mode === 'idle' ? `<button type="button" class="qbtn" data-act="sportStart">${ic('play', 14, 0, 'fill="currentColor"')}<span>${esc(act.name)} başladım</span></button>` : ''}</div>`;
  return `<header class="dtop"><div class="col" style="gap:2px"><span class="date">${esc(longDate(k))}</span><h1>Spor</h1></div>${quickBar}</header>
    ${pilatesBanner()}<div class="kpis">${kpis}</div>
    <section class="card" aria-label="Bu hafta"><div class="card-h"><h2>Bu hafta</h2><span class="hint">Turuncu kesik çerçeve = planlanan pilates · gri = kaçırılan</span></div><div class="wk">${cal}</div></section>
    <div class="dash"><div class="dash-col">${secAct}${secMoves}</div><div class="dash-col">${secLog}${trend}</div></div>`;
}

/* ---------- içgörüler ---------- */
function compare(keys, groupFn, metricFn) {
  const a = [], b = [];
  keys.forEach((k) => { const g = groupFn(k); if (g == null) return; const v = metricFn(k); if (v == null) return; (g ? a : b).push(v); });
  return { a, b };
}
function insightCard(def, keys) {
  const { a, b } = compare(keys, def.group, def.metric);
  if (def.unit === 'tl' && a.length && b.length) {
    const ma = avg(a), mb = avg(b), diff = ma - mb; const few = a.length < 5 || b.length < 5; const strong = Math.abs(diff) >= Math.max(100, 0.25 * Math.max(ma, mb));
    const [tag, tbg, tfg] = few ? ['Az veri', '#FEF3C7', '#92400E'] : strong ? ['Belirgin', '#111827', '#fff'] : ['Zayıf', '#F3F4F6', '#374151'];
    const max = Math.max(ma, mb, 1) * 1.1;
    const row = (label, mm, n, color) => `<div class="col" style="gap:4px"><div class="row" style="justify-content:space-between;font-size:13px"><span style="color:#374151;font-weight:600">${esc(label)}</span><span style="font-weight:800">${fmtTL(mm)} <span style="font-weight:500;color:#4B5563">· ${n} gün</span></span></div><div style="height:10px;border-radius:99px;background:#F0F1F3"><div style="height:10px;border-radius:99px;background:${color};width:${Math.round(mm / max * 100)}%"></div></div></div>`;
    return `<article class="card ins-card"><div class="row">${icoBox(def.icon, def.color)}<span class="sub" style="font-weight:700;font-size:13px">${esc(def.when)}</span><span class="badge" style="background:${tbg};color:${tfg}">${tag}</span></div><h3>${esc(def.subject)} günde ortalama ${fmtTL(Math.abs(diff))} ${diff >= 0 ? 'daha fazla' : 'daha az'} harcadın.</h3>${row(def.labels[0], ma, a.length, '#111827')}${row(def.labels[1], mb, b.length, '#9CA3AF')}<span class="sub">Günlük toplam harcama</span></article>`;
  }
  const isSleep = def.unit === 'sa'; const max = isSleep ? 10 : 5;
  const head = `<div class="row">${icoBox(def.icon, def.color)}<span class="sub" style="font-weight:700;font-size:13px">${esc(def.when)}</span>`;
  if (!a.length || !b.length) {
    return `<article class="card ins-card">${head}<span class="badge" style="background:#F3F4F6;color:#374151">Veri bekleniyor</span></div><h3 style="color:#374151">${esc(def.title)}</h3><p class="sub" style="font-size:13px">Karşılaştırma için iki grupta da kayıt gerekiyor. Şu an: “${esc(def.labels[0])}” ${a.length} gün, “${esc(def.labels[1])}” ${b.length} gün.</p></article>`;
  }
  const ma = avg(a), mb = avg(b), diff = ma - mb;
  const few = a.length < 5 || b.length < 5; const strong = Math.abs(diff) >= (isSleep ? 0.75 : 0.75);
  const [tag, tbg, tfg] = few ? ['Az veri', '#FEF3C7', '#92400E'] : strong ? ['Belirgin', '#111827', '#fff'] : ['Zayıf', '#F3F4F6', '#374151'];
  const headline = isSleep
    ? `${def.subject} ortalama ${fmt1(Math.abs(diff))} saat ${diff >= 0 ? 'daha uzun' : 'daha kısa'} uyudun.`
    : `${def.subject} modun ortalama ${fmt1(Math.abs(diff))} puan ${diff >= 0 ? 'daha yüksek' : 'daha düşük'}.`;
  const row = (label, m, n, color) => `<div class="col" style="gap:4px" title="${esc(label)}: ortalama ${fmt1(m)} (${n} gün)"><div class="row" style="justify-content:space-between;font-size:13px"><span style="color:#374151;font-weight:600">${esc(label)}</span><span style="font-weight:800">${fmt1(m)}${isSleep ? ' sa' : ''} <span style="font-weight:500;color:#4B5563">· ${n} gün</span></span></div><div style="height:10px;border-radius:99px;background:#F0F1F3"><div style="height:10px;border-radius:99px;background:${color};width:${Math.round(clamp(m / max, 0, 1) * 100)}%"></div></div></div>`;
  return `<article class="card ins-card">${head}<span class="badge" style="background:${tbg};color:${tfg}">${tag}</span></div><h3>${esc(headline)}</h3>${row(def.labels[0], ma, a.length, '#111827')}${row(def.labels[1], mb, b.length, '#9CA3AF')}<span class="sub">${isSleep ? 'Ölçek: saat' : 'Ölçek: 1 (çok kötü) – 5 (harika) mod'}</span></article>`;
}
function viewInsights() {
  const today = todayKey();
  const keys = Object.keys(S.days).filter((k) => k <= today).sort();
  const st = {}; keys.forEach((k) => { st[k] = stats(k); });
  const s = (k) => st[k] || stats(k);
  const next = (k) => s(addDays(k, 1));
  const mood = (k) => (s(k) || {}).mood;
  const defs = [
    { icon: 'egg', color: 'orange', when: 'Kahvaltı → mod', title: 'Kahvaltı yaptığın ve atladığın günlerde modun', subject: 'Kahvaltı yaptığın günler', labels: ['Kahvaltı yaptım', 'Kahvaltıyı atladım'], group: (k) => (s(k) || {}).bk, metric: mood, unit: 'p' },
    { icon: 'moon', color: 'indigo', when: 'Uyku → mod', title: '7 saatten az ve çok uyuduğun günlerde modun', subject: '7 saat ve üstü uyuduğun günler', labels: ['7 saat ve üstü', '7 saatten az'], group: (k) => { const v = (s(k) || {}).sleepH; return v == null ? null : v >= 7; }, metric: mood, unit: 'p' },
    { icon: 'cube', color: 'pink', when: 'Rafine şeker → mod', title: 'Rafine şeker olan ve olmayan günlerde modun', subject: 'Rafine şeker yemediğin günler', labels: ['Rafine şeker yok', 'Rafine şeker var'], group: (k) => { const v = (s(k) || {}).sugar; return v == null ? null : v === 0; }, metric: mood, unit: 'p' },
    { icon: 'turk', color: 'brown', when: 'Kahve sayısı → mod', title: 'Az ve çok kahve içtiğin günlerde modun', subject: 'En fazla 2 kahve içtiğin günler', labels: ['En fazla 2 kahve', '3 ve üstü kahve'], group: (k) => { const v = (s(k) || {}).coffee; return v == null ? null : v < 3; }, metric: mood, unit: 'p' },
    { icon: 'run', color: 'orange', when: 'Spor → mod', title: 'Spor yaptığın ve yapmadığın günlerde modun', subject: 'Spor yaptığın günler', labels: ['Spor yaptım', 'Spor yok'], group: (k) => (s(k) ? s(k).hasSport : null), metric: mood, unit: 'p' },
    { icon: 'wallet', color: 'pink', when: 'Mod → harcama', title: 'Modun düşük ve iyi olduğu günlerde harcaman', subject: 'Modunun düşük olduğu günlerde', labels: ['Mod düşük (1–2)', 'Mod iyi (4–5)'], group: (k) => { const x = s(k); if (!x || x.mood == null || !(S.days[k].expenses || []).length) return null; return x.mood <= 2.5 ? true : x.mood >= 3.5 ? false : null; }, metric: (k) => (s(k) || {}).spend, unit: 'tl' },
    { icon: 'kapsul', color: 'sky', when: 'Magnezyum → o gece uyku', title: 'Magnezyum aldığın günlerin gecesinde uykun', subject: 'Magnezyum aldığın günlerin gecesinde', labels: ['Magnezyum aldım', 'Almadım'], group: (k) => (s(k) || {}).mg, metric: (k) => (next(k) || {}).sleepH, unit: 'sa' }
  ];
  const timeDefs = [
    { icon: 'clock', color: 'brown', when: '15:00 sonrası kahve → o gece uyku', title: 'Öğleden sonra kahve içtiğin günlerin gecesinde uykun', subject: '15:00’ten sonra kahve içtiğin günlerin gecesinde', labels: ['15:00 sonrası kahve var', 'Yok'], group: (k) => (s(k) || {}).lateCoffee, metric: (k) => (next(k) || {}).sleepH, unit: 'sa' },
    { icon: 'moon', color: 'indigo', when: 'Yatış saati → ertesi gün mod', title: 'Gece yarısından önce ve sonra yattığında ertesi gün modun', subject: 'Gece yarısından önce yattığın gecelerin ertesi günü', labels: ['00:00’dan önce yattım', '00:00’dan sonra'], group: (k) => (s(k) || {}).bedEarly, metric: (k) => (next(k) || {}).mood, unit: 'p' }
  ];
  const n = keys.length;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const sel = S.ui.insSel && last14.includes(S.ui.insSel) ? S.ui.insSel : today;
  const dayCells = last14.map((k) => { const d = dateObj(k); const on = k === sel; return `<button type="button" class="daybtn" data-act="insSel" data-k="${k}" aria-pressed="${on}" style="background:${on ? '#E0E7FF' : 'transparent'};color:${on ? '#1E1B4B' : '#374151'}">${d.getDate()}<span>${TR_D3[d.getDay()]}</span></button>`; }).join('');
  const hl = (k) => (k === sel ? 'background:#EEF2FF;' : '');
  const lane = (label, iconName, color, cellFn) => `<div class="lane"><span class="lab"><span style="color:${color};display:flex">${ic(iconName, 16, 2)}</span>${label}</span>${last14.map((k) => `<div class="cell" style="${hl(k)}">${cellFn(k, s(k))}</div>`).join('')}</div>`;
  const lanes = `<div class="lanes"><div class="lane"><span></span>${dayCells}</div>
    ${lane('Mod', 'heart', '#4B5563', (k, x) => { if (!x || x.mood == null) return '<span style="color:#9CA3AF">·</span>'; const m = MOODS[clamp(Math.round(x.mood) - 1, 0, 4)]; return `<span class="chip-ic" style="width:30px;height:30px;border-radius:10px;background:${m.bg};color:${m.fg}" title="${m.label}">${ic(m.d, 17, 1.8)}</span>`; })}
    ${lane('Uyku (sa)', 'moon', '#3730A3', (k, x) => (x && x.sleepH != null ? `<span style="color:${x.sleepH < 7 ? '#B45309' : '#3730A3'}">${fmt1(x.sleepH)}</span>` : '<span style="color:#9CA3AF">·</span>'))}
    ${lane('Kahvaltı', 'egg', '#C2410C', (k, x) => (x && x.bk != null ? `<span style="color:${x.bk ? '#15803D' : '#9CA3AF'}">${ic(x.bk ? 'check' : 'minus', 16, 2.4)}</span>` : '<span style="color:#9CA3AF">·</span>'))}
    ${lane('Rafine şeker', 'cube', '#BE185D', (k, x) => (x && x.sugar ? `<span style="min-width:24px;height:24px;border-radius:8px;background:#FBCFE8;color:#9D174D;display:flex;align-items:center;justify-content:center">${x.sugar}</span>` : (x && x.sugar === 0 ? '<span style="color:#9CA3AF">0</span>' : '<span style="color:#9CA3AF">·</span>')))}
    ${lane('Kahve', 'turk', '#78350F', (k, x) => (x && x.coffee != null ? `<span style="min-width:24px;height:24px;border-radius:8px;background:${x.coffee >= 3 ? '#78350F' : '#F5EBDD'};color:${x.coffee >= 3 ? '#fff' : '#78350F'};display:flex;align-items:center;justify-content:center">${x.coffee}</span>` : '<span style="color:#9CA3AF">·</span>'))}
    ${lane('Kilo', 'flame', '#9A3412', (k) => (S.days[k] && S.days[k].weight ? `<span style="color:#9A3412;font-size:11px">${String(S.days[k].weight).replace('.', ',')}</span>` : '<span style="color:#9CA3AF">·</span>'))}
    ${lane('Su', 'drop', '#1D4ED8', (k, x) => (x && x.water ? `<span style="color:#1D4ED8">${x.water}</span>` : '<span style="color:#9CA3AF">·</span>'))}
    ${lane('Spor (dk)', 'run', '#C2410C', (k, x) => (x && x.sportMin ? `<span style="color:#C2410C">${x.sportMin}</span>` : '<span style="color:#9CA3AF">·</span>'))}
  </div>`;
  const secReady = `<div class="card" style="flex-direction:row;flex-wrap:wrap;align-items:center;border:1.5px dashed #D1D5DB;box-shadow:none">${ic('info', 18, 1.9, 'style="color:#4B5563"')}<span style="font-size:14px;color:#374151;flex:1 1 280px">${n < 14 ? `Şu ana kadar <b>${n} günlük</b> kayıt var. Güvenilir karşılaştırmalar için en az 14 gün kayıt öneririz; kartlar sen kayıt tuttukça dolacak.` : `<b>${n} günlük</b> kayıttan hesaplandı.`}</span><div class="row" style="flex:0 1 240px;gap:10px"><div class="bar grow"><div style="width:${Math.min(100, Math.round(n / 14 * 100))}%;background:#111827"></div></div><b style="font-size:13px;white-space:nowrap">${Math.min(n, 14)} / 14 gün</b></div></div>`;
  const secCards = `<h2 class="big-h">Öne çıkanlar</h2><div class="grid-cards">${defs.map((d) => insightCard(d, keys)).join('')}</div>`;
  const secLanes = `<section class="card"><div class="card-h" style="flex-wrap:wrap"><h2 class="big-h">Gün gün yan yana</h2><span class="hint">Bir güne dokun, aşağıda o günün saat saat akışını gör</span></div><div class="scroll-x">${lanes}</div></section>`;
  const secTimeCards = `<h2 class="big-h">Saate bağlı ilişkiler</h2><div class="grid-cards">${timeDefs.map((d) => insightCard(d, keys)).join('')}</div>`;
  const secCaution = `<div class="card" style="flex-direction:row;gap:14px">${ic('info', 20, 1.9, 'style="color:#374151"')}<div class="col" style="gap:4px"><h3 style="font-size:15px;font-weight:700">Birlikte görünmek, sebep olmak demek değil</h3><p class="sub" style="font-size:14px;line-height:1.5">Kartlar sana nereye bakacağını söyler; kararı sen verirsin. Bir grupta 5 günden az kayıt varsa kart “Az veri” der.</p></div></div>`;
  const csvBtn = `<button type="button" class="btn btn-ghost btn-sm" data-act="csv">${ic('download', 16, 2)}CSV indir</button>`;
  if (!isDesktop()) return `${topBar('İçgörüler', 'Mod ve hislerin neyle birlikte değişiyor?', csvBtn)}${secReady}${secCards}${secLanes}${dayTimeline(sel)}${secTimeCards}${secCaution}`;
  // ---------- masaüstü ----------
  const recent = last14.map((x) => s(x)).filter(Boolean);
  const avgOf = (f) => { const xs = recent.map(f).filter((v) => v != null); return xs.length ? avg(xs) : null; };
  const mAvg = avgOf((x) => x.mood); const slAvg = avgOf((x) => x.sleepH); const wAvg = avgOf((x) => (x.water || null)); const spDays = recent.filter((x) => x.hasSport).length;
  const kpi = (icon, color, label, value, sub) => { const [fg, bg] = col(color); return `<div class="kpi"><div class="row" style="gap:8px"><span class="chip-ic" style="width:28px;height:28px;border-radius:8px;background:${bg};color:${fg}">${ic(icon, 15, 2)}</span><span class="kpi-l">${label}</span></div><div class="kpi-v">${value}</div><div class="kpi-s">${sub}</div></div>`; };
  const moodFace = mAvg != null ? MOODS[clamp(Math.round(mAvg) - 1, 0, 4)] : null;
  const kpis = [
    kpi('chart', 'gray', 'Kayıtlı gün', `${n}<small> gün</small>`, n < 14 ? '14 güne ' + (14 - n) + ' gün kaldı' : 'Karşılaştırmalar hazır'),
    kpi('heart', moodFace ? 'teal' : 'gray', 'Ortalama mod', mAvg != null ? fmt1(mAvg) + '<small> / 5</small>' : '—', moodFace ? moodFace.label + ' civarı · son 14 gün' : 'Mod seçtikçe dolar'),
    kpi('moon', 'indigo', 'Ortalama uyku', slAvg != null ? fmt1(slAvg) + '<small> sa</small>' : '—', 'son 14 gün'),
    kpi('drop', 'blue', 'Ortalama su', wAvg != null ? fmt1(wAvg) + '<small> bardak</small>' : '—', 'hedef ' + S.config.waterGoal + ' bardak'),
    kpi('run', 'orange', 'Spor yapılan gün', `${spDays}<small> / 14</small>`, 'son 14 gün')
  ].join('');
  return `<header class="dtop"><div class="col" style="gap:2px"><span class="date">Mod ve hislerin neyle birlikte değişiyor?</span><h1>İçgörüler</h1></div><div class="quick">${csvBtn}</div></header>
    <div class="kpis">${kpis}</div>${n < 14 ? secReady : ''}
    <div class="dash ins-dash"><div class="dash-col">${secLanes}${dayTimeline(sel)}<div class="card-h" style="padding:6px 2px 0"><h2 class="big-h">Saate bağlı ilişkiler</h2></div><div class="dash-2">${timeDefs.map((d) => insightCard(d, keys)).join('')}</div>${secCaution}</div>
    <div class="dash-col ins-side"><div class="card-h" style="padding:0 2px"><h2 class="big-h">Öne çıkanlar</h2></div>${defs.map((d) => insightCard(d, keys)).join('')}</div></div>`;
}
function dayTimeline(k) {
  const d = getDay(k); const c = S.config;
  const H0 = 5 * 60, SPAN = 24 * 60;
  const pos = (t) => { let m = toMin(t); if (m == null) return null; if (m < H0) m += 1440; return clamp(((m - H0) / SPAN) * 100, 1.5, 98.5) + '%'; };
  const ev = (t, icon, fg, bg, tip) => (t ? { t, icon, fg, bg, tip: t + ' · ' + tip } : null);
  const meals = []; const sugar = [];
  MEALS.forEach((m) => { const r = d.meals[m.id]; if (r && !r.skip && r.time) { meals.push(ev(r.time, m.id === 'k' ? 'egg' : 'plate', '#374151', '#F3F4F6', m.name)); if (r.marks && r.marks.s) sugar.push(ev(r.time, 'cube', '#BE185D', '#FCE7F3', 'Rafine şeker (' + m.name + ')')); } });
  (d.snacks || []).forEach((sn) => { meals.push(ev(sn.t, 'leaf', '#15803D', '#DCFCE7', 'Ara öğün: ' + sn.name)); if (sn.marks && sn.marks.s) sugar.push(ev(sn.t, 'cube', '#BE185D', '#FCE7F3', 'Rafine şeker (' + sn.name + ')')); });
  const lanes = [
    { label: 'Uyku', icon: 'moon', color: '#3730A3', events: [ev(d.sleep.wake, 'sun', '#fff', '#B45309', 'Uyandım'), ev(d.sleep.bed, 'moon', '#fff', '#312E81', 'Yattım')] },
    { label: 'Su', icon: 'drop', color: '#1D4ED8', events: d.water.map((t) => ev(t, 'drop', '#1D4ED8', '#DBEAFE', '1 bardak su')) },
    { label: 'İçecek', icon: 'turk', color: '#78350F', events: d.drinks.map((e) => { const dk = c.drinks.find((x) => x.id === e.id) || { name: 'İçecek', icon: 'bardak', color: 'gray' }; const late = e.t >= '15:00' && dk.coffee; return ev(e.t, dk.icon, late ? '#fff' : col(dk.color)[0], late ? col(dk.color)[0] : col(dk.color)[1], dk.name + (e.v ? ' (' + e.v + ')' : '')); }) },
    { label: 'Öğün', icon: 'egg', color: '#C2410C', events: meals },
    { label: 'Rafine şeker', icon: 'cube', color: '#BE185D', events: sugar },
    { label: 'Takviye', icon: 'kapsul', color: '#0369A1', events: Object.entries(d.supps).map(([id, t]) => { const sp = c.supps.find((x) => x.id === id) || { name: id, icon: 'kapsul', color: 'sky' }; return ev(t, sp.icon, col(sp.color)[0], col(sp.color)[1], sp.name); }) },
    { label: 'Spor', icon: 'run', color: '#C2410C', events: d.sport.map((l) => { const a = c.acts.find((x) => x.id === l.act) || { name: l.name, icon: 'dot' }; return ev(l.start || l.end, a.icon, '#C2410C', '#FFEDD5', a.name + ' · ' + durText(l.min || 0)); }).concat(d.reps.map((r) => { const mv = c.moves.find((x) => x.id === r.id) || { name: 'Hareket', icon: 'dot', unit: '' }; return ev(r.t, mv.icon, '#C2410C', '#FFEDD5', mv.name + ' ' + r.n + ' ' + mv.unit); })) },
    { label: 'Mod / not', icon: 'pencil', color: '#4B5563', events: d.notes.map((n) => { const m = n.mood != null ? MOODS[n.mood] : null; return ev(n.t, m ? m.d : 'pencil', m ? m.fg : '#4B5563', m ? m.bg : '#F3F4F6', (m ? m.label : 'Not') + (n.text ? ': ' + n.text.slice(0, 40) : '')); }) }
  ].map((l) => Object.assign(l, { events: l.events.filter(Boolean) }));
  const ticks = [6, 9, 12, 15, 18, 21, 24, 27].map((h) => ({ left: ((h * 60 - H0) / SPAN) * 100 + '%', label: pad(h % 24) + ':00' }));
  const agenda = []; lanes.forEach((l) => l.events.forEach((e) => { let m = toMin(e.t); if (m < H0) m += 1440; agenda.push({ m, t: e.t, text: e.tip.split(' · ').slice(1).join(' · '), color: l.color }); }));
  agenda.sort((a, b) => a.m - b.m);
  const tickMarks = ticks.map((t) => `<span class="tl-tick" style="left:${t.left}"></span>`).join('');
  return `<section class="card" aria-label="Gün içinde"><div class="card-h" style="flex-wrap:wrap"><div class="col"><h2 class="big-h">Gün içinde</h2><span class="hint" style="font-size:13px">Seçili gün: <b style="color:#111827">${esc(longDate(k))}</b></span></div></div>
    ${agenda.length ? `<div class="scroll-x"><div class="tl"><div class="tl-row"><span></span><div style="position:relative;height:18px">${ticks.map((t) => `<span style="position:absolute;left:${t.left};transform:translateX(-50%);font-size:11px;font-weight:600;color:#4B5563">${t.label}</span>`).join('')}</div></div>
      ${lanes.map((l) => `<div class="tl-row"><span class="lab row" style="font-size:13px;font-weight:700;gap:6px"><span style="color:${l.color};display:flex">${ic(l.icon, 16, 2)}</span>${l.label}</span><div class="tl-track">${tickMarks}${l.events.map((e) => { const left = pos(e.t); return left ? `<span class="tl-ev" role="img" aria-label="${esc(e.tip)}" title="${esc(e.tip)}" style="left:${left};background:${e.bg};color:${e.fg}">${ic(e.icon, 16, 1.9)}</span>` : ''; }).join('')}</div></div>`).join('')}</div></div>
    <div class="col divider" style="gap:6px"><h3 style="font-size:15px;font-weight:700">Saat sırasıyla</h3><ol class="agenda">${agenda.map((a) => `<li><b>${esc(a.t)}</b><span style="width:10px;height:10px;border-radius:3px;background:${a.color};flex-shrink:0"></span><span style="color:#374151">${esc(a.text)}</span></li>`).join('')}</ol></div>`
    : '<p class="empty">Bu gün için saatli kayıt yok.</p>'}</section>`;
}

/* ---------- ayarlar ---------- */
function viewSettings() {
  const c = S.config;
  const listEditor = (title, key) => `<div class="col" style="gap:6px"><span class="label">${title}</span><div class="row" style="flex-wrap:wrap;gap:6px">${c[key].map((x) => `<span class="tag" style="padding-right:4px">${esc(x.name)}<button type="button" data-act="listDel" data-list="${key}" data-id="${esc(x.id)}" aria-label="${esc(x.name)} sil" style="width:28px;height:28px;border:0;background:transparent;color:#6B7280;display:flex;align-items:center;justify-content:center;padding:0">${ic('x', 14, 2.2)}</button></span>`).join('')}</div></div>`;
  const num = (label, path, min, max) => { const v = path.split('.').reduce((o, p) => o[p], c); return `<label class="row" style="justify-content:space-between;gap:12px;min-height:48px"><span style="font-size:14px;font-weight:600">${label}</span><input class="field" style="width:90px" type="number" inputmode="numeric" min="${min}" max="${max}" value="${v}" data-change="cfgNum" data-path="${path}"></label>`; };
  return `${topBar('Ayarlar', '')}
  <div class="grid-cards">
    <section class="card"><div class="row">${S.user.picture ? `<img src="${esc(S.user.picture)}" alt="" width="44" height="44" style="border-radius:99px" referrerpolicy="no-referrer">` : icoBox('target', 'gray', 44)}<div class="col grow"><span class="name">${esc(S.user.name || 'Hesabım')}</span><span class="sub">${esc(S.user.email)}</span></div></div>
      <p class="sub" style="font-size:13px;line-height:1.5">Kayıtların önce bu cihazda saklanır, sonra Google Drive’ındaki gizli uygulama klasörüne kaydedilir. Telefon ve bilgisayarda aynı hesapla girdiğinde aynı verileri görürsün. Bu klasörü Drive’da dosya olarak görmezsin; Drive › Ayarlar › Uygulamaları yönet bölümünden silebilirsin.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" data-act="syncNow">${ic('cloud', 16, 2)}Şimdi eşitle</button><button type="button" class="btn btn-ghost btn-sm" data-act="csv">${ic('download', 16, 2)}CSV indir</button><button type="button" class="btn btn-ghost btn-sm" data-act="signout" style="color:#991B1B">${ic('logout', 16, 2)}Çıkış yap</button></div></section>
    <section class="card"><div class="card-h"><h2 style="font-size:17px;font-weight:700">Vücut bilgilerim</h2><span class="hint">${bmrInfo().ready ? 'Bazal ' + fmtK(bmrInfo().bmr) + ' kcal/gün' : 'Bazal metabolizma için'}</span></div>${profileFields(c.profile || {})}<p class="sub">Kiloyu Bugün ekranındaki Vücut kartından gir.</p></section>
    <section class="card"><h2 style="font-size:17px;font-weight:700">Hedefler</h2>
      ${num('Günlük su (bardak)', 'waterGoal', 1, 30)}${num('Haftalık pilates (seans)', 'sportGoal.pilGoal', 0, 14)}${num('Pilates süresi (dk)', 'sportGoal.pilMin', 5, 180)}${num('Haftalık toplam spor (dk)', 'sportGoal.weekMin', 0, 2000)}
      <div class="col" style="gap:6px"><span style="font-size:14px;font-weight:600">Pilates günleri</span><div class="row" style="gap:6px;flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 0].map((dw) => `<button type="button" class="pill" style="height:36px" data-act="pilDay" data-v="${dw}" aria-pressed="${(c.sportGoal.pilDays || []).includes(dw)}">${TR_D3[dw]}</button>`).join('')}</div></div>
      <label class="row" style="justify-content:space-between;gap:12px;min-height:48px"><span style="font-size:14px;font-weight:600">Pilates saati</span><input class="field time" type="time" value="${esc(c.sportGoal.pilTime || '20:00')}" data-change="pilTime"></label>
      ${NUTS.map((n) => num(n.name + (n.limit ? ' (en fazla, öğün)' : ' (öğün)'), 'nutGoals.' + n.k, 0, 4)).join('')}</section>
    <section class="card"><h2 style="font-size:17px;font-weight:700">Listelerim</h2>${listEditor('İçecekler', 'drinks')}${listEditor('Takviyeler', 'supps')}${listEditor('Aktiviteler', 'acts')}${listEditor('Tekrarlı hareketler', 'moves')}
      <p class="sub">Yeni öğe eklemek için ilgili ekrandaki “Ekle” kutusunu kullan. Sildiğin öğenin geçmiş kayıtları silinmez.</p></section>
  </div>`;
}

/* ================= çizim ================= */
const $app = document.getElementById('app');
let rendering = false;
function render() {
  // DOM değişirken odaktaki alan blur/change tetiklerse iç içe çizimi ertele
  if (rendering) { setTimeout(render, 0); return; }
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function renderNow() {
  if (!S.user) { $app.innerHTML = viewLogin(); return; }
  const r = S.route; let body;
  if (r === 'today') body = viewToday();
  else if (r === 'sport') body = viewSport();
  else if (r === 'insights') body = viewInsights();
  else if (r === 'settings') body = viewSettings();
  else if (r.startsWith('area:')) body = viewArea(r.slice(5));
  else body = viewHome();
  // odaktaki alanı ve kaydırmayı koru
  const ae = document.activeElement; const focusDraft = ae && ae.dataset ? ae.dataset.draft : null;
  const sx = window.scrollX, sy = window.scrollY;
  $app.innerHTML = `<div class="shell">${navBar()}<main class="main" id="main">${body}</main></div>`;
  window.scrollTo(sx, sy);
  if (focusDraft) { const el = $app.querySelector(`[data-draft="${focusDraft}"]`); if (el) el.focus(); }
}
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/* ================= eylemler ================= */
const T = () => todayKey();
function saveSport(patch) { Object.assign(S.sport, patch); saveLocal(); render(); }
const draft = (k) => (S.ui.drafts[k] || '').trim();
const clearDraft = (k) => { S.ui.drafts[k] = ''; };
const ACT = {
  signin: () => requestToken(),
  reauth: () => { if (tokenOk()) { sync(); loadRemote(); } else requestToken(); },
  syncNow: () => { if (tokenOk()) loadRemote(); else requestToken(); },
  signout: () => signOut(),
  csv: () => exportCsv(),
  // uyku
  wake: () => mutDay(T(), (d) => { d.sleep.wake = nowHM(); }),
  bed: () => { const now = new Date(); const k = keyOf(logicalDate(now)); mutDay(k, (d) => { d.sleep.bed = hmOf(now); }); toast('İyi geceler. Yatış saatin kaydedildi.'); },
  // su
  waterAdd: () => mutDay(T(), (d) => { d.water.push(nowHM()); }),
  waterUndo: () => mutDay(T(), (d) => { d.water.pop(); }),
  glass: (ds) => mutDay(T(), (d) => { const i = +ds.i; const n = d.water.length; if (i < n) d.water = d.water.slice(0, i === n - 1 ? i : i + 1); else for (let j = n; j <= i; j++) d.water.push(nowHM()); }),
  // içecek
  drinkAdd: (ds) => mutDay(T(), (d) => { d.drinks.push({ id: ds.id, v: ds.v || null, t: nowHM() }); }),
  drinkUndo: (ds) => mutDay(T(), (d) => { const i = d.drinks.map((e) => e.id).lastIndexOf(ds.id); if (i >= 0) d.drinks.splice(i, 1); }),
  addDrink: () => { const nm = draft('newDrink'); if (!nm) return; clearDraft('newDrink'); mutCfg((c) => { c.drinks.push({ id: uid('d'), name: nm, icon: 'bardak', color: 'teal' }); }); },
  // takviye
  suppToggle: (ds) => mutDay(T(), (d) => { if (d.supps[ds.id] != null) delete d.supps[ds.id]; else d.supps[ds.id] = nowHM(); }),
  addSupp: () => { const nm = draft('newSupp'); if (!nm) return; clearDraft('newSupp'); mutCfg((c) => { c.supps.push({ id: uid('s'), name: nm, icon: 'kapsul', color: 'purple' }); }); },
  // mod
  mood: (ds) => mutDay(T(), (d) => { const i = +ds.i; d.mood = d.mood === i ? null : i; }),
  feel: (ds) => { S.ui.feel[ds.v] = !S.ui.feel[ds.v]; render(); },
  noteAdd: () => {
    const text = draft('note'); const tags = FEELINGS.filter((f) => S.ui.feel[f]); const mood = getDay(T()).mood;
    if (!text && !tags.length && mood == null) { toast('Önce bir mod seç, etiket işaretle ya da bir şey yaz.'); return; }
    clearDraft('note'); S.ui.feel = {};
    mutDay(T(), (d) => { d.notes.push({ id: uid('n'), t: nowHM(), mood, tags, text }); });
  },
  noteDel: (ds) => { if (confirm('Bu not silinsin mi?')) mutDay(T(), (d) => { d.notes = d.notes.filter((n) => n.id !== ds.id); }); },
  // öğün
  mark: (ds) => mutDay(T(), (d) => { const r = d.meals[ds.meal] || (d.meals[ds.meal] = {}); r.marks = r.marks || {}; r.marks[ds.k] = !r.marks[ds.k]; if (!r.time) r.time = nowHM(); }),
  snackAdd: (ds) => mutDay(T(), (d) => { d.snacks = d.snacks || []; d.snacks.push({ id: uid('sn'), t: nowHM(), name: ds.v || 'Ara öğün', marks: {} }); }),
  snackDel: (ds) => mutDay(T(), (d) => { d.snacks = (d.snacks || []).filter((x) => x.id !== ds.id); }),
  snackMark: (ds) => mutDay(T(), (d) => { const sn = (d.snacks || []).find((x) => x.id === ds.id); if (sn) { sn.marks = sn.marks || {}; sn.marks[ds.k] = !sn.marks[ds.k]; } }),
  mealSkip: (ds) => mutDay(T(), (d) => { const r = d.meals[ds.meal] || (d.meals[ds.meal] = {}); r.skip = !r.skip; }),
  // spor
  sportAct: (ds) => saveSport({ act: ds.id }),
  sportStart: () => saveSport({ mode: 'running', start: nowHM(), end: '' }),
  sportManual: () => saveSport({ mode: 'pending', start: '', end: '' }),
  sportFinish: () => saveSport({ mode: 'pending', end: nowHM() }),
  sportCancel: () => saveSport({ mode: 'idle', start: '', end: '', intensity: 1, feel: null }),
  sportInt: (ds) => saveSport({ intensity: +ds.i }),
  sportFeel: (ds) => saveSport({ feel: S.sport.feel === +ds.i ? null : +ds.i }),
  sportSave: () => {
    const sp = S.sport; const m = diffMin(sp.start, sp.end);
    if (!m) { toast('Başlangıç ve bitiş saatini gir.'); return; }
    const a = S.config.acts.find((x) => x.id === sp.act) || S.config.acts[0];
    mutDay(T(), (d) => { d.sport.push({ id: uid('x'), act: a.id, name: a.name, start: sp.start, end: sp.end, min: m, intensity: sp.intensity, feel: sp.feel }); });
    saveSport({ mode: 'idle', start: '', end: '', intensity: 1, feel: null });
  },
  sportQuick: () => { const m = S.config.sportGoal.pilMin; mutDay(T(), (d) => { d.sport.push({ id: uid('x'), act: 'pilates', name: 'Pilates', start: minsAgoHM(m), end: nowHM(), min: m, intensity: 1, feel: null }); }); toast('Pilates kaydedildi.'); },
  pilSkip: () => mutDay(T(), (d) => { d.pilSkip = true; }),
  sportDel: (ds) => { if (confirm('Bu aktivite silinsin mi?')) mutDay(T(), (d) => { d.sport = d.sport.filter((x) => x.id !== ds.id); }); },
  toggleOpen: (ds) => { S.ui.open[ds.v] = !S.ui.open[ds.v]; render(); },
  addAct: () => { const nm = draft('newAct'); if (!nm) return; clearDraft('newAct'); S.ui.open.newAct = false; const id = uid('a'); S.sport.act = id; mutCfg((c) => { c.acts.push({ id, name: nm, icon: 'dot' }); }); },
  repAdd: (ds) => mutDay(T(), (d) => { d.reps.push({ id: ds.id, n: +ds.n, t: nowHM() }); }),
  repUndo: (ds) => mutDay(T(), (d) => { const i = d.reps.map((r) => r.id).lastIndexOf(ds.id); if (i >= 0) d.reps.splice(i, 1); }),
  newUnit: (ds) => { S.ui.newUnit = ds.v; render(); },
  addMove: () => { const nm = draft('newMove'); if (!nm) return; clearDraft('newMove'); const unit = S.ui.newUnit || 'tekrar'; mutCfg((c) => { c.moves.push({ id: uid('m'), name: nm, icon: unit === 'sn' ? 'timer' : 'dot', unit }); }); },
  // içgörü
  insSel: (ds) => { S.ui.insSel = ds.k; render(); },
  // alanlar
  addArea: () => { const nm = draft('newArea'); if (!nm) return; clearDraft('newArea'); const id = uid('ar'); mutCfg((c) => { c.areas.push({ id, name: nm, sub: '', icon: 'target', color: GOAL_COLORS[c.areas.length % GOAL_COLORS.length], goals: [] }); }); location.hash = 'area:' + id; },
  areaDel: (ds) => { if (!confirm('Bu alan ve içindeki hedefler silinsin mi? Geçmiş kayıtlar Drive’da kalır.')) return; mutCfg((c) => { c.areas = c.areas.filter((a) => a.id !== ds.area); }); location.hash = 'home'; },
  ngIcon: (ds) => { S.ui.ng.icon = ds.v; render(); },
  ngColor: (ds) => { S.ui.ng.color = ds.v; render(); },
  ngType: (ds) => { S.ui.ng.type = ds.v; render(); },
  ngLimit: () => { S.ui.ng.limit = !S.ui.ng.limit; },
  goalAdd: (ds) => {
    const nm = draft('ngName'); if (!nm) { toast('Hedefe bir ad ver.'); return; }
    const ng = S.ui.ng; const g = { id: uid('g'), name: nm, icon: ng.icon, color: ng.color, type: ng.type, target: ng.type === 'check' ? 1 : Math.max(0, parseInt(S.ui.drafts.ngTarget || '1', 10) || 1), unit: ng.type === 'check' ? '' : draft('ngUnit'), limit: ng.type === 'count' && ng.limit };
    clearDraft('ngName'); clearDraft('ngUnit'); S.ui.drafts.ngTarget = '1'; S.ui.ng.limit = false;
    mutCfg((c) => { const a = c.areas.find((x) => x.id === ds.area); if (a) a.goals.push(g); });
    toast('Hedef eklendi.');
  },
  goalDel: (ds) => { if (!confirm('Bu hedef silinsin mi?')) return; mutCfg((c) => { const a = c.areas.find((x) => x.id === ds.area); if (a) a.goals = a.goals.filter((g) => g.id !== ds.goal); }); },
  goalInc: (ds) => mutDay(T(), (d) => { const v = d.goals[ds.goal] || (d.goals[ds.goal] = { n: 0, times: [] }); v.n += 1; v.times.push(nowHM()); }),
  goalDec: (ds) => mutDay(T(), (d) => { const v = d.goals[ds.goal]; if (v && v.n > 0) { v.n -= 1; v.times.pop(); } }),
  goalCheck: (ds) => mutDay(T(), (d) => { const v = d.goals[ds.goal]; if (v && v.n) delete d.goals[ds.goal]; else d.goals[ds.goal] = { n: 1, times: [nowHM()] }; }),
  // bakım
  careDo: (ds) => { mutDay(T(), (d) => { d.care = d.care || []; d.care.push({ id: uid('ca'), item: ds.id, t: nowHM() }); }); toast('Kaydedildi.'); },
  careUndo: (ds) => mutDay(T(), (d) => { const i = (d.care || []).map((l) => l.item).lastIndexOf(ds.id); if (i >= 0) d.care.splice(i, 1); }),
  careAdd: () => { const nm = draft('careName'); if (!nm) { toast('Bakımın adını yaz.'); return; } const per = Math.max(1, parseInt(S.ui.drafts.carePer || '1', 10) || 1); const g = S.ui.drafts.careGroup || 'Lazer'; clearDraft('careName'); S.ui.drafts.carePer = '1'; mutCfg((c) => { c.care.weekly.push({ id: uid('cw'), name: nm, group: g, perWeek: per, icon: g === 'Lazer' ? 'zap' : g === 'Kişisel bakım' ? 'hand' : g === 'Vücut' ? 'repeat' : 'sparkle', color: 'pink' }); }); },
  careItemDel: (ds) => { if (confirm('Bu bakım listeden kaldırılsın mı? Geçmiş kayıtlar silinmez.')) mutCfg((c) => { c.care.weekly = c.care.weekly.filter((x) => x.id !== ds.id); }); },
  todoAdd: () => { const t = draft('todoText'); if (!t) return; clearDraft('todoText'); mutCfg((c) => { c.care.todos.push({ id: uid('td'), text: t, done: false, created: T() }); }); },
  todoToggle: (ds) => mutCfg((c) => { const t = c.care.todos.find((x) => x.id === ds.id); if (t) { t.done = !t.done; t.doneDate = t.done ? T() : null; } }),
  todoDel: (ds) => { if (confirm('Silinsin mi?')) mutCfg((c) => { c.care.todos = c.care.todos.filter((x) => x.id !== ds.id); }); },
  // maddi
  mxCat: (ds) => { S.ui.mx.cat = ds.v; render(); },
  mxWhy: (ds) => { S.ui.mx.why = S.ui.mx.why === ds.v ? null : ds.v; render(); },
  mxAdd: () => {
    const amt = parseFloat(String(S.ui.drafts.mxAmount || '').replace(',', '.'));
    if (!(amt > 0)) { toast('Önce tutarı yaz.'); const el = document.getElementById('mx-amount'); if (el) el.focus(); return; }
    const e = { id: uid('e'), t: nowHM(), amount: Math.round(amt * 100) / 100, cat: S.ui.mx.cat || 'diger', why: S.ui.mx.why || null, note: draft('mxNote') };
    clearDraft('mxAmount'); clearDraft('mxNote'); S.ui.mx.why = null;
    mutDay(T(), (d) => { d.expenses = d.expenses || []; d.expenses.push(e); });
    const lim = (S.config.money.categories.find((c) => c.id === e.cat) || {}).limit;
    if (lim) { const sp = monthExpenses(T()).filter((x) => x.cat === e.cat).reduce((a, x) => a + x.amount, 0); if (sp > lim) toast('Kaydedildi. Bu kategoride aylık limit aşıldı.'); else if (sp >= lim * 0.8) toast('Kaydedildi. Limitin %' + Math.round(sp / lim * 100) + '’i doldu.'); else toast('Kaydedildi.'); } else toast('Kaydedildi.');
  },
  mxDel: (ds) => { if (confirm('Bu harcama silinsin mi?')) mutDay(T(), (d) => { d.expenses = (d.expenses || []).filter((x) => x.id !== ds.id); }); },
  mxAddCat: () => { const nm = draft('mxNewCat'); if (!nm) return; clearDraft('mxNewCat'); const id = uid('c'); S.ui.mx.cat = id; mutCfg((c) => { c.money.categories.push({ id, name: nm, icon: 'dot', color: 'stone', limit: 0 }); }); },
  mxGoalAdd: () => { const nm = draft('mxGoalName'); const tg = parseFloat(S.ui.drafts.mxGoalTarget || ''); if (!nm || !(tg > 0)) { toast('Hedefin adını ve tutarını yaz.'); return; } const dl = S.ui.drafts.mxGoalDate || ''; clearDraft('mxGoalName'); clearDraft('mxGoalTarget'); clearDraft('mxGoalDate'); mutCfg((c) => { c.money.savings.push({ id: uid('sv'), name: nm, target: tg, deadline: dl }); }); },
  mxGoalDel: (ds) => { if (confirm('Bu birikim hedefi ve kayıtları silinsin mi?')) mutCfg((c) => { c.money.savings = c.money.savings.filter((g) => g.id !== ds.id); c.money.savingsLog = c.money.savingsLog.filter((l) => l.goal !== ds.id); }); },
  mxSave: (ds) => { const key = 'mxSave_' + ds.id; const amt = parseFloat(String(S.ui.drafts[key] || '').replace(',', '.')); if (!(amt > 0)) { toast('Biriktirdiğin tutarı yaz.'); return; } clearDraft(key); mutCfg((c) => { c.money.savingsLog.push({ id: uid('sl'), goal: ds.id, amount: amt, date: T() }); }); toast('Birikim eklendi.'); },
  mxRecKind: (ds) => { S.ui.mxRecKind = ds.v; render(); },
  mxRecAdd: () => { const nm = draft('mxRecName'); const amt = parseFloat(S.ui.drafts.mxRecAmount || ''); if (!nm || !(amt > 0)) { toast('Ad ve tutar gir.'); return; } const day = parseInt(S.ui.drafts.mxRecDay || '', 10); const kind = S.ui.mxRecKind || 'fixed'; clearDraft('mxRecName'); clearDraft('mxRecAmount'); clearDraft('mxRecDay'); mutCfg((c) => { c.money.recurring.push({ id: uid('r'), kind, name: nm, amount: amt, day: day >= 1 && day <= 31 ? day : null }); }); },
  mxRecDel: (ds) => { if (confirm('Silinsin mi?')) mutCfg((c) => { c.money.recurring = c.money.recurring.filter((r) => r.id !== ds.id); }); },
  // ayarlar
  pilDay: (ds) => mutCfg((c) => { const v = +ds.v; const a = new Set(c.sportGoal.pilDays || []); if (a.has(v)) a.delete(v); else a.add(v); c.sportGoal.pilDays = [...a]; }),
  listDel: (ds) => { if (!confirm('Listeden kaldırılsın mı?')) return; mutCfg((c) => { c[ds.list] = c[ds.list].filter((x) => x.id !== ds.id); }); }
};
const CHG = {
  wake: (v) => mutDay(T(), (d) => { d.sleep.wake = v; }),
  bed: (v) => mutDay(T(), (d) => { d.sleep.bed = v; }),
  prevBed: (v) => mutDay(addDays(T(), -1), (d) => { d.sleep.bed = v; }),
  suppTime: (v, ds) => mutDay(T(), (d) => { if (v) d.supps[ds.id] = v; }),
  mealTime: (v, ds) => mutDay(T(), (d) => { const r = d.meals[ds.meal] || (d.meals[ds.meal] = {}); r.time = v; }),
  sportStartT: (v) => saveSport({ start: v }),
  sportEndT: (v) => saveSport({ end: v }),
  weight: (v) => { const n = parseFloat(String(v).replace(',', '.')); mutDay(T(), (d) => { if (n >= 20 && n <= 400) d.weight = Math.round(n * 10) / 10; else delete d.weight; }); },
  prof: (v, ds) => mutCfg((c) => { c.profile = c.profile || {}; const f = ds.field; c.profile[f] = f === 'height' ? (parseInt(v, 10) || null) : f === 'activity' ? parseFloat(v) : v; }),
  snackTime: (v, ds) => mutDay(T(), (d) => { const sn = (d.snacks || []).find((x) => x.id === ds.id); if (sn && v) sn.t = v; }),
  snackName: (v, ds) => mutDay(T(), (d) => { const sn = (d.snacks || []).find((x) => x.id === ds.id); if (sn) sn.name = v; }),
  mxLimit: (v, ds) => mutCfg((c) => { const cat = c.money.categories.find((x) => x.id === ds.id); if (cat) cat.limit = Math.max(0, parseInt(v, 10) || 0); }),
  pilTime: (v) => { if (v) mutCfg((c) => { c.sportGoal.pilTime = v; }); },
  cfgNum: (v, ds) => { const n = parseInt(v, 10); if (isNaN(n)) return; mutCfg((c) => { const parts = ds.path.split('.'); let o = c; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = Math.max(0, n); }); }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  const a = el ? el.dataset.act : '';
  // bir saatlik oturum dolduysa, ilk dokunuşta sessizce yenile
  if (S.user && !tokenOk() && tokenClient && a !== 'signin' && a !== 'reauth' && a !== 'signout' && Date.now() - lastAuthTry > 60000 && (S.dirty.size || !S.loadedRemote)) requestToken();
  if (!el || el.tagName === 'INPUT') { if (el && ACT[a]) ACT[a](el.dataset, el); return; }
  const fn = ACT[a]; if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('input', (e) => { const el = e.target; if (el.dataset && el.dataset.draft) S.ui.drafts[el.dataset.draft] = el.value; });
document.addEventListener('change', (e) => { const el = e.target; if (el.dataset && el.dataset.change && CHG[el.dataset.change]) CHG[el.dataset.change](el.value, el.dataset, el); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.draft || e.target.tagName === 'TEXTAREA') return;
  const map = { newDrink: 'addDrink', newSupp: 'addSupp', newAct: 'addAct', newMove: 'addMove', newArea: 'addArea', mxAmount: 'mxAdd', mxNote: 'mxAdd', mxNewCat: 'mxAddCat', todoText: 'todoAdd', careName: 'careAdd' };
  const a = map[e.target.dataset.draft]; if (a) { e.preventDefault(); ACT[a]({}); }
});
document.addEventListener('toggle', (e) => { const el = e.target; if (el.dataset && el.dataset.keep) S.ui.open[el.dataset.keep] = el.open; }, true);
// #kurulum?boy=163&dogum=1997-11-07&kilo=93&cinsiyet=k → profil bilgilerini kaydet (bilgiler sunucuya gitmez)
function applySetupLink() {
  const h = location.hash.slice(1);
  if (!h.startsWith('kurulum')) return false;
  if (!S.user) return false; // giriş yapınca tekrar denenir
  const q = new URLSearchParams(h.split('?')[1] || '');
  const boy = parseInt(q.get('boy'), 10); const kilo = parseFloat(String(q.get('kilo') || '').replace(',', '.')); const dogum = q.get('dogum'); const cins = q.get('cinsiyet');
  mutCfg((c) => { c.profile = c.profile || {}; if (boy >= 100 && boy <= 250) c.profile.height = boy; if (/^\d{4}-\d{2}-\d{2}$/.test(dogum || '')) c.profile.birth = dogum; if (cins === 'k' || cins === 'f') c.profile.sex = 'f'; if (cins === 'e' || cins === 'm') c.profile.sex = 'm'; });
  if (kilo >= 20 && kilo <= 400) mutDay(todayKey(), (d) => { d.weight = Math.round(kilo * 10) / 10; });
  // &lazer=Kol,Koltuk altı,Yüz &bakim=Manikür,Pedikür &yapilacak=Saçımı kestirmek;Saçımı boyatmak
  // "Ad:2" → haftada 2
  const addW = (list, group, icon) => (list || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((raw) => { const [nm0, n0] = raw.split(':'); const nm = nm0.trim(); const per = Math.max(1, parseInt(n0, 10) || 1); mutCfg((c) => { const ex = c.care.weekly.find((w) => w.name.toLowerCase() === nm.toLowerCase() && w.group === group); if (ex) ex.perWeek = per; else c.care.weekly.push({ id: uid('cw'), name: nm, group, perWeek: per, icon, color: 'pink' }); }); });
  addW(q.get('lazer'), 'Lazer', 'zap'); addW(q.get('bakim'), 'Kişisel bakım', 'hand'); addW(q.get('maske'), 'Maskeler', 'sparkle'); addW(q.get('vucut'), 'Vücut', 'repeat');
  (q.get('yapilacak') || '').split(';').map((x) => x.trim()).filter(Boolean).forEach((t) => mutCfg((c) => { if (!c.care.todos.some((x) => x.text.toLowerCase() === t.toLowerCase())) c.care.todos.push({ id: uid('td'), text: t, done: false, created: todayKey() }); }));
  if (q.get('lazer') || q.get('bakim') || q.get('maske') || q.get('vucut') || q.get('yapilacak')) { history.replaceState(null, '', location.pathname + '#area:bakim'); S.route = 'area:bakim'; render(); toast('Bakım listen hazır.'); return true; }
  history.replaceState(null, '', location.pathname + '#today'); S.route = 'today'; render();
  const b = bmrInfo(); toast(b.ready ? 'Bilgilerin kaydedildi. Bazal metabolizman: ' + fmtK(b.bmr) + ' kcal/gün' : 'Bilgilerin kaydedildi.');
  return true;
}
window.addEventListener('hashchange', () => { if (applySetupLink()) return; S.route = location.hash.slice(1) || 'home'; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user) { if (tokenOk()) loadRemote(); else render(); } });

/* ================= CSV ================= */
function exportCsv() {
  const c = S.config; const keys = Object.keys(S.days).sort();
  const head = ['tarih', 'mod_1_5', 'uyku_saat', 'yatis_onceki_gece', 'kalkis', 'su_bardak', 'su_saatleri', 'icecekler', 'kahve_sayisi', 'takviyeler', 'kahvalti', 'ogle', 'aksam', 'ara_ogun', 'spor_dk', 'spor_detay', 'tekrarlar', 'notlar', 'kilo', 'harcama_tl', 'harcamalar'];
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const mealStr = (r) => { if (!r) return ''; if (r.skip) return 'yemedim'; const m = NUTS.filter((n) => (r.marks || {})[n.k]).map((n) => n.short); return [r.time || '', m.join('+')].filter(Boolean).join(' '); };
  const rows = keys.map((k) => {
    const d = getDay(k); const s = stats(k) || {};
    return [k, s.mood != null ? fmt1(s.mood) : '', s.sleepH != null ? fmt1(s.sleepH) : '', getDay(addDays(k, -1)).sleep.bed || '', d.sleep.wake || '', d.water.length, d.water.join(' '),
      d.drinks.map((e) => ((c.drinks.find((x) => x.id === e.id) || {}).name || e.id) + (e.v ? ' ' + e.v : '') + ' ' + e.t).join(' | '), s.coffee ?? '',
      Object.entries(d.supps).map(([id, t]) => ((c.supps.find((x) => x.id === id) || {}).name || id) + ' ' + t).join(' | '),
      mealStr(d.meals.k), mealStr(d.meals.o), mealStr(d.meals.a), [d.meals.x ? mealStr(d.meals.x) : ''].concat((d.snacks || []).map((sn) => sn.t + ' ' + sn.name + (NUTS.filter((n) => (sn.marks || {})[n.k]).length ? ' ' + NUTS.filter((n) => (sn.marks || {})[n.k]).map((n) => n.short).join('+') : ''))).filter(Boolean).join(' | '),
      s.sportMin || 0, d.sport.map((l) => (l.name || l.act) + ' ' + (l.start || '') + '-' + (l.end || '') + ' ' + l.min + 'dk ' + INTENS[l.intensity ?? 1]).join(' | '),
      d.reps.map((r) => ((c.moves.find((x) => x.id === r.id) || {}).name || r.id) + ' ' + r.n + ' ' + r.t).join(' | '),
      d.notes.map((n) => n.t + ' ' + (n.mood != null ? MOODS[n.mood].label : '') + ' ' + (n.tags || []).join('/') + ' ' + (n.text || '')).join(' | '), d.weight != null ? String(d.weight).replace('.', ',') : '', daySpend(d) || '', (d.expenses || []).map((e) => e.t + ' ' + (((c.money || {}).categories || []).find((x) => x.id === e.cat) || {}).name + ' ' + e.amount + (e.why ? ' ' + e.why : '') + (e.note ? ' ' + e.note : '')).join(' | ')].map(cell).join(',');
  });
  const blob = new Blob(['﻿' + head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hedeflerim-' + todayKey() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= başlangıç ================= */
(function start() {
  try { const u = JSON.parse(localStorage.getItem('ht:lastUser') || 'null'); if (u && u.email) { S.user = u; loadLocal(); S.sync = 'needsAuth'; } } catch (e) { /* yok say */ }
  render();
  if (S.user) applySetupLink();
  initGis();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(() => { if (S.user && S.dirty.size && tokenOk()) sync(); }, 60000);
})();
