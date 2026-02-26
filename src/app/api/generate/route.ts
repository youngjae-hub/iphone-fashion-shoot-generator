import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getImageGenerationProvider,
  getTryOnProvider,
} from '@/lib/providers';
import {
  IImageGenerationProvider,
  ITryOnProvider,
  cropWithFaceDetection,
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
  PoseMode,
} from '@/types';
import { logGenerationBatch, type GenerationLogEntry } from '@/lib/notion';
import { generateWithControlNet, isControlNetAvailable, POSE_SKELETONS } from '@/lib/providers/controlnet';

// Vercel Serverless Function 설정
// Hobby 플랜: 최대 60초, Pro 플랜: 최대 300초
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 프롬프트 설정에서 최종 프롬프트 생성
function buildPromptFromSettings(promptSettings?: CustomPromptSettings): { basePrompt: string; negativePrompt: string } {
  if (!promptSettings) {
    return {
      basePrompt: '',
      negativePrompt: 'blurry, low quality, distorted, ugly, deformed, bad anatomy, watermark, signature, twisted feet, broken ankles, contorted limbs, unnatural pose, extra fingers, missing limbs, bent backwards, impossible angle, dislocated joints, twisted torso, awkward stance, mannequin pose',
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

    // ⭐️ Phase 2-1: poseMode 확인 (기본값: 'auto')
    const poseMode: PoseMode = providers.poseMode || 'auto';
    const useControlNet = poseMode === 'controlnet' && isControlNetAvailable();

    if (poseMode === 'controlnet') {
      if (useControlNet) {
        console.log('🎮 [ControlNet Mode] Using Replicate ControlNet for pose control');
        console.log(`🔑 [ControlNet Mode] REPLICATE_API_TOKEN: SET ✅`);
      } else {
        console.error('❌ [ControlNet Mode] REPLICATE_API_TOKEN not configured!');
        return NextResponse.json(
          {
            success: false,
            error: 'ControlNet 모드에 필요한 REPLICATE_API_TOKEN이 설정되지 않았습니다.',
          },
          { status: 400 }
        );
      }
    }

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

    // ⭐️ 일관성을 위한 시드 설정 (모든 포즈에 동일 적용)
    // 시드가 없으면 랜덤 생성하여 배치 내 일관성 유지
    if (!settings.seed) {
      settings.seed = Math.floor(Math.random() * 1000000);
      console.log(`🎲 Generated consistent seed for batch: ${settings.seed}`);
    }

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
    async function generateSingleImage(task: GenerationTask): Promise<GeneratedImage> {
      try {
        // Virtual Try-On 필수 체크
        if (!tryOnAvailable) {
          throw new Error('Virtual Try-On이 필수입니다. REPLICATE_API_TOKEN을 확인하세요.');
        }

        let modelImage: string;

        // ⭐️ Phase 2-1: ControlNet 모드 vs Auto 모드 분기
        if (useControlNet) {
          // ControlNet + OpenPose: 스켈레톤 이미지로 포즈 제어
          console.log(`🎮 [ControlNet] Generating model for ${task.pose} with skeleton: ${POSE_SKELETONS[task.pose]}`);

          const controlNetPrompt = basePrompt
            ? `${basePrompt}, young Korean female model in her early 20s, slim fit body, tall with long legs, model-like proportions, professional fashion photography, iPhone quality`
            : `young Korean female model in her early 20s, slim fit body, tall with long legs, model-like proportions, height 170cm, slender figure, elegant posture, wearing fashion clothes, professional fashion photography, minimalist background, natural lighting, iPhone style photo, full body shot`;

          const controlNetResult = await generateWithControlNet({
            pose: task.pose,
            prompt: controlNetPrompt,
            negativePrompt: negativePrompt || settings.negativePrompt,
            seed: settings.seed,
          });

          if (!controlNetResult.success || !controlNetResult.imageUrl) {
            console.warn(`⚠️ [ControlNet] Failed for ${task.pose}: ${controlNetResult.error}, falling back to auto mode`);
            // ControlNet 실패 시 기존 방식으로 폴백
            modelImage = await imageProvider.generateModelImage({
              pose: task.pose,
              style: settings.modelStyle,
              seed: settings.seed,
              negativePrompt: negativePrompt || settings.negativePrompt,
              garmentImage,
              garmentCategory: vtonCategory,
              styleReferenceImages,
              backgroundSpotImages,
              customPrompt: basePrompt,
            });
          } else {
            modelImage = controlNetResult.imageUrl;
            console.log(`✅ [ControlNet] Success for ${task.pose}`);
          }
        } else {
          // 기존 Auto 모드: 프롬프트 기반 생성
          console.log(`Generating NEW model for ${task.pose} (category: ${vtonCategory}, seed: ${settings.seed || 'random'})`);
          modelImage = await imageProvider.generateModelImage({
            pose: task.pose,
            style: settings.modelStyle,
            seed: settings.seed,
            negativePrompt: negativePrompt || settings.negativePrompt,
            garmentImage, // 의류 이미지 전달 (뒷면도 색상/스타일 참조 필요)
            garmentCategory: vtonCategory,
            styleReferenceImages,
            backgroundSpotImages,
            customPrompt: basePrompt,
          });
        }

        // 2. Virtual Try-On 필수 적용 (의류만 교체)
        // ⭐️ Phase 1-2: 자동 분류된 카테고리 사용
        // 주의: VTON은 전신(얼굴 포함)이 필요하므로 크롭 전에 실행
        let resultImage = await tryOnProvider.tryOn({
          garmentImage,
          modelImage,
          pose: task.pose,
          category: vtonCategory, // 자동 분류 또는 사용자 지정 카테고리
          seed: settings.seed ? settings.seed + task.shotIndex : undefined, // 각 컷마다 다른 시드
        });

        // ⭐️ Phase 1-1: 얼굴 크롭 (이미지 비율 기반 스마트 크롭)
        try {
          console.log(`Applying smart face crop for ${task.pose}...`);
          resultImage = await cropWithFaceDetection(resultImage, task.pose);
          console.log(`✅ Face cropped successfully for ${task.pose}`);
        } catch (cropError) {
          console.warn(`⚠️ Face crop failed for ${task.pose}:`, cropError);
          // 크롭 실패 시 VTON 결과 그대로 사용
        }

        return {
          id: uuidv4(),
          url: resultImage,
          pose: task.pose,
          timestamp: Date.now(),
          settings,
          provider: styleReferenceImages && styleReferenceImages.length > 0
            ? `${providers.tryOn} (Reference-based)`
            : `${providers.imageGeneration} + ${providers.tryOn}`,
        };
      } catch (error) {
        console.error(`Error generating image for pose ${task.pose}, shot ${task.shotIndex}:`, error);
        throw error; // Try-On 실패는 전체 요청 실패로 처리
      }
    }

    // ⭐️ 순차 생성으로 변경 (타임아웃 방지)
    // Vercel Hobby 60초 제한 대응: 병렬 → 순차 + 조기 반환
    console.log(`Starting sequential generation of ${tasks.length} images...`);
    const startTime = Date.now();
    const TIMEOUT_BUFFER_MS = 50000; // 50초 후 조기 반환 (10초 여유)

    const results: PromiseSettledResult<GeneratedImage>[] = [];

    for (const task of tasks) {
      // 타임아웃 체크: 50초 초과 시 남은 작업 중단
      if (Date.now() - startTime > TIMEOUT_BUFFER_MS) {
        console.warn(`⏱️ Timeout approaching, stopping after ${results.length}/${tasks.length} images`);
        break;
      }

      try {
        const image = await generateSingleImage(task);
        results.push({ status: 'fulfilled', value: image });
        console.log(`✅ Generated ${task.pose} (${results.length}/${tasks.length})`);
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.error(`❌ Failed ${task.pose}:`, error);
      }
    }

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

    if (generatedImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Virtual Try-On에 실패했습니다.',
          details: errors.join(', ')
        },
        { status: 500 }
      );
    }

    // 일부 실패한 경우 경고 포함
    const partialSuccess = generatedImages.length < tasks.length;

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
      warnings: partialSuccess ? errors : undefined,
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
      garmentImage,
      styleReferenceImages,
    });

    const resultImage = await tryOnProvider.tryOn({
      garmentImage,
      modelImage,
      pose,
      category: vtonCategory,
      seed: settings.seed,
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
