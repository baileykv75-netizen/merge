import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile('assets/scripts/core/game-core.ts', 'utf8');
await writeFile('web/game-core.js', stripTypeScriptTypes(source, { mode: 'strip' }));
await mkdir('web/art', { recursive: true });
for (const name of ['hero-sky-knight', 'void-beast', 'battle-observatory']) {
  await copyFile(`assets/resources/art/${name}.png`, `web/art/${name}.png`);
}
console.log('已生成浏览器共用规则：web/game-core.js');
