'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { StatsCard } from '@/components/StatsCard';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/button';

const DEFAULT_START = new Date(2026, 4, 8);   // May 8, 2026
const DEFAULT_END = new Date(2026, 5, 7);     // Jun 7, 2026

interface TopPost {
  date: string;
  title: string;
  url: string;
  viewCount: number;
}

interface StatsResult {
  username: string;
  count: number;
  totalViews: number;
  over5kCount: number;
  over50kCount: number;
  over100kCount: number;
  topPosts: TopPost[];
}

interface RankingEntry {
  username: string;
  total_views: number;
  post_count: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export default function HomePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: DEFAULT_START,
    to: DEFAULT_END,
  });
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated ?? false);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  // Auto-fetch when authenticated
  useEffect(() => {
    if (authenticated) {
      handleFetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const handleLogin = () => {
    window.open('https://xo.nate.com/Login.sk', '_blank', 'noopener,noreferrer');
  };

  const handleFetch = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('기간을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setStats(null);

    try {
      const start = format(dateRange.from, 'yyyyMMdd');
      const end = format(dateRange.to, 'yyyyMMdd');

      const res = await fetch(`/api/posts?start=${start}&end=${end}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as Record<string, string>);
        if (data.code === 'AUTH_EXPIRED') {
          setAuthenticated(false);
          setError('세션이 만료되었습니다. 다시 로그인해주세요.');
        } else {
          setError(data.error ?? '오류가 발생했습니다.');
        }
      } else {
        const data = await res.json() as StatsResult;
        setStats(data);

        // Fetch rankings for the same period
        fetch(`/api/rankings?start=${start}&end=${end}`)
          .then(r => r.ok ? r.json() : [])
          .then((rows: RankingEntry[]) => setRankings(rows))
          .catch(() => {});
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
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
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 p-4">
        <h1 className="text-2xl font-bold">내 판 토크 통계</h1>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside text-left">
          <li>아래 버튼으로 네이트 로그인 (새 탭)</li>
          <li>로그인 후 이 탭으로 돌아오기</li>
          <li>쿠키 입력하기 버튼 클릭 → 쿠키 붙여넣기</li>
        </ol>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={handleLogin} size="lg">
            1. 네이트 로그인 (새 탭)
          </Button>
          <Button variant="outline" size="lg" onClick={() => { window.location.href = '/setup'; }}>
            2. 쿠키 입력하기
          </Button>
        </div>
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
        <StatsCard label="작성 글 수" value={stats?.count ?? null} unit="건" loading={loading} />
        <StatsCard label="총 조회수" value={stats?.totalViews ?? null} unit="" loading={loading} />
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <StatsCard label="5천~5만 조회" value={stats?.over5kCount ?? null} unit="건" loading={loading} />
        <StatsCard label="5만~10만 조회" value={stats?.over50kCount ?? null} unit="건" loading={loading} />
        <StatsCard label="10만+ 조회" value={stats?.over100kCount ?? null} unit="건" loading={loading} />
      </div>

      {stats && stats.topPosts.length > 0 && (
        <div className="w-full max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground mb-2">5천+ 조회 글 목록</p>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {stats.topPosts.map((post, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 gap-3">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate flex-1 min-w-0"
                >
                  {post.title || '(제목 없음)'}
                </a>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {post.date.slice(0, 4)}.{post.date.slice(4, 6)}.{post.date.slice(6, 8)}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatNumber(post.viewCount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rankings.length > 0 && (
        <div className="w-full max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            조회수 랭킹 — 같은 기간 조회한 유저
          </p>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {rankings.map((row, i) => (
              <div
                key={row.username}
                className={`flex items-center gap-3 px-4 py-2 ${stats?.username === row.username ? 'bg-blue-50' : ''}`}
              >
                <span className="w-6 text-center font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium truncate">
                  {row.username}
                  {stats?.username === row.username && (
                    <span className="ml-1.5 text-xs text-blue-500">나</span>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {formatNumber(row.total_views)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleFetch} disabled={loading || !dateRange?.from || !dateRange?.to} variant="outline">
          {loading ? '조회 중...' : '다시 조회'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/setup'; }}>
          쿠키 재입력
        </Button>
      </div>
    </main>
  );
}
