import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

// RESVG_WASM is injected as a pre-compiled WebAssembly.Module via wrangler.toml [wasm_modules]
// This is the ONLY form CF Workers allow — no runtime compilation from bytes
/* global RESVG_WASM */

const RANK_COLORS = {
  S: '#22c55e',
  A: '#84cc16',
  B: '#facc15',
  C: '#f97316',
  D: '#ef4444',
  F: '#b91c1c',
};

let fontRegularBuf = null;
let fontBoldBuf    = null;
let resvgReady     = false;

async function ensureResvg() {
  if (!resvgReady) {
    await initWasm(RESVG_WASM);
    resvgReady = true;
  }
}

async function getFonts() {
  if (!fontRegularBuf || !fontBoldBuf) {
    [fontRegularBuf, fontBoldBuf] = await Promise.all([
      fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2').then(r => r.arrayBuffer()),
      fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2').then(r => r.arrayBuffer()),
    ]);
  }
  return { regular: fontRegularBuf, bold: fontBoldBuf };
}

export default {
  async fetch(request) {
    try {
      const url    = new URL(request.url);
      const VALID  = new Set(['S', 'A', 'B', 'C', 'D', 'F']);
      const rank   = VALID.has(url.searchParams.get('rank')) ? url.searchParams.get('rank') : 'F';
      const deficit = Math.max(0,    Math.min(99,   parseInt(url.searchParams.get('deficit') || '80', 10)));
      const raise   = Math.max(1,    Math.min(999,  parseInt(url.searchParams.get('raise')   || '25', 10)));
      const since   = Math.max(2010, Math.min(2035, parseInt(url.searchParams.get('since')   || '2020', 10)));

      const color       = RANK_COLORS[rank] || '#ef4444';
      const keepingPace = rank === 'S';

      const statLine = keepingPace
        ? `Keeping pace with Bitcoin since ${since}.`
        : `${deficit}% behind Bitcoin since ${since}.`;
      const subLine  = keepingPace
        ? 'Extremely rare.'
        : `+${raise}%/yr just to break even.`;

      const [fonts] = await Promise.all([getFonts(), ensureResvg()]);

      const element = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', width: '1200px', height: '630px', backgroundColor: '#0a0a0a' },
          children: [
            // Left — grade letter on tinted panel
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 320,
                  backgroundColor: color + '15',
                  borderRight: `6px solid ${color}`,
                  flexShrink: 0,
                },
                children: [
                  { type: 'span', props: { style: { fontSize: 260, fontWeight: 700, color, lineHeight: 1 }, children: rank } },
                ],
              },
            },
            // Right — branding + personalized numbers
            {
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 64px' },
                children: [
                  // Branding
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column', marginBottom: 'auto' },
                      children: [
                        { type: 'span', props: { style: { fontSize: 42, fontWeight: 700, color: '#ffffff', letterSpacing: '0.12em' }, children: 'SALI' } },
                        { type: 'span', props: { style: { fontSize: 13, color: '#555555', letterSpacing: '0.16em', marginTop: 6 }, children: 'SATOSHI ANNUAL LABOR INDEX' } },
                      ],
                    },
                  },
                  // Personalized numbers
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto' },
                      children: [
                        { type: 'span', props: { style: { fontSize: 40, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.2 }, children: statLine } },
                        { type: 'span', props: { style: { fontSize: 24, color, letterSpacing: '0.02em' }, children: subLine } },
                      ],
                    },
                  },
                  // Footer
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
                      children: [
                        { type: 'span', props: { style: { fontSize: 14, color: '#333333', letterSpacing: '0.06em' }, children: 'sali.angarlo.com' } },
                        { type: 'span', props: { style: { fontSize: 14, color: '#333333', letterSpacing: '0.06em' }, children: '#Bitcoin  #SALI' } },
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
          { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
          { name: 'Inter', data: fonts.bold,    weight: 700, style: 'normal' },
        ],
      });

      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      const png   = resvg.render().asPng();

      return new Response(png, {
        headers: {
          'Content-Type':  'image/png',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
