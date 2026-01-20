import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getImageGenerationProvider,
  getTryOnProvider,
} from '@/lib/providers';
import { GenerationRequest, GeneratedImage, PoseType } from '@/types';

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

    const imageProvider = getImageGenerationProvider(providers.imageGeneration);
    const tryOnProvider = getTryOnProvider(providers.tryOn);

    // 가용성 체크
    const [imageAvailable, tryOnAvailable] = await Promise.all([
      imageProvider.isAvailable(),
      tryOnProvider.isAvailable(),
    ]);

    if (!imageAvailable) {
      return NextResponse.json(
        { success: false, error: `${providers.imageGeneration} API 키가 설정되지 않았습니다.` },
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
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
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
