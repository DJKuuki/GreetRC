import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {posts, builds, battles, crashes, sections, articles, downloads} from '../data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
const base = process.env.PAGES_BASE_PATH || '/GreetRC/';
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)) throw new Error('PAGES_BASE_PATH must be an absolute directory path.');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Output must stay inside the project.');
fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output);

// Publish runtime files only, keeping development files out of the website.
const runtime = fs.readdirSync(root).filter(file=>/\.(js|css)$/.test(file)).sort();
const checksum = createHash('sha256');
for(const file of runtime)checksum.update(file).update(fs.readFileSync(path.join(root,file)));
const revision = checksum.digest('hex').slice(0,12);
for (const file of runtime) {
  let source=fs.readFileSync(path.join(root,file),'utf8');
  if(file.endsWith('.js'))source=source.replace(/(\bfrom\s+|\bimport\s*)(['"])(\.\/[^'"?]+\.js)\2/g,
    (match,prefix,quote,url)=>runtime.includes(url.slice(2))?`${prefix}${quote}${url}?v=${revision}${quote}`:match);
  fs.writeFileSync(path.join(output,file),source);
}
for (const folder of ['assets', 'vendor']) {
  fs.cpSync(path.join(root, folder), path.join(output, folder), {recursive: true});
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));

function template(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/<base\b[^>]*>/gi, '')
    .replace('<head>', `<head><base href="${base}"><meta name="greet-rc-static" content="true">`)
    .replace(/\b(src|href)="\.\/([^"?]+\.(?:js|css))"/g,
      (match,attribute,asset)=>runtime.includes(asset)?`${attribute}="./${asset}?v=${revision}"`:match);
}
const home = template('index.html');
const community = template('site.html');
fs.writeFileSync(path.join(output, 'index.html'), home);
fs.writeFileSync(path.join(output, 'site.html'), community);
fs.writeFileSync(path.join(output, '404.html'), community);
fs.writeFileSync(path.join(output, '.nojekyll'), '');

const routes = new Set([
  'app', 'square', 'vs', 'crash-heaven', 'discussion', 'resources', 'downloads',
  'discussion/new', 'square/new', 'vs/new', 'crash-heaven/new', 'hangar/new',
  'login', 'register', 'reset-password', 'user-center', 'users/demo', 'hangar',
  'favorites', 'notifications', 'vs/my', 'crash-heaven/my', 'pid/visualization',
  'about', 'privacy', 'changelog', 'sitemap', 'assembly',
  ...posts.map(item => 'discussion/' + item.id),
  ...builds.map(item => 'square/' + item.id),
  ...battles.map(item => 'vs/' + item.id),
  ...crashes.map(item => 'crash-heaven/' + item.id),
  ...sections.map(item => 'resources/' + item.id),
  ...articles.map(item => item.path),
  ...downloads.map(item => 'downloads/' + item.id),
]);
for (const route of routes) {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(route)) throw new Error('Invalid route: ' + route);
  const directory = path.join(output, route);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'index.html'), community);
}
console.log(`Built ${routes.size + 1} pages in ${output} (base: ${base}).`);
