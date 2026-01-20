// ============================================
// Provider Registry & Factory
// ============================================

import {
  IImageGenerationProvider,
  ITryOnProvider,
} from './base';
import { GoogleImagenProvider, VertexImagenProvider } from './google-imagen';
import {
  FluxImageProvider,
  StableDiffusionProvider,
  IDMVTONProvider,
  KolorsVTONProvider,
} from './replicate';
import { HuggingFaceImageProvider } from './huggingface';
import { GoogleGeminiImageProvider } from './google-gemini';
import { ImageGenerationProvider, TryOnProvider } from '@/types';

// Provider 인스턴스들
const providers = {
  imageGeneration: {
    'google-imagen': new GoogleImagenProvider(),
    'vertex-imagen': new VertexImagenProvider(),
    'replicate-flux': new FluxImageProvider(),
    'stability-ai': new StableDiffusionProvider(),
    'huggingface': new HuggingFaceImageProvider(),
    'google-gemini': new GoogleGeminiImageProvider(),
  } as Record<string, IImageGenerationProvider>,

  tryOn: {
    'idm-vton': new IDMVTONProvider(),
    'kolors-virtual-tryon': new KolorsVTONProvider(),
  } as Record<string, ITryOnProvider>,
};

// Provider Factory
export function getImageGenerationProvider(
  name: ImageGenerationProvider | string
): IImageGenerationProvider {
  const provider = providers.imageGeneration[name];
  if (!provider) {
    throw new Error(`Image generation provider not found: ${name}`);
  }
  return provider;
}

export function getTryOnProvider(
  name: TryOnProvider | string
): ITryOnProvider {
  const provider = providers.tryOn[name];
  if (!provider) {
    throw new Error(`Try-on provider not found: ${name}`);
  }
  return provider;
}

// 사용 가능한 Provider 목록
export function getAvailableProviders(): {
  imageGeneration: string[];
  tryOn: string[];
} {
  return {
    imageGeneration: Object.keys(providers.imageGeneration),
    tryOn: Object.keys(providers.tryOn),
  };
}

// Provider 가용성 체크
export async function checkProviderAvailability(): Promise<{
  imageGeneration: Record<string, boolean>;
  tryOn: Record<string, boolean>;
}> {
  const imageGenResults: Record<string, boolean> = {};
  const tryOnResults: Record<string, boolean> = {};

  for (const [name, provider] of Object.entries(providers.imageGeneration)) {
    imageGenResults[name] = await provider.isAvailable();
  }

  for (const [name, provider] of Object.entries(providers.tryOn)) {
    tryOnResults[name] = await provider.isAvailable();
  }

  return {
    imageGeneration: imageGenResults,
    tryOn: tryOnResults,
  };
}

// Re-export base interfaces
export * from './base';
export { GoogleImagenProvider, VertexImagenProvider } from './google-imagen';
export {
  FluxImageProvider,
  StableDiffusionProvider,
  IDMVTONProvider,
  KolorsVTONProvider,
} from './replicate';
export { HuggingFaceImageProvider } from './huggingface';
export { GoogleGeminiImageProvider } from './google-gemini';
