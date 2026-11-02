// Hesap deposu. DATABASE_URL tanımlıysa PostgreSQL, değilse yerel JSON dosyası kullanılır.
const fs = require('fs');
const path = require('path');

const START_CHIPS = 1000;
const DAILY_REWARDS = [100, 150, 200, 250, 300, 400, 500]; // 1.–7. gün (7+ gün: 500)

// Türkiye saatine göre gün (YYYY-MM-DD)
const dayStr = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
const dailyReward = (streak) => DAILY_REWARDS[Math.min(streak, DAILY_REWARDS.length) - 1];

function publicUser(u) {
  if (!u) return null;
  const today = dayStr();
  const yesterday = dayStr(Date.now() - 864e5);
  const nextStreak = u.last_daily === yesterday ? u.streak + 1 : 1;
  return {
    id: u.id, name: u.display, email: u.email || null, chips: u.chips, games: u.games, wins: u.wins,
    streak: u.last_daily === today || u.last_daily === yesterday ? u.streak : 0,
    dailyAvailable: u.last_daily !== today,
    nextDaily: dailyReward(u.last_daily === today ? u.streak + 1 : nextStreak),
    dailyRewards: DAILY_REWARDS,
  };
}

// ---------------- PostgreSQL ----------------
function pgStore(url) {
  const { Pool } = require('pg');
  // Bağlantı adresindeki sslmode / channel_binding gibi parametreleri temizle; SSL'i kendimiz ayarlayalım
  let u;
  try { u = new URL(url); } catch { throw new Error('DATABASE_URL geçerli bir adres değil. "postgresql://" ile başlamalı.'); }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error(`DATABASE_URL "postgresql://" ile başlamalı (şu an: ${u.protocol}).`);
  ['sslmode', 'channel_binding', 'sslrootcert'].forEach((k) => u.searchParams.delete(k));
  const host = u.hostname;
  const internal = host === 'localhost' || host === '127.0.0.1' || !host.includes('.'); // Render iç adresi: dpg-xxxx-a
  const ssl = internal || process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false };
  // Neon gibi servisler boşta kalınca uyur ve açık bağlantıları kapatır:
  // boştaki bağlantıları erken bırak, kopan bağlantı sunucuyu çökertmesin.
  const pool = new Pool({ connectionString: u.toString(), ssl, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
  pool.on('error', (e) => console.warn('Veritabanı bağlantısı koptu (otomatik yeniden bağlanılacak):', e.message));
  const one = async (q, args) => (await pool.query(q, args)).rows[0] || null;
  return {
    kind: 'postgres',
    where: maskDbUrl(u.toString()),
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display TEXT NOT NULL,
        pass_hash TEXT NOT NULL,
        chips INTEGER NOT NULL DEFAULT ${START_CHIPS},
        games INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        last_daily TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // eski tablolar için sütun ekle (göç)
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS session_key TEXT');
      await pool.query("UPDATE users SET session_key = md5(random()::text || id::text) WHERE session_key IS NULL");
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (email)');
      await pool.query('CREATE INDEX IF NOT EXISTS users_chips_idx ON users (chips DESC)');
    },
    async create({ username, email, display, passHash, sessionKey }) {
      try {
        return { user: await one('INSERT INTO users (username, email, display, pass_hash, session_key) VALUES ($1, $2, $3, $4, $5) RETURNING *', [username, email, display, passHash, sessionKey]) };
      } catch (e) {
        if (e.code === '23505') return { conflict: /email/.test(e.constraint || e.detail || '') ? 'email' : 'username' };
        throw e;
      }
    },
    byName: (username) => one('SELECT * FROM users WHERE username = $1', [username]),
    byEmail: (email) => one('SELECT * FROM users WHERE email = $1', [email]),
    byId: (id) => one('SELECT * FROM users WHERE id = $1', [id]),
    debit: (id, amt) => one('UPDATE users SET chips = chips - $2 WHERE id = $1 AND chips >= $2 RETURNING *', [id, amt]),
    credit: (id, amt) => one('UPDATE users SET chips = chips + $2 WHERE id = $1 RETURNING *', [id, amt]),
    addStats: (id, games, wins) => one('UPDATE users SET games = games + $2, wins = wins + $3 WHERE id = $1 RETURNING *', [id, games, wins]),
    async claimDaily(id) {
      const today = dayStr(), yesterday = dayStr(Date.now() - 864e5);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const u = (await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!u || u.last_daily === today) { await client.query('ROLLBACK'); return { user: u, reward: 0 }; }
        const streak = u.last_daily === yesterday ? u.streak + 1 : 1;
        const reward = dailyReward(streak);
        const nu = (await client.query('UPDATE users SET chips = chips + $2, streak = $3, last_daily = $4 WHERE id = $1 RETURNING *', [id, reward, streak, today])).rows[0];
        await client.query('COMMIT');
        return { user: nu, reward };
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    },
    top: async (n) => (await pool.query('SELECT * FROM users ORDER BY chips DESC, wins DESC LIMIT $1', [n])).rows,
    // ---- yönetici ----
    adjust: (id, delta) => one('UPDATE users SET chips = GREATEST(0, chips + $2) WHERE id = $1 RETURNING *', [id, delta]),
    setChips: (id, n) => one('UPDATE users SET chips = $2 WHERE id = $1 RETURNING *', [id, Math.max(0, n)]),
    adjustAll: async (delta) => (await pool.query('UPDATE users SET chips = GREATEST(0, chips + $1) RETURNING *', [delta])).rows,
    async search(q, limit = 50, offset = 0) {
      const like = `%${String(q || '').toLowerCase()}%`;
      const rows = (await pool.query('SELECT * FROM users WHERE username LIKE $1 OR lower(coalesce(email, \'\')) LIKE $1 OR lower(display) LIKE $1 ORDER BY id LIMIT $2 OFFSET $3', [like, limit, offset])).rows;
      const total = +(await pool.query('SELECT count(*) FROM users WHERE username LIKE $1 OR lower(coalesce(email, \'\')) LIKE $1 OR lower(display) LIKE $1', [like])).rows[0].count;
      return { rows, total };
    },
    close: () => pool.end(),
  };
}

// ---------------- JSON dosyası (geliştirme / tek sunucu) ----------------
function jsonStore(file) {
  let data = { seq: 0, users: {} };
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
    }, 200);
  };
  const find = (pred) => Object.values(data.users).find(pred) || null;
  const upd = (id, fn) => { const u = data.users[id]; if (!u) return null; fn(u); save(); return { ...u }; };
  return {
    kind: 'json',
    async init() {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
    },
    async create({ username, email, display, passHash, sessionKey }) {
      if (find((u) => u.username === username)) return { conflict: 'username' };
      if (email && find((u) => u.email === email)) return { conflict: 'email' };
      const u = { id: ++data.seq, username, email, display, pass_hash: passHash, session_key: sessionKey, chips: START_CHIPS, games: 0, wins: 0, streak: 0, last_daily: null, created_at: new Date().toISOString() };
      data.users[u.id] = u; save();
      return { user: { ...u } };
    },
    byName: async (username) => { const u = find((x) => x.username === username); return u && { ...u }; },
    byEmail: async (email) => { const u = find((x) => x.email === email); return u && { ...u }; },
    byId: async (id) => (data.users[id] ? { ...data.users[id] } : null),
    debit: async (id, amt) => (data.users[id] && data.users[id].chips >= amt ? upd(id, (u) => { u.chips -= amt; }) : null),
    credit: async (id, amt) => upd(id, (u) => { u.chips += amt; }),
    addStats: async (id, games, wins) => upd(id, (u) => { u.games += games; u.wins += wins; }),
    async claimDaily(id) {
      const u = data.users[id];
      const today = dayStr(), yesterday = dayStr(Date.now() - 864e5);
      if (!u || u.last_daily === today) return { user: u && { ...u }, reward: 0 };
      const streak = u.last_daily === yesterday ? u.streak + 1 : 1;
      const reward = dailyReward(streak);
      return { user: upd(id, (x) => { x.chips += reward; x.streak = streak; x.last_daily = today; }), reward };
    },
    top: async (n) => Object.values(data.users).sort((a, b) => b.chips - a.chips || b.wins - a.wins).slice(0, n).map((u) => ({ ...u })),
    adjust: async (id, delta) => upd(id, (u) => { u.chips = Math.max(0, u.chips + delta); }),
    setChips: async (id, n) => upd(id, (u) => { u.chips = Math.max(0, n); }),
    adjustAll: async (delta) => Object.keys(data.users).map((id) => upd(id, (u) => { u.chips = Math.max(0, u.chips + delta); })),
    async search(q, limit = 50, offset = 0) {
      const s = String(q || '').toLowerCase();
      const all = Object.values(data.users).filter((u) => !s || u.username.includes(s) || (u.email || '').toLowerCase().includes(s) || u.display.toLowerCase().includes(s)).sort((a, b) => a.id - b.id);
      return { rows: all.slice(offset, offset + limit).map((u) => ({ ...u })), total: all.length };
    },
    close: async () => {},
  };
}

// Panelden yapıştırılan adresi temizle: boşluk, tırnak, baştaki "psql" gibi fazlalıklar
function cleanDbUrl(raw) {
  let u = String(raw || '').trim();
  u = u.replace(/^psql\s+/i, '').trim();
  u = u.replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  u = u.replace(/^['"]+|['"]+$/g, '').trim();
  if (u.startsWith('postgres://')) u = `postgresql://${u.slice('postgres://'.length)}`;
  return u;
}
// Günlüklerde şifreyi göstermeden adres özeti
function maskDbUrl(u) {
  try { const x = new URL(u); return `${x.protocol}//${x.username}:***@${x.host}${x.pathname}`; } catch { return '(okunamadı)'; }
}

function createStore() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return pgStore(cleanDbUrl(process.env.DATABASE_URL));
  return jsonStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'));
}

module.exports = { createStore, cleanDbUrl, maskDbUrl, publicUser, dayStr, dailyReward, START_CHIPS, DAILY_REWARDS };
