// Yalnızca test alt süreci; üretim sunucusuna test uç noktası eklenmez.
const { ready, server, rooms, runWorld } = require('../server/index');
ready.then(() => process.send({ port: server.address().port }));
process.on('message', async (message) => {
  try {
    if (message.type === 'checkpoint') await runWorld(() => {
      const g = [...rooms.values()][0].game;
      g.startsAt = 0; g.forceDice = [1, 2]; g.act(g.current().id, { type: 'roll' });
      if (g.phase === 'buy') g.act(g.current().id, { type: 'buy' });
      delete g.forceDice;
    });
    const g = [...rooms.values()][0]?.game;
    process.send({ reply: message.type, props: g?.props, decks: g?.decks, dice: g?.dice, rollId: g?.rollId });
  } catch (e) { process.send({ error: e.message }); }
});
