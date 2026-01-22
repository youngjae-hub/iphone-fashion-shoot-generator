import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface BrandConfig {
  name: string;
  format: 'jpg' | 'png';
  nukki: boolean;
  backgroundColor: string | null;
  shadow: boolean;
  cropWidth: number;
  cropHeight: number;
}

interface RetouchRequest {
  image: string; // base64 data URL
  brand: string;
  config: BrandConfig;
}

// Replicate 클라이언트 초기화
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const body: RetouchRequest = await request.json();
    const { image, brand, config } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Replicate API 토큰이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    let processedImageUrl = image;

    // 1. 누끼 처리 (배경 제거) - config.nukki가 true인 경우
    if (config.nukki) {
      console.log(`[${brand}] Starting background removal...`);

      try {
        console.log(`[${brand}] Image size: ${image.length} bytes`);
        console.log(`[${brand}] Image type: ${image.substring(0, 50)}...`);

        // 새로운 모델 시도: ilkerc/rembg
        const output = await replicate.run(
          "ilkerc/rembg:9a665d6e3c632d88d4c4a9c99eba7633a2e48e67a4dd61b2c51e8f9f2c0f2d87",
          {
            input: {
              image: image,
            }
          }
        );

        console.log(`[${brand}] Output type: ${typeof output}`);
        console.log(`[${brand}] Output:`, output);

        if (output && typeof output === 'string') {
          processedImageUrl = output;
          console.log(`[${brand}] Background removal completed`);
        } else if (output && typeof output === 'object') {
          // ReadableStream 또는 다른 형태일 수 있음
          processedImageUrl = String(output);
          console.log(`[${brand}] Background removal completed (object)`);
        }
      } catch (rembgError: unknown) {
        console.error('rembg error:', rembgError);
        const errorMessage = rembgError instanceof Error ? rembgError.message : String(rembgError);

        // 대체 모델 시도: cjwbw/rembg
        try {
          console.log(`[${brand}] Trying fallback model...`);
          const output = await replicate.run(
            "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
            {
              input: {
                image: image,
              }
            }
          );

          if (output && typeof output === 'string') {
            processedImageUrl = output;
          } else if (output && typeof output === 'object') {
            processedImageUrl = String(output);
          }
        } catch (fallbackError: unknown) {
          console.error('fallback rembg error:', fallbackError);
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          return NextResponse.json(
            { success: false, error: `배경 제거 실패: ${errorMessage}. Fallback: ${fallbackErrorMessage}` },
            { status: 500 }
          );
        }
      }
    }

    // 2. 배경색 적용 + 그림자 + 크롭/리사이즈
    // 클라이언트에서 Canvas로 처리하거나, Sharp 라이브러리 사용 가능
    // 여기서는 처리된 이미지 URL을 반환하고, 추가 처리는 클라이언트에서 진행

    // 다나앤페타의 경우: 배경색 #F8F8F8 + 하단 그림자 필요
    // 이 부분은 추가 이미지 처리 API 또는 클라이언트 Canvas로 구현 가능

    // 현재는 누끼 처리된 이미지만 반환
    // TODO: 배경색 적용, 그림자 추가, 크롭/리사이즈 구현

    return NextResponse.json({
      success: true,
      processedImage: processedImageUrl,
      brand,
      config,
    });
  } catch (error) {
    console.error('Retouch API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
