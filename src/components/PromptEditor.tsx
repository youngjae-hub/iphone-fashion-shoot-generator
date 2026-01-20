'use client';

import { useState } from 'react';
import {
  CustomPromptSettings,
  PromptTemplate,
  DEFAULT_PROMPT_TEMPLATES,
  STYLE_MODIFIERS,
  DEFAULT_CUSTOM_PROMPT_SETTINGS,
} from '@/types';

interface PromptEditorProps {
  settings: CustomPromptSettings;
  onChange: (settings: CustomPromptSettings) => void;
}

export default function PromptEditor({ settings, onChange }: PromptEditorProps) {
  const [activeCategory, setActiveCategory] = useState<'style' | 'model' | 'background' | 'all'>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 카테고리별 템플릿 필터링
  const filteredTemplates = activeCategory === 'all'
    ? DEFAULT_PROMPT_TEMPLATES
    : DEFAULT_PROMPT_TEMPLATES.filter(t => t.category === activeCategory);

  // 템플릿 선택
  const handleSelectTemplate = (template: PromptTemplate) => {
    onChange({
      ...settings,
      templateId: template.id,
      basePrompt: template.basePrompt,
      negativePrompt: template.negativePrompt || settings.negativePrompt,
    });
  };

  // 스타일 수식어 토글
  const handleToggleModifier = (modifierId: string) => {
    const newModifiers = settings.styleModifiers.includes(modifierId)
      ? settings.styleModifiers.filter(id => id !== modifierId)
      : [...settings.styleModifiers, modifierId];
    onChange({ ...settings, styleModifiers: newModifiers });
  };

  // 커스텀 프롬프트 모드 토글
  const handleToggleCustomMode = () => {
    onChange({ ...settings, useCustomPrompt: !settings.useCustomPrompt });
  };

  // 최종 프롬프트 미리보기 생성
  const generatePreview = (): string => {
    const selectedTemplate = DEFAULT_PROMPT_TEMPLATES.find(t => t.id === settings.templateId);
    const basePrompt = settings.useCustomPrompt
      ? settings.basePrompt
      : selectedTemplate?.basePrompt || '';

    const modifierPrompts = settings.styleModifiers
      .map(id => STYLE_MODIFIERS.find(m => m.id === id)?.prompt)
      .filter(Boolean)
      .join(', ');

    return [basePrompt, modifierPrompts].filter(Boolean).join(', ');
  };

  const selectedTemplate = DEFAULT_PROMPT_TEMPLATES.find(t => t.id === settings.templateId);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          프롬프트 설정
        </h3>
        <button
          onClick={() => onChange(DEFAULT_CUSTOM_PROMPT_SETTINGS)}
          className="text-xs px-2 py-1 rounded hover:bg-[var(--background-tertiary)]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          초기화
        </button>
      </div>

      {/* 커스텀 모드 토글 */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
        <div>
          <p className="text-sm font-medium">커스텀 프롬프트</p>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            직접 프롬프트를 작성합니다
          </p>
        </div>
        <button
          onClick={handleToggleCustomMode}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.useCustomPrompt ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.useCustomPrompt ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* 템플릿 모드 */}
      {!settings.useCustomPrompt && (
        <>
          {/* 카테고리 필터 */}
          <div className="flex gap-1">
            {[
              { id: 'all', label: '전체' },
              { id: 'style', label: '스타일' },
              { id: 'model', label: '모델' },
              { id: 'background', label: '배경' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'hover:bg-[var(--background-tertiary)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 템플릿 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`p-3 rounded-lg text-left transition-all ${
                  settings.templateId === template.id
                    ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-light)]'
                    : 'hover:bg-[var(--background-tertiary)]'
                }`}
                style={{ background: settings.templateId === template.id ? undefined : 'var(--background-secondary)' }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium">{template.name}</span>
                  {template.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'white' }}>
                      기본
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    {template.description}
                  </p>
                )}
                <span
                  className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--background-tertiary)' }}
                >
                  {template.category === 'style' ? '스타일' : template.category === 'model' ? '모델' : '배경'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 커스텀 프롬프트 입력 */}
      {settings.useCustomPrompt && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--foreground-muted)' }}>
              메인 프롬프트
            </label>
            <textarea
              value={settings.basePrompt}
              onChange={(e) => onChange({ ...settings, basePrompt: e.target.value })}
              placeholder="young Korean woman wearing the uploaded clothing, iPhone photo style..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: 'var(--background-tertiary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        </div>
      )}

      {/* 스타일 수식어 */}
      <div>
        <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
          스타일 수식어 (선택)
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLE_MODIFIERS.map((modifier) => (
            <button
              key={modifier.id}
              onClick={() => handleToggleModifier(modifier.id)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                settings.styleModifiers.includes(modifier.id)
                  ? 'bg-[var(--accent)] text-white'
                  : 'hover:bg-[var(--background-tertiary)]'
              }`}
              style={{
                background: settings.styleModifiers.includes(modifier.id) ? undefined : 'var(--background-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {modifier.label}
            </button>
          ))}
        </div>
      </div>

      {/* 고급 설정 */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <svg
            className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          고급 설정
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--foreground-muted)' }}>
                네거티브 프롬프트
              </label>
              <textarea
                value={settings.negativePrompt}
                onChange={(e) => onChange({ ...settings, negativePrompt: e.target.value })}
                placeholder="blurry, low quality, distorted..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  background: 'var(--background-tertiary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 프롬프트 미리보기 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            최종 프롬프트 미리보기
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(generatePreview())}
            className="text-[10px] px-2 py-0.5 rounded hover:bg-[var(--background-secondary)]"
          >
            복사
          </button>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
          {generatePreview() || '템플릿을 선택하거나 커스텀 프롬프트를 입력하세요'}
        </p>
        {settings.negativePrompt && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px]" style={{ color: 'var(--error)' }}>Negative: </span>
            <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              {settings.negativePrompt}
            </span>
          </div>
        )}
      </div>

      {/* 현재 선택 요약 */}
      {selectedTemplate && !settings.useCustomPrompt && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
          <svg className="w-3 h-3" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          현재 템플릿: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{selectedTemplate.name}</span>
          {settings.styleModifiers.length > 0 && (
            <span>+ {settings.styleModifiers.length}개 수식어</span>
          )}
        </div>
      )}
    </div>
  );
}
