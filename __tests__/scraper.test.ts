import { describe, test, expect } from 'vitest';
import { isLoginPage, parsePosts, filterByDateRange, dateTextToYYYYMMDD } from '@/lib/scraper';

const LOGIN_HTML = `<html><body><form name="f_login"><input name="redirect" value="https://pann.nate.com/my"/></form></body></html>`;

// Mirrors actual pann.nate.com/my?mode=T HTML structure (confirmed via browser DevTools)
const POSTS_HTML = `
<html><body>
  <table class="mylist">
    <thead><tr><th>제목</th><th>날짜</th><th>조회</th></tr></thead>
    <tbody>
      <tr class="first">
        <td><a href="/talk/100001">첫 번째 토크 제목</a></td>
        <td class="date">2026.05.15</td>
        <td class="count">234</td>
      </tr>
      <tr>
        <td><a href="/talk/100002">두 번째 토크 제목</a></td>
        <td class="date">2026.05.10</td>
        <td class="count">1,567</td>
      </tr>
      <tr>
        <td><a href="/talk/100003">오래된 토크</a></td>
        <td class="date">2026.04.30</td>
        <td class="count">89</td>
      </tr>
    </tbody>
  </table>
  <div class="paginate list-page">
    <a class="btn pre" href="javascript:alert('첫 번째 페이지입니다.')">이전</a>
    <a class="btn next" href="/my?mode=T&page=2">다음</a>
  </div>
</body></html>`;

// Last page: next button href is javascript: (no real next page)
const NO_NEXT_HTML = `
<html><body>
  <table class="mylist">
    <thead><tr><th>제목</th><th>날짜</th><th>조회</th></tr></thead>
    <tbody>
      <tr class="first">
        <td><a href="/talk/100004">마지막 토크</a></td>
        <td class="date">2026.05.08</td>
        <td class="count">42</td>
      </tr>
    </tbody>
  </table>
  <div class="paginate list-page">
    <a class="btn pre" href="/my?mode=T&page=1">이전</a>
    <a class="btn next" href="javascript:alert('마지막 페이지입니다.')">다음</a>
  </div>
</body></html>`;

describe('isLoginPage', () => {
  test('detects login page by f_login form', () => {
    expect(isLoginPage(LOGIN_HTML)).toBe(true);
  });

  test('detects login page by LoginAuth.sk', () => {
    expect(isLoginPage('<html><body><script src="LoginAuth.sk"></script></body></html>')).toBe(true);
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
  test('extracts posts with date, viewCount, title, url', () => {
    const result = parsePosts(POSTS_HTML);
    expect(result.posts).toHaveLength(3);
    expect(result.posts[0]).toEqual({
      date: '20260515',
      viewCount: 234,
      title: '첫 번째 토크 제목',
      url: 'https://pann.nate.com/talk/100001',
    });
    expect(result.posts[1]).toEqual({
      date: '20260510',
      viewCount: 1567,
      title: '두 번째 토크 제목',
      url: 'https://pann.nate.com/talk/100002',
    });
  });

  test('detects next page link when href is a real URL', () => {
    const result = parsePosts(POSTS_HTML);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextPageUrl).toBe('https://pann.nate.com/my?mode=T&page=2');
  });

  test('no next page when a.btn.next href is javascript:', () => {
    const result = parsePosts(NO_NEXT_HTML);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextPageUrl).toBeUndefined();
  });

  test('returns empty array when table has no rows', () => {
    const html = `<html><body>
      <table class="mylist"><thead></thead><tbody></tbody></table>
    </body></html>`;
    const result = parsePosts(html);
    expect(result.posts).toHaveLength(0);
    expect(result.hasNextPage).toBe(false);
  });

  test('parses comma-separated view count correctly', () => {
    const html = `<html><body>
      <table class="mylist">
        <tbody>
          <tr>
            <td><a href="/talk/1">글</a></td>
            <td class="date">2026.05.01</td>
            <td class="count">12,345</td>
          </tr>
        </tbody>
      </table>
    </body></html>`;
    const result = parsePosts(html);
    expect(result.posts[0].viewCount).toBe(12345);
  });
});

describe('filterByDateRange', () => {
  const posts = [
    { date: '20260515', viewCount: 234, title: 'A', url: 'https://pann.nate.com/talk/1' },
    { date: '20260510', viewCount: 1567, title: 'B', url: 'https://pann.nate.com/talk/2' },
    { date: '20260430', viewCount: 89, title: 'C', url: 'https://pann.nate.com/talk/3' },
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
