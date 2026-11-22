const { defineConfig } = require('@playwright/test');
const os = require('os'), path = require('path');
module.exports = defineConfig({
  testDir: './test/browser', workers: 1, timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:3199', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  projects: [{ name: 'desktop', use: { viewport: { width: 1366, height: 900 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'node server/index.js', url: 'http://127.0.0.1:3199/health', reuseExistingServer: false,
    env: { DATABASE_URL: '', DATA_FILE: path.join(os.tmpdir(), `baron-browser-${process.pid}-${Date.now()}.json`), SESSION_SECRET: 'browser-test-secret', PORT: '3199', DEBUG: '', ADMIN_USER_IDS: '', VOICE_ICE_SERVERS: '[]' } },
});
