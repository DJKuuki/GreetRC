const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const origin='http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[],external=[],failures=[],checked=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
    await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();external.push(u.href);return r.abort();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
    const go=async route=>{await page.goto(origin+route);await page.locator('#site-main h1, #site-main .empty strong').first().waitFor();};
    const screenshot=async name=>page.screenshot({path:path.join(__dirname,'../artifacts/community-'+name+'.png'),fullPage:true});
    await go('/sitemap');
    const routes=await page.locator('.sitemap-grid a').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')))]);
    for(const route of routes.filter(p=>p!=='/')){
      await go(route);assert.notEqual(await page.title(),'页面未找到 · GREET RC技术交流平台',route);
      assert.ok(await page.locator('h1').count(),route);checked.push(route);
    }
    console.log('Document routes checked:',checked.length);
    for(const route of ['/discussion','/square','/vs','/resources','/downloads','/crash-heaven','/login']){await go(route);await screenshot(route.slice(1));}
    await go('/discussion');
    await page.getByRole('link',{name:'新手入门',exact:true}).click();
    await expect(page.locator('.topic-tags .category').first()).toHaveText('新手入门');
    const tags=await page.locator('.topic-tags .category').allTextContents();assert.ok(tags.length>0&&tags.every(t=>t==='新手入门'));
    await go('/discussion');await page.getByRole('textbox',{name:'搜索讨论'}).fill('不存在的标题xyz');await page.getByRole('button',{name:'搜索',exact:true}).click();await expect(page.locator('.empty')).toContainText('暂无匹配内容');
    await go('/discussion');const title1=await page.locator('.topic-title').first().textContent();await page.getByRole('link',{name:'下一页',exact:true}).click();await expect(page.locator('.topic-title').first()).not.toHaveText(title1);
    await go('/discussion/new');
    await page.getByLabel('标题',{exact:true}).fill('本地发布测试 <b>标题</b>');
    await page.getByLabel('讨论分类').selectOption('装备改装');
    await page.getByLabel('正文说明',{exact:true}).fill('用于验证本地发布、回复和持久化。\n<script>window.badContent=true</script>');
    await page.locator('#image-upload').setInputFiles({name:'demo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64')});
    await expect(page.locator('#upload-preview img')).toBeVisible();
    await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.reload();
    await expect(page.getByLabel('标题',{exact:true})).toHaveValue('本地发布测试 <b>标题</b>');
    await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.locator('#editor-preview')).toContainText('<script>');
    await page.getByRole('button',{name:'发布到本地',exact:true}).click();await page.waitForURL('**/discussion/local-*');
    const postURL=page.url();await expect(page.locator('h1')).toHaveText('本地发布测试 <b>标题</b>');assert.equal(await page.evaluate(()=>window.badContent),undefined);
    await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();await expect(page.getByRole('button',{name:'★ 已收藏',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'♡ 点赞',exact:true}).click();
    await page.getByLabel('写下你的回复').fill('这一条回复应当在刷新后保留。');await page.getByRole('button',{name:'发布回复',exact:true}).click();
    await page.reload();await expect(page.locator('.reply')).toContainText('这一条回复应当在刷新后保留。');await screenshot('post-detail');
    await go('/favorites');await expect(page.locator('#site-main')).toContainText('本地发布测试');
    await go('/square/new');await page.getByLabel('标题',{exact:true}).fill('离线测试配置');await page.getByLabel('正文说明',{exact:true}).fill('本地整机配置发布测试。');await page.getByRole('button',{name:'发布到本地',exact:true}).click();await page.waitForURL('**/square/local-*');await expect(page.locator('.kv-table')).toContainText('1950');
    await go('/vs/new');await page.getByLabel('标题',{exact:true}).fill('两种配置本地对比');await page.getByLabel('正文说明',{exact:true}).fill('对比说明');await page.getByRole('button',{name:'发布到本地',exact:true}).click();await page.waitForURL('**/vs/local-*');
    await page.locator('[data-side="left"]').click();await page.reload();await expect(page.locator('[data-side="left"]')).toHaveText('✓ 已投票');
    await page.locator('[data-side="right"]').click();await expect(page.locator('[data-side="right"]')).toHaveText('✓ 已投票');await expect(page.locator('.vote-result').first()).toContainText('0 票');
    await go('/crash-heaven/new');await page.getByLabel('标题',{exact:true}).fill('本地维修记录');await page.getByLabel('事件经过与复盘',{exact:true}).fill('示例维修复盘。');await page.getByRole('button',{name:'发布到本地',exact:true}).click();await page.waitForURL('**/crash-heaven/local-*');
    await go('/login');await page.getByLabel('账号',{exact:true}).fill('离线测试员');await page.getByLabel('演示密码',{exact:true}).fill('do-not-store-password');await page.getByRole('button',{name:'进入本地社区'}).click();await page.waitForURL('**/user-center');await expect(page.locator('.profile-hero')).toContainText('离线测试员');
    assert.ok(!(await page.evaluate(()=>localStorage.getItem('fpv-community-v1'))).includes('do-not-store-password'));
    await go('/user-center?tab=settings');await page.locator('textarea[name="bio"]').fill('资料保存测试');await page.getByRole('button',{name:'保存资料'}).click();await page.reload();await expect(page.locator('textarea[name="bio"]')).toHaveValue('资料保存测试');
    await go('/downloads');const official=page.getByRole('link',{name:'官方下载 / 打开官网 ↗'}).first();assert.equal(await official.getAttribute('href'),'https://betaflight.com/download');assert.equal(await official.getAttribute('target'),'_blank');
    await go('/pid/visualization');const curve=await page.locator('#pid-chart polyline').getAttribute('points');await page.locator('#pid-p').fill('80');assert.notEqual(await page.locator('#pid-chart polyline').getAttribute('points'),curve);
    // Check every visible internal document link on a representative page of each type.
    const more=new Set();for(const route of ['/downloads','/downloads?category=电调工具','/resources/parts','/battery','/user-center','/vs/vs-1']){await go(route);for(const href of await page.locator('a[href^="/"]').evaluateAll(a=>a.map(x=>x.getAttribute('href'))))if(href!=='/'&&!checked.includes(href))more.add(href);}
    for(const route of more){await go(route);assert.notEqual(await page.title(),'页面未找到 · GREET RC技术交流平台',route);checked.push(route);}
    await page.setViewportSize({width:390,height:844});
    for(const route of ['/discussion','/square','/vs/vs-1','/discussion/new','/resources','/downloads','/user-center']){await go(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`mobile overflow ${route}`);}
    await go('/discussion');await screenshot('mobile-discussion');await page.getByRole('button',{name:'展开导航'}).click();await expect(page.locator('#primary-nav')).toBeVisible();await page.locator('#primary-nav').getByRole('link',{name:'广场',exact:true}).click();await expect(page.locator('h1')).toContainText('配置');await screenshot('mobile-square');
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    const report={passed:true,checkedRoutes:checked.length,routes:checked,externalRequests:external,pageErrors:errors,failedResources:failures,checks:['direct page routes and reload','category filter','search empty state','pagination','draft restoration','image attachment','publish post','escape user content','replies persist','favorites persist','build creation','VS creation and one-vote switching','crash creation','demo identity without password persistence','profile settings','official download links','interactive PID demo','mobile layout and navigation'],postURL};
    fs.writeFileSync(path.join(__dirname,'../artifacts/community-test-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
