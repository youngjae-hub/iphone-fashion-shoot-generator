import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Vercel Serverless Function 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface UpscaleRequest {
  image: string; // base64 or URL
  scale?: number; // 업스케일 배율 (2 or 4)
  model?: 'real-esrgan' | 'clarity-upscaler';
  faceEnhance?: boolean; // 얼굴 개선 여부
}

interface UpscaleResponse {
  success: boolean;
  upscaledImage?: string;
  originalSize?: { width: number; height: number };
  upscaledSize?: { width: number; height: number };
  error?: string;
}

// Replicate SDK v1.x FileOutput에서 URL 추출
function extractUrl(output: unknown): string | null {
  // 1. Plain string
  if (typeof output === 'string') return output;

  // 2. URL object
  if (output instanceof URL) return output.href;

  // 3. Array (재귀 처리)
  if (Array.isArray(output) && output.length > 0) {
    return extractUrl(output[0]);
  }

  // 4. Object (FileOutput 등)
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;

    // 4a. FileOutput.url getter → URL 객체
    try {
      if ('url' in obj) {
        const urlVal = obj.url;
        if (urlVal instanceof URL) return urlVal.href;
        if (typeof urlVal === 'string' && urlVal.startsWith('http')) return urlVal;
      }
    } catch { /* url getter 실패 무시 */ }

    // 4b. href 속성
    if ('href' in obj && typeof obj.href === 'string') return obj.href;

    // 4c. toString() → URL 문자열
    const str = String(output);
    if (str.startsWith('http')) return str;
  }

  return null;
}

// POST: 이미지 업스케일
export async function POST(request: NextRequest) {
  try {
    // API 토큰 확인
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'REPLICATE_API_TOKEN이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const body: UpscaleRequest = await request.json();
    const { image, scale = 2, model = 'real-esrgan', faceEnhance = false } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 입력 URL 유효성 검증
    const isValidUrl = image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:image/');
    console.log(`[Upscale] Input: ${isValidUrl ? 'valid URL' : 'INVALID'} (${image.substring(0, 80)}...)`);

    if (!isValidUrl) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이미지 URL입니다.' },
        { status: 400 }
      );
    }

    // Replicate 모델 호출
    let output: unknown;
    try {
      if (model === 'real-esrgan') {
        output = await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          {
            input: {
              image: image,
              scale: scale,
              face_enhance: faceEnhance,
            },
          }
        );
      } else if (model === 'clarity-upscaler') {
        output = await replicate.run(
          "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
          {
            input: {
              image: image,
              scale_factor: scale,
              resemblance: 0.8,
              creativity: 0.3,
              prompt: "high quality fashion photography, sharp details, professional",
              negative_prompt: "blurry, low quality, distorted",
            },
          }
        );
      }
    } catch (replicateError) {
      const msg = replicateError instanceof Error ? replicateError.message : String(replicateError);
      console.error(`[Upscale] Replicate API error: ${msg}`);
      return NextResponse.json(
        { success: false, error: `업스케일 API 호출 실패: ${msg}` },
        { status: 502 }
      );
    }

    // 출력에서 URL 추출
    const upscaledUrl = extractUrl(output);
    console.log(`[Upscale] Output: type=${typeof output}, constructor=${output?.constructor?.name}, extracted=${upscaledUrl ? 'OK' : 'FAILED'}`);

    if (!upscaledUrl) {
      return NextResponse.json(
        { success: false, error: `업스케일 결과 파싱 실패 (output: ${typeof output} / ${output?.constructor?.name})` },
        { status: 500 }
      );
    }

    const response: UpscaleResponse = {
      success: true,
      upscaledImage: upscaledUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Upscale] Unexpected error:', error);
    const msg = error instanceof Error ? error.message : '업스케일 실패';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// 배치 업스케일 지원
export async function PUT(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'REPLICATE_API_TOKEN이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const body = await request.json();
    const { images, scale = 2, model = 'real-esrgan' }: { images: string[], scale?: number, model?: 'real-esrgan' | 'clarity-upscaler' } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (images.length > 10) {
      return NextResponse.json(
        { success: false, error: '최대 10개 이미지만 배치 업스케일 가능합니다.' },
        { status: 400 }
      );
    }

    // 병렬 업스케일
    const results = await Promise.allSettled(
      images.map(async (image) => {
        let output: unknown;

        if (model === 'real-esrgan') {
          output = await replicate.run(
            "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
            {
              input: {
                image: image,
                scale: scale,
                face_enhance: false,
              },
            }
          );
        } else {
          output = await replicate.run(
            "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
            {
              input: {
                image: image,
                scale_factor: scale,
                resemblance: 0.8,
                creativity: 0.3,
              },
            }
          );
        }

        const url = extractUrl(output);
        if (!url) throw new Error('Output URL extraction failed: ' + output?.constructor?.name);
        return url;
      })
    );

    const upscaledImages: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        upscaledImages.push(result.value);
      } else {
        errors.push(`Image ${index + 1}: ${result.reason}`);
      }
    });

    return NextResponse.json({
      success: true,
      upscaledImages,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch upscale error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '배치 업스케일 실패' },
      { status: 500 }
    );
  }
}
