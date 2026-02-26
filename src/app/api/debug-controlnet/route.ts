import { NextRequest, NextResponse } from 'next/server';

// ControlNet 디버그 API - 환경변수 및 스켈레톤 URL 테스트
export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {};

  // 1. 환경변수 체크
  results.env = {
    FAL_KEY: process.env.FAL_KEY ? `SET (${process.env.FAL_KEY.substring(0, 10)}...)` : 'NOT SET ❌',
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET',
  };

  // 2. Base URL 계산
  let baseUrl: string;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  } else {
    baseUrl = 'http://localhost:3000';
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

  // 5. fal.ai API 테스트 (간단한 요청)
  if (process.env.FAL_KEY) {
    try {
      const falResponse = await fetch('https://fal.run/fal-ai/sdxl-controlnet-union', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'test image, simple background',
          openpose_image_url: skeletonUrl,
          openpose_preprocess: false,
          controlnet_conditioning_scale: 0.8,
          num_inference_steps: 10, // 빠른 테스트용
          guidance_scale: 7.5,
          num_images: 1,
          image_size: { width: 512, height: 512 }, // 작은 이미지로 빠른 테스트
        }),
      });

      const responseText = await falResponse.text();
      results.falApiTest = {
        status: falResponse.status,
        ok: falResponse.ok,
        response: responseText.substring(0, 500), // 첫 500자만
      };
    } catch (error) {
      results.falApiTest = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.falApiTest = { error: 'FAL_KEY not set, skipping API test' };
  }

  return NextResponse.json(results, { status: 200 });
}
