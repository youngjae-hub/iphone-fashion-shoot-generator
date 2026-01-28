import { NextRequest, NextResponse } from 'next/server';
import { logGeneration, logGenerationBatch, testNotionConnection, type GenerationLogEntry } from '@/lib/notion';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// POST: 생성 결과 로깅
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entries, entry } = body as { entries?: GenerationLogEntry[]; entry?: GenerationLogEntry };

    // 배치 로깅
    if (entries && entries.length > 0) {
      const result = await logGenerationBatch(entries);
      return NextResponse.json({
        success: true,
        logged: result.success,
        failed: result.failed,
        ids: result.ids,
      });
    }

    // 단일 로깅
    if (entry) {
      const id = await logGeneration(entry);
      return NextResponse.json({
        success: true,
        id,
      });
    }

    return NextResponse.json(
      { success: false, error: 'entry 또는 entries가 필요합니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Notion Log] Error:', error);
    const message = error instanceof Error ? error.message : 'Notion 로깅 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET: 연결 상태 확인
export async function GET() {
  try {
    const result = await testNotionConnection();

    const hasDatabaseId = !!process.env.NOTION_DATABASE_ID;

    return NextResponse.json({
      success: true,
      ...result,
      hasDatabaseId,
      databaseId: hasDatabaseId ? process.env.NOTION_DATABASE_ID : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
