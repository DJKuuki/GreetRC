// Loaded before styles so a saved dark theme never flashes a light background.
(() => {
  const key='greet-rc-theme',media=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try {const saved=localStorage.getItem(key);if(['light','dark'].includes(saved))preference=saved;} catch {}
  function syncButtons(){
    const dark=document.documentElement.dataset.theme==='dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
      button.textContent=dark?'☀':'☾';
      button.setAttribute('aria-label',dark?'切换浅色模式':'切换暗黑模式');
      button.setAttribute('title',dark?'切换浅色模式':'切换暗黑模式');
      button.setAttribute('aria-pressed',String(dark));
    });
  }
  function apply(){
    const mode=preference||(media.matches?'dark':'light');
    document.documentElement.dataset.theme=mode;
    document.documentElement.style.colorScheme=mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#0e141f':'#ffffff');
    syncButtons();
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-theme-toggle]'))return;
    preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
    try {localStorage.setItem(key,preference);} catch {}
    apply();
  });
  media.addEventListener('change',()=>{if(!preference)apply();});
  window.addEventListener('storage',event=>{if(event.key===key){preference=['light','dark'].includes(event.newValue)?event.newValue:null;apply();}});
  window.GreetTheme={syncButtons};
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
})();
