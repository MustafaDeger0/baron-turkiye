const crypto = require('crypto');
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
const validPassword = (pw) => typeof pw === 'string' && pw.length >= 6 && pw.length <= 100;

function installAccountRoutes({ app, db, auth, wrap, userFromReq, ipOf, io, runWorld }) {
  const disconnect = (id) => { io.to(`u:${id}`).emit('session:revoked'); io.in(`u:${id}`).disconnectSockets(true); };
  app.post('/api/logout', wrap(async (req, res) => {
    const u = await userFromReq(req);
    if (!u) return res.status(401).json({ error: 'Oturum geçersiz.' });
    await runWorld(async () => { await db().rotateSession(u.id, auth.newSessionKey()); disconnect(u.id); });
    res.json({ ok: true });
  }));
  app.post('/api/password/change', wrap(async (req, res) => {
    if (auth.rateLimited(`password:${ipOf(req)}`, 8)) return res.status(429).json({ error: 'Biraz bekleyip tekrar dene.' });
    const u = await userFromReq(req), { password, newPassword } = req.body || {};
    if (!u || !await auth.verifyPasswordAsync(password, u.pass_hash)) return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    if (!validPassword(newPassword)) return res.status(400).json({ error: 'Yeni şifre 6–100 karakter olmalı.' });
    const hash = await auth.hashPasswordAsync(newPassword);
    const changed = await runWorld(async () => {
      const result = await db().changePassword(u.id, u.session_key, hash, auth.newSessionKey());
      if (result) disconnect(u.id);
      return result;
    });
    if (!changed) return res.status(409).json({ error: 'Oturum değişti. Tekrar giriş yap.' });
    res.json({ ok: true });
  }));
  app.post('/api/password/forgot', wrap(async (req, res) => {
    if (auth.rateLimited(`reset:${ipOf(req)}`, 4, 15 * 60_000)) return res.status(429).json({ error: 'Çok fazla istek. Daha sonra tekrar dene.' });
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.PUBLIC_URL) return res.status(503).json({ error: 'E-posta hizmeti henüz etkin değil. Destek ile iletişime geç.' });
    const email = auth.normEmail(req.body?.email);
    if (!auth.EMAIL_RE.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
    const u = await db().byEmail(email);
    if (u) {
      const raw = crypto.randomBytes(32).toString('hex');
      await db().setReset(u.id, digest(raw), Date.now() + 30 * 60_000);
      const link = new URL('/', process.env.PUBLIC_URL);
      if (link.protocol !== 'https:' && link.hostname !== 'localhost') throw new Error('PUBLIC_URL HTTPS olmalı.');
      link.hash = `reset=${raw}`;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [u.email], subject: 'Baron Türkiye — Şifreni yenile',
          text: `Şifreni yenilemek için: ${link.href}\nBağlantı 30 dakika geçerlidir ve bir kez kullanılabilir. Bu isteği sen yapmadıysan mesajı yok sayabilirsin.` }),
      });
      if (!response.ok) return res.status(503).json({ error: 'E-posta gönderilemedi. Daha sonra tekrar dene.' });
    }
    res.json({ ok: true, message: 'Bu adresle bir hesap varsa şifre yenileme bağlantısı gönderildi.' });
  }));
  app.post('/api/password/reset', wrap(async (req, res) => {
    if (auth.rateLimited(`reset-use:${ipOf(req)}`, 8)) return res.status(429).json({ error: 'Biraz bekleyip tekrar dene.' });
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) return res.status(400).json({ error: 'Geçersiz bağlantı veya şifre (6–100 karakter).' });
    const hash = await auth.hashPasswordAsync(password);
    const u = await runWorld(async () => {
      const changed = await db().consumeReset(digest(token), Date.now(), hash, auth.newSessionKey());
      if (changed) disconnect(changed.id);
      return changed;
    });
    if (!u) return res.status(400).json({ error: 'Bağlantı kullanılmış veya süresi dolmuş. Yeni bağlantı iste.' });
    res.json({ ok: true });
  }));
}
module.exports = { installAccountRoutes, digest, validPassword };
