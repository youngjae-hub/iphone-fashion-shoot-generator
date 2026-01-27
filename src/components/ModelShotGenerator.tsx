'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadedImage } from '@/types';

// 모델 템플릿 정의
interface ModelTemplate {
  id: string;
  name: string;
  category: 'female' | 'male' | 'child';
  pose: string;
  poseDescription: string;
  thumbnail: string;
  modelImageUrl: string; // base64 또는 URL
  isCustom?: boolean;
}

// 기본 제공 모델 템플릿 (Unsplash 이미지 - 테스트/데모용)
const DEFAULT_MODEL_TEMPLATES: ModelTemplate[] = [
  // 여성 모델
  {
    id: 'female-front-1',
    name: '여성 정면 1',
    category: 'female',
    pose: 'front',
    poseDescription: '정면, 양손 자연스럽게 내림',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=768&h=1024&fit=crop',
  },
  {
    id: 'female-front-2',
    name: '여성 정면 2',
    category: 'female',
    pose: 'front',
    poseDescription: '정면, 한손 주머니',
    thumbnail: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=768&h=1024&fit=crop',
  },
  {
    id: 'female-side-1',
    name: '여성 측면',
    category: 'female',
    pose: 'side',
    poseDescription: '45도 측면, 자연스러운 자세',
    thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=768&h=1024&fit=crop',
  },
  {
    id: 'female-dynamic-1',
    name: '여성 워킹',
    category: 'female',
    pose: 'walking',
    poseDescription: '걷는 자세, 다리 벌림',
    thumbnail: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=768&h=1024&fit=crop',
  },
  {
    id: 'female-dynamic-2',
    name: '여성 에디토리얼',
    category: 'female',
    pose: 'editorial',
    poseDescription: '역동적 포즈, 패션 매거진 스타일',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=768&h=1024&fit=crop',
  },
  // 남성 모델
  {
    id: 'male-front-1',
    name: '남성 정면 1',
    category: 'male',
    pose: 'front',
    poseDescription: '정면, 양손 자연스럽게',
    thumbnail: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=768&h=1024&fit=crop',
  },
  {
    id: 'male-side-1',
    name: '남성 측면',
    category: 'male',
    pose: 'side',
    poseDescription: '측면, 캐주얼 자세',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=267&fit=crop',
    modelImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=768&h=1024&fit=crop',
  },
];

// 배경 옵션
interface BackgroundOption {
  id: string;
  name: string;
  color?: string;
  gradient?: string;
  image?: string;
}

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'white', name: '화이트', color: '#FFFFFF' },
  { id: 'light-gray', name: '라이트 그레이', color: '#F5F5F5' },
  { id: 'warm-beige', name: '웜 베이지', color: '#F5F0E8' },
  { id: 'soft-gradient', name: '소프트 그라데이션', gradient: 'linear-gradient(180deg, #FAFAFA 0%, #E8E8E8 100%)' },
  { id: 'studio-gray', name: '스튜디오 그레이', gradient: 'radial-gradient(ellipse at center, #F0F0F0 0%, #D0D0D0 100%)' },
];

// 생성 결과
interface GeneratedResult {
  id: string;
  templateId: string;
  garmentImageUrl: string;
  resultImageUrl: string;
  enhancedImageUrl?: string; // HD 업스케일된 이미지
  backgroundId: string;
  status: 'generating' | 'completed' | 'error';
  enhanceStatus?: 'idle' | 'enhancing' | 'completed' | 'error';
  error?: string;
  createdAt: Date;
}

// 의류 카테고리
type GarmentCategory = 'upper_body' | 'lower_body' | 'dresses';

export default function ModelShotGenerator() {
  // State
  const [garmentImages, setGarmentImages] = useState<UploadedImage[]>([]);
  const [customModels, setCustomModels] = useState<ModelTemplate[]>([]); // 사용자 업로드 모델
  const [selectedTemplate, setSelectedTemplate] = useState<ModelTemplate | null>(null);
  const [showCustomModelSection, setShowCustomModelSection] = useState(false); // 커스텀 모델 섹션 토글
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>(BACKGROUND_OPTIONS[0]);
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>('upper_body');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'female' | 'male' | 'child'>('female');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isModelDragOver, setIsModelDragOver] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string } | null>(null);
  const [showModelUploadForm, setShowModelUploadForm] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelCategory, setNewModelCategory] = useState<'female' | 'male' | 'child'>('female');
  const [newModelPose, setNewModelPose] = useState('front');
  const [pendingModelFile, setPendingModelFile] = useState<{ file: File; preview: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  // 모든 템플릿 (기본 + 커스텀)
  const allTemplates = [...DEFAULT_MODEL_TEMPLATES, ...customModels];

  // 필터된 템플릿
  const filteredTemplates = allTemplates.filter(
    (t: ModelTemplate) => categoryFilter === 'all' || t.category === categoryFilter
  );

  // 의류 파일 업로드 처리
  const processGarmentFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    );

    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      file,
      preview: URL.createObjectURL(file),
      type: 'garment' as const,
    }));

    setGarmentImages(prev => [...prev, ...newImages]);
    if (newImages.length > 0 && activeStep === 1) {
      setActiveStep(2);
    }
  }, [activeStep]);

  // 모델 이미지 업로드 처리
  const processModelFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPendingModelFile({
        file,
        preview: reader.result as string,
      });
      setShowModelUploadForm(true);
    };
    reader.readAsDataURL(file);
  }, []);

  // 모델 템플릿 저장
  const saveModelTemplate = () => {
    if (!pendingModelFile || !newModelName) return;

    const newTemplate: ModelTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: newModelName,
      category: newModelCategory,
      pose: newModelPose,
      poseDescription: `${newModelCategory === 'female' ? '여성' : newModelCategory === 'male' ? '남성' : '아동'} ${newModelPose}`,
      thumbnail: pendingModelFile.preview,
      modelImageUrl: pendingModelFile.preview,
      isCustom: true,
    };

    setCustomModels(prev => [...prev, newTemplate]);

    // 폼 리셋
    setPendingModelFile(null);
    setShowModelUploadForm(false);
    setNewModelName('');
    setNewModelCategory('female');
    setNewModelPose('front');
  };

  // 커스텀 모델 삭제
  const deleteCustomModel = (id: string) => {
    setCustomModels(prev => prev.filter(m => m.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
    }
  };

  // 드래그 앤 드롭 - 의류
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      processGarmentFiles(e.dataTransfer.files);
    }
  }, [processGarmentFiles]);

  // 드래그 앤 드롭 - 모델
  const handleModelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsModelDragOver(true);
  }, []);

  const handleModelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsModelDragOver(false);
  }, []);

  const handleModelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsModelDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processModelFile(file);
    }
  }, [processModelFile]);

  // 템플릿 선택
  const handleSelectTemplate = (template: ModelTemplate) => {
    setSelectedTemplate(template);
    if (garmentImages.length > 0) {
      setActiveStep(3);
    }
  };

  // 모델컷 생성
  const handleGenerate = async () => {
    if (!selectedTemplate || garmentImages.length === 0) return;

    setIsGenerating(true);

    for (const garment of garmentImages) {
      const result: GeneratedResult = {
        id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        templateId: selectedTemplate.id,
        garmentImageUrl: garment.preview,
        resultImageUrl: '',
        backgroundId: selectedBackground.id,
        status: 'generating',
        createdAt: new Date(),
      };
      setResults(prev => [result, ...prev]);

      try {
        // 파일을 base64로 변환
        const garmentBase64 = await fileToBase64(garment.file);

        // API 호출
        const response = await fetch('/api/model-shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garmentImage: garmentBase64,
            modelImage: selectedTemplate.modelImageUrl, // 커스텀 모델 이미지 전송
            templateId: selectedTemplate.id,
            pose: selectedTemplate.pose,
            category: garmentCategory,
            backgroundId: selectedBackground.id,
            isCustomModel: selectedTemplate.isCustom,
          }),
        });

        const data = await response.json();

        if (data.success && data.resultImage) {
          result.resultImageUrl = data.resultImage;
          result.status = 'completed';
        } else {
          result.status = 'error';
          result.error = data.error || '생성 실패';
        }
      } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : '알 수 없는 오류';
      }

      setResults(prev => prev.map(r => r.id === result.id ? result : r));
    }

    setIsGenerating(false);
  };

  // 다운로드
  const handleDownload = async (result: GeneratedResult, useEnhanced = false) => {
    const imageUrl = useEnhanced && result.enhancedImageUrl ? result.enhancedImageUrl : result.resultImageUrl;
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model_shot_${result.id}${useEnhanced ? '_HD' : ''}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // HD 업스케일
  const handleEnhance = async (result: GeneratedResult) => {
    if (!result.resultImageUrl || result.enhanceStatus === 'enhancing') return;

    // 상태 업데이트 - enhancing
    setResults(prev => prev.map(r =>
      r.id === result.id ? { ...r, enhanceStatus: 'enhancing' as const } : r
    ));

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: result.resultImageUrl,
          scale: "200%", // 2배 업스케일
          mode: "smart_enhance",
        }),
      });

      const data = await response.json();

      if (data.success && data.enhancedImageUrl) {
        setResults(prev => prev.map(r =>
          r.id === result.id ? {
            ...r,
            enhancedImageUrl: data.enhancedImageUrl,
            enhanceStatus: 'completed' as const
          } : r
        ));
      } else {
        setResults(prev => prev.map(r =>
          r.id === result.id ? { ...r, enhanceStatus: 'error' as const } : r
        ));
      }
    } catch (error) {
      console.error('Enhance error:', error);
      setResults(prev => prev.map(r =>
        r.id === result.id ? { ...r, enhanceStatus: 'error' as const } : r
      ));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 스텝 인디케이터 */}
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border)', background: 'var(--background-secondary)' }}>
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          {[
            { step: 1, label: '의류 업로드' },
            { step: 2, label: '모델 선택' },
            { step: 3, label: '생성 & 편집' },
          ].map((item, idx) => (
            <div key={item.step} className="flex items-center">
              <button
                onClick={() => {
                  if (item.step === 1) setActiveStep(1);
                  else if (item.step === 2 && garmentImages.length > 0) setActiveStep(2);
                  else if (item.step === 3 && selectedTemplate) setActiveStep(3);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  activeStep === item.step
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : activeStep > item.step
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]'
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium"
                  style={{
                    background: activeStep >= item.step ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                  }}
                >
                  {activeStep > item.step ? '✓' : item.step}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
              {idx < 2 && (
                <div className="w-12 h-px mx-2" style={{ background: activeStep > item.step ? 'var(--success)' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 업로드 & 설정 */}
        <div className="w-[400px] border-r flex-shrink-0 overflow-y-auto p-5 space-y-5" style={{ borderColor: 'var(--border)' }}>

          {/* Step 1: 의류 업로드 */}
          <div className={activeStep === 1 ? '' : 'opacity-60'}>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={{ background: garmentImages.length > 0 ? 'var(--success)' : 'var(--border)', color: garmentImages.length > 0 ? 'white' : 'var(--foreground-muted)' }}>
                {garmentImages.length > 0 ? '✓' : '1'}
              </span>
              의류 이미지 업로드
            </h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                isDragOver ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && processGarmentFiles(e.target.files)}
                className="hidden"
              />
              <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                의류 사진을 드래그하거나 클릭
              </p>
            </div>

            {/* 업로드된 의류 */}
            {garmentImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {garmentImages.map((img) => (
                  <div key={img.id} className="relative group aspect-[3/4] rounded-md overflow-hidden" style={{ background: 'var(--background-tertiary)' }}>
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setGarmentImages(prev => prev.filter(g => g.id !== img.id))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.7)' }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 의류 카테고리 선택 */}
            {garmentImages.length > 0 && (
              <div className="mt-3">
                <label className="text-xs mb-2 block" style={{ color: 'var(--foreground-muted)' }}>의류 종류</label>
                <div className="flex gap-2">
                  {[
                    { id: 'upper_body', label: '상의' },
                    { id: 'lower_body', label: '하의' },
                    { id: 'dresses', label: '원피스' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setGarmentCategory(cat.id as GarmentCategory)}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                        garmentCategory === cat.id
                          ? 'bg-[var(--foreground)] text-[var(--background)]'
                          : 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: 모델 템플릿 선택 */}
          {garmentImages.length > 0 && (
            <div className={activeStep >= 2 ? '' : 'opacity-60'}>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: selectedTemplate ? 'var(--success)' : 'var(--border)', color: selectedTemplate ? 'white' : 'var(--foreground-muted)' }}>
                  {selectedTemplate ? '✓' : '2'}
                </span>
                모델 템플릿 선택
              </h3>

              {/* 카테고리 필터 */}
              <div className="flex gap-1 mb-3">
                {[
                  { id: 'female', label: '여성' },
                  { id: 'male', label: '남성' },
                  { id: 'all', label: '전체' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id as typeof categoryFilter)}
                    className={`py-1.5 px-3 rounded text-xs font-medium transition-all ${
                      categoryFilter === cat.id
                        ? 'bg-[var(--foreground)] text-[var(--background)]'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 템플릿 그리드 */}
              <div className="grid grid-cols-3 gap-2">
                {filteredTemplates.map((template: ModelTemplate) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`aspect-[3/4] rounded-lg overflow-hidden relative group transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'ring-2 ring-[var(--accent)]'
                        : 'hover:ring-1 ring-[var(--border)]'
                    }`}
                    style={{ background: 'var(--background-tertiary)' }}
                  >
                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                      <span className="text-[10px] text-white flex items-center gap-1">
                        {template.isCustom && <span className="text-[8px] px-1 rounded" style={{ background: 'var(--accent)' }}>MY</span>}
                        {template.name}
                      </span>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {/* 커스텀 모델 삭제 버튼 */}
                    {template.isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomModel(template.id);
                        }}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(239, 68, 68, 0.9)' }}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </button>
                ))}
              </div>

              {/* 커스텀 모델 추가 (옵셔널) */}
              <button
                onClick={() => setShowCustomModelSection(!showCustomModelSection)}
                className="mt-3 w-full py-2 px-3 rounded-md text-xs flex items-center justify-center gap-2 transition-all"
                style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
              >
                <svg className={`w-4 h-4 transition-transform ${showCustomModelSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                내 모델 이미지 추가 (선택사항)
              </button>

              {/* 커스텀 모델 업로드 섹션 (접이식) */}
              {showCustomModelSection && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>
                    직접 촬영한 모델 사진을 업로드하면 더 좋은 품질의 결과물을 얻을 수 있습니다.
                  </p>
                  <div
                    onClick={() => modelFileInputRef.current?.click()}
                    onDragOver={handleModelDragOver}
                    onDragLeave={handleModelDragLeave}
                    onDrop={handleModelDrop}
                    className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                      isModelDragOver ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
                    }`}
                  >
                    <input
                      ref={modelFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && processModelFile(e.target.files[0])}
                      className="hidden"
                    />
                    <svg className="w-6 h-6 mx-auto mb-1" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      모델 이미지 업로드
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 배경 선택 & 생성 */}
          {selectedTemplate && (
            <div className={activeStep === 3 ? '' : 'opacity-60'}>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  3
                </span>
                배경 & 생성
              </h3>

              {/* 배경 옵션 */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {BACKGROUND_OPTIONS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg)}
                    className={`aspect-square rounded-lg overflow-hidden transition-all ${
                      selectedBackground.id === bg.id
                        ? 'ring-2 ring-[var(--accent)]'
                        : 'ring-1 ring-[var(--border)] hover:ring-[var(--foreground-muted)]'
                    }`}
                    style={{
                      background: bg.gradient || bg.color || `url(${bg.image}) center/cover`,
                    }}
                    title={bg.name}
                  />
                ))}
              </div>

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || garmentImages.length === 0 || !selectedTemplate}
                className="w-full py-3 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: isGenerating ? 'var(--border)' : 'var(--foreground)',
                  color: isGenerating ? 'var(--foreground-muted)' : 'var(--background)',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    생성 중... (약 20초)
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    모델컷 생성 ({garmentImages.length}장)
                  </>
                )}
              </button>

              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--foreground-muted)' }}>
                IDM-VTON 모델 사용 · 약 $0.025/장
              </p>
            </div>
          )}
        </div>

        {/* 우측: 결과 영역 */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {results.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <svg className="w-20 h-20 mx-auto mb-4" style={{ color: 'var(--border)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="text-lg font-medium mb-2">AI 모델컷 생성기</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
                  의류 사진을 업로드하고<br />모델을 선택하면 AI가 착장샷을 생성합니다
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <span className="px-2 py-1 rounded-full" style={{ background: 'var(--background-secondary)' }}>1. 의류 업로드</span>
                  <span className="px-2 py-1 rounded-full" style={{ background: 'var(--background-secondary)' }}>2. 모델 선택</span>
                  <span className="px-2 py-1 rounded-full" style={{ background: 'var(--background-secondary)' }}>3. 생성</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">
                  생성 결과 ({results.filter(r => r.status === 'completed').length}/{results.length})
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-lg overflow-hidden"
                    style={{ background: 'var(--background-secondary)' }}
                  >
                    <div className="aspect-[3/4] relative flex items-center justify-center"
                      style={{
                        background: selectedBackground.gradient || selectedBackground.color || 'var(--background-tertiary)',
                      }}
                    >
                      {result.status === 'generating' ? (
                        <div className="text-center">
                          <svg className="w-10 h-10 animate-spin mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>생성 중...</span>
                        </div>
                      ) : result.status === 'error' ? (
                        <div className="text-center p-4">
                          <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs" style={{ color: 'var(--error)' }}>{result.error}</span>
                        </div>
                      ) : (
                        <img
                          src={result.resultImageUrl}
                          alt="결과"
                          className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewModal({ url: result.resultImageUrl, title: '생성 결과' })}
                        />
                      )}
                    </div>

                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs truncate" style={{ color: 'var(--foreground-muted)' }}>
                        {allTemplates.find((t: ModelTemplate) => t.id === result.templateId)?.name || '알 수 없음'}
                      </span>
                      {result.status === 'completed' && (
                        <div className="flex items-center gap-1">
                          {/* HD 업스케일 버튼 */}
                          {result.enhanceStatus === 'completed' ? (
                            <button
                              onClick={() => handleDownload(result, true)}
                              className="p-1 rounded hover:bg-[var(--accent-light)] transition-colors flex items-center gap-0.5"
                              title="HD 이미지 다운로드"
                            >
                              <span className="text-[10px] font-bold" style={{ color: 'var(--success)' }}>HD</span>
                              <svg className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnhance(result)}
                              disabled={result.enhanceStatus === 'enhancing'}
                              className="p-1 rounded hover:bg-[var(--accent-light)] transition-colors"
                              title="HD 업스케일 (2배)"
                            >
                              {result.enhanceStatus === 'enhancing' ? (
                                <svg className="w-4 h-4 animate-spin" style={{ color: 'var(--foreground-muted)' }} viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <span className="text-[10px] font-bold px-1" style={{ color: 'var(--foreground-muted)' }}>HD</span>
                              )}
                            </button>
                          )}
                          {/* 다운로드 버튼 */}
                          <button
                            onClick={() => handleDownload(result)}
                            className="p-1 rounded hover:bg-[var(--accent-light)] transition-colors"
                            title="원본 다운로드"
                          >
                            <svg className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모델 업로드 폼 모달 */}
      {showModelUploadForm && pendingModelFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowModelUploadForm(false)}>
          <div
            className="rounded-lg p-6 max-w-md w-full mx-4"
            style={{ background: 'var(--background-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-4">모델 템플릿 추가</h3>

            <div className="flex gap-4 mb-4">
              <div className="w-32 aspect-[3/4] rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--background-tertiary)' }}>
                <img src={pendingModelFile.preview} alt="미리보기" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--foreground-muted)' }}>이름</label>
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="예: 여성 정면 1"
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--foreground-muted)' }}>성별</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'female', label: '여성' },
                      { id: 'male', label: '남성' },
                      { id: 'child', label: '아동' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setNewModelCategory(cat.id as 'female' | 'male' | 'child')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs transition-all ${
                          newModelCategory === cat.id
                            ? 'bg-[var(--foreground)] text-[var(--background)]'
                            : 'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--foreground-muted)' }}>포즈</label>
                  <select
                    value={newModelPose}
                    onChange={(e) => setNewModelPose(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border)' }}
                  >
                    <option value="front">정면</option>
                    <option value="side">측면</option>
                    <option value="back">뒷면</option>
                    <option value="walking">워킹</option>
                    <option value="editorial">에디토리얼</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowModelUploadForm(false)}
                className="flex-1 py-2 rounded-md text-sm"
                style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
              >
                취소
              </button>
              <button
                onClick={saveModelTemplate}
                disabled={!newModelName}
                className="flex-1 py-2 rounded-md text-sm font-medium"
                style={{
                  background: newModelName ? 'var(--foreground)' : 'var(--border)',
                  color: newModelName ? 'var(--background)' : 'var(--foreground-muted)',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setPreviewModal(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setPreviewModal(null)}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewModal.url}
            alt={previewModal.title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// 유틸리티 함수
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
