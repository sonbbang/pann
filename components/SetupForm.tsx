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

      const data = await res.json();

      if (res.ok) {
        router.push('/');
        return;
      }
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !cookieString.trim()}>
            {loading ? '쿠키 확인 중...' : '연결하기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
