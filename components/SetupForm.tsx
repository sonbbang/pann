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

    try {
      const res = await fetch('/api/setup/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: cookieString.trim() }),
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

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>쿠키 입력</CardTitle>
        <CardDescription>
          아래 순서대로 pann.nate.com 쿠키를 복사해 붙여넣기 해주세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="mb-5 space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            새 탭에서{' '}
            <a
              href="https://pann.nate.com/my?mode=T"
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 underline"
            >
              pann.nate.com/my?mode=T
            </a>{' '}
            접속 — 내 글 목록이 보여야 합니다 (로그인 상태 확인)
          </li>
          <li>
            <strong>F12</strong> → <strong>Network</strong> 탭 클릭
          </li>
          <li>
            <strong>F5</strong> 로 페이지 새로고침
          </li>
          <li>
            Network 목록 맨 위 요청(<code className="bg-muted px-1 rounded">my?mode=T</code>) 클릭
          </li>
          <li>
            오른쪽 패널 → <strong>Headers</strong> → <strong>Request Headers</strong> 섹션에서{' '}
            <strong>Cookie</strong> 값 전체 복사
          </li>
        </ol>

        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ <strong>주의:</strong> Console 탭의 <code>document.cookie</code>로 복사하면 일부 쿠키가 누락됩니다.
          반드시 <strong>Network 탭 → Request Headers → Cookie</strong> 에서 복사하세요.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="cookie-input" className="text-sm font-medium">
            쿠키 문자열
          </label>
          <textarea
            id="cookie-input"
            className="w-full h-28 p-2 text-xs font-mono border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="HID=...; PHPSESSID=...; NATE_HASH=...; ..."
            value={cookieString}
            onChange={(e) => setCookieString(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !cookieString.trim()}>
            {loading ? '저장 중...' : '연결하기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
