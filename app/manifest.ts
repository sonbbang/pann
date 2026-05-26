import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '내 판 토크 통계',
    short_name: '판 통계',
    description: '네이트 판 토크 작성글 통계 조회',
    id: '/',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#ef4444',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/api/icon-pwa',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
