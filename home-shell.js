import {shell} from './shell.js';
shell();
const links=document.createElement('div');links.className='home-entry-links';links.innerHTML='<a href="/discussion">进入讨论组 →</a><a href="/square">发现配置 →</a><a href="/resources">浏览教程 →</a><a href="/sitemap">全部离线页面 →</a>';document.querySelector('.intro').append(links);
