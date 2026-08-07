/**
 * Generates the OG / Twitter share cards for the Dice Seed tool (EN + ES).
 * Matches the SALI grade cards: dark right panel, accent left panel.
 * Output: assets/images/dice-seed-share.png and dice-seed-share-es.png
 */

import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const wasmPath = join(root, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
await initWasm(readFileSync(wasmPath));

const fontsDir = join(root, 'node_modules', '@fontsource', 'inter', 'files');
const regularBuf = readFileSync(join(fontsDir, 'inter-latin-400-normal.woff'));
const boldBuf = readFileSync(join(fontsDir, 'inter-latin-600-normal.woff'));

const ORANGE = '#F7931A';
const DARK = '#0d0d0d';

// A single die pip (filled circle) or an empty spacer of the same size.
function pip(on) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: 38,
        height: 38,
        borderRadius: 999,
        backgroundColor: on ? DARK : 'transparent',
      },
    },
  };
}

// A white rounded die showing the "5" face.
function die() {
  const rows = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: 224,
        height: 224,
        padding: 30,
        borderRadius: 36,
        backgroundColor: '#ffffff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      },
      children: rows.map((r) => ({
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' },
          children: r.map((c) => pip(c)),
        },
      })),
    },
  };
}

const CARDS = {
  'dice-seed-share': {
    headline: 'Roll your own seed',
    sub: 'Turn physical dice into a BIP-39 recovery phrase',
    url: 'sali.angarlo.com/dice-seed',
    tags: '#Bitcoin  #SelfCustody',
  },
  'dice-seed-share-es': {
    headline: 'Crea tu propia semilla',
    sub: 'Convierte dados físicos en una frase BIP-39',
    url: 'sali.angarlo.com/es/dice-seed',
    tags: '#Bitcoin  #Autocustodia',
  },
};

for (const [name, c] of Object.entries(CARDS)) {
  const element = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', width: '1200px', height: '630px' },
      children: [
        // Left — orange panel with a white die
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 360,
              height: 630,
              backgroundColor: ORANGE,
              flexShrink: 0,
            },
            children: [die()],
          },
        },
        // Right — dark panel with branding, headline, footer
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              height: 630,
              padding: '56px 64px',
              backgroundColor: DARK,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 8 },
                  children: [
                    { type: 'span', props: { style: { fontSize: 52, fontWeight: 600, color: '#ffffff', letterSpacing: '0.12em' }, children: 'SALI' } },
                    { type: 'span', props: { style: { fontSize: 13, color: '#444444', letterSpacing: '0.2em' }, children: 'SATOSHI ANNUAL LABOR INDEX' } },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 18 },
                  children: [
                    { type: 'span', props: { style: { fontSize: 64, fontWeight: 600, color: '#f5f5f5', lineHeight: 1.1 }, children: c.headline } },
                    { type: 'span', props: { style: { fontSize: 27, color: ORANGE, fontWeight: 600, lineHeight: 1.3 }, children: c.sub } },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                  children: [
                    { type: 'span', props: { style: { fontSize: 15, color: '#555555', letterSpacing: '0.06em' }, children: c.url } },
                    { type: 'span', props: { style: { fontSize: 15, color: '#555555', letterSpacing: '0.06em' }, children: c.tags } },
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
      { name: 'Inter', data: boldBuf, weight: 600, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();
  const outPath = join(root, 'assets', 'images', `${name}.png`);
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${Math.round(png.byteLength / 1024)}KB)`);
}

console.log('Done.');
