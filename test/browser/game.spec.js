const { test, expect } = require('@playwright/test');

async function login(page, request, quality = '2d') {
  const name = 'web' + Math.random().toString(36).slice(2, 11);
  const response = await request.post('/api/register', { data: { username: name, email: `${name}@test.co`, password: 'secret123' } });
  expect(response.ok()).toBeTruthy(); const account = await response.json();
  await page.addInitScript(({ token, quality }) => { localStorage.setItem('baron_token', JSON.stringify(token)); localStorage.setItem('baron_graphics', JSON.stringify(quality)); }, { token: account.token, quality });
  await page.goto('/'); await expect(page.locator('#home')).toBeVisible();
  return account;
}
async function bots(page) {
  await page.locator('#showBotsBtn').click();
  await page.locator('#botCountSeg button').first().click();
  await page.locator('#botsForm button[type=submit]').click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('.sq')).toHaveCount(40);
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 10000 });
}
test('2D tahta, tapu ve oyun kontrolleri kullanılabilir', async ({ page, request }, testInfo) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await login(page, request); await bots(page);
  await expect(page.locator('#game')).toHaveClass(/g2d/);
  await expect(page.locator('#gl3d')).toBeHidden();
  const deed = page.locator('.sq[data-idx="1"]'); await deed.click();
  await expect(page.locator('#modal')).toBeVisible(); await expect(page.locator('#modalBody')).toContainText('Sinop');
  await page.locator('[data-close]').click();
  await expect(page.locator('#actions button').first()).toBeVisible({ timeout: 25000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('2d-board.png'), animations: 'disabled', timeout: 15000 });
});
test('3D dosyası yüklenemeyince otomatik 2D tahtaya geçilir', async ({ page, request }) => {
  await page.route('**/3d/view.js', (route) => route.abort());
  await login(page, request, 'low'); await bots(page);
  await expect(page.locator('#game')).toHaveClass(/g2d/);
  await expect(page.locator('.board-dom')).toBeVisible();
  await page.locator('.sq[data-idx="1"]').click(); await expect(page.locator('#modalBody')).toContainText('Sinop');
});
test('grafik ayarı oyun içinden değiştirilir ve saklanır', async ({ page, request }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await login(page, request, 'low'); await bots(page);
  await expect(page.locator('#game')).not.toHaveClass(/g2d/, { timeout: 30000 });
  await page.locator('#tbMoreBtn').click(); await page.locator('#graphicsBtn').click();
  await page.locator('#gameQuality').selectOption('2d');
  await expect(page.locator('#game')).toHaveClass(/g2d/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('baron_graphics')))).toBe('2d');
  await page.locator('#tbMoreBtn').click(); await page.locator('#graphicsBtn').click();
  await page.locator('#gameQuality').selectOption('medium');
  await expect(page.locator('#game')).not.toHaveClass(/g2d/, { timeout: 30000 });
  expect(errors).toEqual([]);
});
test('şifre kurtarma ve değiştirme formları doğrulama yapar', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('#auth')).toBeVisible();
  await page.locator('#forgotPasswordBtn').click();
  await page.locator('#passwordForm input[name=email]').fill('unknown@test.co');
  await page.locator('#passwordForm button').click();
  await expect(page.locator('#passwordStatus')).toContainText('E-posta hizmeti');
  await page.locator('[data-close]').click();
  await login(page, request);
  await page.locator('[data-settings]:visible').first().click();
  await page.locator('#changePasswordBtn').click();
  await page.locator('input[name=current]').fill('secret123'); await page.locator('input[name=password]').fill('newsecret123'); await page.locator('input[name=confirm]').fill('different123');
  await page.locator('#passwordForm button').click(); await expect(page.locator('#passwordStatus')).toHaveText('Şifreler eşleşmiyor.');
});
