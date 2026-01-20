'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LoRAModel, LoRAStatus, UploadedImage } from '@/types';

interface LoRATrainingProps {
  onModelReady?: (model: LoRAModel) => void;
}

// 이미지 소스 타입
type ImageSourceTab = 'upload' | 'url';

// 이미지 리사이즈 함수 (학습용으로 최적화 - Vercel 4.5MB 제한 대응)
async function resizeImageForTraining(base64: string, maxSize: number = 768): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // 최대 크기 제한 (768px로 줄여서 payload 크기 감소)
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      // JPEG로 압축 (품질 70%로 더 압축)
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64); // 실패 시 원본 반환
    img.src = base64;
  });
}

export default function LoRATraining({ onModelReady }: LoRATrainingProps) {
  // State
  const [trainingImages, setTrainingImages] = useState<UploadedImage[]>([]);
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [triggerWord, setTriggerWord] = useState('');
  const [trainingSteps, setTrainingSteps] = useState(1000);
  const [isTraining, setIsTraining] = useState(false);
  const [currentModel, setCurrentModel] = useState<LoRAModel | null>(null);
  const [models, setModels] = useState<LoRAModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [available, setAvailable] = useState(false);

  // URL 스크래핑 관련 상태
  const [imageSourceTab, setImageSourceTab] = useState<ImageSourceTab>('upload');
  const [scrapeUrls, setScrapeUrls] = useState(''); // 여러 URL을 줄바꿈으로 구분
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 로드: 모델 목록 & 가용성 체크
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch('/api/lora');
        const data = await res.json();
        if (data.success) {
          setModels(data.models);
          setAvailable(data.available);
        }
      } catch (err) {
        console.error('Failed to load LoRA models:', err);
      }
    }
    loadModels();
  }, []);

  // 학습 상태 폴링
  useEffect(() => {
    if (currentModel && currentModel.status === 'training') {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/lora?modelId=${currentModel.id}&checkStatus=true`);
          const data = await res.json();
          if (data.success && data.model) {
            setCurrentModel(data.model);
            setModels((prev) =>
              prev.map((m) => (m.id === data.model.id ? data.model : m))
            );

            if (data.model.status === 'completed') {
              onModelReady?.(data.model);
              if (pollingRef.current) clearInterval(pollingRef.current);
            } else if (data.model.status === 'failed') {
              setError(data.model.error || '학습에 실패했습니다.');
              if (pollingRef.current) clearInterval(pollingRef.current);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 10000); // 10초마다 체크

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [currentModel, onModelReady]);

  // 이미지 업로드 처리
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = 50 - trainingImages.length;
    const filesToProcess = fileArray.slice(0, remainingSlots);

    const newImages: UploadedImage[] = await Promise.all(
      filesToProcess.map(async (file) => {
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        return {
          id: uuidv4(),
          file,
          preview,
          type: 'reference' as const,
        };
      })
    );

    setTrainingImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, [trainingImages.length]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleRemoveImage = (id: string) => {
    setTrainingImages((prev) => prev.filter((img) => img.id !== id));
  };

  // URL에서 이미지 스크래핑 (복수 URL 지원)
  const handleScrapeImages = async () => {
    const urls = scrapeUrls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setError('URL을 입력해주세요.');
      return;
    }

    setIsScraping(true);
    setError(null);

    let totalImages = 0;
    let failedUrls: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const remainingSlots = 50 - trainingImages.length - totalImages;

      if (remainingSlots <= 0) {
        setScrapeProgress('최대 50장에 도달했습니다.');
        break;
      }

      setScrapeProgress(`URL ${i + 1}/${urls.length} 분석 중... (${url.slice(0, 50)}...)`);

      try {
        const res = await fetch('/api/scrape-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            maxImages: remainingSlots,
          }),
        });

        const data = await res.json();

        if (data.success && data.images && data.images.length > 0) {
          // base64 이미지를 UploadedImage 형식으로 변환
          const newImages: UploadedImage[] = data.images.map((base64: string) => ({
            id: uuidv4(),
            file: null as unknown as File,
            preview: base64,
            type: 'reference' as const,
          }));

          setTrainingImages((prev) => [...prev, ...newImages]);
          totalImages += newImages.length;
          setScrapeProgress(`URL ${i + 1}/${urls.length}: ${newImages.length}장 추가 (총 ${totalImages}장)`);
        } else {
          failedUrls.push(url);
        }
      } catch (err) {
        console.error('Scrape error for URL:', url, err);
        failedUrls.push(url);
      }
    }

    // 완료 메시지
    if (totalImages > 0) {
      setScrapeUrls('');
      if (failedUrls.length > 0) {
        setError(`${totalImages}장 추가됨. ${failedUrls.length}개 URL에서 이미지를 찾지 못했습니다.`);
      }
    } else {
      setError('입력한 URL에서 이미지를 찾을 수 없습니다. 다른 URL을 시도해주세요.');
    }

    setIsScraping(false);
    setScrapeProgress(null);
  };

  // 학습 시작
  const handleStartTraining = async () => {
    if (trainingImages.length < 10) {
      setError('최소 10장의 이미지가 필요합니다.');
      return;
    }

    if (!modelName.trim()) {
      setError('모델 이름을 입력해주세요.');
      return;
    }

    setIsTraining(true);
    setError(null);

    try {
      // 이미지 리사이즈 (업로드 크기 최적화 - 768px, JPEG 70%)
      setError(`이미지 ${trainingImages.length}장 최적화 중...`);
      const resizedImages = await Promise.all(
        trainingImages.map((img) => resizeImageForTraining(img.preview, 768))
      );
      setError(null);

      // payload 크기 계산 (디버그용)
      const payload = JSON.stringify({
        name: modelName,
        description: modelDescription,
        images: resizedImages,
        triggerWord: triggerWord || undefined,
        trainingSteps,
      });
      const payloadSizeMB = (new Blob([payload]).size / 1024 / 1024).toFixed(2);
      console.log(`Payload size: ${payloadSizeMB}MB (${resizedImages.length} images)`);

      // Vercel 제한 체크 (4.5MB)
      if (parseFloat(payloadSizeMB) > 4) {
        throw new Error(`요청 크기(${payloadSizeMB}MB)가 너무 큽니다. 이미지 수를 줄여주세요.`);
      }

      const res = await fetch('/api/lora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      // HTTP 에러 체크
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', res.status, errorText);
        throw new Error(`API 오류 (${res.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();

      if (data.success) {
        setCurrentModel(data.model);
        setModels((prev) => [data.model, ...prev]);
        // 입력 초기화
        setTrainingImages([]);
        setModelName('');
        setModelDescription('');
        setTriggerWord('');
      } else {
        setError(data.error || '학습 시작에 실패했습니다.');
      }
    } catch (err: unknown) {
      // 실제 에러 메시지 표시
      let errorMsg = '서버 오류가 발생했습니다.';
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      // fetch 실패 시 추가 정보
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMsg = '네트워크 오류: 요청이 너무 크거나 서버에 연결할 수 없습니다.';
      }
      setError(errorMsg);
      console.error('Training error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  // 모델 삭제
  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('이 모델을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/lora?modelId=${modelId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setModels((prev) => prev.filter((m) => m.id !== modelId));
        if (currentModel?.id === modelId) {
          setCurrentModel(null);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // 예상 비용 계산
  const estimatedCost = ((15 + trainingImages.length * 0.5) * (trainingSteps / 1000) * 60 * 0.001405).toFixed(2);

  // 상태 뱃지 색상
  const getStatusColor = (status: LoRAStatus) => {
    switch (status) {
      case 'completed':
        return 'var(--success)';
      case 'training':
        return 'var(--accent)';
      case 'failed':
        return 'var(--error)';
      default:
        return 'var(--foreground-muted)';
    }
  };

  const getStatusText = (status: LoRAStatus) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'training':
        return '학습 중';
      case 'uploading':
        return '업로드 중';
      case 'failed':
        return '실패';
      default:
        return '대기';
    }
  };

  if (!available) {
    return (
      <div className="p-4 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
        <div className="flex items-center gap-2 text-yellow-500 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Replicate API 키 필요</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          LoRA 학습을 사용하려면 <code className="px-1 py-0.5 rounded" style={{ background: 'var(--background-secondary)' }}>REPLICATE_API_TOKEN</code> 환경 변수를 설정해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="font-semibold">스타일 학습 (LoRA)</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          Beta
        </span>
      </div>

      {/* 현재 학습 중인 모델 상태 */}
      {currentModel && currentModel.status === 'training' && (
        <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
            </svg>
            <div>
              <p className="font-medium">{currentModel.name} 학습 중...</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                약 15-30분 소요됩니다. 페이지를 닫아도 학습은 계속됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {/* 새 모델 학습 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">새 스타일 학습</h4>

        {/* 모델 이름 */}
        <div className="space-y-2">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>모델 이름 *</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="예: 에이블리 스타일"
            className="input w-full"
          />
        </div>

        {/* 설명 */}
        <div className="space-y-2">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>설명 (선택)</label>
          <textarea
            value={modelDescription}
            onChange={(e) => setModelDescription(e.target.value)}
            placeholder="이 스타일에 대한 설명..."
            className="input w-full min-h-[60px] resize-y"
          />
        </div>

        {/* 트리거 워드 */}
        <div className="space-y-2">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>트리거 워드 (선택)</label>
          <input
            type="text"
            value={triggerWord}
            onChange={(e) => setTriggerWord(e.target.value.toUpperCase())}
            placeholder="자동 생성됨 (예: ABLYSTYLE)"
            className="input w-full"
          />
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            이미지 생성 시 이 단어를 프롬프트에 포함하면 학습된 스타일이 적용됩니다.
          </p>
        </div>

        {/* 학습 단계 */}
        <div className="space-y-2">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            학습 단계: <span className="font-bold" style={{ color: 'var(--accent)' }}>{trainingSteps}</span>
          </label>
          <input
            type="range"
            min={500}
            max={2000}
            step={100}
            value={trainingSteps}
            onChange={(e) => setTrainingSteps(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <span>500 (빠름)</span>
            <span>2000 (정밀)</span>
          </div>
        </div>

        {/* 이미지 소스 선택 */}
        <div className="space-y-3">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            학습 이미지 ({trainingImages.length}/50) - 최소 10장 필요
          </label>

          {/* 탭 선택 */}
          <div className="flex rounded-lg p-1" style={{ background: 'var(--background-tertiary)' }}>
            <button
              onClick={() => setImageSourceTab('upload')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                imageSourceTab === 'upload'
                  ? 'bg-[var(--accent)] text-white'
                  : 'hover:bg-[var(--background-secondary)]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              직접 업로드
            </button>
            <button
              onClick={() => setImageSourceTab('url')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                imageSourceTab === 'url'
                  ? 'bg-[var(--accent)] text-white'
                  : 'hover:bg-[var(--background-secondary)]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              URL에서 가져오기
            </button>
          </div>

          {/* 직접 업로드 탭 */}
          {imageSourceTab === 'upload' && (
            <div
              className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
              <div className="text-center">
                <svg className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium">학습용 이미지 업로드</p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  원하는 스타일의 사진 10-50장 (일괄 선택 가능)
                </p>
              </div>
            </div>
          )}

          {/* URL 입력 탭 */}
          {imageSourceTab === 'url' && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={scrapeUrls}
                    onChange={(e) => setScrapeUrls(e.target.value)}
                    placeholder="URL을 한 줄에 하나씩 입력하세요&#10;https://example.com/product1&#10;https://example.com/product2&#10;https://example.com/product3"
                    className="input w-full min-h-[100px] resize-y text-sm"
                    disabled={isScraping}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {scrapeUrls.split('\n').filter(url => url.trim()).length}개 URL 입력됨
                    </span>
                    <button
                      onClick={handleScrapeImages}
                      disabled={isScraping || !scrapeUrls.trim()}
                      className="btn-primary px-4 py-2 flex items-center gap-2"
                    >
                      {isScraping ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                      전체 가져오기
                    </button>
                  </div>
                </div>

                {scrapeProgress && (
                  <p className="text-sm mt-2" style={{ color: 'var(--accent)' }}>
                    {scrapeProgress}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                    지원하는 소스:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Google Drive', icon: '📁' },
                      { name: '에이블리', icon: '👗' },
                      { name: '지그재그', icon: '👚' },
                      { name: '무신사', icon: '👔' },
                      { name: 'W컨셉', icon: '👠' },
                      { name: '기타 웹사이트', icon: '🌐' },
                    ].map((source) => (
                      <span
                        key={source.name}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--background-secondary)' }}
                      >
                        {source.icon} {source.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    💡 상품 페이지, 브랜드 페이지, 또는 Google Drive 폴더 URL을 입력하세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 업로드된 이미지 그리드 */}
          {trainingImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mt-3">
              {trainingImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-lg overflow-hidden"
                  style={{ aspectRatio: '1', background: 'var(--background-tertiary)' }}
                >
                  <img
                    src={image.preview}
                    alt="Training image"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleRemoveImage(image.id)}
                      className="p-1 rounded-full bg-red-500 hover:bg-red-600"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {trainingImages.length > 0 && (
            <div className="flex justify-between items-center text-xs" style={{ color: 'var(--foreground-muted)' }}>
              <span>{trainingImages.length}장 업로드됨</span>
              <button
                onClick={() => setTrainingImages([])}
                className="text-red-400 hover:text-red-300"
              >
                전체 삭제
              </button>
            </div>
          )}
        </div>

        {/* 예상 비용 & 시작 버튼 */}
        <div className="p-4 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm">예상 비용</span>
            <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
              ~${estimatedCost}
            </span>
          </div>
          <button
            onClick={handleStartTraining}
            disabled={isTraining || trainingImages.length < 10 || !modelName.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {isTraining ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                학습 시작 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                스타일 학습 시작
              </>
            )}
          </button>
        </div>
      </div>

      {/* 학습된 모델 목록 */}
      {models.length > 0 && (
        <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <h4 className="text-sm font-medium">학습된 스타일</h4>
          {models.map((model) => (
            <div
              key={model.id}
              className="p-3 rounded-lg border"
              style={{ borderColor: 'var(--border)', background: 'var(--background-secondary)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: getStatusColor(model.status), color: 'white' }}
                  >
                    {getStatusText(model.status)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteModel(model.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {model.description && (
                <p className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>
                  {model.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                <span>트리거: <code className="px-1 rounded" style={{ background: 'var(--background-tertiary)' }}>{model.triggerWord}</code></span>
                <span>이미지: {model.trainingImages.length}장</span>
                {model.estimatedCost && <span>비용: ${model.estimatedCost}</span>}
              </div>
              {model.error && (
                <p className="text-xs mt-2 text-red-400">{model.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
