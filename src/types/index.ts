// ============================================
// Core Types for iPhone Style Fashion Generator
// ============================================

// AI Provider Types - 유연한 Provider 교체 지원
export type ImageGenerationProvider = 'google-imagen' | 'stability-ai' | 'replicate-flux' | 'huggingface' | 'google-gemini';
export type TryOnProvider = 'idm-vton' | 'kolors-virtual-tryon';
export type BackgroundProvider = 'google-imagen' | 'stability-ai' | 'replicate-flux' | 'google-gemini';

// ============================================
// iPhone Style Lookbook Types (v2 재설계)
// CTR 방식 참고: 촬영 타입, 배경 스팟 분리
// ============================================

// 촬영 타입 - CTR의 '모델컷_face', '모델컷_noface' 등에 대응
export type ShotType = 'iphone_crop' | 'iphone_partial_face' | 'iphone_fullbody';

// 배경 스팟 타입 - CTR의 '호리존', '자연광' 등에 대응하되 더 세분화
export type BackgroundSpotType = 'home' | 'cafe' | 'outdoor' | 'street' | 'custom';

// 의류 타입 - CTR의 CLOTHING_TYPE_HINTS 참고
export type ClothingTypeHint = 'top' | 'outer' | 'bottom' | 'dress' | 'set';

// iPhone 스타일 생성 요청
export interface IPhoneStyleRequest {
  garmentImage: string; // base64 제품 누끼
  shotType: ShotType;
  backgroundSpot: BackgroundSpotType;
  backgroundSpotImage?: string; // custom 배경 스팟 이미지 (base64)
  clothingType?: ClothingTypeHint;
  additionalInstructions?: string;
}

// iPhone 스타일 생성 응답
export interface IPhoneStyleResponse {
  success: boolean;
  image?: string; // base64 결과 이미지
  prompt?: string; // 사용된 프롬프트 (디버그용)
  error?: string;
}

// ⭐️ Phase 2-1: 포즈 제어 모드 (롤백 안전 설계)
// 'auto': 기존 Gemini 텍스트 프롬프트 방식 (기본값, 안정적)
// 'controlnet': ControlNet + OpenPose 스켈레톤 방식 (실험적)
export type PoseMode = 'auto' | 'controlnet';

// ⭐️ 생성 모드 (레퍼런스 프로그램 참고)
// 'direct': VTON 없이 AI가 직접 모델+의류 생성 (레퍼런스 방식, 기본값)
// 'vton': 모델 생성 후 Virtual Try-On 적용 (기존 방식)
export type GenerationMode = 'direct' | 'vton';

// ⭐️ Phase 2-4: 자동 생성 모드
// 'manual': 수동 포즈 선택 (기존 방식)
// 5: 자동 5컷 생성
// 10: 자동 10컷 생성
export type AutoGenerateMode = 'manual' | 5 | 10;

// Provider Configuration
export interface ProviderConfig {
  imageGeneration: ImageGenerationProvider;
  tryOn: TryOnProvider;
  background: BackgroundProvider;
  poseMode?: PoseMode; // Phase 2-1: 기본값 'auto' (기존 방식 유지)
  generationMode?: GenerationMode; // 기본값 'direct' (VTON 없이 직접 생성)
}

// Pose Types - 레퍼런스 모델컷 기반 10가지 포즈
export type PoseType = 'front' | 'side' | 'styled' | 'sitting' | 'fullbody' | 'leaning' | 'back' | 'walking' | 'bag' | 'crop';

export interface PoseConfig {
  type: PoseType;
  label: string;
  labelKr: string;
  promptEn: string;
  enabled: boolean;
  description?: string; // UI에 표시할 짧은 설명
}

// 기본 포즈 설정 (레퍼런스 이미지 분석 기반)
export const DEFAULT_POSES: PoseConfig[] = [
  // 기본 5개 (기본 선택됨)
  { type: 'front', label: 'Front', labelKr: '정면', promptEn: 'front view, standing straight, arms relaxed at sides, looking at camera', enabled: true, description: '정면 기본 스탠딩' },
  { type: 'side', label: 'Side', labelKr: '측면', promptEn: '3/4 angle view, slightly turned body, elegant silhouette, looking away', enabled: true, description: '3/4 각도 실루엣' },
  { type: 'styled', label: 'Styled', labelKr: '연출', promptEn: 'hand touching hair or near face, natural dynamic pose, lifestyle editorial feel', enabled: true, description: '머리 터치 자연스러운 무드' },
  { type: 'sitting', label: 'Sitting', labelKr: '앉은', promptEn: 'sitting on sofa or chair, relaxed pose, legs crossed or together, hands on lap', enabled: true, description: '소파/의자 릴렉스' },
  { type: 'fullbody', label: 'Full Body', labelKr: '전신', promptEn: 'full body shot showing feet, standing pose, head to toe visible', enabled: true, description: '머리~발끝 풀샷' },
  // 추가 5개 (선택 가능)
  { type: 'leaning', label: 'Leaning', labelKr: '기대기', promptEn: 'leaning against window sill or wall, one leg bent, relaxed casual stance, natural lighting from window', enabled: true, description: '창가/벽에 기대기' },
  { type: 'back', label: 'Back', labelKr: '뒷모습', promptEn: 'back view, hand touching hair or neck, slight head turn showing profile, looking away', enabled: true, description: '뒤돌아 프로필' },
  { type: 'walking', label: 'Walking', labelKr: '워킹', promptEn: 'walking pose, one foot forward, natural stride, dynamic movement, outdoor street style', enabled: true, description: '걷는 듯한 동적 포즈' },
  { type: 'bag', label: 'Bag', labelKr: '가방', promptEn: 'holding shoulder bag or handbag, standing pose, one hand on bag strap, stylish accessory coordination', enabled: true, description: '가방 메고 스타일링' },
  { type: 'crop', label: 'Crop', labelKr: '크롭', promptEn: 'upper body focus from chest to waist, headless crop shot, hands visible at sides or touching clothes, detail focus', enabled: true, description: '상반신 디테일 컷' },
];

// ============================================
// 상의(이너) 전용 5가지 표준 포즈 - 레퍼런스 기반
// ============================================

export type TopPoseType = 'top_front' | 'top_hair_touch' | 'top_side_glance' | 'top_leaning' | 'top_detail' | 'top_sitting';

// ⭐️ Phase 2-4: 하의(바지/스커트) 전용 포즈 타입
export type BottomPoseType = 'bottom_front' | 'bottom_side' | 'bottom_walking' | 'bottom_sitting' | 'bottom_back' | 'bottom_leaning';

// ⭐️ 아우터(코트/자켓) 전용 포즈 타입
export type OuterPoseType = 'outer_front_open' | 'outer_front_closed' | 'outer_side' | 'outer_back' | 'outer_walking' | 'outer_detail';

// ⭐️ 드레스/원피스 전용 포즈 타입
export type DressPoseType = 'dress_front' | 'dress_side' | 'dress_back' | 'dress_twirl' | 'dress_sitting' | 'dress_detail' | 'dress_leaning';

export interface TopPoseConfig {
  type: TopPoseType;
  label: string;
  labelKr: string;
  promptEn: string;
  framing: string; // 프레이밍 설명
  handPosition: string; // 손 위치 가이드
}

/**
 * 상의(이너) 전용 5가지 표준 포즈
 * 레퍼런스: Dropbox 폴더2 (검은색 V넥 긴팔) 이미지 분석 기반
 *
 * 핵심 원칙:
 * - 상의가 주인공 → 상반신~무릎 미디엄 샷 위주
 * - 자연스러운 손 제스처로 소매/넥라인 강조
 * - 창가 자연광 활용한 캐주얼 무드
 */
export const TOP_POSES: TopPoseConfig[] = [
  {
    type: 'top_front',
    label: 'Front Relaxed',
    labelKr: '정면 릴렉스',
    promptEn: 'front view, standing relaxed, arms naturally at sides, slight weight shift to one leg, calm expression looking at camera',
    framing: 'medium shot from chest to knees, focus on top garment',
    handPosition: 'both arms relaxed at sides, fingers loosely open',
  },
  {
    type: 'top_hair_touch',
    label: 'Hair Touch',
    labelKr: '헤어 터치',
    promptEn: 'one hand gently touching hair near ear or neck, other arm relaxed, slight head tilt, soft natural expression, candid lifestyle feel',
    framing: 'medium shot from chest to thighs, sleeve detail visible',
    handPosition: 'one hand raised to hair/neck level, bent elbow showing sleeve',
  },
  {
    type: 'top_side_glance',
    label: 'Side Glance',
    labelKr: '사이드 시선',
    promptEn: '3/4 angle body position, face turned to side looking away from camera, one hand near chin or jaw, thoughtful elegant pose',
    framing: 'medium shot showing torso silhouette, neckline emphasized',
    handPosition: 'one hand delicately near chin/jaw, other at side or on hip',
  },
  {
    type: 'top_leaning',
    label: 'Leaning Casual',
    labelKr: '기대기 캐주얼',
    promptEn: 'leaning slightly against window sill or wall, one leg slightly bent, relaxed casual stance, comfortable lifestyle moment',
    framing: 'medium shot from chest to knees, natural posture',
    handPosition: 'one hand resting on surface, other arm relaxed or touching hair',
  },
  {
    type: 'top_detail',
    label: 'Detail Neckline',
    labelKr: '디테일 넥라인',
    promptEn: 'close-up shot focused on neckline and upper chest area, subtle collar detail, fabric texture visible, minimal pose',
    framing: 'tight crop from neck to mid-chest, neckline as focal point',
    handPosition: 'arms not visible or just shoulders, focus on garment details',
  },
  {
    type: 'top_sitting',
    label: 'Sitting',
    labelKr: '앉은 포즈',
    promptEn: 'seated on stool or chair, relaxed posture with straight back, hands on lap or one on thigh, natural comfortable seated position',
    framing: 'medium shot from chest to upper thighs, seated pose visible',
    handPosition: 'hands resting on lap or one hand on thigh, relaxed position',
  },
];

/**
 * TopPoseType을 프롬프트로 변환
 */
export function getTopPosePrompt(poseType: TopPoseType): string {
  const pose = TOP_POSES.find(p => p.type === poseType);
  if (!pose) {
    return TOP_POSES[0].promptEn; // 기본값: front
  }
  return pose.promptEn;
}

/**
 * TopPoseType에 해당하는 프레이밍 가이드
 */
export function getTopPoseFraming(poseType: TopPoseType): string {
  const pose = TOP_POSES.find(p => p.type === poseType);
  if (!pose) {
    return TOP_POSES[0].framing;
  }
  return pose.framing;
}

// IDM-VTON Garment Categories
export type VTONCategory = 'upper_body' | 'lower_body' | 'dresses';

// Generation Settings
export interface GenerationSettings {
  modelStyle: 'iphone-natural' | 'studio' | 'casual';
  backgroundStyle: string;
  poses: PoseType[];
  shotsPerPose: number;
  totalShots: number;
  seed?: number;
  negativePrompt?: string;
  garmentCategory?: VTONCategory; // Virtual Try-On 의류 카테고리
}

// Garment Category Types
export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outer' | 'accessory' | 'unknown';

// Image Types
export interface UploadedImage {
  id: string;
  file?: File; // Optional - URL로 가져온 이미지는 File 객체가 없음
  preview: string;
  type: 'garment' | 'background' | 'reference' | 'style-reference' | 'background-spot';
  processedUrl?: string;
  category?: GarmentCategory; // AI가 판별한 의류 카테고리
  categoryConfidence?: number; // 분류 신뢰도 (0-1)
}

// Background Spot Types - 촬영 장소/배경 스팟
export interface BackgroundSpot {
  id: string;
  name: string;
  description?: string;
  images: string[]; // base64 이미지들
  createdAt: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  pose: PoseType | TopPoseType | BottomPoseType | OuterPoseType | DressPoseType;  // 모든 복종 포즈 지원
  timestamp: number;
  settings: GenerationSettings;
  provider: string;
}

// Generation Request/Response
export interface GenerationRequest {
  garmentImage: string; // base64 or URL
  poses: PoseType[];
  settings: GenerationSettings;
  providers: ProviderConfig;
}

export interface GenerationResponse {
  success: boolean;
  images: GeneratedImage[];
  error?: string;
}

// Try-On Request/Response
export interface TryOnRequest {
  garmentImage: string;
  modelImage?: string;
  pose: PoseType;
  provider: TryOnProvider;
}

export interface TryOnResponse {
  success: boolean;
  resultImage: string;
  error?: string;
}


// App State
export interface AppState {
  uploadedGarments: UploadedImage[];
  generatedImages: GeneratedImage[];
  settings: GenerationSettings;
  providers: ProviderConfig;
  isGenerating: boolean;
  error: string | null;
}

// Default configurations
export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  imageGeneration: 'google-gemini',
  tryOn: 'idm-vton',
  background: 'google-gemini',
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  modelStyle: 'iphone-natural',
  backgroundStyle: 'minimal-studio',
  poses: ['front', 'side', 'styled', 'sitting', 'fullbody'], // 기본 5개 포즈 (back 제외 - Gemini 한계)
  shotsPerPose: 1,
  totalShots: 5,
};

// POSE_CONFIGS는 DEFAULT_POSES를 사용 (위에서 정의됨)

// ============================================
// History & Project Types
// ============================================

export interface GenerationSession {
  id: string;
  name?: string; // 사용자가 지정한 세션 이름
  createdAt: number;
  updatedAt: number;
  garmentImages: string[]; // 원본 의류 이미지 URLs
  generatedImages: GeneratedImage[];
  settings: GenerationSettings;
  providers: ProviderConfig;
  totalCost?: number; // 예상 비용
}

export interface HistoryItem {
  id: string;
  sessionId: string;
  type: 'generation';
  timestamp: number;
  thumbnail?: string; // 첫 번째 생성 이미지
  garmentCount: number;
  imageCount: number;
  status: 'completed' | 'failed' | 'in-progress';
}

export interface ProjectSettings {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  settings: GenerationSettings;
  providers: ProviderConfig;
}

// ⭐️ Phase 1-2: GarmentCategory → VTONCategory 매핑 함수
/**
 * classify-garment API 결과를 IDM-VTON category로 변환
 * @param category - classify-garment API가 반환한 카테고리
 * @returns IDM-VTON에서 사용하는 카테고리
 */
export function mapGarmentCategoryToVTON(category: GarmentCategory): VTONCategory {
  const mapping: Record<GarmentCategory, VTONCategory> = {
    top: 'upper_body',
    outer: 'upper_body',
    bottom: 'lower_body',
    dress: 'dresses',
    accessory: 'upper_body', // 액세서리는 상의로 기본 처리
    unknown: 'dresses', // 알 수 없는 경우 원피스로 기본 처리 (가장 안전)
  };

  return mapping[category];
}
