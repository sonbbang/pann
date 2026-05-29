import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { scrapePopularPosts, scrapePostBody, type PopularPost } from '@/lib/scraper';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export const preferredRegion = 'icn1';
export const maxDuration = 60;

function buildSystemPrompt(gender: '여성' | '남성', category: string): string {
  const isMarriageCategory = category === 'c20025';
  const genderGuide = gender === '남성'
    ? isMarriageCategory
      ? `【남성 작성자】
- 글쓴이는 남성. 아내, 장모님, 처가 어휘 사용
- 절대 금지: 남편, 시어머니, 시댁, 친정`
      : `【남성 작성자】
- 글쓴이는 남성. 여자친구, 좋아하는 여자 어휘 사용
- 절대 금지: 남편, 시어머니, 시댁, 친정, 결혼 관련 소재`
    : isMarriageCategory
      ? `【여성 작성자】
- 글쓴이는 여성. 남편, 시어머니, 친정 어휘 사용`
      : `【여성 작성자】
- 글쓴이는 여성. 남자친구, 좋아하는 남자 어휘 사용
- 절대 금지: 남편, 시어머니, 시댁, 친정, 결혼 관련 소재`;

  return `당신은 판(pann.nate.com)에 글을 쓰는 평범한 한국 ${gender}입니다.
참고글들의 소재와 문체를 분석해 같은 주제 영역(연애, 일상, 가족 등)의 새 글 3편을 직접 작성하세요.
소재는 반드시 참고글을 따를 것. 시스템이 강요하는 다른 주제로 빠지지 말 것.

${genderGuide}

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
반드시 아래 JSON 형식으로만 응답하세요.

{
  "posts": [
    {
      "title": "글 제목",
      "content": "본문 전체 (줄바꿈은 \\n 사용)"
    }
  ]
}`;
}

const CATEGORY_META: Record<string, { name: string; topic: string; forbidden: string }> = {
  c20025: { name: '결혼/시집/친정', topic: '결혼생활, 시댁, 친정, 부부 갈등', forbidden: '연애, 짝사랑, 고백, 학교' },
  c20001: { name: '사는 얘기',      topic: '일상, 직장, 친구, 가족, 생활 속 에피소드', forbidden: '' },
  c20008: { name: '사랑, 고백해도 될까?', topic: '짝사랑, 고백, 연애 감정, 그리움, 설렘', forbidden: '결혼, 시어머니, 시댁, 친정, 남편 (연애·고백 카테고리이므로 결혼 소재 금지)' },
  c20038: { name: '10대 이야기',    topic: '학교생활, 친구, 첫사랑, 청소년 고민', forbidden: '결혼, 시어머니, 직장, 취업' },
};

function buildUserPrompt(posts: PopularPost[], category: string): string {
  const meta = CATEGORY_META[category] ?? { name: category, topic: '다양한 주제', forbidden: '' };
  const lines = posts.map((p, i) => {
    const views = p.viewCount > 0 ? `조회 ${p.viewCount.toLocaleString('ko-KR')}` : '';
    const comments = p.commentCount > 0 ? ` | 댓글 ${p.commentCount}` : '';
    const body = p.body ? `\n본문: ${p.body}` : '';
    return `[참고글 ${i + 1}] 제목: ${p.title}${views ? ` (${views}${comments})` : ''}${body}`;
  });

  const topicConstraint = `\n⚠️ 소재 규칙: 반드시 "${meta.name}" 카테고리 주제(${meta.topic})로만 작성.${meta.forbidden ? ` 금지 소재: ${meta.forbidden}.` : ''}`;

  return `다음은 판(pann.nate.com) "${meta.name}" 카테고리 인기글입니다. 문체 패턴을 분석해 같은 카테고리의 새 글 3편을 작성하세요.${topicConstraint}\n\n===참고글===\n${lines.join('\n\n')}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { category?: string; order?: string; gender?: string };
  const category = body.category ?? 'c20025';
  const order = (body.order ?? 'R') as 'R' | 'B';
  // c20025(결혼/시집/친정)은 여성 전용 카테고리
  const gender = (category === 'c20025' ? '여성' : (body.gender === '남성' ? '남성' : '여성')) as '여성' | '남성';

  if (!/^c\d+$/.test(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Step 1: get popular post list
    const posts = await scrapePopularPosts(category, order);

    if (posts.length === 0) {
      return NextResponse.json({ error: 'No popular posts found' }, { status: 404 });
    }

    // Step 2: fetch body for each post in parallel (fail-soft)
    const postsWithBody = await Promise.all(
      posts.map(async (post) => {
        try {
          const postBody = await scrapePostBody(post.url);
          return { ...post, body: postBody };
        } catch {
          return post;
        }
      })
    );

    // Generate directly with the selected gender (no post-processing conversion)
    const userPrompt = buildUserPrompt(postsWithBody, category);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(gender, category) },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });
    const raw = completion.choices[0].message.content ?? '{}';
    const result = JSON.parse(raw) as { posts: { title: string; content: string }[] };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai-posts] error:', msg);
    return NextResponse.json({ error: 'AI generation failed', detail: msg }, { status: 500 });
  }
}