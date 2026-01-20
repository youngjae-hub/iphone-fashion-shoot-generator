// ============================================
// Google Imagen Provider
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
  generateIPhoneStylePrompt,
} from './base';

// Google Imagen API 클라이언트
export class GoogleImagenProvider implements IImageGenerationProvider {
  name = 'google-imagen';
  private apiKey: string;
  private endpoint: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
    // Vertex AI Imagen 엔드포인트
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImage`;
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const prompt = generateIPhoneStylePrompt(options.pose, options.style);

    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '3:4',
          safetyFilterLevel: 'BLOCK_SOME',
          personGeneration: 'ALLOW_ADULT',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Imagen API error: ${error}`);
    }

    const data = await response.json();

    // base64 이미지 반환
    if (data.generatedImages && data.generatedImages.length > 0) {
      const imageData = data.generatedImages[0].image.bytesBase64Encoded;
      return `data:image/png;base64,${imageData}`;
    }

    throw new Error('No image generated');
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const prompt = options.prompt || `
      minimalist photography studio background,
      soft gradient lighting, neutral tones,
      professional fashion photography backdrop,
      ${options.style}
    `.trim();

    const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '3:4',
          safetyFilterLevel: 'BLOCK_SOME',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Imagen API error: ${error}`);
    }

    const data = await response.json();

    if (data.generatedImages && data.generatedImages.length > 0) {
      const imageData = data.generatedImages[0].image.bytesBase64Encoded;
      return `data:image/png;base64,${imageData}`;
    }

    throw new Error('No background generated');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Vertex AI를 통한 Imagen 사용 (더 고급 기능)
export class VertexImagenProvider implements IImageGenerationProvider {
  name = 'vertex-imagen';
  private projectId: string;
  private location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const prompt = generateIPhoneStylePrompt(options.pose, options.style);

    // Vertex AI REST API 엔드포인트
    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:4',
          safetyFilterLevel: 'block_some',
          personGeneration: 'allow_adult',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex AI error: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.predictions && data.predictions.length > 0) {
      return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    }

    throw new Error('No image generated');
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    // 동일한 로직, 프롬프트만 다름
    return this.generateModelImage({
      pose: 'front',
      style: options.style,
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.projectId && !!process.env.GOOGLE_ACCESS_TOKEN;
  }
}
