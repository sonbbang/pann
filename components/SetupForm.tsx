'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SetupForm() {
  const [cookieString, setCookieString] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [snippet, setSnippet] = useState('');
  const [showManual, setShowManual] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSubmitted = useRef(false);

  useEffect(() => {
    setSnippet(`window.location='${window.location.origin}/setup?c='+encodeURIComponent(document.cookie)`);
  }, []);

  // Auto-fill (and submit) when redirected back with ?c=
  useEffect(() => {
    const c = searchParams.get('c');
    if (!c || autoSubmitted.current) return;
    autoSubmitted.current = true;
    // searchParams.get() already percent-decodes — no second decodeURIComponent
    setCookieString(c);
    submit(c);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function submit(value: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/setup/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: value.trim() }),
      });
      if (res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? '오류가 발생했습니다.');
    } catch {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(cookieString);
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Nate 계정 연결</CardTitle>
        <CardDescription>pann.nate.com 쿠키를 가져와서 연결합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Auto flow */}
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">자동으로 가져오기 (추천)</p>
          <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
            <li>
              <a
                href="https://pann.nate.com/my?mode=T"
                target="_blank"
                rel="noreferrer"
                className="underline font-medium"
              >
                pann.nate.com 접속
              </a>
              {' '}— 로그인 상태 확인
            </li>
            <li>
              <strong>F12</strong> → <strong>Console</strong> 탭
            </li>
            <li>아래 코드 복사 후 붙여넣기 → Enter</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="flex-1 block rounded bg-white border border-blue-200 px-2 py-1.5 text-xs font-mono break-all text-slate-700 select-all">
              {snippet || 'window.location=\'http://localhost:3000/setup?c=\'+encodeURIComponent(document.cookie)'}
            </code>
            <button
              type="button"
              onClick={copySnippet}
              className="shrink-0 rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 transition-colors"
            >
              {copied ? '✓ 복사됨' : '복사'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          <button
            type="button"
            className="underline hover:text-foreground transition-colors"
            onClick={() => setShowManual(v => !v)}
          >
            {showManual ? '수동 입력 접기' : '직접 쿠키 붙여넣기'}
          </button>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Manual fallback */}
        {showManual && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ Network 탭 → Request Headers → <strong>Cookie</strong> 값을 복사하세요.
              Console의 <code>document.cookie</code>도 가능합니다.
            </div>
            <label htmlFor="cookie-input" className="text-sm font-medium">
              쿠키 문자열
            </label>
            <textarea
              id="cookie-input"
              className="w-full h-28 p-2 text-xs font-mono border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="HID=...; JSESSIONID=...; ..."
              value={cookieString}
              onChange={(e) => setCookieString(e.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !cookieString.trim()}>
              {loading ? '저장 중...' : '연결하기'}
            </Button>
          </form>
        )}

        {/* Error when auto-submitted */}
        {error && !showManual && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {loading && !showManual && (
          <p className="text-sm text-center text-muted-foreground">연결 중...</p>
        )}
      </CardContent>
    </Card>
  );
}
