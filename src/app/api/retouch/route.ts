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

        // lucataco/remove-bg 모델 사용 (가장 안정적)
        const output = await replicate.run(
          "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
          {
            input: {
              image: image,
            }
          }
        );

        console.log(`[${brand}] Output type: ${typeof output}`);

        if (output && typeof output === 'string') {
          processedImageUrl = output;
          console.log(`[${brand}] Background removal completed`);
        } else if (output && typeof output === 'object' && 'url' in output) {
          // FileOutput 형태일 수 있음
          processedImageUrl = (output as { url: string }).url;
          console.log(`[${brand}] Background removal completed (FileOutput)`);
        } else if (output) {
          processedImageUrl = String(output);
          console.log(`[${brand}] Background removal completed (string conversion)`);
        }
      } catch (rembgError: unknown) {
        console.error('remove-bg error:', rembgError);
        const errorMessage = rembgError instanceof Error ? rembgError.message : String(rembgError);

        return NextResponse.json(
          { success: false, error: `배경 제거 실패: ${errorMessage}` },
          { status: 500 }
        );
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
