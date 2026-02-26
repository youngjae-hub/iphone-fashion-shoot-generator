import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// ControlNet 디버그 API - Replicate 기반
export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {};

  // 1. 환경변수 체크
  results.env = {
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN
      ? `SET (${process.env.REPLICATE_API_TOKEN.substring(0, 10)}...)`
      : 'NOT SET ❌',
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || 'NOT SET',
  };

  // 2. Base URL 계산
  let baseUrl: string;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else {
    baseUrl = 'https://260116iphone.vercel.app';
  }
  results.baseUrl = baseUrl;

  // 3. 스켈레톤 URL 테스트
  const skeletonPath = '/pose-skeletons/front-standing.png';
  const skeletonUrl = `${baseUrl}${skeletonPath}`;
  results.skeletonUrl = skeletonUrl;

  // 4. 스켈레톤 이미지 접근성 테스트
  try {
    const skeletonResponse = await fetch(skeletonUrl, { method: 'HEAD' });
    results.skeletonAccessible = {
      status: skeletonResponse.status,
      ok: skeletonResponse.ok,
      contentType: skeletonResponse.headers.get('content-type'),
    };
  } catch (error) {
    results.skeletonAccessible = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // 5. Replicate API 연결 테스트 (실제 이미지 생성 없이)
  if (process.env.REPLICATE_API_TOKEN) {
    try {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

      // 모델 정보만 확인 (비용 발생 안함)
      const model = await replicate.models.get("jagilley", "controlnet-pose");
      results.replicateTest = {
        status: 'connected',
        model: model.name,
        description: model.description?.substring(0, 100),
      };
    } catch (error) {
      results.replicateTest = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.replicateTest = { error: 'REPLICATE_API_TOKEN not set' };
  }

  results.message = 'ControlNet now uses Replicate (same token as VTON)';

  return NextResponse.json(results, { status: 200 });
}
