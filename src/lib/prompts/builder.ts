// ============================================
// iPhone Style Lookbook - Prompt Builder
// CTR 방식 참고: 모듈화된 프롬프트 조립
// ============================================

import { PRIME_DIRECTIVES, IPHONE_LOOK_DIRECTIVE, NEGATIVE_DIRECTIVES } from './prime-directives';
import {
  ShotType,
  SHOT_TEMPLATES,
  TopPoseType,
  TOP_POSE_TEMPLATES,
  BottomPoseType,
  BOTTOM_POSE_TEMPLATES,
  OuterPoseType,
  OUTER_POSE_TEMPLATES,
  DressPoseType,
  DRESS_POSE_TEMPLATES,
} from './templates';
import { BackgroundSpotType, BACKGROUND_SPOT_HINTS, ClothingType, CLOTHING_TYPE_HINTS } from './hints';

/**
 * 프롬프트 빌더 설정
 */
export interface PromptBuilderConfig {
  shotType: ShotType;
  backgroundSpot: BackgroundSpotType;
  clothingType?: ClothingType;
  customBackgroundDescription?: string; // custom 배경 스팟 사용 시
  additionalInstructions?: string; // 사용자 추가 지시
  topPose?: TopPoseType; // 상의 전용 포즈 (선택적)
  bottomPose?: BottomPoseType; // 하의 전용 포즈 (선택적)
  outerPose?: OuterPoseType; // 아우터 전용 포즈 (선택적)
  dressPose?: DressPoseType; // 드레스 전용 포즈 (선택적)
}

/**
 * 빌드된 프롬프트 결과
 */
export interface BuiltPrompt {
  fullPrompt: string;
  sections: {
    primeDirectives: string;
    iphoneLook: string;
    shotTemplate: string;
    backgroundHint: string;
    clothingHint: string;
    negativeDirectives: string;
  };
}

/**
 * 프롬프트 빌더
 * CTR의 구조적 장점 + 우리만의 아이폰 스타일
 */
export function buildPrompt(config: PromptBuilderConfig): BuiltPrompt {
  const {
    shotType,
    backgroundSpot,
    clothingType,
    customBackgroundDescription,
    additionalInstructions,
    topPose,
    bottomPose,
    outerPose,
    dressPose,
  } = config;

  // 1. Prime Directives (공통)
  const primeDirectives = PRIME_DIRECTIVES;

  // 2. iPhone Look (공통 - 우리의 핵심 차별점)
  const iphoneLook = IPHONE_LOOK_DIRECTIVE;

  // 3. Shot Template (촬영 타입별)
  // 우선순위: dressPose > outerPose > bottomPose > topPose > 기본 shotType
  let shotTemplate: string;
  if (dressPose && DRESS_POSE_TEMPLATES[dressPose]) {
    // 드레스 포즈 템플릿 사용
    shotTemplate = DRESS_POSE_TEMPLATES[dressPose];
  } else if (outerPose && OUTER_POSE_TEMPLATES[outerPose]) {
    // 아우터 포즈 템플릿 사용
    shotTemplate = OUTER_POSE_TEMPLATES[outerPose];
  } else if (bottomPose && BOTTOM_POSE_TEMPLATES[bottomPose]) {
    // 하의 포즈 템플릿 사용
    shotTemplate = BOTTOM_POSE_TEMPLATES[bottomPose];
  } else if (topPose && TOP_POSE_TEMPLATES[topPose]) {
    // 상의 포즈 템플릿 사용
    shotTemplate = TOP_POSE_TEMPLATES[topPose];
  } else {
    shotTemplate = SHOT_TEMPLATES[shotType];
  }

  // 4. Background Hint
  let backgroundHint = '';
  if (backgroundSpot === 'custom' && customBackgroundDescription) {
    backgroundHint = `[Background Spot: Custom]\n${customBackgroundDescription}`;
  } else if (backgroundSpot === 'custom') {
    backgroundHint = `[Background Spot: Custom]\nMatch the environment exactly from the provided BACKGROUND_SPOT image.`;
  } else {
    backgroundHint = BACKGROUND_SPOT_HINTS[backgroundSpot];
  }

  // 5. Clothing Hint (선택적)
  const clothingHint = clothingType ? CLOTHING_TYPE_HINTS[clothingType] : '';

  // 6. Negative Directives
  const negativeDirectives = NEGATIVE_DIRECTIVES;

  // 프롬프트 조립
  const parts = [
    primeDirectives,
    iphoneLook,
    shotTemplate,
    backgroundHint,
    clothingHint,
    negativeDirectives,
  ].filter(Boolean);

  // 추가 지시사항이 있으면 마지막에 추가
  if (additionalInstructions) {
    parts.push(`[Additional Instructions]\n${additionalInstructions}`);
  }

  // 마지막에 생성 지시
  parts.push('\nGenerate the image now.');

  return {
    fullPrompt: parts.join('\n\n'),
    sections: {
      primeDirectives,
      iphoneLook,
      shotTemplate,
      backgroundHint,
      clothingHint,
      negativeDirectives,
    },
  };
}

/**
 * 간단한 프롬프트 빌더 (기본값 사용)
 * 기본 배경: studio (깨끗한 흰색 스튜디오 배경)
 */
export function buildSimplePrompt(
  shotType: ShotType = 'iphone_crop',
  backgroundSpot: BackgroundSpotType = 'studio'
): string {
  const result = buildPrompt({ shotType, backgroundSpot });
  return result.fullPrompt;
}

/**
 * 디버그용: 프롬프트 섹션 출력
 */
export function debugPrompt(config: PromptBuilderConfig): void {
  const result = buildPrompt(config);
  console.log('=== Built Prompt Debug ===');
  console.log('Shot Type:', config.shotType);
  console.log('Background:', config.backgroundSpot);
  console.log('Clothing:', config.clothingType || 'not specified');
  console.log('');
  console.log('--- Full Prompt ---');
  console.log(result.fullPrompt);
  console.log('=== End Debug ===');
}
