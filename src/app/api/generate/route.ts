import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getImageGenerationProvider,
  getTryOnProvider,
} from '@/lib/providers';
import { GenerationRequest, GeneratedImage, PoseType } from '@/types';

// Vercel Serverless Function 설정
// Hobby 플랜: 최대 60초, Pro 플랜: 최대 300초
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { garmentImage, styleReferenceImages, poses, settings, providers } = body as GenerationRequest & { styleReferenceImages?: string[] };

    if (!garmentImage) {
      return NextResponse.json(
        { success: false, error: '의류 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // Provider 초기화 에러 캐치
    let imageProvider, tryOnProvider;
    try {
      imageProvider = getImageGenerationProvider(providers.imageGeneration);
      tryOnProvider = getTryOnProvider(providers.tryOn);
    } catch (providerError) {
      console.error('Provider initialization error:', providerError);
      return NextResponse.json(
        { success: false, error: 'AI 모델 초기화에 실패했습니다. 환경 변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    // 가용성 체크
    let imageAvailable = false;
    let tryOnAvailable = false;

    try {
      [imageAvailable, tryOnAvailable] = await Promise.all([
        imageProvider.isAvailable(),
        tryOnProvider.isAvailable(),
      ]);
    } catch (availError) {
      console.error('Availability check error:', availError);
    }

    if (!imageAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: `${providers.imageGeneration} API 키가 설정되지 않았습니다. Vercel 환경 변수에 REPLICATE_API_TOKEN을 추가해주세요.`
        },
        { status: 400 }
      );
    }

    const generatedImages: GeneratedImage[] = [];

    // 각 포즈별로 이미지 생성
    for (const pose of poses) {
      for (let i = 0; i < settings.shotsPerPose; i++) {
        try {
          // 1. 의류 이미지를 입은 모델 이미지 생성
          const modelImage = await imageProvider.generateModelImage({
            pose,
            style: settings.modelStyle,
            seed: settings.seed ? settings.seed + i : undefined,
            negativePrompt: settings.negativePrompt,
            garmentImage, // 업로드한 의류 이미지 전달
            styleReferenceImages, // 스타일 참조 이미지들 전달
          });

          let resultImage = modelImage;

          // 2. Virtual Try-On 적용 (가용한 경우에만)
          if (tryOnAvailable) {
            try {
              resultImage = await tryOnProvider.tryOn({
                garmentImage,
                modelImage,
                pose,
                category: 'upper',
              });
            } catch (tryOnError) {
              console.warn('Try-On failed, using model image:', tryOnError);
              // Try-On 실패 시 모델 이미지 그대로 사용
            }
          }

          generatedImages.push({
            id: uuidv4(),
            url: resultImage,
            pose,
            timestamp: Date.now(),
            settings,
            provider: tryOnAvailable ? `${providers.imageGeneration} + ${providers.tryOn}` : providers.imageGeneration,
          });
        } catch (error) {
          console.error(`Error generating image for pose ${pose}, shot ${i}:`, error);
          // 개별 이미지 실패는 전체 요청을 실패시키지 않음
        }
      }
    }

    if (generatedImages.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지 생성에 실패했습니다. API 설정을 확인해주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: generatedImages,
    });
  } catch (error) {
    console.error('Generation error:', error);

    // 에러 타입에 따른 구체적인 메시지
    let errorMessage = '서버 오류가 발생했습니다.';

    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_API_TOKEN')) {
        errorMessage = 'Replicate API 토큰이 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.';
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = '이미지 생성 시간이 초과되었습니다. 포즈 개수를 줄이거나 다시 시도해주세요.';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorMessage = 'API 호출 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('Invalid') || error.message.includes('401')) {
        errorMessage = 'API 키가 유효하지 않습니다. Vercel 환경 변수를 확인해주세요.';
      } else {
        errorMessage = `오류: ${error.message}`;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 단일 이미지 재생성
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { garmentImage, styleReferenceImages, pose, settings, providers } = body;

    const imageProvider = getImageGenerationProvider(providers.imageGeneration);
    const tryOnProvider = getTryOnProvider(providers.tryOn);

    const modelImage = await imageProvider.generateModelImage({
      pose,
      style: settings.modelStyle,
      seed: settings.seed,
      negativePrompt: settings.negativePrompt,
      garmentImage,
      styleReferenceImages,
    });

    const resultImage = await tryOnProvider.tryOn({
      garmentImage,
      modelImage,
      pose,
      category: 'upper',
    });

    return NextResponse.json({
      success: true,
      image: {
        id: uuidv4(),
        url: resultImage,
        pose,
        timestamp: Date.now(),
        settings,
        provider: `${providers.imageGeneration} + ${providers.tryOn}`,
      } as GeneratedImage,
    });
  } catch (error) {
    console.error('Regeneration error:', error);
    return NextResponse.json(
      { success: false, error: '재생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
