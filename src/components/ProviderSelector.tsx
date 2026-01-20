'use client';

import { ProviderConfig, ImageGenerationProvider, TryOnProvider } from '@/types';

interface ProviderSelectorProps {
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
  availability?: {
    imageGeneration: Record<string, boolean>;
    tryOn: Record<string, boolean>;
  };
}

const IMAGE_GENERATION_OPTIONS: { value: ImageGenerationProvider; label: string; description: string }[] = [
  { value: 'google-gemini', label: 'Nano Banana Pro', description: '고품질 이미지 생성 (권장)' },
  { value: 'google-imagen', label: 'Google Imagen', description: '고품질 이미지 생성' },
  { value: 'replicate-flux', label: 'Flux Pro', description: '빠른 생성 속도' },
  { value: 'stability-ai', label: 'Stable Diffusion XL', description: '다양한 스타일 지원' },
  { value: 'openai-dalle', label: 'DALL-E 3', description: 'OpenAI 이미지 생성' },
];

const TRYON_OPTIONS: { value: TryOnProvider; label: string; description: string }[] = [
  { value: 'idm-vton', label: 'IDM-VTON', description: '고품질 가상 피팅' },
  { value: 'kolors-virtual-tryon', label: 'Kolors VTON', description: 'Kwai 가상 피팅' },
  { value: 'fashn-ai', label: 'FASHN AI', description: '패션 특화 피팅' },
];

export default function ProviderSelector({
  config,
  onChange,
  availability,
}: ProviderSelectorProps) {
  const isAvailable = (type: 'imageGeneration' | 'tryOn', provider: string) => {
    if (!availability) return true;
    return availability[type][provider] ?? false;
  };

  return (
    <div className="space-y-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="font-semibold">AI Provider 설정</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          언제든 변경 가능
        </span>
      </div>

      {/* Image Generation Provider */}
      <div className="settings-group">
        <label className="settings-label">이미지 생성 모델</label>
        <div className="space-y-2">
          {IMAGE_GENERATION_OPTIONS.map((option) => {
            const available = isAvailable('imageGeneration', option.value);
            const isSelected = config.imageGeneration === option.value;

            return (
              <div
                key={option.value}
                onClick={() => available && onChange({ ...config, imageGeneration: option.value })}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)]'}
                  ${!available ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent)]'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${isSelected ? 'border-[var(--accent)]' : 'border-[var(--foreground-muted)]'}
                      `}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {option.description}
                      </p>
                    </div>
                  </div>
                  {!available && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--error)', color: 'white' }}>
                      API 키 필요
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Try-On Provider */}
      <div className="settings-group">
        <label className="settings-label">Virtual Try-On 모델</label>
        <div className="space-y-2">
          {TRYON_OPTIONS.map((option) => {
            const available = isAvailable('tryOn', option.value);
            const isSelected = config.tryOn === option.value;

            return (
              <div
                key={option.value}
                onClick={() => available && onChange({ ...config, tryOn: option.value })}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)]'}
                  ${!available ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent)]'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${isSelected ? 'border-[var(--accent)]' : 'border-[var(--foreground-muted)]'}
                      `}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {option.description}
                      </p>
                    </div>
                  </div>
                  {!available && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--error)', color: 'white' }}>
                      API 키 필요
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          결과가 마음에 들지 않으면 언제든 다른 Provider로 변경하여 다시 생성할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
