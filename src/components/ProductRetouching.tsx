'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadedImage } from '@/types';

// 도식화 방법 타입
type FlatlayMethod = 'sdxl' | 'idm-vton' | 'tps' | 'skeleton';
// 리터칭 방법 타입
type RetouchMethod = 'none' | 'photoroom' | 'edge-inpaint' | 'clipping-magic' | 'pixelcut' | 'magic-refiner-mask' | 'ai-studio';

// 브랜드별 설정
const BRAND_CONFIGS = {
  'dana-peta': {
    name: '다나앤페타',
    format: 'jpg' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: true, // 밑단 아래로 미세하게 떨어지는 자연스러운 그림자
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false, // 비활성화 - SDXL이 화질 저하 유발
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'none' as RetouchMethod,
  },
  'jijae': {
    name: '지재',
    format: 'jpg' as const,
    nukki: false,
    backgroundColor: null,
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'none' as RetouchMethod,
  },
  'marchimara': {
    name: '마치마라',
    format: 'jpg' as const,
    nukki: false,
    backgroundColor: null,
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'none' as RetouchMethod,
  },
  'kream': {
    name: 'KREAM',
    format: 'png' as const,
    nukki: true,
    backgroundColor: null, // 투명
    shadow: false,
    cropWidth: 1120,
    cropHeight: 1120,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'none' as RetouchMethod,
  },
  // 리터칭 테스트용 브랜드들
  'test-baseline': {
    name: '🔬 기준 (누끼만)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'none' as RetouchMethod,
  },
  'test-planA': {
    name: '🧪 Plan A (Photoroom)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'photoroom' as RetouchMethod,
  },
  'test-planB': {
    name: '🧪 Plan B (Real-ESRGAN)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'edge-inpaint' as RetouchMethod,
  },
  'test-planC': {
    name: '🧪 Plan C (Clipping Magic)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'clipping-magic' as RetouchMethod,
  },
  'test-planD': {
    name: '🧪 Plan D (Pixelcut)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'pixelcut' as RetouchMethod,
  },
  'test-planE': {
    name: '🧪 Plan E (Magic Refiner)',
    format: 'png' as const,
    nukki: true,
    backgroundColor: '#F8F8F8',
    shadow: false,
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'magic-refiner-mask' as RetouchMethod,
  },
  'test-planF': {
    name: '🚀 Plan F (IC-Light Studio)',
    format: 'png' as const,
    nukki: true, // BiRefNet 누끼 후 IC-Light로 스튜디오 조명 추가
    backgroundColor: null, // IC-Light가 흰색 배경 생성
    shadow: false, // IC-Light가 자연스러운 그림자 생성
    cropWidth: 2000,
    cropHeight: 3000,
    flatlay: false,
    silhouetteRefine: false,
    flatlayMethod: 'sdxl' as FlatlayMethod,
    retouchMethod: 'ai-studio' as RetouchMethod,
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
  timings?: { step: string; duration: number }[];
}

// 파일을 리사이즈된 base64로 변환하는 함수 (최대 1500px)
function fileToResizedBase64(file: File, maxSize: number = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 리사이즈 필요 여부 확인
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        // Canvas로 리사이즈
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG로 압축 (품질 0.9)
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        console.log(`[Resize] ${img.naturalWidth}x${img.naturalHeight} -> ${width}x${height}, size: ${Math.round(resizedBase64.length / 1024)}KB`);
        resolve(resizedBase64);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 이미지의 실제 콘텐츠 영역(바운딩 박스) 감지
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { top: number; bottom: number; left: number; right: number } {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;

  // 알파 채널이 있는 픽셀 찾기 (투명하지 않은 부분)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // 알파값이 10 이상인 픽셀을 콘텐츠로 간주
      if (alpha > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  return { top, bottom, left, right };
}

// 상단(목 라인) 부드럽게 페더링 처리 - 현재 비활성화
// TODO: 핸드리터칭 레퍼런스 분석 후 재설계 필요
// function applyTopFeathering(...) { ... }

// Canvas를 사용한 이미지 후처리 함수 (개선된 버전)
async function postProcessImage(
  imageUrl: string,
  config: typeof BRAND_CONFIGS[BrandKey]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // 1단계: 원본 이미지에서 콘텐츠 영역 감지
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);

      // 콘텐츠 바운딩 박스 감지
      const bounds = detectContentBounds(tempCtx, img.width, img.height);

      // 콘텐츠 영역 크기
      const contentWidth = bounds.right - bounds.left;
      const contentHeight = bounds.bottom - bounds.top;

      // 2단계: 최종 캔버스 생성
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = config.cropWidth;
      canvas.height = config.cropHeight;

      // 배경색 적용
      if (config.backgroundColor) {
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 3단계: 비율 계산 (핸드리터칭 레퍼런스 기준)
      // 레퍼런스 분석 결과: 의류가 프레임의 약 75-80% 차지
      const contentRatio = contentWidth / contentHeight;
      const canvasRatio = canvas.width / canvas.height;

      // 스케일: 레퍼런스 기준 약 0.78 (상하좌우 여백 약 11%)
      const baseScale = 0.78;

      let drawWidth: number;
      let drawHeight: number;

      if (contentRatio > canvasRatio) {
        // 콘텐츠가 더 넓음 - 가로 기준
        drawWidth = canvas.width * baseScale;
        drawHeight = drawWidth / contentRatio;
      } else {
        // 콘텐츠가 더 높음 - 세로 기준
        drawHeight = canvas.height * baseScale;
        drawWidth = drawHeight * contentRatio;
      }

      // 정중앙 배치 (레퍼런스와 동일)
      const drawX = (canvas.width - drawWidth) / 2;
      const drawY = (canvas.height - drawHeight) / 2;

      // 의류 이미지 그리기 (콘텐츠 영역만)
      // 밑단 아래로 자연스럽게 떨어지는 미세한 그림자 적용
      if (config.shadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
      }

      ctx.drawImage(
        img,
        bounds.left, bounds.top, contentWidth, contentHeight,
        drawX, drawY, drawWidth, drawHeight
      );

      if (config.shadow) {
        ctx.restore();
      }

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
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
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
        // 파일을 리사이즈된 base64로 변환
        const base64Image = await fileToResizedBase64(image.file);

        // API 호출
        console.log(`[Retouch] Sending request for ${image.file.name}...`);
        const response = await fetch('/api/retouch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Image,
            brand: activeBrand,
            config: brandConfig,
          }),
        });

        console.log(`[Retouch] Response status: ${response.status}`);

        // 응답 텍스트를 먼저 읽음
        const responseText = await response.text();
        console.log(`[Retouch] Response body (first 200 chars): ${responseText.slice(0, 200)}`);

        // JSON 파싱 시도
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[Retouch] JSON parse error:', parseError);
          processedImage.status = 'error';
          processedImage.error = `응답 파싱 실패: ${responseText.slice(0, 100)}`;
          setProcessedImages([...results]);
          continue;
        }

        // HTTP 응답 상태 체크
        if (!response.ok) {
          console.error(`[Retouch] HTTP ${response.status}:`, data);
          processedImage.status = 'error';
          processedImage.error = data.error || `HTTP ${response.status} 오류`;
        } else if (data.success) {
          console.log(`[Retouch] Success! Processing image...`);
          // 타이밍 정보 저장
          if (data.timings) {
            processedImage.timings = data.timings;
            console.log(`[Retouch] Timings:`, data.timings.map((t: { step: string; duration: number }) => `${t.step}: ${(t.duration / 1000).toFixed(1)}s`).join(', '));
          }
          // 누끼 처리된 이미지에 배경색/그림자/크롭 적용
          const finalImage = await postProcessImage(data.processedImage, brandConfig);
          processedImage.processedUrl = finalImage;
          processedImage.status = 'completed';
          console.log(`[Retouch] Completed!`);
        } else {
          console.error('[Retouch] API returned error:', data.error);
          processedImage.status = 'error';
          processedImage.error = data.error || '처리 실패';
        }
      } catch (error) {
        console.error('[Retouch] Client error:', error);
        processedImage.status = 'error';
        processedImage.error = error instanceof Error ? error.message : '클라이언트 오류';
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
              <div className="flex justify-between">
                <span>도식화</span>
                <span>{brandConfig.flatlay ? '플랫레이 스타일' : 'X'}</span>
              </div>
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
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            setPreviewImage({ url: img.originalUrl, title: `${img.fileName} - 원본` });
                            setPreviewZoom(1);
                          }}
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
                              className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setPreviewImage({ url: img.processedUrl, title: `${img.fileName} - 결과` });
                                setPreviewZoom(1);
                              }}
                            />
                            <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                              결과
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* 파일명 & 타이밍 & 다운로드 */}
                    <div className="p-2">
                      <div className="flex items-center justify-between">
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
                      {/* 타이밍 정보 표시 */}
                      {img.timings && img.timings.length > 0 && (
                        <div className="mt-1 text-[10px] space-y-0.5" style={{ color: 'var(--foreground-muted)', opacity: 0.7 }}>
                          {img.timings.map((t, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{t.step}</span>
                              <span className="font-mono">{(t.duration / 1000).toFixed(1)}s</span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-0.5 border-t" style={{ borderColor: 'var(--border)' }}>
                            <span>총</span>
                            <span className="font-mono">{(img.timings.reduce((sum, t) => sum + t.duration, 0) / 1000).toFixed(1)}s</span>
                          </div>
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

      {/* 이미지 미리보기 모달 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setPreviewImage(null)}
        >
          {/* 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 줌 컨트롤 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
            <button
              className="p-1 hover:bg-white/10 rounded transition-colors text-white"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewZoom(z => Math.max(0.25, z - 0.25));
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white text-sm min-w-[60px] text-center">{Math.round(previewZoom * 100)}%</span>
            <button
              className="p-1 hover:bg-white/10 rounded transition-colors text-white"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewZoom(z => Math.min(4, z + 0.25));
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              className="p-1 hover:bg-white/10 rounded transition-colors text-white ml-2"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewZoom(1);
              }}
            >
              <span className="text-xs">100%</span>
            </button>
          </div>

          {/* 이미지 제목 */}
          <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded">
            {previewImage.title}
          </div>

          {/* 이미지 */}
          <div
            className="max-w-[90vw] max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="transition-transform duration-200"
              style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
