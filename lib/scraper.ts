import * as cheerio from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';

// On Vercel (production) pann.nate.com has a valid cert — no bypass needed.
// On corporate networks (SSL inspection), Node.js rejects the self-signed chain.
const tlsAgent = new Agent({
  connect: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
});

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
  username: string;
  count: number;
  totalViews: number;
  over5kCount: number;
  over50kCount: number;
  over100kCount: number;
  topPosts: Post[];  // viewCount >= 5000, sorted desc
}

// Extract Nate member ID from UA3 cookie (base64-encoded zero-padded numeric ID).
// UA3 format: "<base64>||" where base64 decodes to e.g. "0000470470"
export function extractMemberIdFromCookie(cookieString: string): string {
  for (const pair of cookieString.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    if (key !== 'UA3') continue;
    const val = pair.slice(eqIdx + 1).trim().split('||')[0];
    try {
      const decoded = Buffer.from(val, 'base64').toString('utf-8').trim();
      if (/^\d+$/.test(decoded)) return decoded;
    } catch {}
  }
  return '';
}

export function extractUsername(html: string): string {
  const $ = cheerio.load(html);

  // Try common Korean portal nick selectors
  for (const sel of [
    'em.nick', 'span.nick', '.nick', 'strong.nick',
    '.my_info .name', '.user_name', '#myNick', '.member_name',
    '.myInfo em', '.myInfo span',
  ]) {
    const text = $(sel).first().text().trim();
    if (text && text.length >= 2 && text.length <= 20) return text;
  }

  // Regex fallback: "닉네임 님" pattern anywhere in the page
  const bodyText = $('body').text();
  const match = bodyText.match(/([가-힣a-zA-Z0-9_]{2,15})\s*님(?:\s|$|의|이)/);
  return match ? match[1] : '';
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
  // Valid HTTP header value chars: tab (0x09), printable ASCII (0x20-0x7E), obs-text (0x80-0xFF).
  // DEL (0x7F) is explicitly excluded by the HTTP spec and rejected by Node.js undici.
  const safeCookie = cookieString.replace(/[^\x09\x20-\x7E\x80-\xFF]/g, '').trim();
  console.log(`[fetch] start ${url}, cookie length=${safeCookie.length}`);

  const response = await undiciFetch(url, {
    dispatcher: tlsAgent,
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
  let username = '';
  const MAX_PAGES = 50;

  while (visited < MAX_PAGES) {
    const html = await fetchPage(url, cookieString);

    if (isLoginPage(html)) {
      throw new AuthExpiredError();
    }

    // Extract member ID from cookie (reliable); fall back to HTML parsing
    if (visited === 0) {
      username = extractMemberIdFromCookie(cookieString) || extractUsername(html);
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
    username,
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

// ─── Public (unauthenticated) scraping ───────────────────────────────────────

async function fetchPublicPage(url: string): Promise<string> {
  const response = await undiciFetch(url, {
    dispatcher: tlsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      Referer: 'https://m.pann.nate.com/',
    },
    redirect: 'follow',
  });

  const buffer = await response.arrayBuffer();
  const peek = new TextDecoder('ascii', { fatal: false }).decode(buffer.slice(0, 2000));
  const metaCharset = peek.match(/charset=['"']?([^'"\s;>]+)/i)?.[1]?.toLowerCase() ?? '';
  const charset = metaCharset === 'euc-kr' ? 'euc-kr' : 'utf-8';
  return new TextDecoder(charset).decode(buffer);
}

export interface PopularPost {
  title: string;
  url: string;
  viewCount: number;
  commentCount: number;
  body?: string;
}

/**
 * Scrapes the popular posts list from a mobile pann category page.
 * @param categoryId e.g. "c20025"
 * @param order "R" = 명예의전당(실시간), "B" = 베스트글
 */
export async function scrapePopularPosts(
  categoryId: string,
  order: 'R' | 'B' = 'R',
  limit = 20
): Promise<PopularPost[]> {
  const url = `https://m.pann.nate.com/talk/${categoryId}?order=${order}`;
  const html = await fetchPublicPage(url);
  const $ = cheerio.load(html);
  const posts: PopularPost[] = [];

  $('ul.list li').each((_, el) => {
    const href = $(el).find('a.cnbox').attr('href') ?? '';
    const idMatch = href.match(/\/talk\/(\d+)/);
    if (!idMatch) return;

    const postUrl = `https://m.pann.nate.com/talk/${idMatch[1]}`;
    const title = $(el).find('span.tit').text().trim();
    const viewText = $(el).find('span.sub span.num').first().text().replace(/,/g, '').trim();
    const viewCount = parseInt(viewText, 10) || 0;
    const commentText = $(el).find('span.count').text().replace(/[()]/g, '').trim();
    const commentCount = parseInt(commentText, 10) || 0;

    if (title) posts.push({ title, url: postUrl, viewCount, commentCount });
  });

  return posts.slice(0, limit);
}

/**
 * Fetches the body text of a single pann post (mobile version).
 * Truncates to 800 chars to keep token usage reasonable.
 */
export async function scrapePostBody(postUrl: string): Promise<string> {
  const html = await fetchPublicPage(postUrl);
  const $ = cheerio.load(html);
  return $('#pann-content').text().replace(/\s+/g, ' ').trim().slice(0, 800);
}
