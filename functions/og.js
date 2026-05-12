import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const RANK_COLORS = {
  S: '#22c55e',
  A: '#84cc16',
  B: '#facc15',
  C: '#f97316',
  D: '#ef4444',
  F: '#b91c1c',
};

let wasmReady = false;

async function ensureWasm() {
  if (wasmReady) return;
  const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm');
  await initWasm(wasmModule.default);
  wasmReady = true;
}

async function fetchFont(url) {
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const VALID = new Set(['S', 'A', 'B', 'C', 'D', 'F']);
  const rank    = VALID.has(url.searchParams.get('rank')) ? url.searchParams.get('rank') : 'F';
  const deficit = Math.max(0, Math.min(99,   parseInt(url.searchParams.get('deficit') || '80', 10)));
  const raise   = Math.max(1, Math.min(999,  parseInt(url.searchParams.get('raise')   || '25', 10)));
  const since   = Math.max(2010, Math.min(2035, parseInt(url.searchParams.get('since') || '2020', 10)));

  const color = RANK_COLORS[rank] || '#ef4444';
  const keepingPace = rank === 'S';

  const line1 = keepingPace
    ? `My salary is keeping pace with Bitcoin since ${since}.`
    : `My salary is ${deficit}% behind Bitcoin since ${since}.`;
  const line2 = keepingPace
    ? 'Extremely rare.'
    : `I'd need +${raise}%/yr just to keep up.`;

  const [fontRegular, fontBold] = await Promise.all([
    fetchFont('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'),
    fetchFont('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2'),
  ]);

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
              { type: 'span', props: { style: { fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '0.18em', fontFamily: 'Inter' }, children: 'SALI' } },
              { type: 'span', props: { style: { fontSize: 11, color: '#555555', letterSpacing: '0.14em', marginTop: 6, fontFamily: 'Inter' }, children: 'SATOSHI ANNUAL LABOR INDEX' } },
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
                  style: { fontSize: 196, fontWeight: 700, color, lineHeight: 1, width: 200, textAlign: 'center', flexShrink: 0, fontFamily: 'Inter' },
                  children: rank,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 20 },
                  children: [
                    { type: 'span', props: { style: { fontSize: 38, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.25, fontFamily: 'Inter' }, children: line1 } },
                    { type: 'span', props: { style: { fontSize: 30, color: '#888888', lineHeight: 1.3, fontFamily: 'Inter' }, children: line2 } },
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
              { type: 'span', props: { style: { fontSize: 15, color: '#3a3a3a', letterSpacing: '0.06em', fontFamily: 'Inter' }, children: 'sali.angarlo.com' } },
              { type: 'span', props: { style: { fontSize: 15, color: '#3a3a3a', letterSpacing: '0.06em', fontFamily: 'Inter' }, children: '#Bitcoin  #SALI' } },
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
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
    ],
  });

  await ensureWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
