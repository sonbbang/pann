# Pann Stats — Design Spec
**Date**: 2026-05-22  
**Status**: Approved

## Overview

A personal Next.js web app deployed on Vercel that shows the total post count and view count of the authenticated user's talk (토크) posts on pann.nate.com for a selected date range.

**Default date range**: 2026-05-08 to 2026-06-07  
**Target**: Single user (personal tool)

---

## Architecture

### System Diagram

```
Browser                    Vercel (Next.js)           pann.nate.com
  │                              │                           │
  │── GET /                      │                           │
  │   └─ no session?      ───────┤                           │
  │◄── 302 → Nate login          │                           │
  │                              │                           │
  │── after Nate login           │                           │
  │   redirect → /auth/callback  │                           │
  │                              │                           │
  │── GET /setup                 │                           │
  │   └─ enter HID cookie value  │                           │
  │                              │                           │
  │── POST /api/setup/cookie     │                           │
  │   └─ store encrypted cookie  │                           │
  │                              │                           │
  │── GET /api/posts             │                           │
  │   ?start=YYYYMMDD&end=YYYYMMDD                          │
  │                        ──────┤── GET /my ────────────────┤
  │                              │   Cookie: HID=<value>      │
  │                        ──────┤◄─ HTML (talk post list)   │
  │◄── JSON { count, views }     │   parse → filter → sum    │
```

### Auth Flow

Nate does not provide OAuth. Their session is cookie-based on `.nate.com`. Because our Vercel app runs on a different domain, we cannot auto-forward nate.com cookies. The chosen solution is a one-time Cookie Bridge:

1. Unauthenticated visit → redirect to `https://xo.nate.com/Login.sk?redirect=<app-callback-url>`
2. User logs in at Nate → redirected to `/auth/callback`
3. `/auth/callback` redirects to `/setup`
4. `/setup` shows instructions: open pann.nate.com while logged in → F12 → Application → Cookies → pann.nate.com → copy the entire cookie string → paste into input
5. `POST /api/setup/cookie` encrypts the full cookie string and stores as `nate_session` httpOnly cookie (30-day expiry)
6. Subsequent requests use stored HID for pann.nate.com requests

Session expiry: when the stored HID is rejected by pann.nate.com (response is login page), clear the `nate_session` cookie and redirect to Nate login.

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Main page — date range picker + stats display |
| `/auth/callback` | Receives Nate login redirect, redirects to `/setup` |
| `/setup` | One-time HID cookie entry screen |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/status` | GET | Returns `{ authenticated: boolean }` |
| `/api/setup/cookie` | POST | Accepts `{ cookieString: string }`, validates against pann.nate.com, stores encrypted |
| `/api/posts` | GET | `?start=YYYYMMDD&end=YYYYMMDD` — scrapes and returns `{ count, totalViews }` |

---

## UI

### Main Page (`/`)

```
┌─────────────────────────────────────────┐
│            내 판 토크 통계                │
├─────────────────────────────────────────┤
│  기간                                   │
│  [2026-05-08] ~ [2026-06-07]  [📅변경]  │
├──────────────────┬──────────────────────┤
│    작성 글 수     │      총 조회수         │
│                  │                      │
│      42건        │      12,543          │
│                  │                      │
├──────────────────┴──────────────────────┤
│              [조회하기]                  │
└─────────────────────────────────────────┘
```

- Calendar picker opens on "변경" click (shadcn/ui Calendar, range mode)
- "조회하기" triggers `/api/posts` call with selected dates
- Loading spinner during fetch
- Error state: "세션이 만료되었습니다" with re-login button

### Setup Page (`/setup`)

- Step-by-step instructions with screenshot guidance
- Textarea for pasting full cookie string from browser DevTools
- "연결하기" button → POST to `/api/setup/cookie`
- On success → redirect to `/`

---

## Scraping Logic

Target URL: `https://pann.nate.com/my` (with HID cookie, talk section)

```
fetchMyPage(hid, page=1)
  └─ GET pann.nate.com/my with Cookie: HID=<hid>
      ├─ if response is login page → throw AuthError
      └─ parse HTML with cheerio
          ├─ select talk post rows
          ├─ extract: date (YYYYMMDD), viewCount (integer)
          ├─ filter: date >= startDate AND date <= endDate
          └─ if has-next-page: recurse with page+1

aggregate(posts) → { count: posts.length, totalViews: sum(viewCount) }
```

**Pagination**: pann.nate.com/my likely uses `?page=N` or similar. Fetch all pages within the date range.

**Date detection**: Stop paginating when all posts on a page are older than startDate (assuming descending order).

**Encoding**: pann.nate.com uses EUC-KR encoding. Must decode response correctly.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| HTML parsing | cheerio |
| Cookie encryption | iron-session |
| Date handling | date-fns |
| Deployment | Vercel |

---

## Security

- Nate cookie string stored as `iron-session` encrypted httpOnly cookie — not accessible by client JS
- No credentials stored (ID/PW never handled by our app)
- Cookie string contains only browser-side session values, not passwords
- IRON_SESSION_SECRET must be set as Vercel environment variable

---

## Key Assumptions

1. pann.nate.com/my shows talk posts when a valid Nate session cookie string is passed
2. The page structure includes post date and view count in a parseable HTML format
3. Posts are listed in reverse-chronological order (enables early pagination stop)
4. The HID cookie provides full session access to pann.nate.com

These assumptions will be verified on first authenticated test. If the HTML structure differs, only the cheerio selectors in the scraper need adjustment.
