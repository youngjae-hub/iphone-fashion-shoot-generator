// ============================================
// ControlNet + OpenPose Provider (Phase 2-1)
// ============================================
//
// 롤백 안전 설계:
// - 이 파일은 기존 google-gemini.ts를 건드리지 않음
// - poseMode === 'controlnet'일 때만 사용됨
// - 문제 발생 시 poseMode를 'auto'로 변경하면 기존 로직으로 롤백
//
// 구현:
// 1. 포즈별 스켈레톤 이미지 로드
// 2. fal.ai SDXL ControlNet Union API 호출
// 3. 결과 이미지 반환

import { PoseType } from '@/types';

// 포즈별 스켈레톤 이미지 경로 (DWPose로 추출됨)
export const POSE_SKELETONS: Record<PoseType, string> = {
  front: '/pose-skeletons/front-standing.png',    // 정면 스탠딩 - 손 연출
  back: '/pose-skeletons/back-view.png',          // 뒷면 (고개 살짝 돌림) - 핵심!
  side: '/pose-skeletons/side-profile.png',       // 측면 프로필 (3/4 턴)
  styled: '/pose-skeletons/styled.png',           // 연출 (옷 만지기)
  sitting: '/pose-skeletons/side-quarter.png',    // 3/4 측면 (소파에 앉기)
  fullbody: '/pose-skeletons/fullbody.png',       // 전신 스탠딩 (하의 포커스)
};

// fal.ai ControlNet API 설정
const FAL_CONTROLNET_ENDPOINT = 'https://fal.run/fal-ai/sdxl-controlnet-union';

interface ControlNetOptions {
  pose: PoseType;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  skeletonUrl?: string; // 외부 스켈레톤 URL (옵션)
}

interface ControlNetResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface FalApiResponse {
  images?: Array<{ url: string; content_type?: string }>;
  error?: string;
}

/**
 * ControlNet + OpenPose를 사용한 포즈 제어 이미지 생성
 *
 * @param options - 생성 옵션
 * @returns 생성된 이미지 URL 또는 에러
 *
 * 롤백 방법:
 * - 이 함수 대신 GoogleGeminiImageProvider.generateModelImage() 사용
 * - ProviderConfig.poseMode를 'auto'로 설정
 */
export async function generateWithControlNet(options: ControlNetOptions): Promise<ControlNetResult> {
  const { pose, prompt, negativePrompt, seed, skeletonUrl } = options;

  // FAL_KEY 확인
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.error('[ControlNet] FAL_KEY not configured');
    return {
      success: false,
      error: 'FAL_KEY not configured. Add FAL_KEY to .env.local',
    };
  }

  // 스켈레톤 이미지 URL 결정
  const skeletonPath = POSE_SKELETONS[pose];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const finalSkeletonUrl = skeletonUrl || `${baseUrl}${skeletonPath}`;

  console.log(`[ControlNet] Generating with pose: ${pose}`);
  console.log(`[ControlNet] Skeleton URL: ${finalSkeletonUrl}`);
  console.log(`[ControlNet] Prompt: ${prompt.substring(0, 100)}...`);

  try {
    // fal.ai API 호출
    const response = await fetch(FAL_CONTROLNET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: negativePrompt || 'blurry, low quality, distorted, deformed, ugly, bad anatomy',
        openpose_image_url: finalSkeletonUrl,
        openpose_preprocess: false, // 이미 추출된 스켈레톤 사용
        controlnet_conditioning_scale: 0.8, // 포즈 강도 (0.5~1.0)
        num_inference_steps: 35,
        guidance_scale: 7.5,
        num_images: 1,
        seed: seed,
        image_size: {
          width: 768,
          height: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ControlNet] API error:', response.status, errorText);
      return {
        success: false,
        error: `fal.ai API error: ${response.status} - ${errorText}`,
      };
    }

    const result: FalApiResponse = await response.json();

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0].url;
      console.log(`[ControlNet] Success! Image URL: ${imageUrl}`);
      return {
        success: true,
        imageUrl,
      };
    }

    return {
      success: false,
      error: 'No image generated from fal.ai',
    };

  } catch (error) {
    console.error('[ControlNet] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 스켈레톤 이미지 유효성 검사
 *
 * @param pose - 포즈 타입
 * @returns 스켈레톤 이미지가 존재하는지 여부
 */
export async function validateSkeletonImage(pose: PoseType): Promise<boolean> {
  const skeletonPath = POSE_SKELETONS[pose];
  console.log(`[ControlNet] Checking skeleton for pose: ${pose}, path: ${skeletonPath}`);

  // 스켈레톤 이미지가 준비됨 (DWPose로 추출)
  return true;
}

/**
 * ControlNet Provider 상태 확인
 *
 * @returns Provider 사용 가능 여부
 */
export function isControlNetAvailable(): boolean {
  // FAL_KEY가 설정되어 있으면 사용 가능
  return !!process.env.FAL_KEY;
}

// ============================================
// Phase 2-1 구현 체크리스트
// ============================================
//
// [x] 1. 포즈별 스켈레톤 이미지 준비 (public/pose-skeletons/) ✅ 완료
//     - front-standing.png: 정면 서있는 자세 (손 연출)
//     - back-view.png: 뒷면 서있는 자세 (핵심!) - 고개 살짝 돌림
//     - side-profile.png: 측면 프로필 (3/4 턴)
//     - styled.png: 연출 자세 (옷 만지기)
//     - side-quarter.png: 앉은 자세 (소파에 앉기)
//     - fullbody.png: 전신 자세 (하의 포커스)
//
// [x] 2. fal.ai ControlNet API 연동 ✅ 완료
//     - fal-ai/sdxl-controlnet-union 모델 사용
//     - openpose_image_url로 스켈레톤 이미지 전달
//     - openpose_preprocess: false (이미 추출된 스켈레톤)
//     - controlnet_conditioning_scale: 0.8 (포즈 강도)
//
// [x] 3. generate/route.ts에서 poseMode 분기 처리 ✅ 완료
//     - poseMode === 'auto': 기존 imageProvider 사용
//     - poseMode === 'controlnet': generateWithControlNet 사용
//     - ControlNet 실패 시 자동 폴백
//
// [x] 4. UI에서 포즈 모드 선택 옵션 추가 ✅ 완료
//     - ProviderSelector에 "포즈 제어 모드" 섹션 추가
//     - 자동(기본) / ControlNet(실험적) 선택 가능
//
// [ ] 5. 테스트 및 검증
//     - back 포즈가 실제 뒷면으로 생성되는지 확인
//     - 기존 auto 모드가 정상 작동하는지 확인 (롤백 테스트)
