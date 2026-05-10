import { getCollection } from 'astro:content';


const staticPages = [
  { path: '/', priority: '1.0' },
  { path: '/methodology.html', priority: '0.8' },
  { path: '/examples.html', priority: '0.8' },
  { path: '/notes', priority: '0.8' },
  { path: '/podcast.html', priority: '0.7' },
  { path: '/contact.html', priority: '0.6' },
  { path: '/privacy.html', priority: '0.5' },
  { path: '/es/', priority: '1.0' },
  { path: '/es/methodology.html', priority: '0.8' },
  { path: '/es/examples.html', priority: '0.8' },
  { path: '/es/notas', priority: '0.8' },
  { path: '/es/podcast.html', priority: '0.7' },
  { path: '/es/contact.html', priority: '0.6' },
  { path: '/es/privacy.html', priority: '0.5' }
];

export async function GET(context) {
  const site = context.site?.toString() ?? 'https://sali.angarlo.com/';
  const notes = (await getCollection('notes'))
    .filter((note) => !note.data.draft)
    .map((note) => ({
      path: `/notes/${note.slug}`,
      priority: '0.6'
    }));

  const notas = (await getCollection('notas'))
    .filter((nota) => !nota.data.draft)
    .map((nota) => ({
      path: `/es/notas/${nota.slug}`,
      priority: '0.6'
    }));

  const urls = [...staticPages, ...notes, ...notas]
    .map(({ path, priority }) => {
      const loc = new URL(path, site).toString();
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <priority>${priority}</priority>`,
        '  </url>'
      ].join('\n');
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml'
      }
    }
  );
}
