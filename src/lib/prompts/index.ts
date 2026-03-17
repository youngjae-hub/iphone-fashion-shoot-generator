// ============================================
// iPhone Style Lookbook - Prompts Module
// ============================================

// Prime Directives
export {
  PRIME_DIRECTIVES,
  IPHONE_LOOK_DIRECTIVE,
  NEGATIVE_DIRECTIVES,
} from './prime-directives';

// Shot Templates
export {
  type ShotType,
  SHOT_TEMPLATES,
  type ShotTypeConfig,
  SHOT_TYPE_CONFIGS,
  // 상의(이너) 전용 포즈
  type TopPoseType,
  TOP_POSE_TEMPLATES,
  type TopPoseConfig,
  TOP_POSE_CONFIGS,
  // 하의(바지/스커트) 전용 포즈
  type BottomPoseType,
  BOTTOM_POSE_TEMPLATES,
  type BottomPoseConfig,
  BOTTOM_POSE_CONFIGS,
  // 아우터(코트/자켓) 전용 포즈
  type OuterPoseType,
  OUTER_POSE_TEMPLATES,
  type OuterPoseConfig,
  OUTER_POSE_CONFIGS,
  // 드레스/원피스 전용 포즈
  type DressPoseType,
  DRESS_POSE_TEMPLATES,
  type DressPoseConfig,
  DRESS_POSE_CONFIGS,
} from './templates';

// Hints
export {
  type BackgroundSpotType,
  BACKGROUND_SPOT_HINTS,
  type BackgroundSpotPreset,
  BACKGROUND_SPOT_PRESETS,
  type ClothingType,
  CLOTHING_TYPE_HINTS,
} from './hints';

// Builder
export {
  type PromptBuilderConfig,
  type BuiltPrompt,
  buildPrompt,
  buildSimplePrompt,
  debugPrompt,
} from './builder';

// Auto Pose Selector (Phase 2-4)
export {
  type AutoGenerateCount,
  type AutoSelectedPoses,
  type AutoGenerateConfig,
  selectAutoPoses,
  AUTO_GENERATE_CONFIGS,
} from './auto-pose-selector';
