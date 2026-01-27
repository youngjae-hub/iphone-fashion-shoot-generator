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

// Replicate 클라이언트
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// POST: 이미지 업스케일
export async function POST(request: NextRequest) {
  try {
    const body: UpscaleRequest = await request.json();
    const { image, scale = 2, model = 'real-esrgan', faceEnhance = false } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    let output: unknown;

    if (model === 'real-esrgan') {
      // Real-ESRGAN 업스케일러
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
      // Clarity Upscaler (더 고품질, 더 느림)
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

    // 결과 처리 (Replicate SDK v1.x는 FileOutput 객체 반환)
    let upscaledUrl: string | null = null;

    console.log('[Upscale] Output type:', typeof output);
    console.log('[Upscale] Output constructor:', output?.constructor?.name);
    console.log('[Upscale] Output toString:', String(output));
    console.log('[Upscale] Output keys:', output && typeof output === 'object' ? Object.keys(output as object) : 'N/A');

    if (typeof output === 'string') {
      upscaledUrl = output;
    } else if (output instanceof URL) {
      upscaledUrl = output.toString();
    } else if (Array.isArray(output) && output.length > 0) {
      // 배열 결과 (일부 모델은 배열로 반환)
      const first = output[0];
      upscaledUrl = typeof first === 'string' ? first : String(first);
    } else if (output && typeof output === 'object') {
      // Replicate SDK v1.x FileOutput 객체 처리
      // FileOutput은 ReadableStream을 상속하며 url getter와 toString() 메서드를 가짐

      // 1. url 속성 확인 (FileOutput.url은 URL 객체 반환)
      try {
        if ('url' in output) {
          const urlVal = (output as Record<string, unknown>).url;
          if (urlVal instanceof URL) {
            upscaledUrl = urlVal.href;
          } else if (typeof urlVal === 'string') {
            upscaledUrl = urlVal;
          } else {
            upscaledUrl = String(urlVal);
          }
        }
      } catch (e) {
        console.log('[Upscale] url property access failed:', e);
      }

      // 2. href 속성 확인
      if (!upscaledUrl && 'href' in output) {
        upscaledUrl = String((output as Record<string, unknown>).href);
      }

      // 3. output 속성 확인
      if (!upscaledUrl && 'output' in output) {
        upscaledUrl = String((output as Record<string, unknown>).output);
      }

      // 4. toString() 폴백 (FileOutput.toString()은 URL 문자열 반환)
      if (!upscaledUrl) {
        const str = String(output);
        if (str.startsWith('http')) {
          upscaledUrl = str;
        }
      }
    }

    // 최종 폴백: 어떤 타입이든 toString()으로 URL 추출 시도
    if (!upscaledUrl && output) {
      const str = String(output);
      if (str.startsWith('http')) {
        upscaledUrl = str;
      }
    }

    if (!upscaledUrl) {
      console.error('[Upscale] Failed to extract URL from output:', JSON.stringify(output, null, 2));
      return NextResponse.json(
        { success: false, error: `업스케일 결과를 가져오지 못했습니다. Output type: ${output?.constructor?.name || typeof output}` },
        { status: 500 }
      );
    }

    const response: UpscaleResponse = {
      success: true,
      upscaledImage: upscaledUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upscale error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '업스케일 실패' },
      { status: 500 }
    );
  }
}

// 배치 업스케일 지원
export async function PUT(request: NextRequest) {
  try {
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

        if (typeof output === 'string') return output;
        if (Array.isArray(output) && output.length > 0) return String(output[0]);
        // FileOutput 처리
        if (output && typeof output === 'object') {
          if ('url' in output) {
            const urlVal = (output as Record<string, unknown>).url;
            return urlVal instanceof URL ? urlVal.href : String(urlVal);
          }
          const str = String(output);
          if (str.startsWith('http')) return str;
        }
        throw new Error('Invalid output type: ' + output?.constructor?.name);
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
