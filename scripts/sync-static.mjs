import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const rootFiles = [
  '.nojekyll',
  '_headers',
  'CNAME',
  'favicon.ico',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'contact.html',
  'examples.html',
  'index.html',
  'methodology.html',
  'podcast.html',
  'privacy.html',
  'robots.txt'
];

const rootDirs = ['assets', 'data', 'es', 'og'];

await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });

for (const file of rootFiles) {
  if (existsSync(file)) {
    await cp(file, `public/${file}`);
  }
}

for (const dir of rootDirs) {
  if (existsSync(dir)) {
    await cp(dir, `public/${dir}`, {
      recursive: true,
      filter: (source) => !source.endsWith('.DS_Store')
    });
  }
}
