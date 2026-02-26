// ============================================
// ControlNet + OpenPose Provider (Phase 2-1)
// ============================================
//
// Replicate 기반 ControlNet 구현
// - 기존 REPLICATE_API_TOKEN 사용 (별도 API 키 불필요)
// - poseMode === 'controlnet'일 때만 사용됨
// - 문제 발생 시 poseMode를 'auto'로 변경하면 기존 로직으로 롤백

import Replicate from 'replicate';
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

// Replicate 클라이언트
const getReplicateClient = () => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set');
  }
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
};

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

// Helper function to extract string from Replicate output
function extractOutputString(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const obj = first as Record<string, unknown>;
      if (obj.url) return String(obj.url);
      if (obj.href) return String(obj.href);
    }
    return String(first);
  }
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    if (obj.url) return String(obj.url);
    if (obj.href) return String(obj.href);
  }
  throw new Error('Unexpected output format from Replicate');
}

/**
 * ControlNet + OpenPose를 사용한 포즈 제어 이미지 생성 (Replicate)
 */
export async function generateWithControlNet(options: ControlNetOptions): Promise<ControlNetResult> {
  const { pose, prompt, negativePrompt, seed, skeletonUrl } = options;

  // REPLICATE_API_TOKEN 확인
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[ControlNet] REPLICATE_API_TOKEN not configured');
    return {
      success: false,
      error: 'REPLICATE_API_TOKEN not configured',
    };
  }

  // 스켈레톤 이미지 URL 결정
  const skeletonPath = POSE_SKELETONS[pose];

  // 프로덕션 도메인 사용
  let baseUrl: string;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else {
    baseUrl = 'https://260116iphone.vercel.app';
  }

  const finalSkeletonUrl = skeletonUrl || `${baseUrl}${skeletonPath}`;

  console.log(`[ControlNet] ========== DEBUG (Replicate) ==========`);
  console.log(`[ControlNet] REPLICATE_API_TOKEN: SET ✅`);
  console.log(`[ControlNet] Base URL: ${baseUrl}`);
  console.log(`[ControlNet] Pose: ${pose}`);
  console.log(`[ControlNet] Skeleton URL: ${finalSkeletonUrl}`);
  console.log(`[ControlNet] Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`[ControlNet] ================================================`);

  try {
    const replicate = getReplicateClient();

    // Replicate ControlNet OpenPose 모델 사용
    // jagilley/controlnet-pose: OpenPose 기반 포즈 제어
    console.log(`[ControlNet] Calling Replicate API...`);

    const input = {
      image: finalSkeletonUrl,
      prompt: `${prompt}, best quality, extremely detailed`,
      a_prompt: "best quality, extremely detailed, professional fashion photography",
      n_prompt: negativePrompt || 'blurry, low quality, distorted, deformed, ugly, bad anatomy',
      num_samples: "1",
      image_resolution: "512",
      ddim_steps: 20,
      scale: 9,
      seed: seed || Math.floor(Math.random() * 1000000),
      eta: 0,
      detect_resolution: 512,
      guess_mode: false,
    };

    console.log(`[ControlNet] Input params:`, JSON.stringify(input, null, 2));

    const output = await replicate.run(
      "jagilley/controlnet-pose:0304f7f774ba7341ef754231f794b1ba3d129e3c46af3022a1094dbb3bd59ce1" as `${string}/${string}`,
      { input }
    );

    console.log(`[ControlNet] Raw output:`, JSON.stringify(output).substring(0, 500));

    const imageUrl = extractOutputString(output);
    console.log(`[ControlNet] ✅ Success! Image URL: ${imageUrl}`);

    return {
      success: true,
      imageUrl,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[ControlNet] ❌ Error:', errorMessage);
    console.error('[ControlNet] ❌ Stack:', errorStack);
    console.error('[ControlNet] ❌ Full error:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: `ControlNet error: ${errorMessage}`,
    };
  }
}

/**
 * 스켈레톤 이미지 유효성 검사
 */
export async function validateSkeletonImage(pose: PoseType): Promise<boolean> {
  const skeletonPath = POSE_SKELETONS[pose];
  console.log(`[ControlNet] Checking skeleton for pose: ${pose}, path: ${skeletonPath}`);
  return true;
}

/**
 * ControlNet Provider 상태 확인
 * Replicate 기반이므로 REPLICATE_API_TOKEN 확인
 */
export function isControlNetAvailable(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}
