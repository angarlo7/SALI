/**
 * Generates static OG images for each SALI grade (S, A, B, C, D, F).
 * Runs in Node.js at build time where WASM works fine.
 * Output: og/S.png through F.png
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

const wasmPath = join(root, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
await initWasm(readFileSync(wasmPath));

const fontsDir = join(root, 'node_modules', '@fontsource', 'inter', 'files');
const regularBuf = readFileSync(join(fontsDir, 'inter-latin-400-normal.woff'));
const boldBuf    = readFileSync(join(fontsDir, 'inter-latin-600-normal.woff'));

const GRADES = {
  S: { color: '#22c55e', label: 'Keeping pace with Bitcoin.', sub: 'Extremely rare.' },
  A: { color: '#84cc16', label: 'Barely losing ground.', sub: 'Top earner.' },
  B: { color: '#facc15', label: 'Falling behind Bitcoin.', sub: 'Still recoverable.' },
  C: { color: '#f97316', label: 'Significantly behind Bitcoin.', sub: 'Most workers are here.' },
  D: { color: '#ef4444', label: 'Severely behind Bitcoin.', sub: 'Losing ground fast.' },
  F: { color: '#b91c1c', label: 'Cannot keep up with Bitcoin.', sub: 'Time to reassess.' },
};

const outDir = join(root, 'og');
mkdirSync(outDir, { recursive: true });

for (const [grade, { color, label, sub }] of Object.entries(GRADES)) {
  const element = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', width: '1200px', height: '630px' },
      children: [
        // Left — solid color panel
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 380,
              height: 630,
              backgroundColor: color,
              flexShrink: 0,
            },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontSize: 300, fontWeight: 600, color: 'rgba(0,0,0,0.2)', lineHeight: 1 },
                  children: grade,
                },
              },
            ],
          },
        },
        // Right — dark panel
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              height: 630,
              padding: '52px 60px',
              backgroundColor: '#0a0a0a',
            },
            children: [
              // Branding
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' },
                  children: [
                    { type: 'span', props: { style: { fontSize: 48, fontWeight: 600, color: '#ffffff', letterSpacing: '0.14em' }, children: 'SALI' } },
                    { type: 'span', props: { style: { fontSize: 12, color: '#444444', letterSpacing: '0.18em', marginTop: 8 }, children: 'SATOSHI ANNUAL LABOR INDEX' } },
                  ],
                },
              },
              // Insight + footer
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 32 },
                  children: [
                    // Insight
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', gap: 12 },
                        children: [
                          { type: 'span', props: { style: { fontSize: 36, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.25 }, children: label } },
                          { type: 'span', props: { style: { fontSize: 20, color: '#666666', borderLeft: `4px solid ${color}`, paddingLeft: 14 }, children: sub } },
                        ],
                      },
                    },
                    // Footer
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                        children: [
                          { type: 'span', props: { style: { fontSize: 13, color: '#2a2a2a', letterSpacing: '0.06em' }, children: 'sali.angarlo.com' } },
                          { type: 'span', props: { style: { fontSize: 13, color: '#2a2a2a', letterSpacing: '0.06em' }, children: '#Bitcoin  #SALI' } },
                        ],
                      },
                    },
                  ],
                },
              },
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
  const png   = resvg.render().asPng();

  const outPath = join(outDir, `${grade}.png`);
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${Math.round(png.byteLength / 1024)}KB)`);
}

console.log('Done.');
