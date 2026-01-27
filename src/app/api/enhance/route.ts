/**
 * Image Enhancement API
 *
 * Claid.ai (Letsenhance.io) API를 사용한 이미지 업스케일링
 * - 최대 16배 확대
 * - 8K+ 해상도 지원
 * - Smart Enhance로 디테일 복원
 */

import { NextRequest, NextResponse } from 'next/server';

// 업스케일 모드
type UpscaleMode = 'smart_enhance' | 'smart_resize' | 'faces' | 'digital_art' | 'photo';

// 요청 타입
interface EnhanceRequest {
  imageUrl: string; // 이미지 URL
  scale?: string; // "200%", "400%" 또는 픽셀값 (예: 2048)
  mode?: UpscaleMode;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number; // 1-100
}

// Claid.ai API 응답 타입
interface ClaidResponse {
  data?: {
    output?: {
      tmp_url?: string;
    };
  };
  error?: {
    message?: string;
    code?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: EnhanceRequest = await request.json();
    const {
      imageUrl,
      scale = "200%",
      mode = "smart_enhance",
      format = "jpeg",
      quality = 95
    } = body;

    // 유효성 검사
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl이 필요합니다.' },
        { status: 400 }
      );
    }

    // API 키 확인
    const apiKey = process.env.CLAID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'CLAID_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log(`[Enhance] Starting enhancement: scale=${scale}, mode=${mode}`);
    const startTime = Date.now();

    // Claid.ai API 호출
    const response = await fetch('https://api.claid.ai/v1-beta1/image/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: imageUrl,
        operations: {
          restorations: {
            upscale: mode,
          },
          resizing: {
            width: scale,
            height: "auto",
            fit: "bounds",
          },
        },
        output: {
          format: format,
          quality: quality,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Enhance] Claid API error:', errorText);
      return NextResponse.json(
        { success: false, error: `Claid API 오류: ${response.status}` },
        { status: response.status }
      );
    }

    const result: ClaidResponse = await response.json();
    const duration = Date.now() - startTime;
    console.log(`[Enhance] Completed in ${(duration / 1000).toFixed(1)}s`);

    // 결과 URL 추출
    const enhancedUrl = result.data?.output?.tmp_url;
    if (!enhancedUrl) {
      return NextResponse.json(
        { success: false, error: '업스케일 결과를 가져올 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      enhancedImageUrl: enhancedUrl,
      scale,
      mode,
      duration,
    });

  } catch (error) {
    console.error('[Enhance] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// GET: API 정보 반환
export async function GET(): Promise<NextResponse> {
  const hasApiKey = !!process.env.CLAID_API_KEY;

  return NextResponse.json({
    success: true,
    available: hasApiKey,
    info: {
      name: 'Image Enhancement API',
      description: 'Claid.ai를 사용한 AI 이미지 업스케일링',
      provider: 'Claid.ai (Letsenhance.io)',
      maxUpscale: '16x',
      maxResolution: '8K+',
    },
    modes: [
      { id: 'smart_enhance', name: 'Smart Enhance', description: '일반 이미지 개선 (권장)' },
      { id: 'smart_resize', name: 'Smart Resize', description: '스마트 리사이즈' },
      { id: 'faces', name: 'Faces', description: '인물 사진 최적화' },
      { id: 'digital_art', name: 'Digital Art', description: '디지털 아트/일러스트' },
      { id: 'photo', name: 'Photo', description: '사진 특화' },
    ],
    usage: {
      method: 'POST',
      body: {
        imageUrl: 'string (필수) - 이미지 URL',
        scale: 'string (선택) - "200%", "400%" 또는 픽셀값',
        mode: 'string (선택) - smart_enhance | smart_resize | faces | digital_art | photo',
        format: 'string (선택) - jpeg | png | webp',
        quality: 'number (선택) - 1-100',
      },
    },
  });
}
