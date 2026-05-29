'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { StatsCard } from '@/components/StatsCard';
import { DateRangePicker } from '@/components/DateRangePicker';
import { RankingPagination } from '@/components/RankingPagination';
import { Button } from '@/components/ui/button';

const DEFAULT_START = new Date(2026, 4, 8);   // May 8, 2026
const DEFAULT_END = new Date(2026, 5, 7);     // Jun 7, 2026

const RANKING_PAGE_SIZE = 5;

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

interface RankingResponse {
  data: RankingEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface GeneratedPost {
  title: string;
  content: string;
}

interface AiResult {
  posts: GeneratedPost[];
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
  const [rankingPage, setRankingPage] = useState(1);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiGender, setAiGender] = useState<'여성' | '남성'>('여성');
  const [aiCategory, setAiCategory] = useState('c20025');
  const [activeTab, setActiveTab] = useState<'popular' | 'news'>('popular');
  const [aiModel, setAiModel] = useState('gpt-5.4-mini');
  const [newsUrl, setNewsUrl] = useState('');
  const [postCount, setPostCount] = useState<1 | 2 | 3>(1);

  const rankingTotalPages = Math.ceil(rankingTotal / RANKING_PAGE_SIZE);

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

  const fetchRankings = useCallback(async (page: number) => {
    if (!dateRange?.from || !dateRange?.to) return;
    const start = format(dateRange.from, 'yyyyMMdd');
    const end = format(dateRange.to, 'yyyyMMdd');

    fetch(`/api/rankings?start=${start}&end=${end}&page=${page}`)
      .then((r) => r.ok ? r.json() as Promise<RankingResponse> : Promise.resolve({ data: [], total: 0, page: 1, pageSize: RANKING_PAGE_SIZE }))
      .then((res) => {
        setRankings(res.data);
        setRankingTotal(res.total);
        setRankingPage(res.page);
      })
      .catch(() => {});
  }, [dateRange]);

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
    // Reset ranking state on fresh fetch
    setRankings([]);
    setRankingPage(1);
    setRankingTotal(0);

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
        fetchRankings(1);
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, fetchRankings]);

  const handleAiGenerate = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const res = await fetch('/api/ai-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: aiCategory, order: 'R', gender: aiGender, model: aiModel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, string>;
        setAiError(data.error ?? 'AI 생성 중 오류가 발생했습니다.');
      } else {
        const data = await res.json() as AiResult;
        setAiResult(data);
      }
    } catch {
      setAiError('네트워크 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  }, [aiGender, aiCategory]);

  const handleNewsGenerate = useCallback(async () => {
    if (!newsUrl.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const res = await fetch('/api/news-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newsUrl, gender: aiGender, count: postCount, model: aiModel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, string>;
        setAiError(data.error ?? 'AI 생성 중 오류가 발생했습니다.');
      } else {
        const data = await res.json() as AiResult;
        setAiResult(data);
      }
    } catch {
      setAiError('네트워크 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  }, [newsUrl, aiGender, postCount]);

  if (!authChecked) {
    return (
      <main className="min-h-[960px] flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">로딩 중...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-[960px] flex flex-col items-center justify-center gap-3 bg-slate-50 p-4">
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
    <main className="min-h-[960px] flex flex-col items-center justify-center gap-3 bg-slate-50 p-4">
      <h1 className="text-2xl font-bold">내 판 토크 통계</h1>

      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">기간</p>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex flex-col gap-3 w-full">
        <div className="grid grid-cols-2 gap-3">
          <StatsCard label="작성 글 수" value={stats?.count ?? null} unit="건" loading={loading} />
          <StatsCard label="총 조회수" value={stats?.totalViews ?? null} unit="" loading={loading} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatsCard label="5천~5만 조회" value={stats?.over5kCount ?? null} unit="건" loading={loading} compact />
          <StatsCard label="5만~10만 조회" value={stats?.over50kCount ?? null} unit="건" loading={loading} compact />
          <StatsCard label="10만+ 조회" value={stats?.over100kCount ?? null} unit="건" loading={loading} compact />
        </div>
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

      {(rankings.length > 0 || rankingTotal > 0) && (
        <div className="w-full max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            조회수 랭킹 — 같은 기간 조회한 유저
            {rankingTotal > 0 && (
              <span className="ml-1.5 text-xs font-normal">
                ({rankingTotal}명)
              </span>
            )}
          </p>
          <div className="rounded-lg border bg-white divide-y text-sm">
            {rankings.map((row, i) => {
              const rank = (rankingPage - 1) * RANKING_PAGE_SIZE + i + 1;
              return (
                <div
                  key={row.username}
                  className={`flex items-center gap-3 px-4 py-2 ${stats?.username === row.username ? 'bg-blue-50' : ''}`}
                >
                  <span className="w-6 text-center font-bold text-muted-foreground shrink-0 tabular-nums">
                    {rank}
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
              );
            })}
          </div>

          <RankingPagination
            page={rankingPage}
            totalPages={rankingTotalPages}
            onPageChange={fetchRankings}
          />
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">✨ AI 글 아이디어</p>
            <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
              {(['인기글 기반', '뉴스 기반'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(i === 0 ? 'popular' : 'news'); setAiResult(null); }}
                  className={`px-3 py-1 transition-colors ${(i === 0 ? activeTab === 'popular' : activeTab === 'news') ? 'bg-slate-800 text-white' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">모델</span>
            <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
              {(['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.5-mini', 'gpt-5.4-mini'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAiModel(m)}
                  className={`px-2.5 py-1 transition-colors ${aiModel === m ? 
'bg-slate-800 text-white'
 : 
'bg-white text-muted-foreground hover:bg-slate-50'
}`}
                >
                  {m === 'gpt-4o-mini' ? '4o-mini' : m === 'gpt-4.1-mini' ? '4.1-mini' : m === 'gpt-4.5-mini' ? '4.5-mini' : '5.4-mini'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              {activeTab === 'popular' && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: 'c20025', label: '결혼/시집/친정' },
                      { id: 'c20001', label: '사는 얘기' },
                      { id: 'c20008', label: '사랑, 고백해도 될까?' },
                      { id: 'c20038', label: '10대 이야기' },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => { setAiCategory(id); setAiResult(null); if (id === 'c20025') setAiGender('여성'); }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${aiCategory === id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
                    {(['여성', '남성'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => { setAiGender(g); setAiResult(null); }}
                        disabled={aiCategory === 'c20025' && g === '남성'}
                        className={`px-2.5 py-1 transition-colors ${aiGender === g ? 'bg-slate-800 text-white' : 'bg-white text-muted-foreground hover:bg-slate-50'} ${aiCategory === 'c20025' && g === '남성' ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'news' && (
                <>
                  <input
                    type="url"
                    placeholder="https://m.news.nate.com/view/..."
                    value={newsUrl}
                    onChange={(e) => setNewsUrl(e.target.value)}
                    className="text-xs border rounded px-2.5 py-1.5 w-72 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <div className="flex gap-2">
                    <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
                      {([1, 2, 3] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => setPostCount(n)}
                          className={`px-2.5 py-1 transition-colors ${postCount === n ? 'bg-slate-800 text-white' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
                        >
                          {n}편
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={activeTab === 'popular' ? handleAiGenerate : handleNewsGenerate}
              disabled={aiLoading || (activeTab === 'news' && !newsUrl.trim())}
            >
              {aiLoading ? '분석 중...' : aiResult ? '다시 생성' : (activeTab === 'news' ? '뉴스로 글 생성' : '오늘 인기글로 아이디어 생성')}
            </Button>
          </div>
        </div>

        {aiLoading && (
          <p className="text-sm text-muted-foreground text-center py-6">
            분석 중... (10~20초 소요)
          </p>
        )}

        {aiError && <p className="text-sm text-destructive">{aiError}</p>}

        {aiResult && (
          <div className="space-y-4">
            {aiResult.posts?.map((post, i) => (
              <div key={i} className="rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b gap-2">
                  <p className="font-semibold text-sm flex-1">{post.title}</p>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0 border rounded px-2 py-0.5"
                    onClick={() => { const body = post.content.replace(/\n/g, '\n\n'); navigator.clipboard.writeText(`${post.title}\n\n${body}`); }}
                  >
                    복사
                  </button>
                </div>
                <p className="px-4 py-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <a
        href="https://docs.google.com/spreadsheets/d/17uy1loDcwqa-pcARs9JluaEsHdCG0n_8IFsoLgAPB_k/edit?gid=0#gid=0"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
      >
        📋 판메이커스 내부 직원 지원현황 입력하러 가기
      </a>

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
