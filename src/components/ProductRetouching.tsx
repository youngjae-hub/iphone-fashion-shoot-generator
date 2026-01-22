'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadedImage } from '@/types';

// 브랜드별 설정
const BRAND_CONFIGS = {
  'dana-peta': {
    name: '다나앤페타',
    format: 'jpg' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: true,
    cropWidth: 2000,
    cropHeight: 3000,
  },
  'jijae': {
    name: '지재',
    format: 'jpg' as const,
    nukki: false,
    backgroundColor: null,
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
  },
  'marchimara': {
    name: '마치마라',
    format: 'jpg' as const,
    nukki: false,
    backgroundColor: null,
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
  },
  'kream': {
    name: 'KREAM',
    format: 'png' as const,
    nukki: true,
    backgroundColor: null, // 투명
    shadow: false,
    cropWidth: 1120,
    cropHeight: 1120,
  },
} as const;

type BrandKey = keyof typeof BRAND_CONFIGS;

interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string;
  fileName: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
}

// 파일을 base64로 변환하는 함수
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Canvas를 사용한 이미지 후처리 함수
async function postProcessImage(
  imageUrl: string,
  config: typeof BRAND_CONFIGS[BrandKey]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 캔버스 크기 설정
      canvas.width = config.cropWidth;
      canvas.height = config.cropHeight;

      // 배경색 적용 (투명이 아닌 경우)
      if (config.backgroundColor) {
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 이미지 비율 계산 및 중앙 배치
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;

      let drawWidth: number;
      let drawHeight: number;
      let drawX: number;
      let drawY: number;

      // 이미지를 캔버스에 맞추되 여백을 두고 배치 (80% 크기로)
      const scale = 0.85;

      if (imgRatio > canvasRatio) {
        // 이미지가 더 넓음
        drawWidth = canvas.width * scale;
        drawHeight = drawWidth / imgRatio;
      } else {
        // 이미지가 더 높음
        drawHeight = canvas.height * scale;
        drawWidth = drawHeight * imgRatio;
      }

      drawX = (canvas.width - drawWidth) / 2;
      drawY = (canvas.height - drawHeight) / 2;

      // 그림자 추가 (다나앤페타)
      if (config.shadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 20;

        // 그림자를 위한 임시 도형 그리기
        ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
        ctx.beginPath();
        ctx.ellipse(
          canvas.width / 2,
          drawY + drawHeight + 10,
          drawWidth * 0.4,
          15,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      // 이미지 그리기
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      // 포맷에 따라 출력
      const format = config.format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = config.format === 'jpg' ? 0.95 : undefined;

      const dataUrl = canvas.toDataURL(format, quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

export default function ProductRetouching() {
  const [activeBrand, setActiveBrand] = useState<BrandKey>('dana-peta');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandConfig = BRAND_CONFIGS[activeBrand];

  // 파일 업로드 처리
  const processFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    );

    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      file,
      preview: URL.createObjectURL(file),
      type: 'garment' as const,
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
  }, []);

  // 드래그 앤 드롭 핸들러
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
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const handleRemoveImage = useCallback((id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // 이미지 처리 (다나앤페타)
  const handleProcess = async () => {
    if (uploadedImages.length === 0) return;

    setIsProcessing(true);
    const results: ProcessedImage[] = [];

    for (const image of uploadedImages) {
      const processedImage: ProcessedImage = {
        id: image.id,
        originalUrl: image.preview,
        processedUrl: '',
        fileName: image.file.name,
        status: 'processing',
      };
      results.push(processedImage);
      setProcessedImages([...results]);

      try {
        // 파일을 base64로 변환
        const base64Image = await fileToBase64(image.file);

        // API 호출
        const response = await fetch('/api/retouch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Image,
            brand: activeBrand,
            config: brandConfig,
          }),
        });

        const data = await response.json();

        if (data.success) {
          // 누끼 처리된 이미지에 배경색/그림자/크롭 적용
          const finalImage = await postProcessImage(data.processedImage, brandConfig);
          processedImage.processedUrl = finalImage;
          processedImage.status = 'completed';
        } else {
          processedImage.status = 'error';
          processedImage.error = data.error || '처리 실패';
        }
      } catch (error) {
        processedImage.status = 'error';
        processedImage.error = '서버 오류';
      }

      setProcessedImages([...results]);
    }

    setIsProcessing(false);
  };

  // 이미지 다운로드
  const handleDownload = async (image: ProcessedImage) => {
    if (!image.processedUrl) return;

    try {
      const response = await fetch(image.processedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = brandConfig.format;
      const baseName = image.fileName.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_retouched.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // 전체 다운로드
  const handleDownloadAll = async () => {
    const completedImages = processedImages.filter(img => img.status === 'completed');
    for (const image of completedImages) {
      await handleDownload(image);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 브랜드 탭 */}
      <div className="flex gap-1 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {(Object.keys(BRAND_CONFIGS) as BrandKey[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setActiveBrand(key);
              setUploadedImages([]);
              setProcessedImages([]);
            }}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeBrand === key
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-light)]'
            }`}
          >
            {BRAND_CONFIGS[key].name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 업로드 & 설정 */}
        <div className="w-[360px] border-r flex-shrink-0 overflow-y-auto p-5 space-y-5" style={{ borderColor: 'var(--border)' }}>
          {/* 브랜드 설정 표시 */}
          <div className="p-4 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
            <h3 className="text-sm font-medium mb-3">{brandConfig.name} 설정</h3>
            <div className="space-y-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
              <div className="flex justify-between">
                <span>크롭 사이즈</span>
                <span className="font-mono">{brandConfig.cropWidth} × {brandConfig.cropHeight}</span>
              </div>
              <div className="flex justify-between">
                <span>포맷</span>
                <span className="font-mono uppercase">{brandConfig.format}</span>
              </div>
              <div className="flex justify-between">
                <span>누끼</span>
                <span>{brandConfig.nukki ? 'O' : 'X'}</span>
              </div>
              {brandConfig.backgroundColor && (
                <div className="flex justify-between items-center">
                  <span>배경색</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{
                        backgroundColor: brandConfig.backgroundColor,
                        borderColor: 'var(--border)'
                      }}
                    />
                    <span className="font-mono">{brandConfig.backgroundColor}</span>
                  </div>
                </div>
              )}
              {brandConfig.shadow && (
                <div className="flex justify-between">
                  <span>그림자</span>
                  <span>하단 드롭 쉐도우</span>
                </div>
              )}
            </div>
          </div>

          {/* 이미지 업로드 영역 */}
          <div>
            <h3 className="text-sm font-medium mb-3">이미지 업로드</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                isDragOver ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] hover:border-[var(--foreground-muted)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                클릭 또는 드래그하여 업로드
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)', opacity: 0.7 }}>
                행거컷 이미지를 업로드하세요
              </p>
            </div>
          </div>

          {/* 업로드된 이미지 목록 */}
          {uploadedImages.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">업로드됨 ({uploadedImages.length})</h3>
                <button
                  onClick={() => setUploadedImages([])}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--error)' }}
                >
                  전체 삭제
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {uploadedImages.map((img) => (
                  <div key={img.id} className="relative group aspect-[2/3] rounded-md overflow-hidden" style={{ background: 'var(--background-tertiary)' }}>
                    <img
                      src={img.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemoveImage(img.id)}
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
            </div>
          )}

          {/* 처리 버튼 */}
          <button
            onClick={handleProcess}
            disabled={isProcessing || uploadedImages.length === 0}
            className="w-full py-3 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2"
            style={{
              background: isProcessing || uploadedImages.length === 0 ? 'var(--border)' : 'var(--foreground)',
              color: isProcessing || uploadedImages.length === 0 ? 'var(--foreground-muted)' : 'var(--background)',
              cursor: isProcessing || uploadedImages.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {isProcessing ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                처리 중...
              </>
            ) : (
              <>리터칭 시작 ({uploadedImages.length}장)</>
            )}
          </button>
        </div>

        {/* 우측: 결과 영역 */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {processedImages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--border)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p style={{ color: 'var(--foreground-muted)' }}>
                  이미지를 업로드하고 리터칭을 시작하세요
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">
                  결과 ({processedImages.filter(img => img.status === 'completed').length}/{processedImages.length})
                </h2>
                {processedImages.some(img => img.status === 'completed') && (
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors"
                    style={{ background: 'var(--background-secondary)', color: 'var(--foreground)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    전체 다운로드
                  </button>
                )}
              </div>

              {/* 결과 그리드 */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {processedImages.map((img) => (
                  <div
                    key={img.id}
                    className="rounded-lg overflow-hidden"
                    style={{ background: 'var(--background-secondary)' }}
                  >
                    {/* 원본 → 결과 비교 */}
                    <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)' }}>
                      {/* 원본 */}
                      <div className="aspect-[2/3] relative" style={{ background: 'var(--background-tertiary)' }}>
                        <img
                          src={img.originalUrl}
                          alt="원본"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                          원본
                        </span>
                      </div>
                      {/* 결과 */}
                      <div
                        className="aspect-[2/3] relative flex items-center justify-center"
                        style={{
                          background: brandConfig.nukki && !brandConfig.backgroundColor
                            ? 'repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50% / 16px 16px'
                            : brandConfig.backgroundColor || 'var(--background-tertiary)'
                        }}
                      >
                        {img.status === 'processing' ? (
                          <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--foreground-muted)' }} viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                        ) : img.status === 'error' ? (
                          <div className="text-center p-2">
                            <svg className="w-6 h-6 mx-auto mb-1" style={{ color: 'var(--error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px]" style={{ color: 'var(--error)' }}>{img.error}</span>
                          </div>
                        ) : (
                          <>
                            <img
                              src={img.processedUrl}
                              alt="결과"
                              className="w-full h-full object-contain"
                            />
                            <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                              결과
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* 파일명 & 다운로드 */}
                    <div className="p-2 flex items-center justify-between">
                      <span className="text-xs truncate" style={{ color: 'var(--foreground-muted)' }}>
                        {img.fileName}
                      </span>
                      {img.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(img)}
                          className="p-1 rounded hover:bg-[var(--accent-light)] transition-colors"
                        >
                          <svg className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
