// ============================================
// Replicate Provider - 1월 20일 원본 버전
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
    // Handle FileOutput objects with href property
    const obj = output as Record<string, unknown>;
    if (obj.url && typeof obj.url === 'object') {
      const urlObj = obj.url as Record<string, unknown>;
      if (urlObj.href) return String(urlObj.href);
    }
    if (obj.href) return String(obj.href);
    return String(output);
  }
  throw new Error('Unexpected output format from Replicate');
}

// ============================================
// Flux Image Generation Provider
// ============================================
export class FluxImageProvider implements IImageGenerationProvider {
  name = 'replicate-flux';

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
      minimalist photography studio background,
      soft gradient, neutral tones,
      professional fashion photography backdrop,
      ${options.style}
    `.trim();

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as `${string}/${string}`,
      {
        input: {
          prompt,
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

// ============================================
// IDM-VTON Try-On Provider
// ============================================
export class IDMVTONProvider implements ITryOnProvider {
  name = 'idm-vton';

  async tryOn(options: TryOnOptions): Promise<string> {
    const replicate = getReplicateClient();

    // IDM-VTON 모델 실행
    const output = await replicate.run(
      "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985" as `${string}/${string}`,
      {
        input: {
          crop: false,
          seed: options.seed || 42,
          steps: 40,
          category: options.category || 'dresses',
          force_dc: false,
          garm_img: options.garmentImage,
          human_img: options.modelImage,
          mask_only: false,
          garment_des: "preserve all details: drawstrings, zippers, pockets, seams, exact colors",
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
