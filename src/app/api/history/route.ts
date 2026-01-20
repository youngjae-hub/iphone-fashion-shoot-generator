import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';
import { GenerationSession, GeneratedImage, HistoryItem } from '@/types';

// Vercel Serverless Function 설정
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// KV 키 프리픽스
const SESSION_PREFIX = 'session:';
const SESSION_LIST_KEY = 'sessions:list';
const HISTORY_PREFIX = 'history:';
const HISTORY_LIST_KEY = 'history:list';

// KV 사용 가능 여부 확인
function isKVAvailable(): boolean {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
}

// GET: 히스토리 목록 또는 특정 세션 조회
export async function GET(request: NextRequest) {
  try {
    if (!isKVAvailable()) {
      return NextResponse.json({
        success: true,
        sessions: [],
        history: [],
        kvConnected: false,
        message: 'KV 데이터베이스가 연결되지 않았습니다.',
      });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 특정 세션 조회
    if (sessionId) {
      const session = await kv.get<GenerationSession>(`${SESSION_PREFIX}${sessionId}`);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '세션을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, session });
    }

    // 전체 히스토리 목록 조회
    const historyIds = await kv.lrange(HISTORY_LIST_KEY, 0, limit - 1);
    const history: HistoryItem[] = [];

    for (const id of historyIds) {
      const item = await kv.get<HistoryItem>(`${HISTORY_PREFIX}${id}`);
      if (item) {
        history.push(item);
      }
    }

    // 최근 세션 목록
    const sessionIds = await kv.lrange(SESSION_LIST_KEY, 0, limit - 1);
    const sessions: GenerationSession[] = [];

    for (const id of sessionIds) {
      const session = await kv.get<GenerationSession>(`${SESSION_PREFIX}${id}`);
      if (session) {
        sessions.push(session);
      }
    }

    return NextResponse.json({
      success: true,
      sessions,
      history,
      kvConnected: true,
    });
  } catch (error) {
    console.error('History GET error:', error);
    return NextResponse.json(
      { success: false, error: '히스토리 조회 실패' },
      { status: 500 }
    );
  }
}

// POST: 새 세션 생성 또는 이미지 추가
export async function POST(request: NextRequest) {
  try {
    if (!isKVAvailable()) {
      return NextResponse.json(
        { success: false, error: 'KV 데이터베이스가 연결되지 않았습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, sessionId, images, settings, providers, loraModelId, garmentImages } = body;

    if (action === 'create') {
      // 새 세션 생성
      const newSession: GenerationSession = {
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        garmentImages: garmentImages || [],
        generatedImages: [],
        settings: settings,
        providers: providers,
        loraModelId: loraModelId,
      };

      await kv.set(`${SESSION_PREFIX}${newSession.id}`, newSession);
      await kv.lpush(SESSION_LIST_KEY, newSession.id);

      return NextResponse.json({
        success: true,
        session: newSession,
      });
    }

    if (action === 'addImages' && sessionId) {
      // 기존 세션에 이미지 추가
      const session = await kv.get<GenerationSession>(`${SESSION_PREFIX}${sessionId}`);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '세션을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const newImages = images as GeneratedImage[];
      session.generatedImages = [...session.generatedImages, ...newImages];
      session.updatedAt = Date.now();

      await kv.set(`${SESSION_PREFIX}${sessionId}`, session);

      // 히스토리 아이템 생성/업데이트
      const historyItem: HistoryItem = {
        id: sessionId,
        sessionId: sessionId,
        type: 'generation',
        timestamp: Date.now(),
        thumbnail: session.generatedImages[0]?.url,
        garmentCount: session.garmentImages.length,
        imageCount: session.generatedImages.length,
        status: 'completed',
      };

      await kv.set(`${HISTORY_PREFIX}${sessionId}`, historyItem);

      // 히스토리 목록에 없으면 추가
      const existsInHistory = await kv.lpos(HISTORY_LIST_KEY, sessionId);
      if (existsInHistory === null) {
        await kv.lpush(HISTORY_LIST_KEY, sessionId);
      }

      return NextResponse.json({
        success: true,
        session,
        imagesAdded: newImages.length,
      });
    }

    return NextResponse.json(
      { success: false, error: '잘못된 요청입니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('History POST error:', error);
    return NextResponse.json(
      { success: false, error: '세션 저장 실패' },
      { status: 500 }
    );
  }
}

// DELETE: 세션 삭제
export async function DELETE(request: NextRequest) {
  try {
    if (!isKVAvailable()) {
      return NextResponse.json(
        { success: false, error: 'KV 데이터베이스가 연결되지 않았습니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 삭제
    await kv.del(`${SESSION_PREFIX}${sessionId}`);
    await kv.del(`${HISTORY_PREFIX}${sessionId}`);
    await kv.lrem(SESSION_LIST_KEY, 0, sessionId);
    await kv.lrem(HISTORY_LIST_KEY, 0, sessionId);

    return NextResponse.json({
      success: true,
      message: '세션이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('History DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '세션 삭제 실패' },
      { status: 500 }
    );
  }
}
