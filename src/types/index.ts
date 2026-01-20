// ============================================
// Core Types for iPhone Style Fashion Generator
// ============================================

// AI Provider Types - 유연한 Provider 교체 지원
export type ImageGenerationProvider = 'google-imagen' | 'openai-dalle' | 'stability-ai' | 'replicate-flux' | 'huggingface' | 'google-gemini';
export type TryOnProvider = 'idm-vton' | 'kolors-virtual-tryon' | 'fashn-ai';
export type BackgroundProvider = 'google-imagen' | 'stability-ai' | 'replicate-flux' | 'google-gemini';

// Provider Configuration
export interface ProviderConfig {
  imageGeneration: ImageGenerationProvider;
  tryOn: TryOnProvider;
  background: BackgroundProvider;
}

// Pose Types
export type PoseType = 'front' | 'side' | 'back' | 'styled' | 'detail';

export interface PoseConfig {
  type: PoseType;
  label: string;
  promptKr: string;
  promptEn: string;
  enabled: boolean;
}

// Generation Settings
export interface GenerationSettings {
  modelStyle: 'iphone-natural' | 'studio' | 'casual';
  backgroundStyle: string;
  poses: PoseType[];
  shotsPerPose: number;
  totalShots: number;
  seed?: number;
  negativePrompt?: string;
}

// Garment Category Types
export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outer' | 'accessory' | 'unknown';

// Image Types
export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  type: 'garment' | 'background' | 'reference' | 'style-reference';
  processedUrl?: string;
  category?: GarmentCategory; // AI가 판별한 의류 카테고리
  categoryConfidence?: number; // 분류 신뢰도 (0-1)
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

// Background Generation
export interface BackgroundRequest {
  style: string;
  prompt?: string;
  referenceImages?: string[];
  provider: BackgroundProvider;
}

export interface BackgroundResponse {
  success: boolean;
  backgroundImage: string;
  error?: string;
}

// Model Generation (for consistent model appearance)
export interface ModelGenerationRequest {
  style: 'young-korean-female';
  faceVisible: boolean; // false = 입술 위에서 크롭
  pose: PoseType;
  seed?: number;
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
  poses: ['front', 'side', 'back', 'styled', 'detail'],
  shotsPerPose: 1,
  totalShots: 5,
};

export const POSE_CONFIGS: PoseConfig[] = [
  { type: 'front', label: '정면', promptKr: '정면 포즈', promptEn: 'standing casually facing camera, weight on one leg, relaxed natural stance', enabled: true },
  { type: 'side', label: '측면', promptKr: '옆 모습', promptEn: 'side profile angle, looking away naturally, candid walking moment', enabled: true },
  { type: 'back', label: '뒷면', promptKr: '뒤 모습', promptEn: 'back view, slightly looking over shoulder, showing outfit back details', enabled: true },
  { type: 'styled', label: '연출', promptKr: '자연스러운 연출', promptEn: 'lifestyle pose - sitting on chair, adjusting clothes, twirling skirt, hand in pocket, touching hair', enabled: true },
  { type: 'detail', label: '디테일', promptKr: '디테일 클로즈업', promptEn: 'close-up 3/4 shot focusing on outfit details, fabric texture, accessories', enabled: true },
];

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
