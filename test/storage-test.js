const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../server/db');
const { Game } = require('../server/game');
const { snapshot, restore } = require('../server/persistence');
const { digest } = require('../server/accounts');

async function check(url) {
  process.env.DATABASE_URL = url;
  process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baron-store-')), 'db.json');
  const db = createStore(); await db.init();
  await db.loadWorld();
  try {
    const suffix = require('crypto').randomBytes(8).toString('hex');
    const make = async (name) => (await db.create({ username: name + suffix, email: name + suffix + '@test.co', display: name, passHash: 'hash', sessionKey: 'key' })).user;
    const a = await make('ali'), b = await make('veli');
    const world = { version: 1, savedAt: Date.now(), rooms: [] };
    const op = { key: suffix + ':start', entries: [{ uid: a.id, chips: -250 }, { uid: b.id, chips: -250 }] };
    await db.commitWorld(world, [op]); await db.commitWorld(world, [op]);
    assert.equal((await db.byId(a.id)).chips, 750, 'aynı giriş ücreti iki kez düşülmez');
    await assert.rejects(db.commitWorld({ ...world, savedAt: 1 }, [{ key: suffix + ':bad', entries: [{ uid: a.id, chips: -100 }, { uid: b.id, chips: -99999 }] }]));
    assert.equal((await db.byId(a.id)).chips, 750, 'başarısız toplu işlem bütünüyle geri alınır');
    assert.notEqual((await db.loadWorld()).savedAt, 1, 'bakiye hatasında dünya kaydı da geri alınır');
    const finish = { key: suffix + ':finish', entries: [{ uid: a.id, chips: 500, games: 1, wins: 1 }, { uid: b.id, games: 1 }] };
    await db.commitWorld(world, [finish]); await db.commitWorld(world, [finish]);
    assert.equal((await db.byId(a.id)).chips, 1250); assert.equal((await db.byId(a.id)).wins, 1);
    await db.setReset(a.id, digest('one-use'), Date.now() + 10000);
    assert.ok(await db.consumeReset(digest('one-use'), Date.now(), 'new-hash', 'new-key'));
    assert.equal(await db.consumeReset(digest('one-use'), Date.now(), 'bad', 'bad'), null);
    assert.equal((await db.byId(a.id)).session_key, 'new-key');
    await db.setReset(a.id, digest('expired'), Date.now() - 1);
    assert.equal(await db.consumeReset(digest('expired'), Date.now(), 'bad', 'bad'), null);
    assert.equal(await db.changePassword(a.id, 'old-key', 'bad', 'bad'), null);
    await db.provisionAdmins([a.id]); assert.equal(!!(await db.byId(a.id)).is_admin, true);
    if (url) {
      const stale = createStore(); await stale.init(); await stale.loadWorld();
      await db.commitWorld(world);
      await assert.rejects(stale.commitWorld(world, [{ key: suffix + ':stale', entries: [{ uid: a.id, chips: 100 }] }]), { code: 'WORLD_STALE' });
      assert.equal((await db.byId(a.id)).chips, 1250, 'eski sunucunun işlemi ve kaydı geri alınır');
      await stale.close();
    }
    const game = new Game([{ id: 'a', name: 'Ali' }, { id: 'b', name: 'Veli' }]);
    const rooms = new Map([['ABCDE', { code: 'ABCDE', players: [], game }]]);
    const saved = JSON.parse(JSON.stringify(snapshot(rooms))), recovered = new Map();
    restore(recovered, saved);
    assert.ok(recovered.get('ABCDE').game instanceof Game);
    assert.deepEqual(recovered.get('ABCDE').game.decks, game.decks);
    assert.deepEqual(recovered.get('ABCDE').game.props, game.props);
    await db.deleteUser(a.id); await db.deleteUser(b.id);
    console.log(`${db.kind}: atomik çip, tekrar deneme, şifre ve maç kaydı testleri geçti`);
  } finally { await db.close(); }
}
(async () => { await check(''); if (process.env.PG_TEST_URL) await check(process.env.PG_TEST_URL); })().catch((e) => { console.error(e); process.exitCode = 1; });
