import { NextRequest, NextResponse } from 'next/server';
import { createGenerationLogDatabase, testNotionConnection } from '@/lib/notion';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// POST: Notion Database 초기 생성
export async function POST(request: NextRequest) {
  try {
    // 1. 연결 테스트
    const connectionTest = await testNotionConnection();
    if (!connectionTest.connected) {
      return NextResponse.json(
        {
          success: false,
          error: `Notion 연결 실패: ${connectionTest.error}`,
          guide: 'NOTION_API_KEY가 올바른지 확인하세요.',
        },
        { status: 401 }
      );
    }

    // 2. 이미 DB가 있는지 확인
    if (process.env.NOTION_DATABASE_ID) {
      return NextResponse.json({
        success: true,
        message: 'Database가 이미 설정되어 있습니다.',
        databaseId: process.env.NOTION_DATABASE_ID,
        alreadyExists: true,
      });
    }

    // 3. Parent Page ID 확인
    const body = await request.json();
    const { parentPageId } = body as { parentPageId: string };

    if (!parentPageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'parentPageId가 필요합니다.',
          guide: 'Notion 페이지 ID를 전달하세요. (예: 2ef466b62099809aa9e2ce2c0260bf6d)',
        },
        { status: 400 }
      );
    }

    // 4. Database 생성
    const databaseId = await createGenerationLogDatabase(parentPageId);

    return NextResponse.json({
      success: true,
      databaseId,
      message: `Database 생성 완료! .env.local에 다음을 추가하세요: NOTION_DATABASE_ID=${databaseId}`,
      nextStep: 'NOTION_DATABASE_ID를 환경 변수에 추가한 후 서버를 재시작하세요.',
    });
  } catch (error) {
    console.error('[Notion Setup] Error:', error);
    const message = error instanceof Error ? error.message : 'Database 생성 실패';

    // Notion API 에러 상세 분석
    let guide = '';
    if (message.includes('Could not find')) {
      guide = '페이지를 찾을 수 없습니다. Integration이 해당 페이지에 연결되어 있는지 확인하세요.';
    } else if (message.includes('Unauthorized') || message.includes('unauthorized')) {
      guide = 'API 키가 유효하지 않습니다. https://www.notion.so/my-integrations에서 확인하세요.';
    } else if (message.includes('restricted')) {
      guide = 'Integration에 페이지 접근 권한이 없습니다. Notion에서 페이지 > ... > 연결 추가로 Integration을 연결하세요.';
    }

    return NextResponse.json(
      { success: false, error: message, guide },
      { status: 500 }
    );
  }
}
