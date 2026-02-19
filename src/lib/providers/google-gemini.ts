// ============================================
// Google Gemini Image Generation Provider (1월 20일 버전)
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
  generateIPhoneStylePrompt,
} from './base';

// Google Gemini API를 통한 이미지 생성
export class GoogleGeminiImageProvider implements IImageGenerationProvider {
  name = 'google-gemini';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const basePrompt = generateIPhoneStylePrompt(options.pose, options.style);

    // 커스텀 프롬프트가 있으면 결합
    let finalPrompt = basePrompt;
    if (options.customPrompt) {
      finalPrompt = `${options.customPrompt}, ${basePrompt}`;
    }

    // 요청 parts 구성
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // 스타일 참조 이미지가 있으면 첨부 (스타일/조명/배경 참고용)
    if (options.styleReferenceImages && options.styleReferenceImages.length > 0) {
      // 첫 번째 참조 이미지만 사용 (Gemini는 멀티 이미지 입력 가능)
      const refImage = options.styleReferenceImages[0];
      const base64Data = refImage.replace(/^data:image\/\w+;base64,/, '');

      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });

      // 프롬프트에 스타일 참조 지시 추가
      parts.push({
        text: `Generate a NEW fashion model image using the style, lighting, and background mood from the reference image above.
IMPORTANT: Do NOT copy the clothing from the reference. Generate a model wearing simple neutral underwear or form-fitting base layer.
Style to match: ${finalPrompt}`,
      });

      console.log('📸 Using style reference image for lighting/background guidance');
    } else if (options.backgroundSpotImages && options.backgroundSpotImages.length > 0) {
      // 배경 스팟 이미지 사용
      const bgImage = options.backgroundSpotImages[0];
      const base64Data = bgImage.replace(/^data:image\/\w+;base64,/, '');

      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });

      parts.push({
        text: `Generate a fashion model image using the background/location from the reference image above.
Place the model naturally in this environment.
Model requirements: ${finalPrompt}`,
      });

      console.log('🏞️ Using background spot image for location guidance');
    } else {
      // 참조 이미지 없이 텍스트만으로 생성
      parts.push({
        text: `Generate a fashion photography image: ${finalPrompt}`,
      });
    }

    // Gemini 이미지 생성 모델 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${this.apiKey}`,
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
      minimalist photography studio background,
      soft gradient, neutral tones,
      professional fashion photography backdrop,
      ${options.style}
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
