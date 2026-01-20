'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ImageUploader,
  ProviderSelector,
  GenerationSettings,
  ResultGallery,
  LoRATraining,
  History,
} from '@/components';
import {
  UploadedImage,
  GeneratedImage,
  ProviderConfig,
  GenerationSettings as GenerationSettingsType,
  LoRAModel,
  GenerationSession,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_GENERATION_SETTINGS,
} from '@/types';

export default function Home() {
  // State
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [settings, setSettings] = useState<GenerationSettingsType>(DEFAULT_GENERATION_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    imageGeneration: Record<string, boolean>;
    tryOn: Record<string, boolean>;
  } | undefined>();
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'provider' | 'training' | 'history'>('upload');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [styleReferenceImages, setStyleReferenceImages] = useState<UploadedImage[]>([]);
  const [activeLoRA, setActiveLoRA] = useState<LoRAModel | null>(null);

  // Provider 가용성 체크
  useEffect(() => {
    async function checkProviders() {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        if (data.success) {
          setAvailability(data.availability);
        }
      } catch (err) {
        console.error('Failed to check providers:', err);
      }
    }
    checkProviders();
  }, []);

  // Handlers
  const handleUpload = useCallback((newImages: UploadedImage[]) => {
    setUploadedImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleGenerate = async () => {
    if (uploadedImages.length === 0) {
      setError('의류 이미지를 먼저 업로드해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 첫 번째 업로드된 이미지를 사용 (추후 다중 이미지 지원 가능)
      const garmentImage = uploadedImages[0].preview;

      // 활성화된 LoRA가 있으면 LoRA 생성 API 사용
      if (activeLoRA && activeLoRA.status === 'completed') {
        const generatedImages: GeneratedImage[] = [];

        for (const pose of settings.poses) {
          for (let i = 0; i < settings.shotsPerPose; i++) {
            try {
              const response = await fetch('/api/lora/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  loraModelId: activeLoRA.id,
                  garmentImage,
                  pose,
                  seed: settings.seed ? settings.seed + i : undefined,
                }),
              });

              const data = await response.json();
              if (data.success && data.image) {
                generatedImages.push(data.image);
              }
            } catch (err) {
              console.error(`LoRA generation error for pose ${pose}:`, err);
            }
          }
        }

        if (generatedImages.length > 0) {
          setGeneratedImages((prev) => [...generatedImages, ...prev]);
          // 히스토리 저장
          saveToHistory(generatedImages);
        } else {
          setError('LoRA 이미지 생성에 실패했습니다.');
        }
      } else {
        // 기본 생성 API 사용
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garmentImage,
            styleReferenceImages: styleReferenceImages.map((img) => img.preview),
            poses: settings.poses,
            settings,
            providers: providerConfig,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setGeneratedImages((prev) => [...data.images, ...prev]);
          // 히스토리 저장
          saveToHistory(data.images);
        } else {
          setError(data.error || '이미지 생성에 실패했습니다.');
        }
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // 히스토리에 저장
  const saveToHistory = async (images: GeneratedImage[]) => {
    try {
      if (!currentSessionId) {
        // 새 세션 생성
        const createRes = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            garmentImages: uploadedImages.map(img => img.preview),
            settings,
            providers: providerConfig,
            loraModelId: activeLoRA?.id,
          }),
        });
        const createData = await createRes.json();
        if (createData.success) {
          setCurrentSessionId(createData.session.id);
          // 이미지 추가
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'addImages',
              sessionId: createData.session.id,
              images,
            }),
          });
        }
      } else {
        // 기존 세션에 이미지 추가
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'addImages',
            sessionId: currentSessionId,
            images,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to save to history:', err);
    }
  };

  // 히스토리에서 세션 불러오기
  const loadFromHistory = (session: GenerationSession) => {
    setGeneratedImages(session.generatedImages);
    setSettings(session.settings);
    setProviderConfig(session.providers);
    setCurrentSessionId(session.id);
    setActiveTab('upload');
  };

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fashion_${image.pose}_${image.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDownloadAll = async () => {
    for (const image of generatedImages) {
      await handleDownload(image);
      // 다운로드 간격 두기
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  const handleRegenerate = async (image: GeneratedImage) => {
    if (uploadedImages.length === 0) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentImage: uploadedImages[0].preview,
          pose: image.pose,
          settings: image.settings,
          providers: providerConfig,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedImages((prev) => [data.image, ...prev]);
      } else {
        setError(data.error || '재생성에 실패했습니다.');
      }
    } catch (err) {
      setError('재생성 중 오류가 발생했습니다.');
      console.error('Regenerate error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--background-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg">iPhone Style Fashion Generator</h1>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                AI 패션 룩북 이미지 생성
              </p>
            </div>
          </div>

          {/* Current Provider Badge */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="provider-badge">
              {providerConfig.imageGeneration}
            </span>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>+</span>
            <span className="provider-badge">
              {providerConfig.tryOn}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-full md:w-96 border-r flex-shrink-0 overflow-y-auto" style={{ borderColor: 'var(--border)', background: 'var(--background-secondary)' }}>
          <div className="p-4 space-y-6">
            {/* Tab Navigation */}
            <div className="flex rounded-lg p-1" style={{ background: 'var(--background-tertiary)' }}>
              {[
                { id: 'upload', label: '업로드' },
                { id: 'settings', label: '설정' },
                { id: 'provider', label: 'AI 모델' },
                { id: 'training', label: '스타일 학습' },
                { id: 'history', label: '히스토리' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'hover:bg-[var(--background-secondary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'upload' && (
              <ImageUploader
                uploadedImages={uploadedImages}
                onUpload={handleUpload}
                onRemove={handleRemoveImage}
                maxImages={5}
                styleReferenceImages={styleReferenceImages}
                onStyleReferenceUpload={setStyleReferenceImages}
              />
            )}

            {activeTab === 'settings' && (
              <GenerationSettings
                settings={settings}
                onChange={setSettings}
              />
            )}

            {activeTab === 'provider' && (
              <ProviderSelector
                config={providerConfig}
                onChange={setProviderConfig}
                availability={availability}
              />
            )}

            {activeTab === 'training' && (
              <LoRATraining
                onModelReady={(model) => {
                  setActiveLoRA(model);
                  // 학습 완료 시 알림
                  alert(`"${model.name}" 스타일 학습이 완료되었습니다!`);
                }}
              />
            )}

            {activeTab === 'history' && (
              <History onLoadSession={loadFromHistory} />
            )}

            {/* Active LoRA Badge */}
            {activeLoRA && (
              <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--success)', background: 'rgba(34, 197, 94, 0.1)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">활성 스타일: {activeLoRA.name}</span>
                  </div>
                  <button
                    onClick={() => setActiveLoRA(null)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    해제
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                  트리거: <code className="px-1 rounded" style={{ background: 'var(--background-tertiary)' }}>{activeLoRA.triggerWord}</code>
                </p>
              </div>
            )}

            {/* Generate Button */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || uploadedImages.length === 0}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                    </svg>
                    생성 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    이미지 생성 ({settings.totalShots}컷)
                  </>
                )}
              </button>

              <p className="text-xs text-center mt-2" style={{ color: 'var(--foreground-muted)' }}>
                {settings.poses.length}개 포즈 × {settings.shotsPerPose}컷
              </p>
            </div>
          </div>
        </aside>

        {/* Result Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <ResultGallery
            images={generatedImages}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
            onRegenerate={handleRegenerate}
          />
        </div>
      </main>
    </div>
  );
}
