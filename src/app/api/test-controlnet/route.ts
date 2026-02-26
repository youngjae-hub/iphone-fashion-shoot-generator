import { NextResponse } from 'next/server';
import { generateWithControlNet } from '@/lib/providers/controlnet';

// ControlNet 실제 테스트 API - 에러 상세 반환
export async function GET() {
  const startTime = Date.now();

  try {
    // 간단한 테스트 프롬프트로 실제 생성 시도
    const result = await generateWithControlNet({
      pose: 'front',
      prompt: 'young Korean female model, fashion photography, simple background',
      negativePrompt: 'blurry, low quality',
      seed: 12345,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      duration: `${duration}ms`,
      result,
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    return NextResponse.json({
      duration: `${duration}ms`,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        raw: JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2),
      },
    }, { status: 500 });
  }
}
