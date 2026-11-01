// Şifre karma ve oturum anahtarları (HMAC imzalı, 30 gün geçerli)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_DAYS = 30;

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Yerel geliştirme: data/secret dosyasında sakla ki yeniden başlatınca oturumlar düşmesin
  const f = path.join(__dirname, '..', 'data', 'secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { /* yok */ }
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); } catch { /* salt okunur disk */ }
  if (process.env.DATABASE_URL) console.warn('UYARI: SESSION_SECRET tanımlı değil; sunucu yeniden başlarsa herkesin oturumu kapanır.');
  return s;
}
const SECRET = loadSecret();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), want.length);
  return crypto.timingSafeEqual(want, got);
}

const b64 = (x) => Buffer.from(x).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
// Anahtar, kullanıcının kendine özel session_key değerini de taşır: tablo sıfırlansa ve
// numaralar yeniden başlasa bile eski bir anahtar başkasının hesabını açamaz.
function makeToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, k: user.session_key, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = sign(payload);
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const { uid, k, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() && uid && k ? { uid, k } : null;
  } catch { return null; }
}

// Kullanıcı adı: 3–16 karakter, harf (Türkçe dahil), rakam, alt çizgi
const NAME_RE = /^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ]{3,16}$/;
const normName = (n) => String(n || '').trim().toLocaleLowerCase('tr-TR');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@.]{2,24}$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const newSessionKey = () => crypto.randomBytes(16).toString('hex');
// Anahtarı doğrula ve kullanıcıyı getir (session_key eşleşmeli)
async function userFromToken(db, token) {
  const t = readToken(token);
  if (!t) return null;
  const u = await db.byId(t.uid);
  return u && u.session_key === t.k ? u : null;
}

// Basit IP başına deneme sınırı
const attempts = new Map();
function rateLimited(ip, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
  a.push(now);
  attempts.set(ip, a);
  return a.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of attempts) if (v.every((t) => now - t > 60_000)) attempts.delete(k); }, 60_000).unref();

module.exports = { hashPassword, verifyPassword, makeToken, readToken, userFromToken, NAME_RE, normName, EMAIL_RE, normEmail, newSessionKey, rateLimited };
