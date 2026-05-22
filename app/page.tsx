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
        setAuthenticated(data.authenticated ?? false);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
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
