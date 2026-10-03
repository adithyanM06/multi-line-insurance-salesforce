import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
const root = resolve('.');
const listing = await readFile(new URL('./SOURCE.md', import.meta.url), 'utf8');
const files = [...listing.matchAll(/^## (metadata\/[^\r\n]+)\r?\n\s*```\r?\n([\s\S]*?)\r?\n```/gm)];
if (!files.length) throw new Error('No metadata source files found in SOURCE.md.');
for (const [, name, source] of files) {
  const path = resolve(root, name);
  if (!path.startsWith(root + sep) || name.includes('..')) throw new Error('Invalid source path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source + '\n', 'utf8');
}
console.log(`Extracted ${files.length} Salesforce source files to metadata/.`);
