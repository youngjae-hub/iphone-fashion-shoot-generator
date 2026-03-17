// ============================================
// 자동 포즈 선택기
// Phase 2-4: 포즈 다양성 확보 (5~10개 자동 생성)
// ============================================

import {
  TopPoseType,
  BottomPoseType,
  OuterPoseType,
  DressPoseType,
} from './templates';
import { VTONCategory, GarmentCategory } from '@/types';

/**
 * 자동 생성 모드
 */
export type AutoGenerateCount = 5 | 10;

/**
 * 모든 포즈 타입 유니온
 */
export type AnyPoseType = TopPoseType | BottomPoseType | OuterPoseType | DressPoseType;

/**
 * 자동 선택된 포즈 결과
 */
export interface AutoSelectedPoses {
  topPoses?: TopPoseType[];
  bottomPoses?: BottomPoseType[];
  outerPoses?: OuterPoseType[];
  dressPoses?: DressPoseType[];
  // 각 포즈에 대한 변형 (seed offset)
  variations: Array<{
    poseType: AnyPoseType;
    seedOffset: number;  // 메인 seed에 더해질 오프셋
    variationLabel: string;  // 예: "front_v1", "front_v2"
  }>;
}

/**
 * 상의(이너) 카테고리 최적 포즈 조합
 */
function selectTopPoses(count: AutoGenerateCount): AutoSelectedPoses {
  const basePoses: TopPoseType[] = [
    'top_front',       // 1. 정면 - 필수
    'top_hair_touch',  // 2. 헤어터치 - 인기 포즈
    'top_side_glance', // 3. 사이드 시선 - 실루엣
    'top_leaning',     // 4. 기대기 - 라이프스타일
    'top_sitting',     // 5. 앉은 포즈
  ];

  if (count === 5) {
    return {
      topPoses: basePoses,
      variations: basePoses.map((pose, index) => ({
        poseType: pose,
        seedOffset: index * 1000,
        variationLabel: `${pose}`,
      })),
    };
  }

  // 10개: 5가지 기본 + 5가지 변형
  const variations: AutoSelectedPoses['variations'] = [];
  basePoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: index * 1000,
      variationLabel: `${pose}_v1`,
    });
  });

  const extraPoses: TopPoseType[] = [
    'top_front',
    'top_hair_touch',
    'top_detail',
    'top_side_glance',
    'top_leaning',
  ];

  extraPoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: (index + 5) * 1000 + 500,
      variationLabel: `${pose}_v2`,
    });
  });

  return {
    topPoses: [...basePoses, ...extraPoses],
    variations,
  };
}

/**
 * 하의(바지/스커트) 카테고리 최적 포즈 조합
 */
function selectBottomPoses(count: AutoGenerateCount): AutoSelectedPoses {
  const basePoses: BottomPoseType[] = [
    'bottom_front',    // 1. 정면 스탠딩 - 필수
    'bottom_side',     // 2. 90도 측면 - 다리 라인
    'bottom_walking',  // 3. 워킹 - 움직임
    'bottom_back',     // 4. 뒷모습 - 포켓 디테일
    'bottom_sitting',  // 5. 앉은 포즈 - 착용감
  ];

  if (count === 5) {
    return {
      bottomPoses: basePoses,
      variations: basePoses.map((pose, index) => ({
        poseType: pose,
        seedOffset: index * 1000,
        variationLabel: `${pose}`,
      })),
    };
  }

  // 10개
  const variations: AutoSelectedPoses['variations'] = [];
  basePoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: index * 1000,
      variationLabel: `${pose}_v1`,
    });
  });

  const extraPoses: BottomPoseType[] = [
    'bottom_front',
    'bottom_side',
    'bottom_walking',
    'bottom_front',
    'bottom_side',
  ];

  extraPoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: (index + 5) * 1000 + 500,
      variationLabel: `${pose}_v2`,
    });
  });

  return {
    bottomPoses: [...basePoses, ...extraPoses],
    variations,
  };
}

/**
 * 아우터(코트/자켓) 카테고리 최적 포즈 조합
 */
function selectOuterPoses(count: AutoGenerateCount): AutoSelectedPoses {
  const basePoses: OuterPoseType[] = [
    'outer_front_open',    // 1. 열린 정면 - 레이어드
    'outer_front_closed',  // 2. 닫힌 정면 - 실루엣
    'outer_side',          // 3. 측면 - 구조
    'outer_back',          // 4. 뒷모습 - 벤트/디테일
    'outer_walking',       // 5. 워킹 - 움직임
  ];

  if (count === 5) {
    return {
      outerPoses: basePoses,
      variations: basePoses.map((pose, index) => ({
        poseType: pose,
        seedOffset: index * 1000,
        variationLabel: `${pose}`,
      })),
    };
  }

  // 10개
  const variations: AutoSelectedPoses['variations'] = [];
  basePoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: index * 1000,
      variationLabel: `${pose}_v1`,
    });
  });

  const extraPoses: OuterPoseType[] = [
    'outer_front_open',
    'outer_front_closed',
    'outer_detail',
    'outer_side',
    'outer_walking',
  ];

  extraPoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: (index + 5) * 1000 + 500,
      variationLabel: `${pose}_v2`,
    });
  });

  return {
    outerPoses: [...basePoses, ...extraPoses],
    variations,
  };
}

/**
 * 드레스/원피스 카테고리 최적 포즈 조합
 */
function selectDressPoses(count: AutoGenerateCount): AutoSelectedPoses {
  const basePoses: DressPoseType[] = [
    'dress_front',   // 1. 정면 전신
    'dress_side',    // 2. 측면 실루엣
    'dress_back',    // 3. 뒷면 디자인
    'dress_twirl',   // 4. 트윌/움직임
    'dress_sitting', // 5. 앉은 포즈
  ];

  if (count === 5) {
    return {
      dressPoses: basePoses,
      variations: basePoses.map((pose, index) => ({
        poseType: pose,
        seedOffset: index * 1000,
        variationLabel: `${pose}`,
      })),
    };
  }

  // 10개
  const variations: AutoSelectedPoses['variations'] = [];
  basePoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: index * 1000,
      variationLabel: `${pose}_v1`,
    });
  });

  const extraPoses: DressPoseType[] = [
    'dress_front',
    'dress_side',
    'dress_twirl',
    'dress_detail',
    'dress_front',
  ];

  extraPoses.forEach((pose, index) => {
    variations.push({
      poseType: pose,
      seedOffset: (index + 5) * 1000 + 500,
      variationLabel: `${pose}_v2`,
    });
  });

  return {
    dressPoses: [...basePoses, ...extraPoses],
    variations,
  };
}

/**
 * 의류 카테고리에 따라 최적의 포즈 자동 선택
 * @param vtonCategory - VTON 카테고리 (upper_body, lower_body, dresses)
 * @param count - 생성할 포즈 수 (5 또는 10)
 * @param garmentCategory - 세부 의류 카테고리 (top, outer, bottom, dress)
 */
export function selectAutoPoses(
  vtonCategory: VTONCategory,
  count: AutoGenerateCount,
  garmentCategory?: GarmentCategory
): AutoSelectedPoses {
  // garmentCategory가 있으면 더 정확한 포즈 선택
  if (garmentCategory === 'outer') {
    return selectOuterPoses(count);
  }
  if (garmentCategory === 'dress') {
    return selectDressPoses(count);
  }

  // vtonCategory 기반 선택
  switch (vtonCategory) {
    case 'upper_body':
      return selectTopPoses(count);
    case 'lower_body':
      return selectBottomPoses(count);
    case 'dresses':
      return selectDressPoses(count);
    default:
      return selectDressPoses(count);
  }
}

/**
 * 자동 생성 모드 설정 정보
 */
export interface AutoGenerateConfig {
  count: AutoGenerateCount;
  label: string;
  labelKr: string;
  description: string;
}

export const AUTO_GENERATE_CONFIGS: AutoGenerateConfig[] = [
  {
    count: 5,
    label: 'Quick 5',
    labelKr: '빠른 5컷',
    description: '핵심 포즈 5가지 자동 생성',
  },
  {
    count: 10,
    label: 'Full 10',
    labelKr: '풀 10컷',
    description: '다양한 포즈 10가지 자동 생성',
  },
];
