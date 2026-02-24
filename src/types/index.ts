// ============================================
// Core Types for iPhone Style Fashion Generator
// ============================================

// AI Provider Types - 유연한 Provider 교체 지원
export type ImageGenerationProvider = 'google-imagen' | 'stability-ai' | 'replicate-flux' | 'huggingface' | 'google-gemini';
export type TryOnProvider = 'idm-vton' | 'kolors-virtual-tryon';
export type BackgroundProvider = 'google-imagen' | 'stability-ai' | 'replicate-flux' | 'google-gemini';

// ⭐️ Phase 2-1: 포즈 제어 모드 (롤백 안전 설계)
// 'auto': 기존 Gemini 텍스트 프롬프트 방식 (기본값, 안정적)
// 'controlnet': ControlNet + OpenPose 스켈레톤 방식 (실험적)
export type PoseMode = 'auto' | 'controlnet';

// Provider Configuration
export interface ProviderConfig {
  imageGeneration: ImageGenerationProvider;
  tryOn: TryOnProvider;
  background: BackgroundProvider;
  poseMode?: PoseMode; // Phase 2-1: 기본값 'auto' (기존 방식 유지)
}

// Pose Types - 레퍼런스 모델컷 기반 6가지 포즈
export type PoseType = 'front' | 'back' | 'side' | 'sitting' | 'styled' | 'fullbody';

export interface PoseConfig {
  type: PoseType;
  label: string;
  labelKr: string;
  promptEn: string;
  enabled: boolean;
}

// 기본 포즈 설정 (뒷면은 VTON에서 디테일 손실이 심해 비활성화)
export const DEFAULT_POSES: PoseConfig[] = [
  { type: 'front', label: 'Front', labelKr: '정면', promptEn: 'front view, standing straight, arms relaxed at sides', enabled: true },
  { type: 'styled', label: 'Styled', labelKr: '연출', promptEn: 'hand touching hair or near face, natural dynamic pose, lifestyle editorial feel', enabled: true },
  { type: 'side', label: 'Side', labelKr: '측면', promptEn: '3/4 angle view, slightly turned body, elegant silhouette', enabled: true },
  { type: 'sitting', label: 'Sitting', labelKr: '앉은', promptEn: 'sitting on sofa or chair, relaxed pose, legs crossed or together', enabled: true },
  { type: 'fullbody', label: 'Full Body', labelKr: '전신', promptEn: 'full body shot showing feet, standing pose, head to toe visible', enabled: true },
  // 뒷면은 VTON에서 의류 디테일이 심하게 왜곡되어 제외
  // { type: 'back', label: 'Back', labelKr: '뒷면', promptEn: 'back view, showing back of garment, slight head turn', enabled: false },
];

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
  pose: PoseType;
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
// LoRA Training Types
// ============================================

export type LoRAStatus = 'idle' | 'uploading' | 'training' | 'completed' | 'failed';

export interface LoRAModel {
  id: string;
  name: string;
  description?: string;
  status: LoRAStatus;
  replicateModelId?: string; // Replicate에서 생성된 모델 ID (training ID)
  replicateVersionId?: string; // 학습 완료 후 버전 ID
  replicateDestination?: string; // Replicate 모델 경로 (username/model-slug)
  modelSlug?: string; // 모델 슬러그 (URL-safe 이름)
  trainingImages: string[]; // 학습에 사용된 이미지 URL들 (ZIP URL)
  trainingImageCount?: number; // 실제 학습에 사용된 이미지 개수
  triggerWord: string; // LoRA 트리거 단어 (예: "ABLYSTYLE")
  createdAt: number;
  completedAt?: number;
  error?: string;
  estimatedCost?: number; // USD
}

export interface LoRATrainingRequest {
  name: string;
  description?: string;
  images: string[]; // base64 이미지들
  triggerWord?: string;
  trainingSteps?: number; // 기본 1000-1500
}

export interface LoRATrainingResponse {
  success: boolean;
  model?: LoRAModel;
  trainingId?: string; // Replicate training ID
  error?: string;
}

export interface LoRAGenerationRequest {
  loraModelId: string;
  prompt: string;
  garmentImage?: string;
  pose: PoseType;
  seed?: number;
}

// LoRA 관련 Provider Config 확장
export interface ExtendedProviderConfig extends ProviderConfig {
  activeLoRA?: string; // 현재 사용 중인 LoRA 모델 ID
}

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
  loraModelId?: string; // 사용된 LoRA 모델 ID
  totalCost?: number; // 예상 비용
}

export interface HistoryItem {
  id: string;
  sessionId: string;
  type: 'generation' | 'lora-training';
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
  loraModelId?: string;
}

// ============================================
// Prompt Customization Types
// ============================================

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'model' | 'background' | 'style' | 'custom';
  basePrompt: string;
  negativePrompt?: string;
  isDefault?: boolean;
}

export interface CustomPromptSettings {
  useCustomPrompt: boolean;
  basePrompt: string;
  styleModifiers: string[]; // 추가 스타일 수식어
  negativePrompt: string;
  templateId?: string; // 선택된 템플릿 ID
}

// 기본 프롬프트 템플릿들
export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'iphone-natural',
    name: '아이폰 자연광',
    description: '자연스러운 아이폰 촬영 느낌',
    category: 'style',
    basePrompt: 'iPhone photo, natural lighting, soft shadows, authentic candid moment, slight grain, neutral natural tones',
    negativePrompt: 'studio lighting, flash, artificial, overly edited, HDR, oversaturated',
    isDefault: true,
  },
  {
    id: 'studio-clean',
    name: '스튜디오 클린',
    description: '깔끔한 스튜디오 촬영',
    category: 'style',
    basePrompt: 'professional studio photography, soft box lighting, clean white background, high-end fashion editorial',
    negativePrompt: 'outdoor, natural lighting, grainy, amateur',
  },
  {
    id: 'lifestyle-casual',
    name: '라이프스타일 캐주얼',
    description: '일상적인 캐주얼 느낌',
    category: 'style',
    basePrompt: 'lifestyle photography, casual setting, urban backdrop, relaxed atmosphere, street style',
    negativePrompt: 'formal, studio, stiff pose',
  },
  {
    id: 'korean-model',
    name: '한국 모델',
    description: '젊은 한국인 여성 모델',
    category: 'model',
    basePrompt: 'young Korean woman, slim figure, modern hairstyle, natural makeup, cropped above lips showing only body',
    negativePrompt: 'full face visible, western features, heavy makeup, aged',
  },
  {
    id: 'minimal-bg',
    name: '미니멀 배경',
    description: '심플한 단색 배경',
    category: 'background',
    basePrompt: 'minimal background, soft gradient, clean aesthetic, no distracting elements',
    negativePrompt: 'busy background, cluttered, detailed scenery',
  },
  {
    id: 'outdoor-natural',
    name: '야외 자연',
    description: '자연스러운 야외 배경',
    category: 'background',
    basePrompt: 'outdoor setting, natural environment, soft bokeh background, golden hour lighting',
    negativePrompt: 'indoor, studio, artificial lighting',
  },
];

// 스타일 수식어 옵션들
export const STYLE_MODIFIERS = [
  { id: 'warm-tone', label: '따뜻한 톤', prompt: 'warm color grading' },
  { id: 'cool-tone', label: '차가운 톤', prompt: 'cool blue undertones' },
  { id: 'high-contrast', label: '하이 콘트라스트', prompt: 'high contrast, dramatic shadows' },
  { id: 'soft-light', label: '소프트 라이트', prompt: 'soft diffused lighting' },
  { id: 'golden-hour', label: '골든아워', prompt: 'golden hour warm sunlight' },
  { id: 'film-grain', label: '필름 그레인', prompt: 'subtle film grain texture' },
  { id: 'vintage', label: '빈티지', prompt: 'vintage aesthetic, muted colors' },
  { id: 'modern-clean', label: '모던 클린', prompt: 'modern clean aesthetic, sharp details' },
];

export const DEFAULT_CUSTOM_PROMPT_SETTINGS: CustomPromptSettings = {
  useCustomPrompt: false,
  basePrompt: '',
  styleModifiers: [],
  negativePrompt: 'blurry, low quality, distorted, ugly, deformed, bad anatomy, watermark, signature, twisted feet, broken ankles, contorted limbs, unnatural pose, extra fingers, missing limbs',
  templateId: 'iphone-natural',
};

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
