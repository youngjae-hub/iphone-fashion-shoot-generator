// ============================================
// Base Provider Interface - 유연한 Provider 교체를 위한 추상화
// ============================================

import { PoseType, GeneratedImage, GenerationSettings, VTONCategory } from '@/types';

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
  category?: VTONCategory; // 의류 카테고리: upper_body, lower_body, dresses
  seed?: number; // 각 컷마다 다른 결과를 위한 시드값
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
    front: 'medium close-up shot from chest to knees, standing casually facing camera, weight on one leg, face naturally cut off at forehead by tight framing, chin and lips visible but eyes out of frame, fashion lookbook cropping style',
    side: 'full body shot from head to feet, side profile angle, looking away naturally, candid walking moment, generous framing with environment visible, entire body in frame',
    back: 'full body shot from head to feet, back view, slightly looking over shoulder, showing outfit back details, shot from distance with full body visible',
    styled: 'medium shot from neck to knees, sitting on chair or adjusting clothes or hand in pocket, face naturally cropped at nose level by tight framing, lower face and chin visible, relaxed editorial feel with natural movement',
    detail: '3/4 body shot with comfortable framing, focusing on outfit details, fabric texture, accessories, upper body cropped at chin level',
  };

  return `${basePrompt}, ${posePrompts[pose]}${additionalPrompt ? `, ${additionalPrompt}` : ''}`;
}

// 네거티브 프롬프트 기본값
export const DEFAULT_NEGATIVE_PROMPT = `
  low quality, blurry, distorted, deformed, ugly,
  bad anatomy, bad proportions, extra limbs,
  watermark, signature, text, logo,
  oversaturated, artificial lighting
`.trim().replace(/\s+/g, ' ');
