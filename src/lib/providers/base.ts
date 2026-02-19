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

// 아이폰 스타일 프롬프트 생성 유틸리티 (VTON 호환 - 전체 얼굴 필요)
export function generateIPhoneStylePrompt(pose: PoseType, additionalPrompt?: string): string {
  // ⚠️ VTON이 신체를 감지하려면 전체 얼굴이 보여야 함 (얼굴 크롭은 VTON 후 후처리로)
  const basePrompt = `
    iPhone photography style, natural lighting,
    young Korean female model, full body shot with visible face,
    high-quality fashion lookbook, sharp details,
    natural skin texture, subtle color grading,
    professional fashion photography
  `.trim().replace(/\s+/g, ' ');

  const posePrompts: Record<PoseType, string> = {
    front: 'front view, standing pose, looking at camera direction',
    side: 'side profile, 90 degree angle, elegant silhouette',
    back: 'back view, showing garment back details',
    styled: 'dynamic editorial pose, natural movement, lifestyle feel',
    detail: 'close-up detail shot, fabric texture, craftsmanship focus',
  };

  return `${basePrompt}, ${posePrompts[pose]}${additionalPrompt ? `, ${additionalPrompt}` : ''}`;
}

// 네거티브 프롬프트 기본값 (VTON 호환 - 얼굴 제한 제거)
export const DEFAULT_NEGATIVE_PROMPT = `
  low quality, blurry, distorted, deformed, ugly,
  bad anatomy, bad proportions, extra limbs,
  watermark, signature, text, logo,
  oversaturated, artificial lighting
`.trim().replace(/\s+/g, ' ');

// ⭐️ 얼굴 인식 기반 스마트 크롭 (Google Vision API 사용)
/**
 * 얼굴을 인식하여 입술 위치에서 크롭
 * @param imageInput - base64 이미지
 * @returns 크롭된 base64 이미지
 */
export async function smartFaceCrop(imageInput: string): Promise<string> {
  if (typeof window !== 'undefined') {
    // 브라우저 환경에서는 fallback으로 고정 비율 크롭
    return cropTopForPrivacy(imageInput, 20);
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.warn('Google Cloud API key not found, falling back to fixed crop');
    return cropTopForPrivacy(imageInput, 20);
  }

  try {
    const sharp = require('sharp');

    // base64 데이터 추출
    const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 이미지 메타데이터
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      return cropTopForPrivacy(imageInput, 20);
    }

    // Google Vision API로 얼굴 감지
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Data },
            features: [{ type: 'FACE_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );

    if (!visionResponse.ok) {
      console.warn('Vision API failed, falling back to fixed crop');
      return cropTopForPrivacy(imageInput, 20);
    }

    const visionData = await visionResponse.json();
    const faces = visionData.responses?.[0]?.faceAnnotations;

    if (!faces || faces.length === 0) {
      console.log('No face detected, using fixed crop');
      return cropTopForPrivacy(imageInput, 20);
    }

    // 첫 번째 얼굴의 랜드마크에서 입술 하단 위치 찾기
    const face = faces[0];
    const landmarks = face.landmarks || [];

    // LOWER_LIP 또는 MOUTH_BOTTOM 랜드마크 찾기
    let lipY = 0;
    for (const landmark of landmarks) {
      if (landmark.type === 'LOWER_LIP' || landmark.type === 'MOUTH_BOTTOM') {
        lipY = Math.max(lipY, landmark.position.y);
      }
    }

    // 랜드마크가 없으면 boundingPoly 사용
    if (lipY === 0 && face.boundingPoly?.vertices) {
      const vertices = face.boundingPoly.vertices;
      const faceBottom = Math.max(...vertices.map((v: {y?: number}) => v.y || 0));
      const faceTop = Math.min(...vertices.map((v: {y?: number}) => v.y || height));
      // 얼굴 영역의 70% 지점 (대략 입술 위치)
      lipY = faceTop + (faceBottom - faceTop) * 0.7;
    }

    if (lipY === 0) {
      return cropTopForPrivacy(imageInput, 20);
    }

    // 입술 위치에서 약간 위로 크롭 (입술 일부만 보이게)
    const cropY = Math.floor(lipY - 10); // 입술 위 10px 정도
    const newHeight = height - cropY;

    if (newHeight < height * 0.5) {
      // 너무 많이 잘리면 fallback
      console.log('Crop too aggressive, using fixed crop');
      return cropTopForPrivacy(imageInput, 25);
    }

    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: cropY,
        width: width,
        height: newHeight,
      })
      .toBuffer();

    console.log(`✅ Smart face crop: cropped at y=${cropY} (lip position)`);
    return `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;

  } catch (error) {
    console.error('Smart face crop failed:', error);
    return cropTopForPrivacy(imageInput, 20);
  }
}

// ⭐️ Phase 1-1: 얼굴 크롭 후처리 - 상단 일정 비율 자르기 (fallback용)
/**
 * 이미지 상단을 잘라서 얼굴 노출 방지
 * @param imageInput - base64 이미지 또는 URL
 * @param cropPercentage - 잘라낼 상단 비율 (기본 20%)
 * @returns 크롭된 base64 이미지
 */
export async function cropTopForPrivacy(imageInput: string, cropPercentage: number = 20): Promise<string> {
  // Node.js 환경에서는 sharp 라이브러리 사용 필요
  // 브라우저 환경에서는 Canvas API 사용

  if (typeof window === 'undefined') {
    // 서버 환경 (Node.js) - sharp 사용
    try {
      const sharp = require('sharp');

      let imageBuffer: Buffer;

      // URL인 경우 fetch로 이미지 다운로드
      if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        console.log(`Fetching image from URL for cropping...`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

          const response = await fetch(imageInput, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } catch (fetchError) {
          console.error('Failed to fetch image for cropping:', fetchError);
          return imageInput; // fetch 실패 시 원본 URL 반환
        }
      } else {
        // base64인 경우
        const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      }

      // 이미지 메타데이터 가져오기
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      if (!width || !height) {
        console.warn('Could not get image dimensions for cropping');
        return imageInput; // 크롭 실패 시 원본 반환
      }

      // 상단 크롭 계산
      const cropHeight = Math.floor(height * (cropPercentage / 100));
      const newHeight = height - cropHeight;

      // 크롭 실행
      const croppedBuffer = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: cropHeight,
          width: width,
          height: newHeight,
        })
        .toBuffer();

      // base64로 다시 인코딩
      console.log(`✅ Image cropped successfully (${cropPercentage}% from top)`);
      return `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;

    } catch (error) {
      console.error('Image cropping failed:', error);
      return imageInput; // 에러 시 원본 반환
    }
  } else {
    // 클라이언트 환경 (브라우저) - Canvas API 사용
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cropHeight = Math.floor(img.height * (cropPercentage / 100));
        const newHeight = img.height - cropHeight;

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageInput);
          return;
        }

        // 이미지의 하단 부분만 그리기
        ctx.drawImage(
          img,
          0, cropHeight, // 소스 x, y
          img.width, newHeight, // 소스 width, height
          0, 0, // 대상 x, y
          img.width, newHeight // 대상 width, height
        );

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(imageInput);
      img.src = imageInput;
    });
  }
}
