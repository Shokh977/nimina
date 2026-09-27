import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nimina',
    short_name: 'Nimina',
    description: 'Turn app screenshots into polished, animated promo videos.',
    start_url: '/projects',
    display: 'standalone',
    background_color: '#121317',
    theme_color: '#121317',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
