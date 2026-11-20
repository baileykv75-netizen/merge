import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'build', 'web-mobile');
const destination = join(root, 'docs');

if (!existsSync(join(source, 'index.html'))) {
  throw new Error('请先在 Cocos Creator 中构建 Web 手机端。');
}

// 只清理工程内固定的 Pages 发布目录，避免旧构建文件残留。
if (destination !== join(root, 'docs')) throw new Error('发布目录无效');
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
const page = join(destination, 'index.html');
const html = readFileSync(page, 'utf8');
writeFileSync(page, html.replace(/<title>[^<]*<\/title>/, '<title>装备合成原型</title>'));
console.log(`已将 Cocos Web 手机端构建复制到 ${destination}`);
