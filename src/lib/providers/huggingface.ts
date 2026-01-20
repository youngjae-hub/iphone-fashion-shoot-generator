// ============================================
// Hugging Face Inference API Provider (무료)
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
  generateIPhoneStylePrompt,
} from './base';

const HF_API_URL = 'https://api-inference.huggingface.co/models';

// Hugging Face API 호출
async function queryHuggingFace(model: string, prompt: string): Promise<string> {
  const token = process.env.HUGGINGFACE_API_TOKEN;

  if (!token) {
    throw new Error('HUGGINGFACE_API_TOKEN is not set');
  }

  const response = await fetch(`${HF_API_URL}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        negative_prompt: "low quality, blurry, distorted, deformed, ugly, bad anatomy",
        width: 768,
        height: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }

  // 이미지 바이너리를 base64로 변환
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

// ============================================
// Hugging Face Image Generation Provider
// ============================================
export class HuggingFaceImageProvider implements IImageGenerationProvider {
  name = 'huggingface';

  // 무료로 사용 가능한 모델들
  private model = 'stabilityai/stable-diffusion-xl-base-1.0';

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const prompt = generateIPhoneStylePrompt(options.pose, options.style);
    return queryHuggingFace(this.model, prompt);
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const prompt = options.prompt || `
      minimalist photography studio background,
      soft gradient, neutral tones,
      professional fashion photography backdrop,
      ${options.style}
    `.trim();

    return queryHuggingFace(this.model, prompt);
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.HUGGINGFACE_API_TOKEN;
  }
}
