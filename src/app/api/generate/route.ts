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
  VTONCategory,
  GarmentCategory,
  mapGarmentCategoryToVTON,
  PoseMode,
  GenerationMode,
} from '@/types';
import { logGenerationBatch, type GenerationLogEntry } from '@/lib/notion';
import { generateWithControlNet, isControlNetAvailable, POSE_SKELETONS } from '@/lib/providers/controlnet';
import { GoogleGeminiImageProvider } from '@/lib/providers/google-gemini';
import { ShotType, BackgroundSpotType, ClothingType, TopPoseType, BottomPoseType, OuterPoseType, DressPoseType, selectAutoPoses, AutoGenerateCount } from '@/lib/prompts';
import { AutoGenerateMode } from '@/types';

// Vercel Serverless Function 설정
// Hobby 플랜: 최대 60초, Pro 플랜: 최대 300초
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 기본 프롬프트 설정
function getDefaultPrompts(): { basePrompt: string; negativePrompt: string } {
  return {
    basePrompt: '',
    negativePrompt: 'blurry, low quality, distorted, ugly, deformed, bad anatomy, watermark, signature, twisted feet, broken ankles, contorted limbs, unnatural pose, extra fingers, missing limbs, bent backwards, impossible angle, dislocated joints, twisted torso, awkward stance, mannequin pose',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { garmentImage, garmentCategory, backgroundSpotImages, poses, topPoses, settings, providers, backgroundSpotMode, selectedBackgroundSpot, referencePosePrompt, referencePoseImage, autoGenerateMode } = body as GenerationRequest & {
      garmentCategory?: GarmentCategory;
      backgroundSpotImages?: string[];
      backgroundSpotMode?: 'studio' | 'dropbox';
      selectedBackgroundSpot?: { path: string; thumbnailUrl?: string } | null;
      topPoses?: TopPoseType[];  // ⭐️ 상의 포즈 배열 (Direct 모드용)
      referencePosePrompt?: string | null;  // ⭐️ 레퍼런스 이미지에서 추출한 포즈 프롬프트 (텍스트)
      referencePoseImage?: string | null;  // ⭐️ 레퍼런스 포즈 원본 이미지 (base64)
      autoGenerateMode?: AutoGenerateMode;  // ⭐️ Phase 2-4: 자동 생성 모드
    };

    // 레퍼런스 포즈 로깅
    if (referencePoseImage) {
      console.log(`📸 [Reference Pose] Using reference IMAGE for visual pose matching`);
    }
    if (referencePosePrompt) {
      console.log(`📸 [Reference Pose] Extracted prompt: "${referencePosePrompt}"`);
    }

    // ⭐️ 생성 모드 확인 (기본값: 'direct' - VTON 없이 직접 생성)
    const generationMode: GenerationMode = providers.generationMode || 'direct';
    console.log(`🎯 [Generation Mode] ${generationMode === 'direct' ? 'Direct (레퍼런스 방식)' : 'VTON (기존 방식)'}`);

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

    // 기본 프롬프트 설정
    const { basePrompt, negativePrompt } = getDefaultPrompts();

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
      topPose?: TopPoseType;  // ⭐️ 상의(이너) 포즈
      bottomPose?: BottomPoseType;  // ⭐️ 하의 포즈
      outerPose?: OuterPoseType;  // ⭐️ 아우터 포즈
      dressPose?: DressPoseType;  // ⭐️ 드레스/원피스 포즈
      seedOffset?: number;  // ⭐️ 변형용 시드 오프셋
    }

    const tasks: GenerationTask[] = [];

    // ⭐️ 레퍼런스 포즈 이미지가 있으면 1개만 생성
    if (referencePoseImage) {
      console.log(`📸 [Reference Pose Mode] Generating 1 image with reference pose`);
      tasks.push({ pose: poses[0] || 'front', shotIndex: 0 });
    }
    // ⭐️ Phase 2-4: 자동 생성 모드 (5컷 또는 10컷)
    else if (autoGenerateMode === 5 || autoGenerateMode === 10) {
      const autoCount = autoGenerateMode as AutoGenerateCount;
      // garmentCategory를 전달하여 아우터/드레스 구분
      const autoPoses = selectAutoPoses(vtonCategory, autoCount, garmentCategory);
      console.log(`🎯 [Auto Generate Mode] ${autoCount}컷 자동 생성, Category: ${vtonCategory}, Garment: ${garmentCategory || 'auto'}`);

      for (const variation of autoPoses.variations) {
        if (autoPoses.outerPoses) {
          // 아우터 포즈
          tasks.push({
            pose: 'front',
            shotIndex: 0,
            outerPose: variation.poseType as OuterPoseType,
            seedOffset: variation.seedOffset,
          });
        } else if (autoPoses.dressPoses) {
          // 드레스 포즈
          tasks.push({
            pose: 'front',
            shotIndex: 0,
            dressPose: variation.poseType as DressPoseType,
            seedOffset: variation.seedOffset,
          });
        } else if (autoPoses.bottomPoses) {
          // 하의 포즈
          tasks.push({
            pose: 'front',
            shotIndex: 0,
            bottomPose: variation.poseType as BottomPoseType,
            seedOffset: variation.seedOffset,
          });
        } else if (autoPoses.topPoses) {
          // 상의 포즈
          tasks.push({
            pose: 'front',
            shotIndex: 0,
            topPose: variation.poseType as TopPoseType,
            seedOffset: variation.seedOffset,
          });
        }
      }
      console.log(`📍 [Auto Generate] Created ${tasks.length} tasks`);
    }
    // ⭐️ Direct 모드 + 상의 + topPoses 배열이 있으면 topPoses 사용
    else if (generationMode === 'direct' && vtonCategory === 'upper_body' && topPoses && topPoses.length > 0) {
      console.log(`📍 [Direct Mode] Using topPoses: ${topPoses.join(', ')}`);
      for (const topPose of topPoses) {
        tasks.push({ pose: 'front', shotIndex: 0, topPose });
      }
    } else {
      // 기존 방식: poses 배열 사용 (수동 선택 모드)
      for (const pose of poses) {
        for (let i = 0; i < settings.shotsPerPose; i++) {
          tasks.push({ pose, shotIndex: i });
        }
      }
    }

    // 병렬 이미지 생성 함수
    async function generateSingleImage(task: GenerationTask): Promise<GeneratedImage> {
      try {
        let resultImage: string;

        // ⭐️ Direct 모드: VTON 없이 AI가 직접 생성 (레퍼런스 프로그램 방식)
        if (generationMode === 'direct') {
          // Gemini의 generateIPhoneStyle 사용 (새로운 프롬프트 시스템)
          const geminiProvider = new GoogleGeminiImageProvider();

          // 의류 카테고리를 ClothingType으로 매핑
          const clothingTypeMap: Record<string, ClothingType> = {
            'upper_body': 'top',
            'lower_body': 'bottom',
            'dresses': 'dress',
          };
          const clothingType = clothingTypeMap[vtonCategory] || 'dress';

          // ⭐️ 포즈 타입 결정: task에서 직접 또는 카테고리별 매핑
          let topPose: TopPoseType | undefined;
          let bottomPose: BottomPoseType | undefined;
          let outerPose: OuterPoseType | undefined;
          let dressPose: DressPoseType | undefined;

          // 레퍼런스 이미지가 있으면 프리셋 포즈 무시
          if (!referencePoseImage) {
            // ⭐️ task에서 직접 지정된 포즈 우선 사용 (자동 생성 모드)
            if (task.topPose) {
              topPose = task.topPose;
              console.log(`👕 [Auto/Direct] Using topPose: ${topPose}`);
            } else if (task.bottomPose) {
              bottomPose = task.bottomPose;
              console.log(`👖 [Auto] Using bottomPose: ${bottomPose}`);
            } else if (task.outerPose) {
              outerPose = task.outerPose;
              console.log(`🧥 [Auto] Using outerPose: ${outerPose}`);
            } else if (task.dressPose) {
              dressPose = task.dressPose;
              console.log(`👗 [Auto] Using dressPose: ${dressPose}`);
            }
            // ⭐️ 수동 선택 모드: garmentCategory 기반 매핑
            else if (garmentCategory === 'outer') {
              // 아우터: OuterPoseType 매핑
              const outerPoseMap: Record<string, OuterPoseType> = {
                'front': 'outer_front_open',
                'styled': 'outer_front_closed',
                'side': 'outer_side',
                'sitting': 'outer_front_closed',
                'fullbody': 'outer_front_open',
                'leaning': 'outer_front_closed',
                'back': 'outer_back',
                'walking': 'outer_walking',
                'bag': 'outer_front_open',
                'crop': 'outer_detail',
              };
              outerPose = outerPoseMap[task.pose];
              console.log(`🧥 [Manual] ${task.pose} → ${outerPose}`);
            } else if (garmentCategory === 'dress' || vtonCategory === 'dresses') {
              // 드레스/원피스: DressPoseType 매핑
              const dressPoseMap: Record<string, DressPoseType> = {
                'front': 'dress_front',
                'styled': 'dress_twirl',
                'side': 'dress_side',
                'sitting': 'dress_sitting',
                'fullbody': 'dress_front',
                'leaning': 'dress_leaning',  // ⭐️ 기대기 포즈 수정
                'back': 'dress_back',
                'walking': 'dress_twirl',
                'bag': 'dress_front',
                'crop': 'dress_detail',
              };
              dressPose = dressPoseMap[task.pose];
              console.log(`👗 [Manual] ${task.pose} → ${dressPose}`);
            } else if (vtonCategory === 'upper_body') {
              // 상의(이너): TopPoseType 매핑
              const topPoseMap: Record<string, TopPoseType> = {
                'front': 'top_front',
                'styled': 'top_hair_touch',
                'side': 'top_side_glance',
                'sitting': 'top_sitting',
                'fullbody': 'top_front',
                'leaning': 'top_leaning',
                'back': 'top_front',
                'walking': 'top_front',
                'bag': 'top_hair_touch',
                'crop': 'top_detail',
              };
              topPose = topPoseMap[task.pose];
              console.log(`👕 [Manual] ${task.pose} → ${topPose}`);
            } else if (vtonCategory === 'lower_body') {
              // 하의: BottomPoseType 매핑
              const bottomPoseMap: Record<string, BottomPoseType> = {
                'front': 'bottom_front',
                'side': 'bottom_side',
                'styled': 'bottom_walking',
                'sitting': 'bottom_sitting',
                'fullbody': 'bottom_front',
                'leaning': 'bottom_leaning',  // ⭐️ 기대기 포즈 추가
                'back': 'bottom_back',
                'walking': 'bottom_walking',
                'bag': 'bottom_front',
                'crop': 'bottom_front',
              };
              bottomPose = bottomPoseMap[task.pose];
              console.log(`👖 [Manual] ${task.pose} → ${bottomPose}`);
            }
          }

          const currentPose = task.topPose || task.bottomPose || task.outerPose || task.dressPose || task.pose;
          console.log(`🎯 [Direct Mode] Generating for ${currentPose}, Category: ${vtonCategory}, Garment: ${garmentCategory || 'auto'}, RefImage: ${referencePoseImage ? 'YES' : 'NO'}`);

          // 배경 스팟 이미지 (있으면 첫 번째 사용)
          const backgroundSpotImage = backgroundSpotImages && backgroundSpotImages.length > 0
            ? backgroundSpotImages[0]
            : undefined;

          // ⭐️ 레퍼런스 포즈 텍스트가 있으면 additionalInstructions에 포함
          const poseInstructions = referencePosePrompt
            ? `CRITICAL POSE REQUIREMENT: ${referencePosePrompt}. ${basePrompt || ''}`
            : basePrompt;

          const result = await geminiProvider.generateIPhoneStyle({
            garmentImage,
            shotType: 'iphone_crop' as ShotType,
            backgroundSpot: backgroundSpotImage ? 'custom' as BackgroundSpotType : 'studio' as BackgroundSpotType,
            backgroundSpotImage,
            clothingType: clothingType as ClothingType,
            topPose,
            bottomPose,
            outerPose,  // ⭐️ 아우터 포즈 전달
            dressPose,  // ⭐️ 드레스 포즈 전달
            referencePoseImage: referencePoseImage || undefined,
            additionalInstructions: poseInstructions,
          });

          resultImage = result.image;
          console.log(`✅ [Direct Mode] Generated for ${task.pose}`);

        } else {
          // ⭐️ VTON 모드: 기존 방식 (모델 생성 → VTON 적용)

          // Virtual Try-On 필수 체크
          if (!tryOnAvailable) {
            throw new Error('Virtual Try-On이 필수입니다. REPLICATE_API_TOKEN을 확인하세요.');
          }

          let modelImage: string;

          // ⭐️ Phase 2-1: ControlNet 모드 vs Auto 모드 분기
          if (useControlNet) {
            // ControlNet + OpenPose: 스켈레톤 이미지로 포즈 제어
            console.log(`🎮 [ControlNet] Generating model for ${task.pose} with skeleton: ${POSE_SKELETONS[task.pose]}, category: ${vtonCategory}`);

            // 의류 카테고리에 따른 프레이밍 조정
            const framingPrompt = vtonCategory === 'upper_body'
              ? 'upper body focus, chest to waist framing, showing the top clearly'
              : vtonCategory === 'lower_body'
              ? 'full body shot, showing pants/skirt clearly'
              : 'full body shot, showing the entire outfit';

            // ⭐️ 레퍼런스 포즈가 있으면 프롬프트에 포함
            const poseDescription = referencePosePrompt || '';
            const controlNetPrompt = basePrompt
              ? `${poseDescription ? poseDescription + ', ' : ''}${basePrompt}, young Korean female model in her early 20s, slim fit body, tall with long legs, model-like proportions, professional fashion photography, iPhone quality, ${framingPrompt}`
              : `${poseDescription ? poseDescription + ', ' : ''}young Korean female model in her early 20s, slim fit body, tall with long legs, model-like proportions, height 170cm, slender figure, elegant posture, wearing fashion clothes, professional fashion photography, minimalist background, natural lighting, iPhone style photo, ${framingPrompt}`;

            const controlNetResult = await generateWithControlNet({
              pose: task.pose,
              prompt: controlNetPrompt,
              negativePrompt: negativePrompt || settings.negativePrompt,
              seed: settings.seed,
              garmentCategory: vtonCategory,
            });

            if (!controlNetResult.success || !controlNetResult.imageUrl) {
              console.warn(`⚠️ [ControlNet] Failed for ${task.pose}: ${controlNetResult.error}, falling back to auto mode`);
              // ControlNet 실패 시 기존 방식으로 폴백
              // ⭐️ 레퍼런스 포즈가 있으면 포함
              const fallbackPrompt = referencePosePrompt
                ? `${referencePosePrompt}, ${basePrompt || ''}`
                : basePrompt;
              modelImage = await imageProvider.generateModelImage({
                pose: task.pose,
                style: settings.modelStyle,
                seed: settings.seed,
                negativePrompt: negativePrompt || settings.negativePrompt,
                garmentImage,
                garmentCategory: vtonCategory,
                backgroundSpotImages,
                customPrompt: fallbackPrompt,
              });
            } else {
              modelImage = controlNetResult.imageUrl;
              console.log(`✅ [ControlNet] Success for ${task.pose}`);
            }
          } else {
            // 기존 Auto 모드: 프롬프트 기반 생성
            // ⭐️ 레퍼런스 포즈가 있으면 customPrompt에 포함
            const customPromptWithPose = referencePosePrompt
              ? `${referencePosePrompt}, ${basePrompt || ''}`
              : basePrompt;

            console.log(`Generating NEW model for ${task.pose} (category: ${vtonCategory}, seed: ${settings.seed || 'random'})`);
            modelImage = await imageProvider.generateModelImage({
              pose: task.pose,
              style: settings.modelStyle,
              seed: settings.seed,
              negativePrompt: negativePrompt || settings.negativePrompt,
              garmentImage, // 의류 이미지 전달 (뒷면도 색상/스타일 참조 필요)
              garmentCategory: vtonCategory,
              backgroundSpotImages,
              customPrompt: customPromptWithPose,
            });
          }

          // 2. Virtual Try-On 필수 적용 (의류만 교체)
          // ⭐️ Phase 1-2: 자동 분류된 카테고리 사용
          // 주의: VTON은 전신(얼굴 포함)이 필요하므로 크롭 전에 실행
          resultImage = await tryOnProvider.tryOn({
            garmentImage,
            modelImage,
            pose: task.pose,
            category: vtonCategory, // 자동 분류 또는 사용자 지정 카테고리
            seed: settings.seed ? settings.seed + task.shotIndex : undefined, // 각 컷마다 다른 시드
          });
        }

        // ⭐️ Phase 1-1: 얼굴 크롭 (이미지 비율 기반 스마트 크롭)
        // ⭐️ Phase 2-4: bottomPose도 레이블에 포함
        const poseLabel = task.topPose || task.bottomPose || task.outerPose || task.dressPose || task.pose;
        try {
          console.log(`Applying smart face crop for ${poseLabel}...`);
          resultImage = await cropWithFaceDetection(resultImage, task.pose);
          console.log(`✅ Face cropped successfully for ${poseLabel}`);
        } catch (cropError) {
          console.warn(`⚠️ Face crop failed for ${poseLabel}:`, cropError);
          // 크롭 실패 시 결과 그대로 사용
        }

        return {
          id: uuidv4(),
          url: resultImage,
          pose: poseLabel,  // ⭐️ topPose 또는 bottomPose 사용
          timestamp: Date.now(),
          settings,
          provider: generationMode === 'direct'
            ? `${providers.imageGeneration} (Direct)`
            : `${providers.imageGeneration} + ${providers.tryOn}`,
        };
      } catch (error) {
        console.error(`Error generating image for pose ${task.topPose || task.bottomPose || task.outerPose || task.dressPose || task.pose}, shot ${task.shotIndex}:`, error);
        throw error;
      }
    }

    // ⭐️ 순차 생성으로 변경 (타임아웃 방지)
    // 로컬: 3분, Vercel Hobby: 60초 제한
    console.log(`Starting sequential generation of ${tasks.length} images...`);
    const startTime = Date.now();
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
    const TIMEOUT_BUFFER_MS = isLocal ? 180000 : 50000; // 로컬 3분, Vercel 50초
    console.log(`⏱️ Timeout set to ${TIMEOUT_BUFFER_MS / 1000}s (${isLocal ? 'local' : 'vercel'})`)

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
          error: generationMode === 'direct' ? '이미지 생성에 실패했습니다.' : 'Virtual Try-On에 실패했습니다.',
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
        hasStyleReference: false,
        hasBackgroundSpot: !!(backgroundSpotImages && backgroundSpotImages.length > 0),
        success: true,
        resultImageUrl: img.url.startsWith('http') ? img.url : undefined,
        backgroundSpotInfo: backgroundSpotMode === 'dropbox' ? selectedBackgroundSpot?.path : undefined,
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
    const { garmentImage, pose, settings, providers } = body;

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
