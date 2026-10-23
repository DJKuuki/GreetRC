import {messages} from './messages.js';
export const languages = ['zh','en','vi'];
const storageKey='greet-rc-language';
let saved='zh';
try { saved=localStorage.getItem(storageKey)||'zh'; } catch {}
const requested=new URLSearchParams(location.search).get('lang');
export let language=languages.includes(requested)?requested:languages.includes(saved)?saved:'zh';
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phrases=new RegExp(Object.keys(messages).filter(s=>s.length>1).sort((a,b)=>b.length-a.length).map(escapeRegex).join('|'),'g');
export function t(value,locale=language) {
  const source=String(value),s=source.trim();
  // Whitespace is layout, not a translation key. Missing translations retain source text.
  if(!s)return source;
  const translated=key=>{
    const text=messages[key]?.[locale];
    return typeof text==='string'&&text.trim()?text:key;
  };
  if(Object.hasOwn(messages,s)) return source.replace(s,()=>translated(s));
  if(locale==='zh')return source.replace(phrases,translated);
  let out=source;
  out=out.replace(/第 (\d+) \/ (\d+) 页 · (\d+) 条/g,(_,p,n,total)=>locale==='en'?`Page ${p} / ${n} · ${total} items`:`Trang ${p} / ${n} · ${total} mục`)
    .replace(/共 (\d+) 篇内容 · 文章框架示例/g,(_,n)=>locale==='en'?`${n} articles · Sample outlines`:`${n} bài · Khung nội dung mẫu`)
    .replace(/(\d+) 个内容节点/g,(_,n)=>locale==='en'?`${n} topics`:`${n} chủ đề`)
    .replace(/(\d+) 票 · 示例票数/g,(_,n)=>locale==='en'?`${n} votes · Sample tally`:`${n} phiếu · Số phiếu mẫu`)
    .replace(/([PID]) 参数/g,(_,p)=>locale==='en'?`${p} parameter`:`Tham số ${p}`);
  out=out.replace(phrases,translated);
  return out.replace(/([\d.]+)\s*寸/g,'$1 inch').replace(/：/g,': ');
}

const records=new WeakMap();
const attributes=['placeholder','aria-label','title','alt'];
const excluded='script,style,textarea,[translate="no"],[data-user-content]';
function replaceValue(node,key,current,write) {
  let state=records.get(node);if(!state){state={};records.set(node,state);}
  let entry=state[key];
  if(!entry||current!==entry.output)entry=state[key]={source:current,output:current};
  let output;
  if(node.parentElement?.tagName==='TITLE'&&location.pathname.includes('/local-')) {
    const i=entry.source.lastIndexOf(' · ');
    output=i<0?entry.source:entry.source.slice(0,i+3)+t(entry.source.slice(i+3));
  } else output=t(entry.source);
  entry.output=output;if(output!==current)write(output);
}
let observer;
export function applyLanguage() {
  observer?.disconnect();
  document.documentElement.lang={zh:'zh-CN',en:'en',vi:'vi'}[language];
  // Option text must not become its submitted value when labels are translated.
  document.querySelectorAll('option:not([value])').forEach(e=>e.setAttribute('value',e.textContent));
  const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
  for(let node;node=walker.nextNode();) {
    if(!node.parentElement||node.parentElement.closest(excluded))continue;
    replaceValue(node,'text',node.nodeValue,value=>node.nodeValue=value);
  }
  document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el=>{
    if(el.closest('script,style,[translate="no"],[data-user-content]'))return;
    for(const name of attributes)if(el.hasAttribute(name))replaceValue(el,name,el.getAttribute(name),value=>el.setAttribute(name,value));
  });
  document.querySelectorAll('[data-language-select]').forEach(el=>{el.value=language;el.setAttribute('aria-label',{zh:'界面语言',en:'Interface language',vi:'Ngôn ngữ giao diện'}[language]);});
  observer?.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributes});
}
export function setLanguage(next) {
  if(!languages.includes(next))return;
  language=next;try{localStorage.setItem(storageKey,next);}catch{}
  const url=new URL(location.href);url.searchParams.set('lang',next);history.replaceState(null,'',url);
  applyLanguage();document.dispatchEvent(new CustomEvent('languagechange',{detail:next}));
}
export function languageControl(){return '<select class="language-select" data-language-select translate="no"><option value="zh" lang="zh-CN">中文</option><option value="en" lang="en">English</option><option value="vi" lang="vi">Tiếng Việt</option></select>';}
document.addEventListener('change',e=>{if(e.target.matches('[data-language-select]'))setLanguage(e.target.value);});
// Keep link navigation in the active language, including filtered/paged URLs.
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href);if(u.origin===location.origin&&!u.hash&&!/\.[a-z\d]+$/i.test(u.pathname)){u.searchParams.set('lang',language);a.href=u.href;}},true);
document.addEventListener('submit',e=>{if(e.target.method?.toLowerCase()==='get'){let input=e.target.querySelector('input[name="lang"]');if(!input){input=document.createElement('input');input.type='hidden';input.name='lang';e.target.append(input);}input.value=language;}},true);
observer=new MutationObserver(()=>applyLanguage());
applyLanguage();
if(requested&&languages.includes(requested))try{localStorage.setItem(storageKey,language);}catch{}
