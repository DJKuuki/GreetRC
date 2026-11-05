// Loaded before styles so a saved dark theme never flashes a light background.
(() => {
  const key='greet-rc-theme',media=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try {const saved=localStorage.getItem(key);if(['light','dark'].includes(saved))preference=saved;} catch {}
  const icons={
    moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8 8 0 0 1 9.4 4a8 8 0 1 0 10.6 10.6Z"/></svg>',
    sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>'
  };
  function syncButtons(){
    const dark=document.documentElement.dataset.theme==='dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
      button.innerHTML=dark?icons.sun:icons.moon;
      button.setAttribute('aria-label',dark?'切换浅色模式':'切换暗黑模式');
      button.setAttribute('title',dark?'切换浅色模式':'切换暗黑模式');
      button.setAttribute('aria-pressed',String(dark));
    });
  }
  function apply(){
    const mode=preference||(media.matches?'dark':'light');
    document.documentElement.dataset.theme=mode;
    document.documentElement.style.colorScheme=mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#121513':'#f5f3ee');
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
