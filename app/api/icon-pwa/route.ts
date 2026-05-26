import { NextResponse } from 'next/server';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="28" fill="#ef4444"/>
  <text x="96" y="138" font-family="sans-serif" font-size="108" font-weight="700" text-anchor="middle" fill="white">판</text>
</svg>`;

export function GET() {
  return new NextResponse(SVG, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  });
}
