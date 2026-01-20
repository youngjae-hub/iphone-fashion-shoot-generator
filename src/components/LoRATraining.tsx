'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LoRAModel, LoRAStatus, UploadedImage } from '@/types';

interface LoRATrainingProps {
  onModelReady?: (model: LoRAModel) => void;
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
      const res = await fetch('/api/lora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName,
          description: modelDescription,
          images: trainingImages.map((img) => img.preview),
          triggerWord: triggerWord || undefined,
          trainingSteps,
        }),
      });

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
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
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

        {/* 이미지 업로드 */}
        <div className="space-y-2">
          <label className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            학습 이미지 ({trainingImages.length}/50) - 최소 10장 필요
          </label>

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
