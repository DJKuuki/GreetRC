import {languageControl} from './i18n.js?v=13c01ea2fe43';
import {routePath, siteHTML} from './paths.js?v=13c01ea2fe43';
export const nav = [['/','首页'],['/app','App 下载'],['/square','广场'],['/vs','VS 对比'],['/crash-heaven','炸机记录'],['/discussion','讨论组'],['/resources','教程'],['/downloads','下载与资源']];
export function escapeHTML(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function shell(){
  const pathname=routePath();
  let nickname='';try{nickname=JSON.parse(localStorage.getItem('fpv-community-v1')||'{}').profile?.name||'';}catch{}
  const header=document.getElementById('site-header')||document.querySelector('header');
  header.className='site-header';header.innerHTML=siteHTML(`<a class="site-logo" href="/" aria-label="GREET RC技术交流平台"><img class="brand-image" src="/assets/logo.jpg" alt="" width="44" height="44"><span class="logo-copy"><strong>GREET RC</strong><small>技术交流平台</small></span></a><nav id="primary-nav" aria-label="主导航">${nav.map(([url,title])=>`<a href="${url}" ${pathname===url||(url!=='/'&&pathname.startsWith(url+'/'))?'aria-current="page"':''}>${title}</a>`).join('')}<details class="nav-tools"><summary>工具 ▾</summary><div><a href="/pid/visualization">PID 可视化</a><a href="/changelog">更新日志</a><a href="/sitemap">全部离线页面</a></div></details></nav><span class="site-offline">离线演示</span>${languageControl()}<button class="theme-toggle" data-theme-toggle type="button" aria-label="切换暗黑模式" title="切换暗黑模式" aria-pressed="false">☾</button><a class="site-user" href="${nickname?'/user-center':'/login'}">${nickname?`<span translate="no">${escapeHTML(nickname)}</span>`:'登录'}</a><button class="nav-toggle" aria-label="展开导航" aria-controls="primary-nav" aria-expanded="false">☰</button>`);
  window.GreetTheme?.syncButtons();
  header.querySelector('.nav-toggle').onclick=e=>{const open=header.querySelector('nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));};
  const footer=document.getElementById('site-footer')||document.querySelector('footer');footer.className='site-footer';footer.innerHTML=siteHTML(`<div class="footer-inner"><strong>GREET RC技术交流平台</strong><p>探索结构，交流想法。从第一套配置开始。</p><nav aria-label="页脚导航">${nav.filter(([,t])=>t!=='App 下载').map(([url,t])=>`<a href="${url}">${t}</a>`).join('')}<a href="/about">关于</a><a href="/privacy">隐私说明</a><a href="/sitemap">全部页面</a></nav><div class="footer-note"><span>本地界面复现 · 示例内容 · 数据仅保存在当前浏览器</span><span>参考 hs-fpv.com · GREET RC / OFFLINE</span></div></div>`);
}
