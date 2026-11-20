import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenePath = path.join(project, 'assets', 'Main.scene');
const scriptPath = path.join(project, 'assets', 'scripts', 'StarforgeGame.ts');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const scriptMeta = JSON.parse(fs.readFileSync(`${scriptPath}.meta`, 'utf8'));
const uuid = scriptMeta.uuid.replace(/-/g, '');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let classId = uuid.slice(0, 5);
for (let i = 5; i < uuid.length; i += 3) {
  const n = Number.parseInt(uuid.slice(i, i + 3), 16);
  classId += alphabet[n >>> 6] + alphabet[n & 63];
}

const canvas = scene.find((entry) => entry.__type__ === 'cc.Node' && entry._name === 'Canvas');
if (!canvas) throw new Error('Main.scene is missing Canvas');
if (scene.some((entry) => entry.__type__ === classId)) {
  console.log('StarforgeGame is already attached');
  process.exit(0);
}
const index = scene.length;
canvas._components.push({ __id__: index });
scene.push({
  __type__: classId,
  _name: '',
  _objFlags: 0,
  node: { __id__: scene.indexOf(canvas) },
  _enabled: true,
  __prefab: null,
  _id: '7fKX4lwxFNA5b3WvH4o8TQ',
});
fs.writeFileSync(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
console.log(`Attached StarforgeGame (${classId}) to Canvas`);
