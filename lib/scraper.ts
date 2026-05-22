import * as cheerio from 'cheerio';

export interface Post {
  date: string;   // YYYYMMDD
  viewCount: number;
}

export interface ParseResult {
  posts: Post[];
  hasNextPage: boolean;
  nextPageUrl?: string;
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
    const dateText = $(el).find('td.date').text().trim();
    const viewText = $(el).find('td.count').text().trim();

    const date = dateTextToYYYYMMDD(dateText);
    const viewCount = parseInt(viewText.replace(/,/g, ''), 10) || 0;

    if (date) {
      posts.push({ date, viewCount });
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

async function fetchEucKrPage(url: string, cookieString: string): Promise<string> {
  // Keep only valid HTTP header value chars: printable ASCII + obs-text (0x20-0xFF), remove the rest
  const safeCookie = cookieString.replace(/[^\x20-\xFF]/g, '').trim();
  const removedCount = cookieString.length - safeCookie.length;
  console.log(`[fetch] start ${url}, cookie length=${safeCookie.length}, removed=${removedCount} invalid chars`);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Cookie: safeCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://pann.nate.com/',
      },
      redirect: 'follow',
    });
    console.log(`[fetch] ok ${response.status} ${response.headers.get('content-type')}`);
  } catch (e) {
    console.error('[fetch] fetch() threw:', String(e), (e as Error)?.cause ? String((e as Error).cause) : '');
    throw e;
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
    console.log(`[fetch] buffer size=${buffer.byteLength}`);
  } catch (e) {
    console.error('[fetch] arrayBuffer() threw:', String(e));
    throw e;
  }

  try {
    return new TextDecoder('euc-kr').decode(buffer);
  } catch (e) {
    console.error('[fetch] TextDecoder threw:', String(e));
    throw e;
  }
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
): Promise<{ count: number; totalViews: number }> {
  let url = 'https://pann.nate.com/my?mode=T';
  let allPosts: Post[] = [];
  let visited = 0;
  const MAX_PAGES = 50;

  while (visited < MAX_PAGES) {
    const html = await fetchEucKrPage(url, cookieString);

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

  return {
    count: allPosts.length,
    totalViews: allPosts.reduce((sum, p) => sum + p.viewCount, 0),
  };
}

export function validateCookieString(cookieString: string): boolean {
  // Basic format check: must contain at least one key=value pair
  return cookieString.includes('=');
}
