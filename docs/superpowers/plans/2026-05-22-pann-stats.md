# Pann Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that shows a user's total talk post count and view count on pann.nate.com for a selectable date range, using a cookie-based session bridge for authentication.

**Architecture:** The app stores an encrypted Nate session cookie (obtained once from browser DevTools after login) and uses it to make server-side requests to pann.nate.com/my, parsing the EUC-KR HTML with cheerio. Authentication is initiated via redirect to `xo.nate.com/Login.sk`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, cheerio, iconv-lite, iron-session (sealData/unsealData), Vitest

---

## File Structure

```
pann/
├── app/
│   ├── globals.css
│   ├── layout.tsx                     # root layout, metadata
│   ├── page.tsx                       # main stats page (Client Component)
│   ├── auth/callback/page.tsx         # Server Component: redirects to /setup
│   ├── setup/page.tsx                 # cookie input page (Client Component)
│   └── api/
│       ├── auth/status/route.ts       # GET: is session valid?
│       ├── setup/cookie/route.ts      # POST: seal and store Nate cookie
│       └── posts/route.ts             # GET: scrape, filter, aggregate
├── lib/
│   ├── session.ts                     # sealData/unsealData helpers + cookie name
│   └── scraper.ts                     # pann.nate.com fetch + cheerio parse
├── components/
│   ├── DateRangePicker.tsx            # shadcn Calendar with date-range state
│   ├── StatsCard.tsx                  # single stat card (label + value)
│   └── SetupForm.tsx                  # cookie textarea + submit
├── __tests__/
│   └── scraper.test.ts                # unit tests for scraper (mock HTML)
├── vitest.config.ts
├── vitest.setup.ts
├── .env.example
└── next.config.ts
```

---

## Task 1: Initialize Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (via CLI)
- Create: `.env.example`
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Run create-next-app**

```powershell
cd C:\Users\n3299\git\pann
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

When prompted "Would you like to proceed?" for the non-empty directory, type `y`.
When prompted about Turbopack, select `No`.

Expected: Next.js project files created (app/, public/, etc.)

- [ ] **Step 2: Install runtime dependencies**

```powershell
npm install cheerio iconv-lite iron-session
```

Expected: packages added to node_modules

- [ ] **Step 3: Install dev dependencies**

```powershell
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom vite-tsconfig-paths
```

Expected: dev packages added

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 5: Create vitest.setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Add test script to package.json**

In `package.json`, add to the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Create .env.example**

```
SESSION_SECRET=change-this-to-a-random-32-char-string-at-minimum
NATE_LOGIN_URL=https://xo.nate.com/Login.sk
```

- [ ] **Step 8: Create .env.local** (not committed)

```
SESSION_SECRET=your-secret-here-minimum-32-chars-long-random
NATE_LOGIN_URL=https://xo.nate.com/Login.sk
```

Generate a secure secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- [ ] **Step 9: Install shadcn/ui**

```powershell
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then add components:
```powershell
npx shadcn@latest add button card calendar popover badge
```

- [ ] **Step 10: Commit baseline**

```powershell
git add -A
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Session Helpers

**Files:**
- Create: `lib/session.ts`

- [ ] **Step 1: Create lib/session.ts**

```typescript
import { sealData, unsealData } from 'iron-session';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'nate_sess';
const SESSION_PASSWORD = process.env.SESSION_SECRET!;

if (!SESSION_PASSWORD || SESSION_PASSWORD.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

export async function getNateSession(): Promise<string | null> {
  const cookieStore = cookies();
  const sealed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sealed) return null;

  try {
    const data = await unsealData<{ nateSession: string }>(sealed, {
      password: SESSION_PASSWORD,
      ttl: 60 * 60 * 24 * 30,
    });
    return data.nateSession ?? null;
  } catch {
    return null;
  }
}

export async function setNateSession(cookieString: string): Promise<void> {
  const sealed = await sealData(
    { nateSession: cookieString },
    { password: SESSION_PASSWORD, ttl: 60 * 60 * 24 * 30 }
  );
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export async function clearNateSession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
}
```

- [ ] **Step 2: Commit**

```powershell
git add lib/session.ts
git commit -m "feat: add iron-session helpers for Nate cookie storage"
```

---

## Task 3: Scraper Library with Tests

**Files:**
- Create: `lib/scraper.ts`
- Create: `__tests__/scraper.test.ts`

> **IMPORTANT:** The HTML selectors in `parsePosts()` are based on common Korean board patterns and MUST be verified after the first authenticated test run. See `⚠️ VERIFY` comments.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/scraper.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect all to FAIL**

```powershell
npm test
```

Expected: `FAIL` — "Cannot find module '@/lib/scraper'"

- [ ] **Step 3: Implement lib/scraper.ts**

```typescript
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
  const cleaned = text.trim().replace(/[.\-]/g, '');
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
  const nextHref =
    $('a.next').attr('href') ||
    $('.paging a:last-child').attr('href') ||
    $('a:contains("다음")').attr('href');

  const hasNextPage = !!nextHref && !$('a.next').parent().hasClass('disabled');

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
```

- [ ] **Step 4: Run tests — expect all to PASS**

```powershell
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```powershell
git add lib/scraper.ts __tests__/scraper.test.ts vitest.config.ts vitest.setup.ts
git commit -m "feat: add pann.nate.com scraper with EUC-KR support and unit tests"
```

---

## Task 4: API Route — Auth Status

**Files:**
- Create: `app/api/auth/status/route.ts`

- [ ] **Step 1: Create app/api/auth/status/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function GET(): Promise<NextResponse> {
  const nateSession = await getNateSession();

  if (!nateSession) {
    return NextResponse.json({ authenticated: false });
  }

  const valid = await validateCookieString(nateSession);

  if (!valid) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/api/auth/status/route.ts
git commit -m "feat: add auth status API route"
```

---

## Task 5: API Route — Setup Cookie

**Files:**
- Create: `app/api/setup/cookie/route.ts`

- [ ] **Step 1: Create app/api/setup/cookie/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { setNateSession } from '@/lib/session';
import { validateCookieString } from '@/lib/scraper';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cookieString: string;

  try {
    const body = await request.json();
    cookieString = (body.cookieString ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!cookieString) {
    return NextResponse.json({ error: 'cookieString is required' }, { status: 400 });
  }

  const valid = await validateCookieString(cookieString);

  if (!valid) {
    return NextResponse.json(
      { error: '쿠키가 유효하지 않습니다. pann.nate.com에 로그인된 상태에서 쿠키를 복사해주세요.' },
      { status: 401 }
    );
  }

  await setNateSession(cookieString);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/api/setup/cookie/route.ts
git commit -m "feat: add setup cookie API route with validation"
```

---

## Task 6: API Route — Posts

**Files:**
- Create: `app/api/posts/route.ts`

- [ ] **Step 1: Create app/api/posts/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getNateSession } from '@/lib/session';
import { scrapeMyTalkPosts, AuthExpiredError } from '@/lib/scraper';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate || !/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) {
    return NextResponse.json(
      { error: 'start and end query params must be YYYYMMDD format' },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: 'start must be before or equal to end' },
      { status: 400 }
    );
  }

  const nateSession = await getNateSession();

  if (!nateSession) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await scrapeMyTalkPosts(nateSession, startDate, endDate);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: 'Session expired', code: 'AUTH_EXPIRED' }, { status: 401 });
    }
    console.error('Scrape error:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/api/posts/route.ts
git commit -m "feat: add posts API route with date range scraping"
```

---

## Task 7: Auth Callback Page

**Files:**
- Create: `app/auth/callback/page.tsx`

- [ ] **Step 1: Create directory and page**

```powershell
New-Item -ItemType Directory -Force app/auth/callback
```

Create `app/auth/callback/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { getNateSession } from '@/lib/session';

export default async function AuthCallbackPage() {
  const session = await getNateSession();

  if (session) {
    redirect('/');
  }

  redirect('/setup');
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/auth/callback/page.tsx
git commit -m "feat: add auth callback redirect page"
```

---

## Task 8: Setup Page & Component

**Files:**
- Create: `components/SetupForm.tsx`
- Create: `app/setup/page.tsx`

- [ ] **Step 1: Create components/SetupForm.tsx**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SetupForm() {
  const [cookieString, setCookieString] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/setup/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookieString: cookieString.trim() }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push('/');
    } else {
      setError(data.error ?? '오류가 발생했습니다.');
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>세션 연결</CardTitle>
        <CardDescription>
          아래 안내에 따라 pann.nate.com 쿠키를 복사해 붙여넣기 해주세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="mb-4 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>새 탭에서 <a href="https://pann.nate.com/my" target="_blank" rel="noreferrer" className="text-blue-500 underline">pann.nate.com/my</a> 접속 (로그인 상태 확인)</li>
          <li>F12 → <strong>Application</strong> → <strong>Cookies</strong> → <strong>https://pann.nate.com</strong> 선택</li>
          <li>모든 쿠키 행을 선택(Ctrl+A) → 브라우저 개발자 도구에서 우클릭 → "Copy All" 또는 아래 방법으로 수집:</li>
          <li>콘솔(Console) 탭에서 <code className="bg-muted px-1 rounded">document.cookie</code> 입력 후 출력값 전체 복사</li>
        </ol>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            className="w-full h-28 p-2 text-xs font-mono border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="HID=...; JSESSIONID=...; ..."
            value={cookieString}
            onChange={(e) => setCookieString(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !cookieString.trim()}>
            {loading ? '확인 중...' : '연결하기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create app/setup/page.tsx**

```powershell
New-Item -ItemType Directory -Force app/setup
```

```typescript
import { SetupForm } from '@/components/SetupForm';

export default function SetupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <SetupForm />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add components/SetupForm.tsx app/setup/page.tsx
git commit -m "feat: add setup page with cookie input form"
```

---

## Task 9: Stats Components

**Files:**
- Create: `components/StatsCard.tsx`
- Create: `components/DateRangePicker.tsx`

- [ ] **Step 1: Create components/StatsCard.tsx**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  label: string;
  value: number | null;
  unit: string;
  loading?: boolean;
}

export function StatsCard({ label, value, unit, loading = false }: StatsCardProps) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-3xl font-bold">
            {value === null ? '--' : value.toLocaleString('ko-KR')}
            <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create components/DateRangePicker.tsx**

```typescript
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const label = value?.from && value?.to
    ? `${format(value.from, 'yyyy.MM.dd', { locale: ko })} ~ ${format(value.to, 'yyyy.MM.dd', { locale: ko })}`
    : '기간 선택';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={2}
          locale={ko}
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Install date-fns and lucide-react (if not already installed)**

```powershell
npm install date-fns lucide-react
```

- [ ] **Step 4: Commit**

```powershell
git add components/StatsCard.tsx components/DateRangePicker.tsx
git commit -m "feat: add StatsCard and DateRangePicker components"
```

---

## Task 10: Main Stats Page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '내 판 토크 통계',
  description: '네이트 판 토크 작성글 통계 조회',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace app/page.tsx**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { StatsCard } from '@/components/StatsCard';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/button';

const DEFAULT_START = new Date(2026, 4, 8);   // May 8, 2026
const DEFAULT_END = new Date(2026, 5, 7);     // Jun 7, 2026

interface StatsResult {
  count: number;
  totalViews: number;
}

export default function HomePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: DEFAULT_START,
    to: DEFAULT_END,
  });
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        setAuthChecked(true);
      });
  }, []);

  const handleLogin = () => {
    const loginUrl = `https://xo.nate.com/Login.sk?redirect=${encodeURIComponent(
      `${window.location.origin}/auth/callback`
    )}&cpurl=${encodeURIComponent('npann_ndr.nate.com/my/talk')}`;
    window.location.href = loginUrl;
  };

  const handleFetch = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('기간을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setStats(null);

    const start = format(dateRange.from, 'yyyyMMdd');
    const end = format(dateRange.to, 'yyyyMMdd');

    const res = await fetch(`/api/posts?start=${start}&end=${end}`);
    const data = await res.json();

    if (!res.ok) {
      if (data.code === 'AUTH_EXPIRED') {
        setAuthenticated(false);
        setError('세션이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        setError(data.error ?? '오류가 발생했습니다.');
      }
    } else {
      setStats(data);
    }

    setLoading(false);
  }, [dateRange]);

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">로딩 중...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-4">
        <h1 className="text-2xl font-bold">내 판 토크 통계</h1>
        <p className="text-muted-foreground">네이트 계정으로 로그인이 필요합니다.</p>
        <Button onClick={handleLogin} size="lg">
          네이트 로그인
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <h1 className="text-2xl font-bold">내 판 토크 통계</h1>

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">기간</p>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <StatsCard
          label="작성 글 수"
          value={stats?.count ?? null}
          unit="건"
          loading={loading}
        />
        <StatsCard
          label="총 조회수"
          value={stats?.totalViews ?? null}
          unit=""
          loading={loading}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleFetch} disabled={loading || !dateRange?.from || !dateRange?.to} size="lg">
        {loading ? '조회 중...' : '조회하기'}
      </Button>
    </main>
  );
}
```

- [ ] **Step 3: Run dev server and manually verify**

```powershell
npm run dev
```

Navigate to `http://localhost:3000` and verify:
- Login button appears (since no session)
- Clicking login redirects to `xo.nate.com/Login.sk`

- [ ] **Step 4: Commit**

```powershell
git add app/page.tsx app/layout.tsx
git commit -m "feat: add main stats page with date picker and auth flow"
```

---

## Task 11: Vercel Deployment

**Files:**
- Create: `vercel.json` (optional, for function config)

- [ ] **Step 1: Install Vercel CLI (if not installed)**

```powershell
npm install -g vercel
```

- [ ] **Step 2: Deploy to Vercel (first time)**

```powershell
vercel
```

When prompted:
- Link to existing project? No → create new project
- Project name: `pann`
- Directory: `.`
- Override settings? No

Expected: preview URL provided

- [ ] **Step 3: Set environment variable on Vercel**

```powershell
vercel env add SESSION_SECRET
```

Paste the same SESSION_SECRET value from `.env.local` when prompted.
Select: Production, Preview, Development.

- [ ] **Step 4: Deploy to production**

```powershell
vercel --prod
```

- [ ] **Step 5: End-to-end test on production URL**

1. Visit the production URL
2. Click "네이트 로그인"
3. Log in at Nate — should redirect to `/setup`
4. On `/setup`: open pann.nate.com in browser console, run `document.cookie`, copy output
5. Paste into setup form, click "연결하기"
6. Should redirect to `/` with stats UI
7. Select date range and click "조회하기"
8. Verify stats appear

> **⚠️ If stats return 0 or error:** The scraper selectors in `lib/scraper.ts` need updating. Open the logged-in pann.nate.com/my page, inspect the HTML structure of the post list, and update the cheerio selectors in `parsePosts()`.

- [ ] **Step 6: Final commit**

```powershell
git add -A
git commit -m "feat: complete pann stats app"
git push
```

---

## Post-Deploy: Updating Scraper Selectors

After first authenticated run, if data is incorrect:

1. Log in to pann.nate.com/my in browser
2. Right-click a post item → Inspect
3. Note the exact class names for: post container, date element, view count element
4. Update `parsePosts()` in `lib/scraper.ts`:
   - `$('.list_item')` → correct container selector
   - `.find('.date')` → correct date selector
   - `.find('.view_cnt em')` → correct view count selector
5. Update `parsePosts` test mock HTML in `__tests__/scraper.test.ts` to match real structure
6. Run `npm test` to confirm tests pass
7. Commit and redeploy
