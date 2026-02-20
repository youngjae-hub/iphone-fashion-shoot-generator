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
  garmentCategory?: 'upper_body' | 'lower_body' | 'dresses'; // 의류 카테고리 (프레이밍 조정용)
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

  // ⭐️ Phase 1-1: 얼굴 크롭 일관성 - 모든 포즈에서 동일한 크롭 기준 적용
  const faceCropStandard = 'CRITICAL FOR ANONYMITY: face must be cropped above lips, showing only chin and lower jaw, eyes and nose must NOT be visible in frame, tight head cropping for privacy';

  const posePrompts: Record<PoseType, string> = {
    front: `medium close-up shot from chest to knees, standing casually facing camera, weight on one leg, ${faceCropStandard}, fashion lookbook style`,
    side: `full body shot from head to feet, side profile angle, looking away naturally, candid walking moment, ${faceCropStandard}, generous framing with environment visible`,
    back: `full body shot from head to feet, back view, slightly looking over shoulder, ${faceCropStandard}, showing outfit back details`,
    styled: `medium shot from neck to knees, sitting on chair or adjusting clothes or hand in pocket, ${faceCropStandard}, relaxed editorial feel with natural movement`,
    sitting: `sitting pose on chair, relaxed casual posture, ${faceCropStandard}, full body visible`,
    fullbody: `full body shot from head to feet, standing naturally, ${faceCropStandard}, generous framing`,
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

// ⭐️ Phase 1-1: 얼굴 크롭 후처리 - 상단 일정 비율 자르기
/**
 * 이미지 상단을 잘라서 얼굴 노출 방지
 * @param base64Image - base64 인코딩된 이미지 (data:image/... 형식)
 * @param cropPercentage - 잘라낼 상단 비율 (기본 15%)
 * @returns 크롭된 base64 이미지
 */
export async function cropTopForPrivacy(imageInput: string, cropPercentage: number = 15): Promise<string> {
  // Node.js 환경에서는 sharp 라이브러리 사용 필요
  // 브라우저 환경에서는 Canvas API 사용

  if (typeof window === 'undefined') {
    // 서버 환경 (Node.js) - sharp 사용
    try {
      const sharp = require('sharp');

      let imageBuffer: Buffer;
      let mimeType = 'image/jpeg';

      // URL인 경우 먼저 다운로드
      if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        console.log(`[cropTopForPrivacy] Downloading image from URL...`);
        const response = await fetch(imageInput);
        if (!response.ok) {
          console.warn(`[cropTopForPrivacy] Failed to download image: ${response.status}`);
          return imageInput;
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        mimeType = response.headers.get('content-type') || 'image/jpeg';
      } else {
        // base64인 경우
        const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        mimeType = imageInput.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
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

      console.log(`[cropTopForPrivacy] Cropping ${cropPercentage}% from top: ${height}px → ${newHeight}px`);

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
      return `data:${mimeType};base64,${croppedBuffer.toString('base64')}`;

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

// ⭐️ 얼굴 감지 기반 크롭 - 입술 아래에서 자르기
/**
 * 얼굴 감지를 통해 일관된 위치에서 크롭
 * 이미지 비율을 분석하고, 전신샷에서 얼굴 위치를 추정하여 입술 아래에서 크롭
 * @param imageInput - base64 또는 URL 이미지
 * @param pose - 포즈 타입 (back이면 최소 크롭)
 * @returns 크롭된 base64 이미지
 */
export async function cropWithFaceDetection(imageInput: string, pose?: string): Promise<string> {
  console.log(`[cropWithFaceDetection] Starting crop for pose: ${pose}, input type: ${imageInput.startsWith('http') ? 'URL' : 'base64'}`);

  if (typeof window !== 'undefined') {
    console.log('[cropWithFaceDetection] Browser environment, using fallback');
    return cropTopForPrivacy(imageInput, 18);
  }

  try {
    const sharp = require('sharp');

    // 이미지 버퍼 준비
    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg';

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      console.log(`[cropWithFaceDetection] Fetching URL: ${imageInput.substring(0, 50)}...`);
      const response = await fetch(imageInput);
      if (!response.ok) {
        console.error(`[cropWithFaceDetection] Fetch failed: ${response.status}`);
        return cropTopForPrivacy(imageInput, 18);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get('content-type') || 'image/jpeg';
      console.log(`[cropWithFaceDetection] Downloaded ${imageBuffer.length} bytes`);
    } else {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      mimeType = imageInput.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
      console.log(`[cropWithFaceDetection] Base64 decoded ${imageBuffer.length} bytes`);
    }

    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    console.log(`[cropWithFaceDetection] Image dimensions: ${width}x${height}`);

    if (!width || !height) {
      console.error('[cropWithFaceDetection] Invalid dimensions');
      return cropTopForPrivacy(imageInput, 18);
    }

    // ⭐️ Google Cloud Vision API로 얼굴 감지
    const googleApiKey = process.env.GOOGLE_CLOUD_API_KEY;
    let cropY: number = Math.floor(height * 0.18); // 기본값: 18% 크롭
    let detectionMethod = 'fallback';

    if (googleApiKey) {
      try {
        console.log('[cropWithFaceDetection] Calling Google Cloud Vision Face Detection...');
        const visionResponse = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: imageBuffer.toString('base64') },
                features: [{ type: 'FACE_DETECTION', maxResults: 1 }]
              }]
            })
          }
        );

        if (visionResponse.ok) {
          const visionData = await visionResponse.json();
          const faces = visionData.responses?.[0]?.faceAnnotations;

          if (faces && faces.length > 0) {
            const face = faces[0];
            // boundingPoly의 하단 y좌표 (턱 위치)
            const vertices = face.boundingPoly?.vertices || [];
            const chinY = Math.max(...vertices.map((v: { y?: number }) => v.y || 0));

            // 턱 아래 충분한 여유를 두고 크롭 (입술 아래 보장)
            const margin = Math.floor(height * 0.05); // 5% 여유
            cropY = Math.min(chinY + margin, Math.floor(height * 0.35)); // 최대 35%까지만
            cropY = Math.max(cropY, Math.floor(height * 0.18)); // 최소 18% 크롭 (얼굴 작아도 충분히 자름)

            detectionMethod = 'vision-api';
            console.log(`[cropWithFaceDetection] Face detected! Chin at y=${chinY}, cropping at y=${cropY} (${((cropY/height)*100).toFixed(1)}%)`);
          } else {
            console.log('[cropWithFaceDetection] No face detected by Vision API');
          }
        } else {
          console.warn(`[cropWithFaceDetection] Vision API error: ${visionResponse.status}`);
        }
      } catch (visionError) {
        console.warn('[cropWithFaceDetection] Vision API call failed:', visionError);
      }
    }

    // Vision API 실패 시 fallback: 18% 고정 크롭
    if (detectionMethod === 'fallback') {
      cropY = Math.floor(height * 0.18);
      console.log(`[cropWithFaceDetection] Using fallback 18% crop: ${cropY}px`);
    }

    const newHeight = height - cropY;
    console.log(`[cropWithFaceDetection] Final crop: ${cropY}px from top (${((cropY/height)*100).toFixed(1)}%), method: ${detectionMethod}`);

    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top: cropY, width, height: newHeight })
      .toBuffer();

    console.log(`[cropWithFaceDetection] Crop successful, output size: ${croppedBuffer.length} bytes`);
    return `data:${mimeType};base64,${croppedBuffer.toString('base64')}`;

  } catch (error) {
    console.error('[cropWithFaceDetection] ERROR:', error);
    console.warn('[cropWithFaceDetection] Returning original image due to error');
    return imageInput;
  }
}
