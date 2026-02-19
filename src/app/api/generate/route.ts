import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getImageGenerationProvider,
  getTryOnProvider,
} from '@/lib/providers';
import {
  IImageGenerationProvider,
  ITryOnProvider,
  smartFaceCrop,
} from '@/lib/providers/base';
import {
  GenerationRequest,
  GeneratedImage,
  CustomPromptSettings,
  DEFAULT_PROMPT_TEMPLATES,
  STYLE_MODIFIERS,
  VTONCategory,
  GarmentCategory,
  mapGarmentCategoryToVTON,
} from '@/types';
import { logGenerationBatch, type GenerationLogEntry } from '@/lib/notion';

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
    const { garmentImage, garmentCategory, styleReferenceImages, backgroundSpotImages, poses, settings, providers, promptSettings } = body as GenerationRequest & { garmentCategory?: GarmentCategory; styleReferenceImages?: string[]; backgroundSpotImages?: string[]; promptSettings?: CustomPromptSettings };

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

    // ⭐️ Phase 1-2: 의류 카테고리 처리 (사용자 선택 우선, BLIP-2는 fallback)
    let vtonCategory: VTONCategory = 'dresses'; // 기본값

    if (garmentCategory) {
      // 사용자가 UI에서 선택한 카테고리 사용 (최우선)
      vtonCategory = mapGarmentCategoryToVTON(garmentCategory);
      console.log(`👤 User selected category: ${garmentCategory} → VTON: ${vtonCategory}`);
    } else if (settings.garmentCategory) {
      // GenerationSettings에서 지정한 경우 (하위 호환)
      vtonCategory = settings.garmentCategory;
      console.log(`⚙️ Settings category: ${vtonCategory}`);
    } else {
      // 사용자가 선택하지 않은 경우에만 BLIP-2 자동 분류 (fallback)
      try {
        console.log('🤖 Attempting auto-classification with BLIP-2 (user did not select category)...');
        const classifyResponse = await fetch(`${request.nextUrl.origin}/api/classify-garment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: garmentImage }),
        });

        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          if (classifyData.success && classifyData.category) {
            const detectedCategory = classifyData.category as GarmentCategory;
            vtonCategory = mapGarmentCategoryToVTON(detectedCategory);
            console.log(`✅ Auto-classified: ${detectedCategory} → VTON: ${vtonCategory} (confidence: ${classifyData.confidence})`);
          }
        } else {
          console.warn('⚠️ Garment classification failed, using default category: dresses');
        }
      } catch (classifyError) {
        console.warn('⚠️ Garment classification error:', classifyError);
        console.log('Using default category: dresses');
        // 분류 실패 시 기본값 유지
      }
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

    // ⭐️ 모델 일관성을 위한 공통 시드 설정
    // 시드가 없으면 랜덤 생성하여 모든 포즈에 동일하게 적용
    const baseSeed = settings.seed || Math.floor(Math.random() * 1000000);
    console.log(`🎲 Using base seed for model consistency: ${baseSeed}`);

    // 모델 일관성을 위한 상세 설명 (모든 포즈에 동일하게 적용)
    const modelDescription = `same young Korean female model throughout all shots,
      long black wavy hair, slim figure, natural makeup,
      consistent appearance and body proportions`.replace(/\s+/g, ' ');

    // 첫 번째 생성된 모델 이미지 (이후 포즈의 스타일 참조로 사용)
    let referenceModelImage: string | null = null;

    // 병렬 이미지 생성 함수
    async function generateSingleImage(task: GenerationTask, useReference: boolean = false): Promise<GeneratedImage> {
      try {
        // Virtual Try-On 필수 체크
        if (!tryOnAvailable) {
          throw new Error('Virtual Try-On이 필수입니다. REPLICATE_API_TOKEN을 확인하세요.');
        }

        let modelImage: string;

        // 스타일 참조 이미지 결정
        // - 사용자가 제공한 참조 이미지가 있으면 사용
        // - 없으면 첫 번째 생성된 모델을 참조로 사용 (모델 일관성)
        let effectiveStyleRef = styleReferenceImages;
        if (!effectiveStyleRef?.length && useReference && referenceModelImage) {
          effectiveStyleRef = [referenceModelImage];
          console.log(`🔗 Using first model as reference for consistency (${task.pose})`);
        }

        // 1. AI로 모델 생성 (모델 일관성을 위해 동일한 시드와 설명 사용)
        const consistentPrompt = basePrompt
          ? `${basePrompt}, ${modelDescription}`
          : modelDescription;

        modelImage = await imageProvider.generateModelImage({
          pose: task.pose,
          style: settings.modelStyle,
          seed: baseSeed, // 모든 포즈에 동일한 시드 사용
          negativePrompt: negativePrompt || settings.negativePrompt,
          backgroundSpotImages,
          customPrompt: consistentPrompt,
          styleReferenceImages: effectiveStyleRef,
        });

        // 첫 번째 이미지면 참조용으로 저장
        if (!referenceModelImage) {
          referenceModelImage = modelImage;
          console.log(`📌 First model image saved as reference`);
        }

        // 2. Virtual Try-On 필수 적용 (의류만 교체)
        console.log(`👗 Applying VTON for ${task.pose} pose (category: ${vtonCategory})...`);
        let resultImage = await tryOnProvider.tryOn({
          garmentImage,
          modelImage,
          pose: task.pose,
          category: vtonCategory,
          seed: baseSeed + task.shotIndex, // 약간의 변형을 위해 shotIndex 추가
        });

        // ⭐️ 카테고리별 스마트 크롭
        try {
          console.log(`Applying smart crop (${vtonCategory}) to VTON result for ${task.pose}...`);
          resultImage = await smartFaceCrop(resultImage, vtonCategory);
          console.log(`✅ Smart crop completed for ${task.pose} (${vtonCategory})`);
        } catch (cropError) {
          console.warn(`⚠️ Face crop failed for ${task.pose}:`, cropError);
        }

        return {
          id: uuidv4(),
          url: resultImage,
          pose: task.pose,
          timestamp: Date.now(),
          settings: { ...settings, seed: baseSeed }, // 사용된 시드 저장
          provider: effectiveStyleRef?.length
            ? `${providers.imageGeneration} + ${providers.tryOn} (Consistent)`
            : `${providers.imageGeneration} + ${providers.tryOn}`,
        };
      } catch (error) {
        console.error(`Error generating image for pose ${task.pose}, shot ${task.shotIndex}:`, error);
        throw error;
      }
    }

    // ⭐️ 타임아웃 경고 (4개 이상 포즈 시)
    const TIMEOUT_WARNING_THRESHOLD = 4;
    if (tasks.length >= TIMEOUT_WARNING_THRESHOLD) {
      console.warn(`⚠️ ${tasks.length}개 이미지 생성 요청 - 60초 타임아웃 초과 가능성 있음`);
    }

    // ⭐️ 모델 일관성을 위해 첫 번째 이미지는 먼저 생성
    console.log(`Starting generation with model consistency (${tasks.length} images)...`);
    const startTime = Date.now();
    const SOFT_TIMEOUT = 50000; // 50초 (60초 타임아웃 전에 응답)

    // 첫 번째 작업 먼저 실행 (참조 모델 생성)
    const firstTask = tasks[0];
    const remainingTasks = tasks.slice(1);

    let firstResult: GeneratedImage | null = null;
    try {
      firstResult = await generateSingleImage(firstTask, false);
      console.log(`✅ First model generated successfully for ${firstTask.pose} (${(Date.now() - startTime) / 1000}s)`);
    } catch (error) {
      console.error(`❌ First model generation failed:`, error);
    }

    // 남은 시간 체크
    const elapsedTime = Date.now() - startTime;
    const remainingTime = SOFT_TIMEOUT - elapsedTime;

    let remainingResults: PromiseSettledResult<GeneratedImage>[] = [];

    if (remainingTime > 10000 && remainingTasks.length > 0) {
      // 10초 이상 남았으면 나머지 작업 진행
      console.log(`⏱️ ${Math.round(remainingTime / 1000)}s remaining, processing ${remainingTasks.length} more tasks...`);

      // 타임아웃 레이스: 남은 시간 내에 완료된 것만 취합
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), remainingTime)
      );

      const tasksPromise = Promise.allSettled(
        remainingTasks.map(task => generateSingleImage(task, true))
      );

      const raceResult = await Promise.race([tasksPromise, timeoutPromise]);

      if (raceResult === 'timeout') {
        console.warn(`⏰ Soft timeout reached, returning partial results`);
        // 타임아웃이면 빈 결과
        remainingResults = remainingTasks.map(() => ({
          status: 'rejected' as const,
          reason: new Error('Timeout - 시간 초과'),
        }));
      } else {
        remainingResults = raceResult;
      }
    } else if (remainingTasks.length > 0) {
      console.warn(`⏰ Not enough time for remaining tasks (${Math.round(remainingTime / 1000)}s left)`);
      remainingResults = remainingTasks.map(() => ({
        status: 'rejected' as const,
        reason: new Error('Skipped - 시간 부족'),
      }));
    }

    // 결과 취합
    const results: PromiseSettledResult<GeneratedImage>[] = [
      firstResult
        ? { status: 'fulfilled' as const, value: firstResult }
        : { status: 'rejected' as const, reason: new Error('First model generation failed') },
      ...remainingResults,
    ];

    const generatedImages: GeneratedImage[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        generatedImages.push(result.value);
      } else {
        errors.push(`${tasks[index].pose} 포즈 실패: ${result.reason?.message || result.reason}`);
        console.error(`Task ${index} failed:`, result.reason);
      }
    });

    console.log(`Parallel generation completed in ${(Date.now() - startTime) / 1000}s - ${generatedImages.length}/${tasks.length} successful`);

    // 타임아웃 관련 에러인지 체크
    const hasTimeoutError = errors.some(e => e.includes('Timeout') || e.includes('시간'));
    const timeoutHint = hasTimeoutError ? ' 포즈 수를 3개 이하로 줄여보세요.' : '';

    if (generatedImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: hasTimeoutError
            ? `시간 초과로 이미지 생성에 실패했습니다.${timeoutHint}`
            : 'Virtual Try-On에 실패했습니다.',
          details: errors.join(', ')
        },
        { status: 500 }
      );
    }

    // 일부 실패한 경우 경고 포함
    const partialSuccess = generatedImages.length < tasks.length;
    const timeoutWarning = hasTimeoutError ? ` (일부 시간 초과 -${timeoutHint})` : '';

    // Notion 로깅 (비동기 - 응답을 지연시키지 않음)
    if (process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID) {
      const durationSeconds = Math.round((Date.now() - startTime) / 100) / 10; // 소수점 1자리
      const logEntries: GenerationLogEntry[] = generatedImages.map(img => ({
        title: `${img.pose} - ${providers.imageGeneration}`,
        provider: providers.imageGeneration,
        modelName: tryOnAvailable ? `${providers.imageGeneration} + ${providers.tryOn}` : providers.imageGeneration,
        pose: img.pose,
        prompt: basePrompt || undefined,
        customPrompt: promptSettings?.useCustomPrompt ? promptSettings.basePrompt : undefined,
        hasStyleReference: !!(styleReferenceImages && styleReferenceImages.length > 0),
        hasBackgroundSpot: !!(backgroundSpotImages && backgroundSpotImages.length > 0),
        success: true,
        resultImageUrl: img.url.startsWith('http') ? img.url : undefined,
        styleReferenceInfo: styleReferenceImages?.length ? `${styleReferenceImages.length}장 사용` : undefined,
        backgroundSpotInfo: backgroundSpotImages?.length ? `${backgroundSpotImages.length}장 사용` : undefined,
        totalShotsGenerated: generatedImages.length, // 총 생성 컷 수
        durationSeconds: durationSeconds, // 소요 시간 (초)
      }));

      logGenerationBatch(logEntries).catch(err => {
        console.warn('[Notion Log] 비동기 로깅 실패 (무시):', err);
      });
    }

    return NextResponse.json({
      success: true,
      images: generatedImages,
      warnings: partialSuccess ? [...errors, timeoutWarning].filter(Boolean) : undefined,
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

    // ⭐️ Phase 1-2: 재생성 시에도 자동 분류 적용
    let vtonCategory: VTONCategory = settings.garmentCategory || 'dresses';

    if (!settings.garmentCategory) {
      try {
        const classifyResponse = await fetch(`${request.nextUrl.origin}/api/classify-garment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: garmentImage }),
        });

        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          if (classifyData.success && classifyData.category) {
            vtonCategory = mapGarmentCategoryToVTON(classifyData.category as GarmentCategory);
          }
        }
      } catch (classifyError) {
        console.warn('⚠️ Garment classification error in regeneration:', classifyError);
      }
    }

    const modelImage = await imageProvider.generateModelImage({
      pose,
      style: settings.modelStyle,
      seed: settings.seed,
      negativePrompt: settings.negativePrompt,
      styleReferenceImages, // 스타일 참조용 (조명/배경/분위기만)
    });

    let resultImage = await tryOnProvider.tryOn({
      garmentImage,
      modelImage,
      pose,
      category: vtonCategory,
      seed: settings.seed,
    });

    // 카테고리별 크롭 후처리
    try {
      resultImage = await smartFaceCrop(resultImage, vtonCategory);
    } catch (cropError) {
      console.warn('⚠️ Face crop failed in regeneration:', cropError);
    }

    return NextResponse.json({
      success: true,
      image: {
        id: uuidv4(),
        url: resultImage,
        pose,
        timestamp: Date.now(),
        settings,
        provider: styleReferenceImages?.length
          ? `${providers.imageGeneration} + ${providers.tryOn} (Style Ref)`
          : `${providers.imageGeneration} + ${providers.tryOn}`,
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
