// ============================================
// Base Provider Interface - 유연한 Provider 교체를 위한 추상화
// ============================================

import { PoseType, GeneratedImage, GenerationSettings } from '@/types';

// 이미지 생성 Provider 인터페이스
export interface IImageGenerationProvider {
  name: string;
  generateModelImage(options: ModelGenerationOptions): Promise<string>;
  generateBackground(options: BackgroundOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// Virtual Try-On Provider 인터페이스
export interface ITryOnProvider {
  name: string;
  tryOn(options: TryOnOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// 옵션 타입들
export interface ModelGenerationOptions {
  pose: PoseType;
  style: string;
  seed?: number;
  negativePrompt?: string;
  garmentImage?: string; // base64 이미지 - 이 옷을 입힌 모델 생성
  styleReferenceImages?: string[]; // base64 이미지 배열 - 이 스타일들을 참조 (최대 10장)
  backgroundSpotImages?: string[]; // base64 이미지 배열 - 이 배경/장소를 참조하여 생성
  customPrompt?: string; // 사용자 정의 프롬프트 (프롬프트 에디터에서 설정)
}

export interface BackgroundOptions {
  style: string;
  prompt?: string;
  referenceImage?: string;
}

export interface TryOnOptions {
  garmentImage: string; // base64
  modelImage?: string; // base64, optional - 없으면 모델도 생성
  pose: PoseType;
  category?: 'upper' | 'lower' | 'full';
}

// Provider Registry - 런타임에 Provider 교체 가능
export class ProviderRegistry {
  private static imageGenerationProviders: Map<string, IImageGenerationProvider> = new Map();
  private static tryOnProviders: Map<string, ITryOnProvider> = new Map();

  static registerImageGeneration(name: string, provider: IImageGenerationProvider) {
    this.imageGenerationProviders.set(name, provider);
  }

  static registerTryOn(name: string, provider: ITryOnProvider) {
    this.tryOnProviders.set(name, provider);
  }

  static getImageGeneration(name: string): IImageGenerationProvider | undefined {
    return this.imageGenerationProviders.get(name);
  }

  static getTryOn(name: string): ITryOnProvider | undefined {
    return this.tryOnProviders.get(name);
  }

  static listImageGenerationProviders(): string[] {
    return Array.from(this.imageGenerationProviders.keys());
  }

  static listTryOnProviders(): string[] {
    return Array.from(this.tryOnProviders.keys());
  }
}

// 아이폰 스타일 프롬프트 생성 유틸리티
export function generateIPhoneStylePrompt(pose: PoseType, additionalPrompt?: string): string {
  const basePrompt = `
    iPhone photography style, natural lighting,
    young Korean female model,
    high-quality fashion lookbook, sharp details,
    natural skin texture, subtle color grading,
    professional fashion photography
  `.trim().replace(/\s+/g, ' ');

  const posePrompts: Record<PoseType, string> = {
    front: 'wide full body shot from head to feet, standing casually facing camera, weight on one leg, relaxed natural stance, generous framing with space around model, full head and body visible in frame',
    side: 'wide full body shot from head to feet, side profile angle, looking away naturally, candid walking moment, generous framing with environment visible, entire body in frame',
    back: 'wide full body shot from head to feet, back view, slightly looking over shoulder, showing outfit back details, shot from distance with full body visible',
    styled: 'wide shot lifestyle pose from head to feet, sitting on chair or adjusting clothes or hand in pocket or touching hair, full body with surroundings visible, natural relaxed editorial feel',
    detail: '3/4 body shot with comfortable framing, focusing on outfit details, fabric texture, accessories, upper body and face visible',
  };

  return `${basePrompt}, ${posePrompts[pose]}${additionalPrompt ? `, ${additionalPrompt}` : ''}`;
}

// 네거티브 프롬프트 기본값
export const DEFAULT_NEGATIVE_PROMPT = `
  low quality, blurry, distorted, deformed, ugly,
  bad anatomy, bad proportions, extra limbs,
  watermark, signature, text, logo,
  cropped head, cut off head, head out of frame, feet cut off,
  oversaturated, artificial lighting
`.trim().replace(/\s+/g, ' ');
