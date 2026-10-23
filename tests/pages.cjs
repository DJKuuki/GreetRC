const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium, expect} = require('@playwright/test');

const root = path.resolve(__dirname, '../dist');
const mount = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<base href="([^"]+)">/)[1];
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png'};
// Serve real exported files, with no local development server route fallback.
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (!url.pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice(mount.length - 1)));
  if (path.relative(root, file).startsWith('..')) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) { response.writeHead(301, {Location:url.pathname + '/' + url.search}).end(); return; }
    file = path.join(file, 'index.html');
  }
  let status = 200;
  if (!fs.existsSync(file)) { file = path.join(root, '404.html'); status = 404; }
  response.writeHead(status, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = origin + mount;
  let browser;
  try {
    browser = await chromium.launch({channel:'msedge', headless:true});
    const context = await browser.newContext({viewport:{width:1440, height:1050}});
    const errors = [], failures = [], external = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      external.push(url.href); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    const go = route => page.goto(base + route);

    await go('');
    await page.waitForFunction(() => window.fpvDiagnostics?.().ready, {}, {timeout:90000});
    assert.equal(await page.locator('.site-logo img').evaluate(image => image.naturalWidth > 0), true);
    await page.locator('#primary-nav').getByRole('link', {name:'讨论组', exact:true}).click();
    await expect(page.locator('#primary-nav [aria-current="page"]')).toHaveText('讨论组');
    await page.getByRole('textbox', {name:'搜索讨论'}).fill('不存在的标题xyz');
    await page.getByRole('button', {name:'搜索', exact:true}).click();
    await expect(page.locator('.empty')).toContainText('暂无匹配内容');
    assert.ok(new URL(page.url()).pathname.startsWith(mount));

    const links = new Set();
    for (const route of ['sitemap', 'discussion', 'square', 'vs', 'crash-heaven', 'resources/parts', 'downloads']) {
      await go(route);
      await page.locator('#site-main h1').first().waitFor();
      for (const href of await page.locator('a[href]').evaluateAll(items => items.map(item => item.href))) {
        const url = new URL(href);
        if (url.origin === origin) {
          assert.ok(url.pathname.startsWith(mount), 'Link escaped project directory: ' + href);
          links.add(href);
        }
      }
    }
    for (const href of links) {
      const response = await fetch(href);
      assert.equal(response.status, 200, 'Static route: ' + href);
      await response.arrayBuffer();
    }

    await go('assembly/beginner');
    await page.locator('#site-main h1').waitFor();
    await page.reload();
    assert.ok(!(await page.title()).includes('页面未找到'));
    const anchor = page.locator('#site-main a[href*="#"]').first();
    await expect(anchor).toBeVisible();
    const anchorURL = new URL(await anchor.getAttribute('href'), page.url());
    assert.equal(anchorURL.pathname, new URL(page.url()).pathname);

    await go('discussion/new?lang=en');
    await page.getByLabel('Title', {exact:true}).fill('Static hosting test');
    await page.getByLabel('Description', {exact:true}).fill('Browser-local content survives static hosting and reload.');
    await page.locator('[data-language-select]').selectOption('vi');
    await expect(page.getByLabel('Tiêu đề', {exact:true})).toHaveValue('Static hosting test');
    await page.locator('[data-language-select]').selectOption('en');
    await page.getByRole('button', {name:'Publish locally', exact:true}).click();
    await page.waitForURL(url => url.pathname === mount + 'site.html' && url.searchParams.get('route')?.startsWith('/discussion/local-'));
    await expect(page.locator('h1')).toHaveText('Static hosting test');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Static hosting test');
    await page.locator('[data-action="favorite"]').click();
    await go('favorites?lang=en');
    await page.getByRole('link', {name:'Static hosting test', exact:true}).click();
    await expect(page.locator('h1')).toHaveText('Static hosting test');

    await go('login?lang=en');
    await page.getByLabel('Account', {exact:true}).fill('Pages tester');
    await page.getByLabel('Demo password', {exact:true}).fill('not-stored');
    await page.getByRole('button', {name:'Enter local community', exact:true}).click();
    await page.waitForURL(url => url.pathname.replace(/\/$/, '') === mount + 'user-center');
    await expect(page.locator('.profile-hero')).toContainText('Pages tester');
    await page.getByLabel('Switch to dark mode').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.setViewportSize({width:390, height:844});
    await go('discussion?lang=vi');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', {name:'Mở trình đơn', exact:true}).click();
    await expect(page.locator('#primary-nav')).toBeVisible();

    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    assert.deepEqual(external, []);
    console.log(JSON.stringify({passed:true, staticLinks:links.size, mount,
      checks:['3D model and logo', 'project links and filters', 'static deep links and reload', 'browser-local publishing and favorites', 'login redirect', 'languages and theme', 'mobile navigation'], errors, failures, external}, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
