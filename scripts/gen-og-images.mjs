/**
 * Generates static OG images for each SALI grade (S, A, B, C, D, F).
 * Runs in Node.js at build time where WASM works fine.
 * Output: public/og/S.png through F.png
 */

import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Init WASM from local file (works fine in Node.js)
const wasmPath = join(root, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
await initWasm(readFileSync(wasmPath));

// Load Inter fonts from @fontsource/inter (woff, works with satori)
const fontsDir = join(root, 'node_modules', '@fontsource', 'inter', 'files');
const regularBuf = readFileSync(join(fontsDir, 'inter-latin-400-normal.woff'));
const boldBuf    = readFileSync(join(fontsDir, 'inter-latin-600-normal.woff'));

const GRADES = {
  S: { color: '#22c55e', line1: 'My salary is keeping pace with Bitcoin.', line2: 'Extremely rare.' },
  A: { color: '#84cc16', line1: 'My salary is nearly keeping pace with Bitcoin.', line2: 'Top 15% of earners.' },
  B: { color: '#facc15', line1: 'My salary is moderately behind Bitcoin.', line2: 'Still ahead of most.' },
  C: { color: '#f97316', line1: 'My salary is significantly behind Bitcoin.', line2: 'The average result.' },
  D: { color: '#ef4444', line1: 'My salary is severely behind Bitcoin.', line2: 'Losing ground fast.' },
  F: { color: '#b91c1c', line1: 'My salary cannot keep up with Bitcoin.', line2: 'Time to reassess.' },
};

const outDir = join(root, 'og');
mkdirSync(outDir, { recursive: true });

for (const [grade, { color, line1, line2 }] of Object.entries(GRADES)) {
  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: '630px',
        backgroundColor: '#0a0a0a',
        padding: '60px 80px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', marginBottom: '44px' },
            children: [
              { type: 'span', props: { style: { fontSize: 22, fontWeight: 600, color: '#ffffff', letterSpacing: '0.18em' }, children: 'SALI' } },
              { type: 'span', props: { style: { fontSize: 11, color: '#555555', letterSpacing: '0.14em', marginTop: 6 }, children: 'SATOSHI ANNUAL LABOR INDEX' } },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1, gap: 56 },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: 196, fontWeight: 600, color, lineHeight: 1, width: 200, textAlign: 'center', flexShrink: 0 },
                  children: grade,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 20 },
                  children: [
                    { type: 'span', props: { style: { fontSize: 38, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.25 }, children: line1 } },
                    { type: 'span', props: { style: { fontSize: 30, color: '#888888', lineHeight: 1.3 }, children: line2 } },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', marginTop: 44 },
            children: [
              { type: 'span', props: { style: { fontSize: 15, color: '#3a3a3a', letterSpacing: '0.06em' }, children: 'sali.angarlo.com' } },
              { type: 'span', props: { style: { fontSize: 15, color: '#3a3a3a', letterSpacing: '0.06em' }, children: '#Bitcoin  #SALI' } },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: regularBuf, weight: 400, style: 'normal' },
      { name: 'Inter', data: boldBuf,    weight: 600, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();

  const outPath = join(outDir, `${grade}.png`);
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${Math.round(png.byteLength / 1024)}KB)`);
}

console.log('Done.');
