const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const auth = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'];
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

execFileSync(process.execPath, [path.join(__dirname, 'build-pages.mjs')], {cwd: root, stdio: 'inherit'});
const gitDirectory = git(['rev-parse', '--absolute-git-dir']);
const source = git(['rev-parse', '--short', 'HEAD']);
const remote = spawnSync('git', [...auth, 'ls-remote', '--exit-code', 'origin', 'refs/heads/gh-pages'], {cwd: root, encoding: 'utf8'});
if (remote.status !== 0 && remote.status !== 2) throw new Error(remote.stderr || 'Cannot read publishing branch.');
let parent;
if (remote.status === 0) {
  git([...auth, 'fetch', 'origin', 'refs/heads/gh-pages']);
  parent = git(['rev-parse', 'FETCH_HEAD']);
}

// A separate temporary index leaves the source branch and its staging area intact.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'greet-rc-pages-'));
const index = path.join(temporary, 'index');
const publish = args => execFileSync('git', args, {
  cwd: output, encoding: 'utf8',
  env: {...process.env, GIT_DIR: gitDirectory, GIT_WORK_TREE: output, GIT_INDEX_FILE: index},
}).trim();
try {
  publish(['read-tree', '--empty']);
  publish(['-c', 'core.autocrlf=false', 'add', '--all', '--', '.']);
  const tree = publish(['write-tree']);
  const args = ['commit-tree', tree];
  if (parent) args.push('-p', parent);
  args.push('-m', `Deploy GREET RC static site from ${source}`);
  const revision = git(args);
  execFileSync('git', [...auth, 'push', 'origin', `${revision}:refs/heads/gh-pages`], {cwd: root, stdio: 'inherit'});
  console.log(`Published ${revision} to gh-pages.`);
} finally {
  fs.rmSync(index, {force: true});
  fs.rmSync(index + '.lock', {force: true});
  fs.rmdirSync(temporary);
}
