'use client';

import { ProviderConfig, ImageGenerationProvider, TryOnProvider, PoseMode } from '@/types';
import HelpTooltip from './HelpTooltip';

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
];

const TRYON_OPTIONS: { value: TryOnProvider; label: string; description: string }[] = [
  { value: 'idm-vton', label: 'IDM-VTON', description: '고품질 가상 피팅' },
  { value: 'kolors-virtual-tryon', label: 'Kolors VTON', description: 'Kwai 가상 피팅' },
];

const POSE_MODE_OPTIONS: { value: PoseMode; label: string; description: string }[] = [
  { value: 'auto', label: '자동 (기본)', description: '프롬프트 기반으로 포즈 생성' },
  { value: 'controlnet', label: 'ControlNet', description: '스켈레톤으로 정확한 포즈 제어 (실험적)' },
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
        <label className="settings-label flex items-center gap-2">
          이미지 생성 모델
          <HelpTooltip title="이미지 생성 모델이란?">
            <p className="mb-2">AI 이미지를 만들어주는 <strong>핵심 엔진</strong>입니다. 각 모델마다 특징이 다릅니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Nano Banana Pro:</strong> 가장 고품질, 권장</li>
              <li><strong>Google Imagen:</strong> 안정적인 품질</li>
              <li><strong>Flux Pro:</strong> 빠른 속도, 괜찮은 품질</li>
              <li><strong>Stable Diffusion:</strong> 다양한 스타일</li>
              <li><strong>DALL-E 3:</strong> OpenAI의 이미지 생성</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 결과가 마음에 안 들면 다른 모델로 재시도해보세요!</p>
          </HelpTooltip>
        </label>
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
        <label className="settings-label flex items-center gap-2">
          Virtual Try-On 모델
          <HelpTooltip title="Virtual Try-On이란?">
            <p className="mb-2">업로드한 옷을 모델이 <strong>실제로 입은 것처럼</strong> 합성해주는 기술입니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>IDM-VTON:</strong> 가장 자연스러운 합성 (권장)</li>
              <li><strong>Kolors VTON:</strong> 빠른 속도</li>
              <li><strong>FASHN AI:</strong> 패션 특화 합성</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 옷의 디테일과 핏을 자연스럽게 표현합니다.</p>
          </HelpTooltip>
        </label>
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

      {/* Pose Mode (Phase 2-1) */}
      <div className="settings-group">
        <label className="settings-label flex items-center gap-2">
          포즈 제어 모드
          <HelpTooltip title="포즈 제어 모드란?">
            <p className="mb-2">AI가 모델의 <strong>포즈</strong>를 생성하는 방식을 선택합니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>자동 (기본):</strong> 프롬프트 텍스트로 포즈 생성 - 안정적</li>
              <li><strong>ControlNet:</strong> 스켈레톤 이미지로 정확한 포즈 제어 - 실험적이지만 뒷면 포즈에 유리</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 뒷면(back) 포즈가 잘 안 나올 때 ControlNet을 시도해보세요!</p>
          </HelpTooltip>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255, 180, 0, 0.2)', color: '#f59e0b' }}>
            실험적
          </span>
        </label>
        <div className="space-y-2">
          {POSE_MODE_OPTIONS.map((option) => {
            const isSelected = (config.poseMode || 'auto') === option.value;

            return (
              <div
                key={option.value}
                onClick={() => onChange({ ...config, poseMode: option.value })}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)]'}
                  hover:border-[var(--accent)]
                `}
              >
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
