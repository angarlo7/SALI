const VALID_RANKS = new Set(['S', 'A', 'B', 'C', 'D', 'F']);

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const rank    = VALID_RANKS.has(url.searchParams.get('rank')) ? url.searchParams.get('rank') : 'F';
  const deficit = Math.max(0, Math.min(99,   parseInt(url.searchParams.get('deficit') || '80', 10)));
  const raise   = Math.max(1, Math.min(999,  parseInt(url.searchParams.get('raise')   || '25', 10)));
  const since   = Math.max(2010, Math.min(2035, parseInt(url.searchParams.get('since') || '2020', 10)));

  const ogImageUrl = `https://sali.angarlo.com/og/${rank}2.png`;
  const keepingPace = rank === 'S';

  const title = keepingPace
    ? `SALI Grade ${rank} — Keeping pace with Bitcoin since ${since}`
    : `SALI Grade ${rank} — ${deficit}% behind Bitcoin since ${since}`;
  const description = keepingPace
    ? `My salary is keeping pace with Bitcoin since ${since}. Extremely rare. Calculate yours at sali.angarlo.com`
    : `My salary is ${deficit}% behind Bitcoin since ${since}. I'd need +${raise}%/yr just to keep up. Calculate yours at sali.angarlo.com`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(url.href)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@angarlo">
  <meta name="twitter:creator" content="@angarlo">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImageUrl)}">
  <script>window.location.replace('/');</script>
</head>
<body style="background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem;">
  <p>Redirecting to SALI&hellip;</p>
  <p><a href="/" style="color:#F7931A;text-decoration:none;">Click here if not redirected</a></p>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"50af8042fed14fbdb35bde67c57585bf"}'></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
