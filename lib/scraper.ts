import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

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

  // ⚠️ VERIFY: These selectors are educated guesses — update after first authenticated test
  $('.list_item').each((_, el) => {
    const dateText = $(el).find('.date').text().trim();
    const viewText = $(el).find('.view_cnt em, .view em, em').first().text().trim();

    const date = dateTextToYYYYMMDD(dateText);
    const viewCount = parseInt(viewText.replace(/,/g, ''), 10) || 0;

    if (date) {
      posts.push({ date, viewCount });
    }
  });

  // ⚠️ VERIFY: Next page link selector — common Korean board patterns
  let $nextEl = $('a.next');
  if (!$nextEl.attr('href')) $nextEl = $('.paging a:last-child');
  if (!$nextEl.attr('href')) $nextEl = $('a:contains("다음")');

  const nextHref = $nextEl.attr('href') || null;
  const hasNextPage = !!nextHref &&
    !$nextEl.hasClass('disabled') &&
    !$nextEl.parent().hasClass('disabled');

  return {
    posts,
    hasNextPage,
    nextPageUrl: hasNextPage && nextHref
      ? nextHref.startsWith('http')
        ? nextHref
        : `https://pann.nate.com${nextHref}`
      : undefined,
  };
}

export function filterByDateRange(posts: Post[], startDate: string, endDate: string): Post[] {
  return posts.filter(p => p.date >= startDate && p.date <= endDate);
}

async function fetchEucKrPage(url: string, cookieString: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Cookie: cookieString,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });

  const buffer = await response.arrayBuffer();
  return iconv.decode(Buffer.from(buffer), 'euc-kr');
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
  // ⚠️ VERIFY: Starting URL — may need ?menu=talk or similar after checking logged-in page
  let url = 'https://pann.nate.com/my';
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

export async function validateCookieString(cookieString: string): Promise<boolean> {
  try {
    const html = await fetchEucKrPage('https://pann.nate.com/my', cookieString);
    return !isLoginPage(html);
  } catch {
    return false;
  }
}
