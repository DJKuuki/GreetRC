// Resolve application routes relative to this module, including project Pages URLs.
const baseURL = new URL('.', import.meta.url);
export const basePath = baseURL.pathname;
const staticSite = !!document.querySelector('meta[name="greet-rc-static"]');

export function routePath() {
  let pathname = location.pathname;
  if (staticSite && pathname === basePath + 'site.html') {
    pathname = new URLSearchParams(location.search).get('route') || '/';
  } else if (pathname.startsWith(basePath)) {
    pathname = '/' + pathname.slice(basePath.length);
  }
  return decodeURI(pathname).replace(/\/+$/, '') || '/';
}

export function siteHref(href) {
  if (href.startsWith('#')) return location.pathname + location.search + href;
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  if (basePath !== '/' && href.startsWith(basePath)) return href;
  // Browser-created records have no generated HTML file. Use the static shell
  // so publishing, following a link, and reloading all return an HTTP 200.
  if (staticSite && /^\/(discussion|square|vs|crash-heaven)\/local-[^/?#]+/.test(href)) {
    const url = new URL(href, location.origin);
    url.searchParams.set('route', url.pathname);
    return basePath + 'site.html?' + url.searchParams + url.hash;
  }
  return basePath + href.slice(1);
}

export function siteHTML(html) {
  return html.replace(/\b(href|src|action)="((?:\/(?!\/)|#)[^"]*)"/g,
    (_, attribute, href) => `${attribute}="${siteHref(href.replaceAll('&amp;', '&')).replaceAll('&', '&amp;')}"`);
}
