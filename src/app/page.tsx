'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  ImageUploader,
  ProviderSelector,
  GenerationSettings,
  ResultGallery,
  LoRATraining,
  History,
  PromptEditor,
} from '@/components';
import {
  UploadedImage,
  GeneratedImage,
  ProviderConfig,
  GenerationSettings as GenerationSettingsType,
  LoRAModel,
  GenerationSession,
  GarmentCategory,
  CustomPromptSettings,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_CUSTOM_PROMPT_SETTINGS,
} from '@/types';

export default function Home() {
  const { data: session } = useSession();

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
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'prompt' | 'provider' | 'training' | 'history'>('upload');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [styleReferenceImages, setStyleReferenceImages] = useState<UploadedImage[]>([]);
  const [backgroundSpotImages, setBackgroundSpotImages] = useState<UploadedImage[]>([]);
  const [activeLoRA, setActiveLoRA] = useState<LoRAModel | null>(null);
  const [promptSettings, setPromptSettings] = useState<CustomPromptSettings>(DEFAULT_CUSTOM_PROMPT_SETTINGS);

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

  // 의류 카테고리 업데이트 핸들러
  const handleCategoryUpdate = useCallback((id: string, category: GarmentCategory, confidence: number) => {
    setUploadedImages(prev => prev.map(img =>
      img.id === id ? { ...img, category, categoryConfidence: confidence } : img
    ));
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
            backgroundSpotImages: backgroundSpotImages.map((img) => img.preview),
            poses: settings.poses,
            settings,
            providers: providerConfig,
            promptSettings, // 프롬프트 커스터마이징 설정 추가
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
      {/* Header - Contemporary */}
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="logo-text" style={{ fontSize: '1.5rem' }}>rapport.</span>
              <span className="logo-subtitle" style={{ marginTop: '-2px' }}>STUDIO</span>
            </div>
            <div className="hidden sm:block h-8 w-px" style={{ background: 'var(--border)' }} />
            <span className="hidden sm:block text-xs" style={{ color: 'var(--foreground-muted)' }}>
              AI Fashion Lookbook Generator
            </span>
          </div>

          {/* Right side: Provider + User */}
          <div className="flex items-center gap-3">
            {/* Current Provider Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {providerConfig.imageGeneration}
              </span>
            </div>

            {/* User Menu */}
            {session?.user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)' }}>
                  {session.user.image ? (
                    <img src={session.user.image} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium" style={{ background: 'var(--border)' }}>
                      {session.user.name?.[0] || session.user.email?.[0] || '?'}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {session.user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 rounded-md transition-colors hover:bg-[var(--accent-light)]"
                  title="Sign out"
                >
                  <svg className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-full md:w-[360px] border-r flex-shrink-0 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="p-5 space-y-5">
            {/* Tab Navigation - Contemporary */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'upload', label: 'Upload' },
                { id: 'settings', label: 'Settings' },
                { id: 'prompt', label: 'Prompt' },
                { id: 'provider', label: 'Model' },
                { id: 'training', label: 'Train' },
                { id: 'history', label: 'History' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-1.5 px-3 rounded text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-[var(--foreground)] text-[var(--background)]'
                      : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-light)]'
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
                backgroundSpotImages={backgroundSpotImages}
                onBackgroundSpotUpload={setBackgroundSpotImages}
                maxBackgroundSpotImages={5}
                autoClassify={true}
                onCategoryUpdate={handleCategoryUpdate}
              />
            )}

            {activeTab === 'settings' && (
              <GenerationSettings
                settings={settings}
                onChange={setSettings}
              />
            )}

            {activeTab === 'prompt' && (
              <PromptEditor
                settings={promptSettings}
                onChange={setPromptSettings}
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

            {/* Generate Button - Contemporary */}
            <div className="pt-5 mt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              {error && (
                <div className="mb-4 p-3 rounded text-sm flex items-center gap-2" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || uploadedImages.length === 0}
                className="w-full py-3 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: isGenerating || uploadedImages.length === 0 ? 'var(--border)' : 'var(--foreground)',
                  color: isGenerating || uploadedImages.length === 0 ? 'var(--foreground-muted)' : 'var(--background)',
                  cursor: isGenerating || uploadedImages.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    Generate {settings.totalShots} Images
                  </>
                )}
              </button>

              <p className="text-[11px] text-center mt-2" style={{ color: 'var(--foreground-muted)' }}>
                {settings.poses.length} poses × {settings.shotsPerPose} shots each
              </p>
            </div>
          </div>
        </aside>

        {/* Result Area - Clean */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'var(--background)' }}>
          <ResultGallery
            images={generatedImages}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
            onRegenerate={handleRegenerate}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-3 px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
          <span>© 2025 rapport. STUDIO</span>
          <span>Powered by AI</span>
        </div>
      </footer>
    </div>
  );
}
