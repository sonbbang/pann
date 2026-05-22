import * as cheerio from 'cheerio';

export interface Post {
  date: string;      // YYYYMMDD
  viewCount: number;
  title: string;
  url: string;
}

export interface ParseResult {
  posts: Post[];
  hasNextPage: boolean;
  nextPageUrl?: string;
}

export interface ScrapeResult {
  count: number;
  totalViews: number;
  over5kCount: number;
  over50kCount: number;
  over100kCount: number;
  topPosts: Post[];  // viewCount >= 5000, sorted desc
}

export function isLoginPage(html: string): boolean {
  return html.includes('f_login') || html.includes('LoginAuth.sk');
}

export function dateTextToYYYYMMDD(text: string): string {
  // Handles "2026.05.15" and "2026-05-15"
  const cleaned = text.trim().replace(/[.-]/g, '');
  if (/^\d{8}$/.test(cleaned)) return cleaned;
  return '';
}

export function parsePosts(html: string): ParseResult {
  const $ = cheerio.load(html);
  const posts: Post[] = [];

  $('table.mylist tbody tr').each((_, el) => {
    const linkEl = $(el).find('td.subject a').first();
    const title = linkEl.text().trim();
    const href = linkEl.attr('href') ?? '';
    const url = href ? `https://pann.nate.com${href}` : '';

    const dateText = $(el).find('td.date').text().trim();
    const viewText = $(el).find('td.count').text().trim();

    const date = dateTextToYYYYMMDD(dateText);
    const viewCount = parseInt(viewText.replace(/,/g, ''), 10) || 0;

    if (date) {
      posts.push({ date, viewCount, title, url });
    }
  });

  const nextHref = $('a.btn.next').attr('href') || null;
  // href starts with "javascript:" on last page
  const hasNextPage = !!nextHref && !nextHref.startsWith('javascript');

  return {
    posts,
    hasNextPage,
    nextPageUrl: hasNextPage && nextHref
      ? `https://pann.nate.com${nextHref}`
      : undefined,
  };
}

export function filterByDateRange(posts: Post[], startDate: string, endDate: string): Post[] {
  return posts.filter(p => p.date >= startDate && p.date <= endDate);
}

async function fetchPage(url: string, cookieString: string): Promise<string> {
  // Keep only valid HTTP header value chars: printable ASCII + obs-text (0x20-0xFF), remove the rest
  const safeCookie = cookieString.replace(/[^\x20-\xFF]/g, '').trim();
  console.log(`[fetch] start ${url}, cookie length=${safeCookie.length}`);

  const response = await fetch(url, {
    headers: {
      Cookie: safeCookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      Referer: 'https://pann.nate.com/',
    },
    redirect: 'follow',
  });
  console.log(`[fetch] ${response.status} ${response.headers.get('content-type')}`);

  const buffer = await response.arrayBuffer();

  // Peek at the first 2 KB as ASCII to detect the meta charset declaration.
  // The HTTP Content-Type may say EUC-KR while the actual content is UTF-8 (pann.nate.com case).
  const peek = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, 2000));
  const metaCharset = peek.match(/charset=['"']?([^'"\s;>]+)/i)?.[1]?.toLowerCase() ?? '';
  const charset = metaCharset === 'euc-kr' ? 'euc-kr' : 'utf-8';

  return new TextDecoder(charset).decode(buffer);
}

export class AuthExpiredError extends Error {
  constructor() {
    super('AUTH_EXPIRED');
    this.name = 'AuthExpiredError';
  }
}

export async function scrapeMyTalkPosts(
  cookieString: string,
  startDate: string,
  endDate: string
): Promise<ScrapeResult> {
  let url = 'https://pann.nate.com/my?mode=T';
  let allPosts: Post[] = [];
  let visited = 0;
  const MAX_PAGES = 50;

  while (visited < MAX_PAGES) {
    const html = await fetchPage(url, cookieString);

    if (isLoginPage(html)) {
      throw new AuthExpiredError();
    }

    const { posts, hasNextPage, nextPageUrl } = parsePosts(html);
    visited++;

    const filtered = filterByDateRange(posts, startDate, endDate);
    allPosts = [...allPosts, ...filtered];

    // Stop early: oldest post on page is before start date (descending order assumed)
    const oldest = posts[posts.length - 1];
    if (!hasNextPage || !nextPageUrl || (oldest && oldest.date < startDate)) {
      break;
    }

    url = nextPageUrl;
  }

  const topPosts = allPosts
    .filter(p => p.viewCount >= 5000)
    .sort((a, b) => b.viewCount - a.viewCount);

  return {
    count: allPosts.length,
    totalViews: allPosts.reduce((sum, p) => sum + p.viewCount, 0),
    over5kCount:   topPosts.filter(p => p.viewCount >= 5000  && p.viewCount < 50000).length,
    over50kCount:  topPosts.filter(p => p.viewCount >= 50000 && p.viewCount < 100000).length,
    over100kCount: topPosts.filter(p => p.viewCount >= 100000).length,
    topPosts,
  };
}

export function validateCookieString(cookieString: string): boolean {
  // Basic format check: must contain at least one key=value pair
  return cookieString.includes('=');
}
