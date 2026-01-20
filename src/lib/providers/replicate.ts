// ============================================
// Replicate Provider - IDM-VTON, Flux 등 지원
// ============================================

import Replicate from 'replicate';
import {
  IImageGenerationProvider,
  ITryOnProvider,
  ModelGenerationOptions,
  BackgroundOptions,
  TryOnOptions,
  generateIPhoneStylePrompt,
  DEFAULT_NEGATIVE_PROMPT
} from './base';

// Replicate 클라이언트 (서버 사이드에서만 사용)
const getReplicateClient = () => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set');
  }
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
};

// Helper function to extract string from Replicate output
function extractOutputString(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    return String(output[0]);
  }
  if (output && typeof output === 'object') {
    return String(output);
  }
  throw new Error('Unexpected output format from Replicate');
}

// ============================================
// Flux Image Generation Provider (SDXL Turbo - 더 빠르고 무료 친화적)
// ============================================
export class FluxImageProvider implements IImageGenerationProvider {
  name = 'replicate-flux';

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const replicate = getReplicateClient();
    // customPrompt가 있으면 기본 프롬프트와 합치고, 없으면 기본 프롬프트만 사용
    const basePrompt = generateIPhoneStylePrompt(options.pose, options.style);
    const prompt = options.customPrompt
      ? `${basePrompt}, ${options.customPrompt}`
      : basePrompt;

    // SDXL Turbo 사용 - 더 빠르고 Rate limit 덜 엄격
    const output = await replicate.run(
      "stability-ai/sdxl-turbo:a00d0b7dcbb9c3fbb34ba87d2d5b46c56969c84a628bf778a7fdaec30b1b99c5" as `${string}/${string}`,
      {
        input: {
          prompt,
          negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
          width: 768,
          height: 1024,
          num_inference_steps: 4,
          guidance_scale: 0.0,
        }
      }
    );

    return extractOutputString(output);
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const replicate = getReplicateClient();

    const prompt = options.prompt || `
      minimalist photography studio background,
      soft gradient, neutral tones,
      professional fashion photography backdrop,
      ${options.style}
    `.trim();

    const output = await replicate.run(
      "stability-ai/sdxl-turbo:a00d0b7dcbb9c3fbb34ba87d2d5b46c56969c84a628bf778a7fdaec30b1b99c5" as `${string}/${string}`,
      {
        input: {
          prompt,
          width: 768,
          height: 1024,
          num_inference_steps: 4,
          guidance_scale: 0.0,
        }
      }
    );

    return extractOutputString(output);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!process.env.REPLICATE_API_TOKEN;
    } catch {
      return false;
    }
  }
}

// ============================================
// IDM-VTON Try-On Provider
// ============================================
export class IDMVTONProvider implements ITryOnProvider {
  name = 'idm-vton';

  async tryOn(options: TryOnOptions): Promise<string> {
    const replicate = getReplicateClient();

    // IDM-VTON 모델 실행
    const output = await replicate.run(
      "cuuupid/idm-vton:c871bb9b046f351a536e7819bb21256cc1c7e0cd9ff4c782e3b4ad583f7febcc" as `${string}/${string}`,
      {
        input: {
          crop: false,
          seed: 42,
          steps: 30,
          category: options.category || "upper_body",
          force_dc: false,
          garm_img: options.garmentImage,
          human_img: options.modelImage,
          mask_only: false,
          garment_des: "fashion garment, high quality fabric",
        }
      }
    );

    return extractOutputString(output);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!process.env.REPLICATE_API_TOKEN;
    } catch {
      return false;
    }
  }
}

// ============================================
// Kolors Virtual Try-On Provider (대안)
// ============================================
export class KolorsVTONProvider implements ITryOnProvider {
  name = 'kolors-virtual-tryon';

  async tryOn(options: TryOnOptions): Promise<string> {
    const replicate = getReplicateClient();

    const output = await replicate.run(
      "kwai-kolors/kolors-virtual-tryon:4e3cbc6c096a70ee93dbd91a258ebf8ba3c5e772e22e0c7e49de27a04f633289" as `${string}/${string}`,
      {
        input: {
          seed: 42,
          steps: 30,
          person_image: options.modelImage,
          garment_image: options.garmentImage,
        }
      }
    );

    return extractOutputString(output);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!process.env.REPLICATE_API_TOKEN;
    } catch {
      return false;
    }
  }
}

// ============================================
// Stable Diffusion Image Provider (대안)
// ============================================
export class StableDiffusionProvider implements IImageGenerationProvider {
  name = 'stability-ai';

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    const replicate = getReplicateClient();
    const prompt = generateIPhoneStylePrompt(options.pose, options.style);

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as `${string}/${string}`,
      {
        input: {
          prompt,
          negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
          width: 768,
          height: 1024,
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          seed: options.seed,
        }
      }
    );

    return extractOutputString(output);
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const replicate = getReplicateClient();

    const prompt = options.prompt || `
      clean studio background, soft lighting,
      fashion photography backdrop, ${options.style}
    `.trim();

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as `${string}/${string}`,
      {
        input: {
          prompt,
          negative_prompt: "text, watermark, logo, busy background",
          width: 768,
          height: 1024,
          num_outputs: 1,
        }
      }
    );

    return extractOutputString(output);
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!process.env.REPLICATE_API_TOKEN;
    } catch {
      return false;
    }
  }
}
