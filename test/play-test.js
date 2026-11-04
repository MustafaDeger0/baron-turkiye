// Google Play gereksinimleri: hesap silme, sohbet süzgeci, şikayet, susturma, assetlinks
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');
const PORT = 3177, URL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/baron-play-');
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok' : 'HATA'} - ${m}`); if (!c) fails++; };
const post = (p, body, tok) => fetch(URL + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
const get = (p, tok) => fetch(URL + p, { headers: tok ? { authorization: `Bearer ${tok}` } : {} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const conn = (tok) => new Promise((res) => { const s = io(URL, { auth: { token: tok }, transports: ['websocket'] }); s.on('connect', () => res(s)); });
const emit = (s, ev, d) => new Promise((res) => s.emit(ev, d, res));

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT, DATABASE_URL: process.env.PG_TEST_URL || '', DATA_FILE: path.join(dataDir, 'db.json'), ADMIN_USERS: 'yonetici', ANDROID_SHA256: 'AA:BB', CONTACT_EMAIL: 'destek@ornek.com' }, stdio: 'ignore' });
  for (let k = 0; k < 120; k++) { try { await fetch(URL + '/health'); break; } catch { await sleep(250); } }
  try {
    const reg = (n) => post('/api/register', { username: n, email: `${n}@x.co`, password: 'secret123' });
    const A = await reg('yonetici'), B = await reg('ahmet'), C = await reg('zeynep');
    ok(A.token && B.token && C.token, 'hesaplar açıldı');
    const al = await get('/.well-known/assetlinks.json');
    ok(al.body[0] && al.body[0].target.sha256_cert_fingerprints[0] === 'AA:BB' && al.body[0].target.package_name === 'com.baronturkiye.oyun', 'assetlinks.json doğru');
    const si = await get('/api/site-info'); ok(si.body.contact === 'destek@ornek.com', 'iletişim adresi');
    for (const pg of ['/gizlilik.html', '/kosullar.html', '/hesap-sil.html']) ok((await fetch(URL + pg)).status === 200, `${pg} açılıyor`);

    // sohbet: süzgeç, şikayet
    const sb = await conn(B.token), sc = await conn(C.token);
    const room = await emit(sb, 'room:create', { roomName: 'Test', isPublic: false, maxPlayers: 4, stake: 0 });
    await emit(sc, 'room:join', { code: room.code });
    let last = null; sc.on('room:state', (st) => { last = st; });
    sb.emit('chat', 'merhaba amk naber');
    await sleep(300);
    const m = last.chat.filter((x) => x.from).pop();
    ok(m && !/amk/i.test(m.text) && /merhaba/.test(m.text) && m.fromPid, `küfür süzüldü: "${m && m.text}"`);
    sb.emit('chat', 'götürürüm sıkıntı yok'); await sleep(300);
    ok(/götürürüm sıkıntı/.test(last.chat.filter((x) => x.from).pop().text), 'masum kelimeler bozulmadı');
    const rep = await emit(sc, 'chat:report', { pid: m.fromPid, reason: 'Küfür / hakaret' });
    ok(rep && rep.ok, 'şikayet gönderildi');
    const self = await emit(sb, 'chat:report', { pid: m.fromPid, reason: 'x' });
    ok(self && self.error, 'kendini şikayet edemez');
    const reps = await get('/api/admin/reports', A.token);
    ok(reps.body.reports.length === 1 && /merhaba/.test(reps.body.reports[0].messages), 'yönetici şikayeti ve mesajları görüyor');
    ok((await get('/api/admin/reports', B.token)).status === 403, 'normal oyuncu şikayetleri göremez');
    // susturma
    const bId = reps.body.reports[0].targetId;
    await post('/api/admin/mute', { id: bId, muted: true }, A.token);
    const mres = await emit(sb, 'chat', 'deneme');
    ok(mres && mres.error, 'susturulan oyuncu yazamıyor');
    await post('/api/admin/mute', { id: bId, muted: false }, A.token);

    // hesap silme
    ok((await post('/api/account/delete', { password: 'yanlis' }, C.token)).status === 401, 'yanlış şifreyle silinmiyor');
    let disc = false; sc.on('disconnect', () => { disc = true; });
    ok((await post('/api/account/delete', { password: 'secret123' }, C.token)).ok, 'oyun içinden hesap silindi');
    await sleep(300);
    ok(disc, 'silinen hesabın bağlantısı kesildi');
    ok((await get('/api/me', C.token)).status === 401, 'silinen hesabın oturumu geçersiz');
    ok((await post('/api/login', { login: 'zeynep', password: 'secret123' })).status === 401, 'silinen hesapla giriş yapılamıyor');
    ok((await post('/api/account/delete', { login: 'ahmet@x.co', password: 'secret123' })).ok, 'web sayfasından (e-posta + şifre) hesap silindi');
    const r2 = await reg('zeynep'); ok(!!r2.token, 'silinen kullanıcı adı yeniden alınabiliyor');
    sb.close(); sc.close();
  } catch (e) { console.error(e); fails++; }
  srv.kill();
  console.log(fails ? `PLAY TESTİ: ${fails} hata` : 'PLAY TESTİ GEÇTİ');
  process.exit(fails ? 1 : 0);
})();
