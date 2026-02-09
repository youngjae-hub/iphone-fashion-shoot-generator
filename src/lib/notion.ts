import { Client } from '@notionhq/client';

// Notion Client 싱글턴
let notionClient: Client | null = null;

function getNotionClient(): Client {
  if (!notionClient) {
    const token = process.env.NOTION_API_KEY;
    if (!token) {
      throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    notionClient = new Client({ auth: token });
  }
  return notionClient;
}

// Database ID 환경 변수
function getDatabaseId(): string {
  const id = process.env.NOTION_DATABASE_ID?.trim();
  if (!id) {
    throw new Error('NOTION_DATABASE_ID 환경 변수가 설정되지 않았습니다. /api/notion-log/setup을 먼저 실행하세요.');
  }
  return id;
}

// ============================================
// Database 생성 (초기 설정용)
// ============================================

export async function createGenerationLogDatabase(parentPageId: string): Promise<string> {
  const notion = getNotionClient();

  const response = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'Generation Log' } }],
    description: [{ type: 'text', text: { content: 'AI 이미지 생성 로그 - rapport. STUDIO' } }],
    initial_data_source: {
      properties: {
        '제목': {
          title: {},
        },
        'Provider': {
          select: {
            options: [
              { name: 'google-gemini', color: 'blue' },
              { name: 'replicate-flux', color: 'purple' },
              { name: 'stability-ai', color: 'green' },
              { name: 'idm-vton', color: 'orange' },
              { name: 'kolors-vton', color: 'pink' },
            ],
          },
        },
        '모델명': {
          rich_text: {},
        },
        '포즈': {
          select: {
            options: [
              { name: 'front', color: 'blue' },
              { name: 'side', color: 'green' },
              { name: 'back', color: 'orange' },
              { name: 'styled', color: 'purple' },
              { name: 'detail', color: 'pink' },
            ],
          },
        },
        '프롬프트': {
          rich_text: {},
        },
        '커스텀 프롬프트': {
          rich_text: {},
        },
        '스타일참조': {
          checkbox: {},
        },
        '배경스팟': {
          checkbox: {},
        },
        '성공': {
          checkbox: {},
        },
        '의류종류': {
          multi_select: {
            options: [
              { name: '상의', color: 'blue' },
              { name: '하의', color: 'green' },
              { name: '원피스', color: 'purple' },
              { name: '아우터', color: 'orange' },
              { name: '스커트', color: 'pink' },
              { name: '악세서리', color: 'yellow' },
            ],
          },
        },
        'MD 평가': {
          select: {
            options: [
              { name: '좋음', color: 'green' },
              { name: '보통', color: 'yellow' },
              { name: '나쁨', color: 'red' },
            ],
          },
        },
        '피드백 메모': {
          rich_text: {},
        },
        '결과 이미지': {
          url: {},
        },
        '의류 원본': {
          url: {},
        },
        '스타일참조 이미지': {
          rich_text: {},
        },
        '배경스팟 이미지': {
          rich_text: {},
        },
        '생성일시': {
          date: {},
        },
        '총 생성 컷 수': {
          number: {},
        },
        '소요 시간 (초)': {
          number: {},
        },
      },
    },
  });

  return response.id;
}

// ============================================
// 로그 기록
// ============================================

export interface GenerationLogEntry {
  title: string;
  provider: string;
  modelName?: string;
  pose: string;
  prompt?: string;
  customPrompt?: string;
  hasStyleReference: boolean;
  hasBackgroundSpot: boolean;
  success: boolean;
  garmentCategory?: string[];
  resultImageUrl?: string;
  garmentImageUrl?: string;
  styleReferenceInfo?: string;
  backgroundSpotInfo?: string;
  totalShotsGenerated?: number; // 총 생성 컷 수
  durationSeconds?: number; // 소요 시간 (초)
}

export async function logGeneration(entry: GenerationLogEntry): Promise<string> {
  const notion = getNotionClient();
  const databaseId = getDatabaseId();

  const properties: Record<string, unknown> = {
    '제목': {
      title: [{ text: { content: entry.title } }],
    },
    'Provider': {
      select: { name: entry.provider },
    },
    '포즈': {
      select: { name: entry.pose },
    },
    '스타일참조': {
      checkbox: entry.hasStyleReference,
    },
    '배경스팟': {
      checkbox: entry.hasBackgroundSpot,
    },
    '성공': {
      checkbox: entry.success,
    },
    '생성일시': {
      date: { start: new Date().toISOString() },
    },
  };

  // Optional fields
  if (entry.modelName) {
    properties['모델명'] = {
      rich_text: [{ text: { content: entry.modelName } }],
    };
  }

  if (entry.prompt) {
    properties['프롬프트'] = {
      rich_text: [{ text: { content: truncateText(entry.prompt, 2000) } }],
    };
  }

  if (entry.customPrompt) {
    properties['커스텀 프롬프트'] = {
      rich_text: [{ text: { content: truncateText(entry.customPrompt, 2000) } }],
    };
  }

  if (entry.garmentCategory && entry.garmentCategory.length > 0) {
    properties['의류종류'] = {
      multi_select: entry.garmentCategory.map(cat => ({ name: cat })),
    };
  }

  if (entry.resultImageUrl) {
    properties['결과 이미지'] = {
      url: entry.resultImageUrl,
    };
  }

  if (entry.garmentImageUrl) {
    properties['의류 원본'] = {
      url: entry.garmentImageUrl,
    };
  }

  if (entry.styleReferenceInfo) {
    properties['스타일참조 이미지'] = {
      rich_text: [{ text: { content: truncateText(entry.styleReferenceInfo, 2000) } }],
    };
  }

  if (entry.backgroundSpotInfo) {
    properties['배경스팟 이미지'] = {
      rich_text: [{ text: { content: truncateText(entry.backgroundSpotInfo, 2000) } }],
    };
  }

  if (entry.totalShotsGenerated !== undefined) {
    properties['총 생성 컷 수'] = {
      number: entry.totalShotsGenerated,
    };
  }

  if (entry.durationSeconds !== undefined) {
    properties['소요 시간 (초)'] = {
      number: entry.durationSeconds,
    };
  }

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as Parameters<typeof notion.pages.create>[0]['properties'],
  });

  return response.id;
}

// ============================================
// 배치 로깅 (여러 이미지 한번에)
// ============================================

export async function logGenerationBatch(entries: GenerationLogEntry[]): Promise<{ success: number; failed: number; ids: string[] }> {
  const results = await Promise.allSettled(
    entries.map(entry => logGeneration(entry))
  );

  const ids: string[] = [];
  let success = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      success++;
      ids.push(result.value);
    } else {
      failed++;
      console.error('[Notion Log] Failed to log entry:', result.reason);
    }
  }

  return { success, failed, ids };
}

// ============================================
// 연결 테스트
// ============================================

export async function testNotionConnection(): Promise<{ connected: boolean; user?: string; error?: string }> {
  try {
    const notion = getNotionClient();
    const response = await notion.users.me({});
    return {
      connected: true,
      user: response.name || response.id,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Utility
// ============================================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
