import { describe, test, expect } from 'vitest';
import { isLoginPage, parsePosts, filterByDateRange, dateTextToYYYYMMDD } from '@/lib/scraper';

const LOGIN_HTML = `<html><body><form name="f_login"><input name="redirect" value="https://pann.nate.com/my"/></form></body></html>`;

const POSTS_HTML = `
<html><body>
  <ul class="list_wrap">
    <li class="list_item">
      <a href="/talk/100001">첫 번째 토크 제목</a>
      <span class="date">2026.05.15</span>
      <span class="view_cnt">조회 <em>234</em></span>
    </li>
    <li class="list_item">
      <a href="/talk/100002">두 번째 토크 제목</a>
      <span class="date">2026.05.10</span>
      <span class="view_cnt">조회 <em>1,567</em></span>
    </li>
    <li class="list_item">
      <a href="/talk/100003">오래된 토크</a>
      <span class="date">2026.04.30</span>
      <span class="view_cnt">조회 <em>89</em></span>
    </li>
  </ul>
  <div class="paging">
    <span class="on">1</span>
    <a href="/my?page=2">2</a>
    <a class="next" href="/my?page=2">다음</a>
  </div>
</body></html>`;

const NO_NEXT_HTML = `
<html><body>
  <ul class="list_wrap">
    <li class="list_item">
      <a href="/talk/100004">마지막 토크</a>
      <span class="date">2026.05.08</span>
      <span class="view_cnt">조회 <em>42</em></span>
    </li>
  </ul>
  <div class="paging"><span class="on">2</span></div>
</body></html>`;

describe('isLoginPage', () => {
  test('detects login page by f_login form', () => {
    expect(isLoginPage(LOGIN_HTML)).toBe(true);
  });

  test('returns false for normal post list', () => {
    expect(isLoginPage(POSTS_HTML)).toBe(false);
  });
});

describe('dateTextToYYYYMMDD', () => {
  test('converts "2026.05.15" to "20260515"', () => {
    expect(dateTextToYYYYMMDD('2026.05.15')).toBe('20260515');
  });

  test('converts "2026-05-15" to "20260515"', () => {
    expect(dateTextToYYYYMMDD('2026-05-15')).toBe('20260515');
  });

  test('returns empty string for unparseable input', () => {
    expect(dateTextToYYYYMMDD('invalid')).toBe('');
  });
});

describe('parsePosts', () => {
  test('extracts posts with date and viewCount', () => {
    const result = parsePosts(POSTS_HTML);
    expect(result.posts).toHaveLength(3);
    expect(result.posts[0]).toEqual({ date: '20260515', viewCount: 234 });
    expect(result.posts[1]).toEqual({ date: '20260510', viewCount: 1567 });
    expect(result.posts[2]).toEqual({ date: '20260430', viewCount: 89 });
  });

  test('detects next page link', () => {
    const result = parsePosts(POSTS_HTML);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextPageUrl).toContain('page=2');
  });

  test('no next page when only current page indicator', () => {
    const result = parsePosts(NO_NEXT_HTML);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextPageUrl).toBeUndefined();
  });

  test('returns empty array when no list items', () => {
    const result = parsePosts('<html><body><ul class="list_wrap"></ul></body></html>');
    expect(result.posts).toHaveLength(0);
  });
});

describe('filterByDateRange', () => {
  const posts = [
    { date: '20260515', viewCount: 234 },
    { date: '20260510', viewCount: 1567 },
    { date: '20260430', viewCount: 89 },
  ];

  test('keeps posts within range inclusive', () => {
    const result = filterByDateRange(posts, '20260508', '20260607');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('20260515');
    expect(result[1].date).toBe('20260510');
  });

  test('excludes posts outside range', () => {
    const result = filterByDateRange(posts, '20260501', '20260509');
    expect(result).toHaveLength(0);
  });

  test('includes posts on boundary dates', () => {
    const result = filterByDateRange(posts, '20260510', '20260515');
    expect(result).toHaveLength(2);
  });
});
