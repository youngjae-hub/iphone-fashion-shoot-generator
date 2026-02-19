// ============================================
// Google Gemini / Nano Banana Pro Image Generation Provider
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
} from './base';

// ⭐️ Phase 1-3: 간결한 에이블리/지그재그 스타일 프롬프트
function generateAblelyStylePrompt(pose: string, garmentDescription?: string): string {
  const stylePrompt = `
    Korean fashion lookbook photography,
    iPhone quality with natural daylight,
    clean minimal background,
    young Korean woman model in early 20s,
    natural relaxed posture,
    authentic real-photo aesthetic,
    sharp details and true-to-life colors
  `.trim().replace(/\s+/g, ' ');

  const posePrompts: Record<string, string> = {
    front: 'full body standing naturally, weight on one leg',
    side: 'full body side view, candid walking moment',
    back: 'full body back view, looking over shoulder',
    styled: 'dynamic lifestyle pose with natural movement',
    detail: 'upper body focusing on outfit details and fabric',
  };

  const poseStr = posePrompts[pose] || posePrompts.front;
  const garmentStr = garmentDescription ? `wearing ${garmentDescription}` : '';

  return `${stylePrompt}, ${poseStr}${garmentStr ? `, ${garmentStr}` : ''}`;
}

// Google Nano Banana Pro 모델 사용 (더 고품질 이미지 생성)
export class GoogleGeminiImageProvider implements IImageGenerationProvider {
  name = 'google-gemini';
  private apiKey: string;
  // ⚠️ 모델 변경 시 반드시 커밋할 것! (unstaged 변경으로 인한 혼란 방지)
  private model = 'nano-banana-pro-preview';

  // 디버깅용: 실제 사용 중인 모델명 반환
  getModelName(): string {
    return this.model;
  }

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
    // 🔍 시작 시 실제 모델 로깅 (디버깅용)
    console.log(`[GoogleGeminiImageProvider] Initialized with model: ${this.model}`);
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    // ⭐️ Phase 1-3: 포즈별 프롬프트 간결화 및 명확화
    const poseDescriptions: Record<string, string> = {
      front: 'Full body shot, standing naturally, weight on one leg, relaxed posture',
      side: 'Full body side profile, mid-stride walking pose, candid moment',
      back: 'Full body back view, slightly looking over shoulder',
      styled: 'Dynamic lifestyle pose - sitting, adjusting clothes, or natural movement',
      detail: 'Upper body focused shot showing fabric details and accessories',
    };

    const posePrompt = poseDescriptions[options.pose] || poseDescriptions.front;

    // 스타일 참조 이미지가 있는 경우 다른 프롬프트 사용
    const styleRefCount = options.styleReferenceImages?.length || 0;
    const hasStyleRef = styleRefCount > 0;

    // 배경 스팟 이미지 확인
    const backgroundSpotCount = options.backgroundSpotImages?.length || 0;
    const hasBackgroundSpot = backgroundSpotCount > 0;

    // ⭐️ Phase 1-3: 프롬프트 간결화 및 아이폰 스타일 핵심 집중
    const textPrompt = options.garmentImage
      ? `Generate a high-quality fashion lookbook photo ${hasStyleRef ? 'matching the EXACT style of the reference images' : 'with iPhone photography aesthetic'}.

${hasStyleRef ? `STYLE REFERENCE (${styleRefCount} images):
- Match the lighting, color grading, and composition from reference images
- Replicate the overall mood and aesthetic
- Blend best elements from all references
` : `CORE STYLE - iPhone Photography:
- Natural daylight, soft window lighting
- Sharp focus with natural depth of field
- True-to-life colors, no heavy filters
- Clean composition
${hasBackgroundSpot ? '' : '- Simple neutral background'}
`}
${hasBackgroundSpot ? `LOCATION (${backgroundSpotCount} reference images):
- Use the exact location/background shown in references
- Match environment, furniture, and lighting
- Model naturally placed in this setting
` : ''}
${options.customPrompt ? `CUSTOM STYLE: ${options.customPrompt}\n` : ''}
MODEL: Korean woman in early 20s, natural expression, full visible face
(Note: Face will be cropped post-VTON for privacy - generate with complete face for body detection)

POSE: ${posePrompt}

GARMENT: Model must wear the EXACT garment from reference image
- Accurate colors, patterns, and fabric texture
- Natural draping and fit

Output: Professional fashion photo that looks authentically shot, not AI-generated.`
      : generateAblelyStylePrompt(options.pose, options.style);

    // 요청 body 구성
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // 스타일 참조 이미지들 먼저 추가 (최대 10장)
    if (options.styleReferenceImages && options.styleReferenceImages.length > 0) {
      for (const styleRef of options.styleReferenceImages) {
        const base64Data = styleRef.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = styleRef.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }

    // 배경 스팟 이미지들 추가 (최대 5장)
    if (options.backgroundSpotImages && options.backgroundSpotImages.length > 0) {
      for (const bgSpot of options.backgroundSpotImages) {
        const base64Data = bgSpot.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = bgSpot.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }

    // 의류 이미지 추가 (마지막에 추가하여 명확히 구분)
    if (options.garmentImage) {
      const base64Data = options.garmentImage.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = options.garmentImage.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({ text: textPrompt });

    // 🔍 실제 호출되는 모델 로깅 (디버깅용)
    console.log(`[Gemini] Calling model: ${this.model} for pose: ${options.pose}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['image', 'text'],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API Error:', error);
      throw new Error(`Google Gemini API error: ${error}`);
    }

    const data = await response.json();

    // 이미지 데이터 추출
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error('No image generated from Gemini');
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const prompt = options.prompt || `
      simple clean background,
      natural daylight from window,
      minimalist aesthetic, neutral tones,
      online shopping mall photo backdrop style
    `.trim();

    return this.generateModelImage({
      pose: 'front',
      style: prompt,
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
