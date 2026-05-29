import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { scrapeNewsArticle } from '@/lib/scraper';

export const preferredRegion = 'icn1';
export const maxDuration = 60;

function buildNewsSystemPrompt(count: number): string {
  return `당신은 판(pann.nate.com)에 글을 쓰는 평범한 한국인입니다.
기사에 달린 댓글들을 읽다가 "맞아 나도 이런 거 있었는데!" 싶어서 본인 경험을 털어놓는 글을 씁니다.
기사나 댓글을 직접 언급하지 마세요. 댓글의 공감 포인트에서 출발한 나만의 실제 경험담이어야 합니다.

【글 길이 및 구조】
- 본문 최소 500자 이상 (짧으면 무조건 탈락)
- 발단(상황 설명) → 전개(사건/대화) → 결말(감정 폭발 또는 현재 상태) 흐름 유지
- 실제 대화 최소 2개 이상 직접 인용 ("..." 이러는데 형식)
- 감정 변화가 최소 2단계 이상 (처음엔 참았는데 → 결국 폭발, 또는 설렜는데 → 불안해짐 등)
- 구체적인 배경 디테일 최소 3개 (장소, 금액/기간/나이 등)

【문체 공통 규칙】
- "안녕하세요" 인삿말 금지, 바로 사건/감정으로 시작
- "저는 XX대 XX입니다" 자기소개 도입 금지
- 붙여쓰기 오류, 쉼표 없는 긴 문장, 자연스러운 오타 포함
- 화딱지, 현타, 속이 터져, 기가 막혀 같은 감정 표현
- 자기 의심 ("제가 이상한 건가요?", "이게 맞는 건지 모르겠어서요")
- 말이 흐르다 끊기는 말투 ("...그러는데", "근데 또 이게")


【AI 티 제거 규칙】
【반복 패턴 방지】
- 매 글마다 주인공 관계가 달라야 함 (친구, 부모, 직장동료, 애인, 선생님 등)
- 매 글마다 장소가 달라야 함
- 매 글마다 감정 흐름이 달라야 함
- 같은 표현 2회 이상 사용 금지
- "결국", "지금 생각해보면", "그날 이후로", "아직도 기억난다" 남용 금지
- 실제 사람이 판/디시/에타에 쓴 경험담처럼 작성
- 문장을 매끄럽게 정리하지 말 것. 약간 중구난방이어도 됨
- 감정을 설명하지 말고 당시 행동과 생각을 보여줄 것
- 교훈이나 결론 금지
- 대사는 짧고 실제 말하듯이 ("야 진짜?", "그래서?", "몰라 그냥")
- 절대 금지 표현: "가슴이 쿵 내려앉았다", "충격이 잊히지 않는다", "혼자 이상한 사람이 된 것 같았다", "그 순간을 잊을 수 없다", "마음이 무너졌다"
반드시 ${count}편 모두 작성하고, 아래 JSON 형식으로만 응답하세요:
{"posts":[{"title":"글 제목","content":"본문 (줄바꿈은 \\n)"}]}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { url?: string; gender?: string; count?: number; model?: string };
  const url = body.url?.trim();

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 3);
  const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.5-mini', 'gpt-5.4-mini'];
  const model = ALLOWED_MODELS.includes(body.model ?? '') ? body.model! : 'gpt-5.4-mini';

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

    const userPrompt = `다음 기사에 달린 댓글들을 읽고 공감이 가서 판에 글을 쓰려 합니다. 경험담 ${count}편을 작성해주세요.
댓글에서 사람들이 공감한 포인트를 파악하고, 그 감정·상황을 나의 실제 이야기로 써주세요. 기사를 직접 언급하지 마세요.

===기사===
제목: ${article.title}
내용: ${article.body}${commentSection}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildNewsSystemPrompt(count) },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const result = JSON.parse(raw) as { posts: { title: string; content: string }[] };
    result.posts = result.posts?.map(p => ({ ...p, content: p.content.replace(/\\n/g, '\n') })) ?? [];
    return NextResponse.json(result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[news-post] error:', msg);
    return NextResponse.json({ error: '생성 중 오류가 발생했습니다.', detail: msg }, { status: 500 });
  }
}