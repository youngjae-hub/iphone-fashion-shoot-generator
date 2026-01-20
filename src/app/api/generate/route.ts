import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getImageGenerationProvider,
  getTryOnProvider,
} from '@/lib/providers';
import {
  IImageGenerationProvider,
  ITryOnProvider,
} from '@/lib/providers/base';
import {
  GenerationRequest,
  GeneratedImage,
  CustomPromptSettings,
  DEFAULT_PROMPT_TEMPLATES,
  STYLE_MODIFIERS,
} from '@/types';

// Vercel Serverless Function 설정
// Hobby 플랜: 최대 60초, Pro 플랜: 최대 300초
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 프롬프트 설정에서 최종 프롬프트 생성
function buildPromptFromSettings(promptSettings?: CustomPromptSettings): { basePrompt: string; negativePrompt: string } {
  if (!promptSettings) {
    return {
      basePrompt: '',
      negativePrompt: 'blurry, low quality, distorted, ugly, deformed, bad anatomy, watermark, signature',
    };
  }

  let basePrompt = '';

  if (promptSettings.useCustomPrompt) {
    basePrompt = promptSettings.basePrompt;
  } else if (promptSettings.templateId) {
    const template = DEFAULT_PROMPT_TEMPLATES.find(t => t.id === promptSettings.templateId);
    basePrompt = template?.basePrompt || '';
  }

  // 스타일 수식어 추가
  if (promptSettings.styleModifiers && promptSettings.styleModifiers.length > 0) {
    const modifierPrompts = promptSettings.styleModifiers
      .map(id => STYLE_MODIFIERS.find(m => m.id === id)?.prompt)
      .filter(Boolean)
      .join(', ');
    if (modifierPrompts) {
      basePrompt = basePrompt ? `${basePrompt}, ${modifierPrompts}` : modifierPrompts;
    }
  }

  return {
    basePrompt,
    negativePrompt: promptSettings.negativePrompt || 'blurry, low quality, distorted, ugly, deformed, bad anatomy, watermark, signature',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { garmentImage, styleReferenceImages, poses, settings, providers, promptSettings } = body as GenerationRequest & { styleReferenceImages?: string[]; promptSettings?: CustomPromptSettings };

    if (!garmentImage) {
      return NextResponse.json(
        { success: false, error: '의류 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // Provider 초기화 에러 캐치
    let imageProvider: IImageGenerationProvider;
    let tryOnProvider: ITryOnProvider;
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

    // 프롬프트 설정에서 최종 프롬프트 빌드
    const { basePrompt, negativePrompt } = buildPromptFromSettings(promptSettings);

    // 생성할 이미지 작업 목록 구성
    interface GenerationTask {
      pose: typeof poses[0];
      shotIndex: number;
    }

    const tasks: GenerationTask[] = [];
    for (const pose of poses) {
      for (let i = 0; i < settings.shotsPerPose; i++) {
        tasks.push({ pose, shotIndex: i });
      }
    }

    // 병렬 이미지 생성 함수
    async function generateSingleImage(task: GenerationTask): Promise<GeneratedImage | null> {
      try {
        // 1. 의류 이미지를 입은 모델 이미지 생성
        const modelImage = await imageProvider.generateModelImage({
          pose: task.pose,
          style: settings.modelStyle,
          seed: settings.seed ? settings.seed + task.shotIndex : undefined,
          negativePrompt: negativePrompt || settings.negativePrompt,
          garmentImage, // 업로드한 의류 이미지 전달
          styleReferenceImages, // 스타일 참조 이미지들 전달
          customPrompt: basePrompt, // 커스텀 프롬프트 전달
        });

        let resultImage = modelImage;

        // 2. Virtual Try-On 적용 (가용한 경우에만)
        if (tryOnAvailable) {
          try {
            resultImage = await tryOnProvider.tryOn({
              garmentImage,
              modelImage,
              pose: task.pose,
              category: 'upper',
            });
          } catch (tryOnError) {
            console.warn('Try-On failed, using model image:', tryOnError);
            // Try-On 실패 시 모델 이미지 그대로 사용
          }
        }

        return {
          id: uuidv4(),
          url: resultImage,
          pose: task.pose,
          timestamp: Date.now(),
          settings,
          provider: tryOnAvailable ? `${providers.imageGeneration} + ${providers.tryOn}` : providers.imageGeneration,
        };
      } catch (error) {
        console.error(`Error generating image for pose ${task.pose}, shot ${task.shotIndex}:`, error);
        return null; // 개별 이미지 실패는 전체 요청을 실패시키지 않음
      }
    }

    // 모든 이미지 병렬 생성 (Promise.all 사용)
    console.log(`Starting parallel generation of ${tasks.length} images...`);
    const startTime = Date.now();

    const results = await Promise.all(tasks.map(task => generateSingleImage(task)));

    const generatedImages: GeneratedImage[] = results.filter((img): img is GeneratedImage => img !== null);

    console.log(`Parallel generation completed in ${(Date.now() - startTime) / 1000}s - ${generatedImages.length}/${tasks.length} successful`);

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
