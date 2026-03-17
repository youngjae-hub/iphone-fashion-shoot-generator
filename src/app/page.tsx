'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ImageUploader,
  ProviderSelector,
  GenerationSettings,
  ResultGallery,
  History,
  type BackgroundSpotMode,
} from '@/components';
import {
  UploadedImage,
  GeneratedImage,
  ProviderConfig,
  GenerationSettings as GenerationSettingsType,
  GenerationSession,
  GarmentCategory,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_POSES,
  PoseType,
  AutoGenerateMode,
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
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'provider' | 'history'>('upload');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 드롭박스 배경 스팟 관련 상태
  const [backgroundSpotMode, setBackgroundSpotMode] = useState<BackgroundSpotMode>('studio');
  const [selectedBackgroundSpot, setSelectedBackgroundSpot] = useState<{
    id: string;
    name: string;
    path: string;
    thumbnailUrl?: string;
    source?: 'dropbox' | 'local';
  } | null>(null);

  // 레퍼런스 포즈 관련 상태
  const [referencePoseImage, setReferencePoseImage] = useState<string | null>(null);
  const [extractedPosePrompt, setExtractedPosePrompt] = useState<string | null>(null);
  const [isAnalyzingPose, setIsAnalyzingPose] = useState(false);
  const [useReferencePose, setUseReferencePose] = useState(false);

  // ⭐️ Phase 2-4: 자동 생성 모드
  const [autoGenerateMode, setAutoGenerateMode] = useState<AutoGenerateMode>(5); // 기본값: 빠른 5컷

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

  // 레퍼런스 포즈 이미지 업로드 핸들러
  const handleReferencePoseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지를 base64로 변환
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setReferencePoseImage(base64);
      setIsAnalyzingPose(true);
      setExtractedPosePrompt(null);

      try {
        const response = await fetch('/api/analyze-pose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceImage: base64 }),
        });

        const data = await response.json();
        if (data.success) {
          setExtractedPosePrompt(data.posePrompt);
          setUseReferencePose(true);
        } else {
          setError(`포즈 분석 실패: ${data.error}`);
        }
      } catch (err) {
        setError('포즈 분석 중 오류가 발생했습니다.');
        console.error('Pose analysis error:', err);
      } finally {
        setIsAnalyzingPose(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // 레퍼런스 포즈 제거
  const handleRemoveReferencePose = useCallback(() => {
    setReferencePoseImage(null);
    setExtractedPosePrompt(null);
    setUseReferencePose(false);
  }, []);

  const handleGenerate = async () => {
    if (uploadedImages.length === 0) {
      setError('누끼 이미지를 먼저 업로드해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const garmentImage = uploadedImages[0].preview;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentImage,
          garmentCategory: uploadedImages[0].category,
          poses: settings.poses,
          settings,
          providers: providerConfig,
          backgroundSpotMode,
          selectedBackgroundSpot: backgroundSpotMode === 'dropbox' ? selectedBackgroundSpot : null,
          // 레퍼런스 포즈 전달 (이미지 + 프롬프트)
          referencePosePrompt: useReferencePose && extractedPosePrompt ? extractedPosePrompt : null,
          referencePoseImage: useReferencePose && referencePoseImage ? referencePoseImage : null,
          // ⭐️ Phase 2-4: 자동 생성 모드
          autoGenerateMode: useReferencePose && referencePoseImage ? 'manual' : autoGenerateMode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedImages((prev) => [...data.images, ...prev]);
        saveToHistory(data.images);

        if (data.warnings && data.warnings.length > 0) {
          const failedCount = data.warnings.length;
          const successCount = data.images.length;
          setError(`⚠️ ${successCount}개 생성 성공, ${failedCount}개 실패:\n${data.warnings.join('\n')}`);
        }
      } else {
        setError(data.error || '이미지 생성에 실패했습니다.');
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
        const createRes = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            garmentImages: [],
            settings,
            providers: providerConfig,
          }),
        });
        const createData = await createRes.json();
        if (createData.success) {
          setCurrentSessionId(createData.session.id);
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
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {providerConfig.imageGeneration}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-[360px] border-r flex-shrink-0 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="p-5 space-y-5">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'upload', label: 'Upload' },
                { id: 'settings', label: 'Settings' },
                { id: 'provider', label: 'Model' },
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
                autoClassify={true}
                onCategoryUpdate={handleCategoryUpdate}
              />
            )}

            {activeTab === 'settings' && (
              <GenerationSettings
                settings={settings}
                onChange={setSettings}
                backgroundSpotMode={backgroundSpotMode}
                onBackgroundSpotModeChange={setBackgroundSpotMode}
                selectedBackgroundSpot={selectedBackgroundSpot}
                onBackgroundSpotSelect={setSelectedBackgroundSpot}
              />
            )}

            {activeTab === 'provider' && (
              <ProviderSelector
                config={providerConfig}
                onChange={setProviderConfig}
                availability={availability}
              />
            )}

            {activeTab === 'history' && (
              <History onLoadSession={loadFromHistory} />
            )}

            {/* Generate Button */}
            <div className="pt-5 mt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              {error && (
                <div className="mb-4 p-3 rounded text-sm flex items-center gap-2" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* ⭐️ Phase 2-4: 자동 생성 모드 선택 */}
              <div className="mb-4" style={{
                opacity: useReferencePose && referencePoseImage ? 0.4 : 1,
                pointerEvents: useReferencePose && referencePoseImage ? 'none' : 'auto',
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                    생성 모드 {useReferencePose && referencePoseImage && <span className="text-[10px] font-normal" style={{ color: 'var(--foreground-muted)' }}>(레퍼런스 모드)</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {/* 빠른 5컷 */}
                  <button
                    onClick={() => setAutoGenerateMode(5)}
                    className={`p-2 rounded-lg border transition-all text-center ${
                      autoGenerateMode === 5
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <div className={`text-sm font-medium ${autoGenerateMode === 5 ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                      빠른 5컷
                    </div>
                    <div className="text-[9px]" style={{ color: 'var(--foreground-muted)' }}>
                      핵심 포즈 자동
                    </div>
                  </button>

                  {/* 풀 10컷 */}
                  <button
                    onClick={() => setAutoGenerateMode(10)}
                    className={`p-2 rounded-lg border transition-all text-center ${
                      autoGenerateMode === 10
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <div className={`text-sm font-medium ${autoGenerateMode === 10 ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                      풀 10컷
                    </div>
                    <div className="text-[9px]" style={{ color: 'var(--foreground-muted)' }}>
                      다양한 포즈
                    </div>
                  </button>

                  {/* 수동 선택 */}
                  <button
                    onClick={() => setAutoGenerateMode('manual')}
                    className={`p-2 rounded-lg border transition-all text-center ${
                      autoGenerateMode === 'manual'
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <div className={`text-sm font-medium ${autoGenerateMode === 'manual' ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                      수동 선택
                    </div>
                    <div className="text-[9px]" style={{ color: 'var(--foreground-muted)' }}>
                      직접 포즈 선택
                    </div>
                  </button>
                </div>

                {/* 복종별 기본 포즈 안내 (자동 모드일 때만 표시) */}
                {autoGenerateMode !== 'manual' && uploadedImages[0]?.category && (
                  <div className="mt-2 p-2 rounded-lg text-[10px]" style={{ background: 'var(--background-tertiary)' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <svg className="w-3 h-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium" style={{ color: 'var(--accent)' }}>
                        {uploadedImages[0].category === 'top' ? '상의' :
                         uploadedImages[0].category === 'bottom' ? '하의' :
                         uploadedImages[0].category === 'outer' ? '아우터' :
                         uploadedImages[0].category === 'dress' ? '원피스' : '의류'} 인식됨 - 기본 포즈
                      </span>
                    </div>
                    <p style={{ color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
                      {uploadedImages[0].category === 'top' && '정면 / 헤어터치 / 사이드 / 기대기 / 앉은'}
                      {uploadedImages[0].category === 'bottom' && '정면 / 측면 / 워킹 / 뒷모습 / 앉은'}
                      {uploadedImages[0].category === 'outer' && '오픈정면 / 클로즈정면 / 측면 / 뒷모습 / 워킹'}
                      {uploadedImages[0].category === 'dress' && '정면 / 측면 / 뒷모습 / 트윌 / 앉은'}
                      {!['top', 'bottom', 'outer', 'dress'].includes(uploadedImages[0].category || '') && '정면 / 측면 / 뒷모습 / 연출 / 앉은'}
                    </p>
                  </div>
                )}
              </div>

              {/* 레퍼런스 모드일 때 안내 메시지 */}
              {autoGenerateMode === 'manual' && useReferencePose && referencePoseImage && (
                <div className="mb-4 p-3 rounded-lg border" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>레퍼런스 포즈 모드</span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    업로드한 레퍼런스 이미지의 <strong>포즈만</strong> 참고하여 1장 생성됩니다.<br/>
                    (배경, 의상, 얼굴은 참고하지 않음)
                  </p>
                </div>
              )}

              {/* 포즈 선택 UI (수동 모드 + 레퍼런스 없을 때만 표시) */}
              <div className="mb-4" style={{
                display: autoGenerateMode === 'manual' && !(useReferencePose && referencePoseImage) ? 'block' : 'none',
              }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                    포즈 선택
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    {settings.poses.length}개 선택됨
                  </span>
                </div>

                {/* 기본 포즈 (1행) */}
                <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                  {/* 정면 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('front')
                        ? settings.poses.filter(p => p !== 'front')
                        : [...settings.poses, 'front' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('front')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('front') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="8" r="5" />
                      <line x1="16" y1="13" x2="16" y2="26" />
                      <line x1="16" y1="17" x2="8" y2="23" />
                      <line x1="16" y1="17" x2="24" y2="23" />
                      <line x1="16" y1="26" x2="11" y2="38" />
                      <line x1="16" y1="26" x2="21" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('front') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>정면</span>
                  </button>

                  {/* 측면 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('side')
                        ? settings.poses.filter(p => p !== 'side')
                        : [...settings.poses, 'side' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('side')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('side') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <ellipse cx="14" cy="8" rx="4" ry="5" />
                      <line x1="14" y1="13" x2="16" y2="26" />
                      <line x1="15" y1="17" x2="22" y2="22" />
                      <line x1="15" y1="17" x2="10" y2="24" />
                      <line x1="16" y1="26" x2="12" y2="38" />
                      <line x1="16" y1="26" x2="20" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('side') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>측면</span>
                  </button>

                  {/* 연출 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('styled')
                        ? settings.poses.filter(p => p !== 'styled')
                        : [...settings.poses, 'styled' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('styled')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('styled') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="8" r="5" />
                      <line x1="16" y1="13" x2="16" y2="26" />
                      <path d="M16 17 L12 20 L14 10" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="16" y1="17" x2="24" y2="24" />
                      <line x1="16" y1="26" x2="11" y2="38" />
                      <line x1="16" y1="26" x2="21" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('styled') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>연출</span>
                  </button>

                  {/* 앉은 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('sitting')
                        ? settings.poses.filter(p => p !== 'sitting')
                        : [...settings.poses, 'sitting' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('sitting')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('sitting') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="8" r="5" />
                      <line x1="16" y1="13" x2="16" y2="24" />
                      <line x1="16" y1="17" x2="10" y2="22" />
                      <line x1="16" y1="17" x2="22" y2="22" />
                      <path d="M16 24 L10 28 L10 38" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16 24 L22 28 L22 38" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('sitting') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>앉은</span>
                  </button>

                  {/* 전신 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('fullbody')
                        ? settings.poses.filter(p => p !== 'fullbody')
                        : [...settings.poses, 'fullbody' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('fullbody')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('fullbody') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="5" r="3.5" />
                      <line x1="16" y1="8.5" x2="16" y2="22" />
                      <line x1="16" y1="12" x2="10" y2="18" />
                      <line x1="16" y1="12" x2="22" y2="18" />
                      <line x1="16" y1="22" x2="11" y2="38" />
                      <line x1="16" y1="22" x2="21" y2="38" />
                      <line x1="11" y1="38" x2="8" y2="38" />
                      <line x1="21" y1="38" x2="24" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('fullbody') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>전신</span>
                  </button>
                </div>

                {/* 추가 포즈 (2행) */}
                <div className="grid grid-cols-5 gap-1.5">
                  {/* 기대기 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('leaning')
                        ? settings.poses.filter(p => p !== 'leaning')
                        : [...settings.poses, 'leaning' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('leaning')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('leaning') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="14" cy="8" r="5" />
                      <line x1="14" y1="13" x2="16" y2="26" />
                      <line x1="15" y1="17" x2="8" y2="22" />
                      <line x1="15" y1="17" x2="22" y2="20" />
                      <line x1="16" y1="26" x2="12" y2="38" />
                      <path d="M16 26 L20 32 L18 38" strokeLinecap="round" strokeLinejoin="round" />
                      {/* 벽/창문 */}
                      <line x1="26" y1="5" x2="26" y2="38" strokeDasharray="2,2" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('leaning') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>기대기</span>
                  </button>

                  {/* 뒷모습 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('back')
                        ? settings.poses.filter(p => p !== 'back')
                        : [...settings.poses, 'back' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('back')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('back') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="8" r="5" />
                      <line x1="16" y1="13" x2="16" y2="26" />
                      {/* 뒷모습 - 팔이 머리 뒤로 */}
                      <path d="M16 17 L12 14 L14 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="16" y1="17" x2="22" y2="22" />
                      <line x1="16" y1="26" x2="11" y2="38" />
                      <line x1="16" y1="26" x2="21" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('back') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>뒷모습</span>
                  </button>

                  {/* 워킹 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('walking')
                        ? settings.poses.filter(p => p !== 'walking')
                        : [...settings.poses, 'walking' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('walking')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('walking') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="6" r="4" />
                      <line x1="16" y1="10" x2="16" y2="22" />
                      {/* 걷는 팔 */}
                      <line x1="16" y1="14" x2="10" y2="20" />
                      <line x1="16" y1="14" x2="22" y2="18" />
                      {/* 걷는 다리 */}
                      <line x1="16" y1="22" x2="8" y2="38" />
                      <line x1="16" y1="22" x2="24" y2="38" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('walking') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>워킹</span>
                  </button>

                  {/* 가방 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('bag')
                        ? settings.poses.filter(p => p !== 'bag')
                        : [...settings.poses, 'bag' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('bag')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('bag') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      <circle cx="16" cy="8" r="5" />
                      <line x1="16" y1="13" x2="16" y2="26" />
                      <line x1="16" y1="17" x2="10" y2="23" />
                      <line x1="16" y1="17" x2="22" y2="23" />
                      <line x1="16" y1="26" x2="11" y2="38" />
                      <line x1="16" y1="26" x2="21" y2="38" />
                      {/* 가방 */}
                      <rect x="4" y="18" width="6" height="8" rx="1" />
                      <line x1="7" y1="18" x2="10" y2="14" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('bag') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>가방</span>
                  </button>

                  {/* 크롭 */}
                  <button
                    onClick={() => {
                      const newPoses = settings.poses.includes('crop')
                        ? settings.poses.filter(p => p !== 'crop')
                        : [...settings.poses, 'crop' as PoseType];
                      if (newPoses.length > 0) {
                        setSettings({ ...settings, poses: newPoses, totalShots: newPoses.length * settings.shotsPerPose });
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                      settings.poses.includes('crop')
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <svg className="w-6 h-8 mb-0.5" viewBox="0 0 32 40" fill="none" stroke={settings.poses.includes('crop') ? 'var(--accent)' : 'var(--foreground-muted)'} strokeWidth="1.5">
                      {/* 머리 없는 상반신 */}
                      <line x1="16" y1="5" x2="16" y2="26" />
                      <line x1="16" y1="10" x2="6" y2="18" />
                      <line x1="16" y1="10" x2="26" y2="18" />
                      {/* 크롭 라인 */}
                      <line x1="4" y1="2" x2="28" y2="2" strokeDasharray="2,2" />
                      <line x1="4" y1="30" x2="28" y2="30" strokeDasharray="2,2" />
                    </svg>
                    <span className={`text-[9px] font-medium ${settings.poses.includes('crop') ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>크롭</span>
                  </button>
                </div>

                {/* 선택된 포즈 설명 */}
                <div className="mt-3 p-2 rounded text-[10px] leading-relaxed max-h-24 overflow-y-auto" style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}>
                  {useReferencePose && referencePoseImage ? (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>레퍼런스 포즈 모드: <strong className="text-[var(--accent)]">1개 이미지</strong>만 생성됩니다</span>
                    </div>
                  ) : settings.poses.length === 0 ? (
                    <span>최소 1개의 포즈를 선택해주세요</span>
                  ) : (
                    <div className="space-y-0.5">
                      {settings.poses.includes('front') && <div><strong className="text-[var(--foreground)]">정면:</strong> 앞에서 바라본 기본 스탠딩</div>}
                      {settings.poses.includes('side') && <div><strong className="text-[var(--foreground)]">측면:</strong> 3/4 각도 실루엣</div>}
                      {settings.poses.includes('styled') && <div><strong className="text-[var(--foreground)]">연출:</strong> 머리 터치 자연스러운 무드</div>}
                      {settings.poses.includes('sitting') && <div><strong className="text-[var(--foreground)]">앉은:</strong> 소파/의자 릴렉스</div>}
                      {settings.poses.includes('fullbody') && <div><strong className="text-[var(--foreground)]">전신:</strong> 머리~발끝 풀샷</div>}
                      {settings.poses.includes('leaning') && <div><strong className="text-[var(--foreground)]">기대기:</strong> 창가/벽에 기대기</div>}
                      {settings.poses.includes('back') && <div><strong className="text-[var(--foreground)]">뒷모습:</strong> 뒤돌아 프로필</div>}
                      {settings.poses.includes('walking') && <div><strong className="text-[var(--foreground)]">워킹:</strong> 걷는 듯한 동적 포즈</div>}
                      {settings.poses.includes('bag') && <div><strong className="text-[var(--foreground)]">가방:</strong> 가방 메고 스타일링</div>}
                      {settings.poses.includes('crop') && <div><strong className="text-[var(--foreground)]">크롭:</strong> 상반신 디테일 컷</div>}
                    </div>
                  )}
                </div>

                {/* 레퍼런스 포즈 업로드 */}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                      레퍼런스 포즈
                    </span>
                    {referencePoseImage && (
                      <button
                        onClick={handleRemoveReferencePose}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)' }}
                      >
                        제거
                      </button>
                    )}
                  </div>

                  {!referencePoseImage ? (
                    <label className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all hover:border-[var(--accent)]" style={{ borderColor: 'var(--border)' }}>
                      <svg className="w-6 h-6 mb-1" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                        레퍼런스 이미지 업로드
                      </span>
                      <span className="text-[9px] mt-0.5 text-center px-2" style={{ color: 'var(--foreground-muted)', opacity: 0.7 }}>
                        동일한 무드 &amp; 포징, 옷만 교체
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReferencePoseUpload}
                      />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      {/* 업로드된 이미지 미리보기 */}
                      <div className="relative w-full h-24 rounded-lg overflow-hidden" style={{ background: 'var(--background-tertiary)' }}>
                        <img
                          src={referencePoseImage}
                          alt="Reference pose"
                          className="w-full h-full object-contain"
                        />
                        {isAnalyzingPose && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                              <span className="text-white text-xs">분석 중...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 추출된 포즈 설명 */}
                      {extractedPosePrompt && (
                        <div className="p-2 rounded text-[10px]" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)' }}>
                          <div className="flex items-center gap-1 mb-1">
                            <svg className="w-3 h-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-medium" style={{ color: 'var(--accent)' }}>포즈 추출 완료</span>
                          </div>
                          <p style={{ color: 'var(--foreground-muted)' }}>{extractedPosePrompt}</p>
                        </div>
                      )}

                      {/* 적용 여부 토글 */}
                      {extractedPosePrompt && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useReferencePose}
                            onChange={(e) => setUseReferencePose(e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                          />
                          <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                            이 포즈를 생성에 적용
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || uploadedImages.length === 0 || (!useReferencePose && settings.poses.length === 0)}
                className="w-full py-3 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: isGenerating || uploadedImages.length === 0 || (!useReferencePose && settings.poses.length === 0) ? 'var(--border)' : 'var(--foreground)',
                  color: isGenerating || uploadedImages.length === 0 || (!useReferencePose && settings.poses.length === 0) ? 'var(--foreground-muted)' : 'var(--background)',
                  cursor: isGenerating || uploadedImages.length === 0 || (!useReferencePose && settings.poses.length === 0) ? 'not-allowed' : 'pointer',
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
                ) : useReferencePose && referencePoseImage ? (
                  <>
                    Generate 1 Image (Reference Pose)
                  </>
                ) : (
                  <>
                    Generate {settings.totalShots} Images
                  </>
                )}
              </button>

              <p className="text-[11px] text-center mt-2" style={{ color: 'var(--foreground-muted)' }}>
                {useReferencePose && referencePoseImage ? (
                  '레퍼런스 포즈 1장 생성'
                ) : (
                  `${settings.poses.length} poses × ${settings.shotsPerPose} shots each`
                )}
              </p>
            </div>
          </div>
        </aside>

        {/* Result Area */}
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
