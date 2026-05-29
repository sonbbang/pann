import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { scrapeNewsArticle } from '@/lib/scraper';

export const preferredRegion = 'icn1';
export const maxDuration = 60;

function buildNewsSystemPrompt(gender: '여성' | '남성'): string {
  const genderGuide = gender === '남성'
    ? `【남성 작성자】
- 글쓴이는 남성. 여자친구/아내/좋아하는 여자 어휘 사용
- 절대 금지: 남편, 시어머니, 시댁, 친정`
    : `【여성 작성자】
- 글쓴이는 여성. 남자친구/남편/좋아하는 남자 어휘 사용
- 절대 금지: 아내, 처가, 장모님`;

  return `당신은 뉴스 기사를 읽고 떠오른 나의 경험을 판(pann.nate.com)에 쓰는 평범한 한국 ${gender}입니다.
기사 내용을 직접 언급하거나 요약하지 마세요. 기사와 댓글에서 공감 포인트를 찾아 나의 실제 경험담으로 자연스럽게 녹여내세요.

${genderGuide}

【글 길이 및 구조】
- 본문 최소 500자 이상 (짧으면 탈락)
- 발단(상황) → 전개(사건/대화) → 결말(감정 폭발 또는 현재 상태)
- 실제 대화 최소 2개 이상 ("..." 형식)
- 감정 변화 최소 2단계
- 구체적 배경 디테일 최소 3개 (장소, 금액/기간/나이 등)

【문체】
- "안녕하세요" 인삿말 금지, 바로 사건/감정으로 시작
- 붙여쓰기 오류, 쉼표 없는 긴 문장, 자연스러운 오타 포함
- 화딱지, 현타, 속이 터져 같은 감정 표현
- 자기 의심 ("제가 이상한 건가요?")
- 말이 흐르다 끊기는 말투

반드시 아래 JSON 형식으로만 응답하세요:
{"posts":[{"title":"글 제목","content":"본문 (줄바꿈은 \\\\n)"}]}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { url?: string; gender?: string; count?: number };
  const url = body.url?.trim();
  const gender = (body.gender === '남성' ? '남성' : '여성') as '여성' | '남성';
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 3);

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'URL을 입력해주세요.' }, { status: 400 });
  }

  try {
    const article = await scrapeNewsArticle(url);

    if (!article.title && !article.body) {
      return NextResponse.json({ error: '기사 내용을 가져올 수 없습니다.' }, { status: 422 });
    }

    const commentSection = article.comments.length > 0
      ? `\n\n===댓글 반응===\n${article.comments.slice(0, 8).map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';

    const userPrompt = `다음 기사를 읽고 떠오른 나의 경험담 ${count}편을 작성해주세요.
기사를 직접 언급하지 말고, 기사의 핵심 상황/감정을 나의 실제 이야기로 자연스럽게 풀어내세요.

===기사===
제목: ${article.title}
내용: ${article.body}${commentSection}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildNewsSystemPrompt(gender) },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const result = JSON.parse(raw) as { posts: { title: string; content: string }[] };
    return NextResponse.json(result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[news-post] error:', msg);
    return NextResponse.json({ error: '생성 중 오류가 발생했습니다.', detail: msg }, { status: 500 });
  }
}