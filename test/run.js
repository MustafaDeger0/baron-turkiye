// Testler canlı DATABASE_URL'i hiçbir zaman kullanmaz.
const { spawnSync } = require('child_process');
const path = require('path');
const files = ['sim.js', 'bots-sim.js', 'bot-trade-test.js', 'storage-test.js', 'reliability-test.js', 'restart-test.js', 'socket-test.js', 'fuzz.js', 'play-test.js'];
const requested = process.argv.slice(2);
if (requested.some((file) => !files.includes(file))) throw new Error('Bilinmeyen test dosyası.');
for (const file of requested.length ? requested : files) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit', timeout: 300_000,
    env: { ...process.env, DATABASE_URL: '', SESSION_SECRET: 'isolated-test-secret', ADMIN_USER_IDS: '', DEBUG: '' },
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
