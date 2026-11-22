const { test, expect } = require('@playwright/test');

async function account(request) {
  const username = 'ui' + Math.random().toString(36).slice(2, 11);
  const response = await request.post('/api/register', { data: { username, email: `${username}@test.co`, password: 'secret123' } });
  expect(response.ok()).toBeTruthy(); return response.json();
}
async function enter(page, user) {
  await page.addInitScript((token) => { localStorage.setItem('baron_token', JSON.stringify(token)); localStorage.setItem('baron_graphics', '"2d"'); }, user.token);
  await page.goto('/'); await expect(page.locator('#home')).toBeVisible();
}
test('masaüstü ana ekranı küçülmeden ve kaydırma olmadan sığar', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop');
  const user = await account(request); await enter(page, user);
  for (const [width, height] of [[1920, 900], [1366, 768], [1280, 600], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('#home2')).toHaveCSS('transform', 'none');
    const dimensions = await page.evaluate(() => {
      const main = document.querySelector('#showCreateBtn').getBoundingClientRect();
      const rooms = document.querySelector('.rooms-card').getBoundingClientRect();
      const footer = document.querySelector('.foot.legal').getBoundingClientRect();
      return { scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
        font: parseFloat(getComputedStyle(document.querySelector('.m-t')).fontSize), mainRight: main.right, roomBottom: rooms.bottom, footerBottom: footer.bottom };
    });
    expect(dimensions.scroll, `${width}×${height} sayfa taşmamalı`).toBe(false);
    expect(dimensions.font).toBeGreaterThanOrEqual(20);
    expect(dimensions.mainRight).toBeLessThanOrEqual(width);
    expect(dimensions.roomBottom).toBeLessThanOrEqual(height);
    expect(dimensions.footerBottom).toBeLessThanOrEqual(height);
    await page.screenshot({ path: info.outputPath(`home-${width}-${height}.png`), animations: 'disabled', timeout: 15000 });
  }
  await page.locator('[data-settings]:visible').first().click();
  await expect(page.locator('#accountId')).toHaveText(String(user.user.id));
  await expect(page.locator('#changePasswordBtn')).toBeVisible();
  await page.locator('[data-close]').click();
  await page.goto('/admin.html');
  await expect(page.locator('#gateMsg')).toContainText(`Hesap kimliğin: ${user.user.id}`);
});

test('özel odada iki oyuncu ses bağlar, susturur ve ayrılır', async ({ browser, page, request }, info) => {
  const host = await account(request), guest = await account(request);
  const otherContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 800 } });
  const other = await otherContext.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); other.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await acquire(...args); window.__testVoiceTracks = stream.getTracks(); return stream; };
  });
  try {
    await enter(page, host); await enter(other, guest);
    await expect(page.locator('#voiceBar')).toBeHidden();
    await page.locator('#showCreateBtn').click();
    await page.locator('#maxPlayersSel').selectOption('2');
    await page.locator('#createForm button[type=submit]').click();
    await expect(page.locator('#lobby')).toBeVisible();
    const code = await page.locator('#lobbyCode').innerText();
    await other.locator('#codeInput').fill(code); await other.locator('#joinBtn').click();
    await expect(other.locator('#lobby')).toBeVisible();
    await expect(page.locator('#voiceBar')).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('#voiceAudio audio')).toHaveCount(0);
    expect(await page.evaluate(() => window.__testVoiceTracks === undefined)).toBe(true);
    await page.locator('#voiceJoin').click(); await other.locator('#voiceJoin').click();
    await expect(page.locator('#voiceBar')).toHaveAttribute('data-state', 'joined');
    await expect(other.locator('#voiceBar')).toHaveAttribute('data-state', 'joined');
    await expect(page.locator('#voiceAudio audio')).toHaveAttribute('data-connection', 'connected', { timeout: 30000 });
    await expect(other.locator('#voiceAudio audio')).toHaveAttribute('data-connection', 'connected', { timeout: 30000 });
    expect(await page.locator('#voiceAudio audio').evaluate((el) => el.srcObject?.getAudioTracks().length)).toBe(1);
    await page.locator('#voiceMute').click(); await expect(page.locator('#voiceMute')).toHaveAttribute('aria-pressed', 'true');
    await expect(other.locator('#voicePeers')).toContainText('mikrofon kapalı');
    await page.locator('#startBtn').click(); await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#voiceBar')).toHaveAttribute('data-state', 'joined');
    await page.locator('#voiceLeave').click();
    await expect(page.locator('#voiceBar')).toHaveAttribute('data-state', 'idle');
    await expect(other.locator('#voiceAudio audio')).toHaveCount(0);
    await expect(page.locator('#voiceAudio audio')).toHaveCount(0);
    expect(await page.evaluate(() => window.__testVoiceTracks.every((track) => track.readyState === 'ended'))).toBe(true);
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await page.locator('#voiceJoin').click();
    await expect(page.locator('#toasts')).toContainText('Mikrofon izni verilmedi');
    await expect(page.locator('#voiceBar')).toHaveAttribute('data-state', 'idle');
    expect(errors).toEqual([]);
  } finally { await otherContext.close(); }
});
