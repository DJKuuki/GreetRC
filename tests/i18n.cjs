const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();external.push(u.href);return r.abort();});
  const language=async value=>{await page.locator('[data-language-select]').selectOption(value);await expect(page.locator('html')).toHaveAttribute('lang',value==='zh'?'zh-CN':value);};
  await page.goto(origin+'/discussion/new?lang=en');
  await page.getByLabel('Title',{exact:true}).fill('讨论组');
  await page.getByLabel('Description',{exact:true}).fill('教程和机架是我的原文，不应该被翻译。');
  await page.locator('select[name="category"]').selectOption('装备改装');
  await language('vi');
  await expect(page.getByLabel('Tiêu đề',{exact:true})).toHaveValue('讨论组');
  await expect(page.getByLabel('Nội dung',{exact:true})).toHaveValue('教程和机架是我的原文，不应该被翻译。');
  assert.equal(await page.locator('select[name="category"]').inputValue(),'装备改装');
  await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('Đã lưu nháp');
  await page.reload();await expect(page.getByLabel('Tiêu đề',{exact:true})).toHaveValue('讨论组');
  await page.getByRole('button',{name:'Đăng cục bộ',exact:true}).click();await page.waitForURL('**/discussion/local-*');
  await expect(page.locator('h1')).toHaveText('讨论组');await language('en');
  await expect(page.locator('h1')).toHaveText('讨论组');
  await expect(page.locator('.article-body')).toContainText('教程和机架是我的原文，不应该被翻译。');
  await page.getByRole('button',{name:'☆ Save',exact:true}).click();await expect(page.getByRole('button',{name:'★ Saved',exact:true})).toBeVisible();
  await page.getByLabel('Write a reply').fill('机架');await page.getByRole('button',{name:'Post reply',exact:true}).click();await expect(page.locator('.reply p')).toHaveText('机架');
  await language('zh');await expect(page.getByRole('button',{name:'★ 已收藏',exact:true})).toBeVisible();
  await language('en');await page.goto(origin+'/discussion?category='+encodeURIComponent('装备改装'));
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  assert.ok((await page.locator('.category').allTextContents()).every(s=>s==='Modifications'));
  await page.goto(origin+'/discussion?lang=en&q=simulator');await expect(page.locator('.topic-title')).toContainText('simulator');
  await page.goto(origin+'/?lang=vi');await page.waitForFunction(()=>window.fpvDiagnostics?.().ready);
  for(const button of await page.locator('#parts button').all()){
   await button.click();assert.ok(!/[\u3400-\u9fff]/.test(await page.locator('#part-description').textContent()));
  }
  await page.getByLabel('Đóng thông tin bộ phận').click();
  await page.getByRole('button',{name:'↗ Tháo rời mô hình',exact:true}).click();
  await page.waitForFunction(()=>fpvDiagnostics().expanded&&!fpvDiagnostics().animating);
  await language('en');await expect(page.getByRole('button',{name:'↙ Assemble model',exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>fpvDiagnostics().expanded),true);
  await page.getByRole('button',{name:'↙ Assemble model',exact:true}).click();await page.waitForFunction(()=>!fpvDiagnostics().animating);
  await page.locator('#model-next').click();await page.waitForFunction(()=>!fpvDiagnostics().animating);await page.locator('#model-next').click();await page.waitForFunction(()=>window.fpvDiagnostics?.().ready&&fpvDiagnostics().parts.length===1);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.screenshot({path:'artifacts/greet-rc-home-en.png',fullPage:true});
  await language('vi');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.waitForFunction(()=>!fpvDiagnostics().animating);
  await page.screenshot({path:'artifacts/greet-rc-home-vi-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByLabel('Mở trình đơn').click();await page.locator('#primary-nav').getByRole('link',{name:'Diễn đàn',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Diễn đàn');
  await page.screenshot({path:'artifacts/greet-rc-forum-vi-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'artifacts/greet-rc-forum-vi.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: trilingual UI, retained drafts and user text, stable categories, localized search/actions, persistent language, 3D state, mobile layout and offline loading.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
