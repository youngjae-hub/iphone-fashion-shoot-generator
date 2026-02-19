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
    const prompt = generateIPhoneStylePrompt(options.pose, options.style);

    // Gemini 2.0 Flash 모델 사용 (1월 20일 검증된 버전)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate a fashion photography image: ${prompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['image', 'text'],
            responseMimeType: 'image/jpeg',
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
