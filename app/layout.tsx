import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '내 판 토크 통계',
  description: '네이트 판 토크 작성글 통계 조회',
};

export const viewport: Viewport = {
  themeColor: '#ef4444',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="bg-slate-50 h-full">
      <body className={`${inter.className} max-w-[480px] w-full mx-auto min-h-screen bg-slate-50`}>
        {children}
        <Analytics />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
