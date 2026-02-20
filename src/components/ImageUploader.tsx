'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadedImage, GarmentCategory } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ImageUploaderProps {
  onUpload: (images: UploadedImage[]) => void;
  uploadedImages: UploadedImage[];
  onRemove: (id: string) => void;
  maxImages?: number;
  styleReferenceImages?: UploadedImage[];
  onStyleReferenceUpload?: (images: UploadedImage[]) => void;
  maxStyleReferenceImages?: number;
  backgroundSpotImages?: UploadedImage[];
  onBackgroundSpotUpload?: (images: UploadedImage[]) => void;
  maxBackgroundSpotImages?: number;
  autoClassify?: boolean; // 자동 분류 활성화
  onCategoryUpdate?: (id: string, category: GarmentCategory, confidence: number) => void;
}

// 카테고리 한글 라벨
const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  top: '상의',
  bottom: '하의',
  dress: '원피스',
  outer: '아우터',
  accessory: '액세서리',
  unknown: '미분류',
};

// 이미지를 JPEG로 변환 (webp 호환성 문제 해결)
async function convertImageToJPEG(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        // 항상 JPEG로 변환 (webp 호환성 문제 해결)
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(jpegDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function ImageUploader({
  onUpload,
  uploadedImages,
  onRemove,
  maxImages = 5,
  styleReferenceImages = [],
  onStyleReferenceUpload,
  maxStyleReferenceImages = 10,
  backgroundSpotImages = [],
  onBackgroundSpotUpload,
  maxBackgroundSpotImages = 5,
  autoClassify = true,
  onCategoryUpdate,
}: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isStyleDragOver, setIsStyleDragOver] = useState(false);
  const [isBackgroundSpotDragOver, setIsBackgroundSpotDragOver] = useState(false);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const backgroundSpotInputRef = useRef<HTMLInputElement>(null);

  // AI 분류 호출
  const classifyGarment = async (imageId: string, imageBase64: string) => {
    setClassifyingIds(prev => new Set(prev).add(imageId));
    try {
      const response = await fetch('/api/classify-garment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });
      const data = await response.json();
      if (data.success && onCategoryUpdate) {
        onCategoryUpdate(imageId, data.category, data.confidence);
      }
    } catch (err) {
      console.error('Classification error:', err);
    } finally {
      setClassifyingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  // 수동 카테고리 변경
  const handleManualCategoryChange = (imageId: string, category: GarmentCategory) => {
    if (onCategoryUpdate) {
      onCategoryUpdate(imageId, category, 1.0); // 수동 선택은 신뢰도 100%
    }
  };

  const processFiles = useCallback(
    async (files: FileList | File[], type: 'garment' | 'style-reference' | 'background-spot' = 'garment') => {
      const fileArray = Array.from(files);

      if (type === 'style-reference') {
        // 스타일 참조 이미지 - 최대 maxStyleReferenceImages개까지
        const remainingSlots = maxStyleReferenceImages - styleReferenceImages.length;
        const filesToProcess = fileArray.slice(0, remainingSlots);

        const newImages: UploadedImage[] = await Promise.all(
          filesToProcess.map(async (file) => {
            const preview = await convertImageToJPEG(file);

            return {
              id: uuidv4(),
              file,
              preview,
              type: 'style-reference' as const,
            };
          })
        );

        onStyleReferenceUpload?.([...styleReferenceImages, ...newImages]);
        return;
      }

      if (type === 'background-spot') {
        // 배경 스팟 이미지 - 최대 maxBackgroundSpotImages개까지
        const remainingSlots = maxBackgroundSpotImages - backgroundSpotImages.length;
        const filesToProcess = fileArray.slice(0, remainingSlots);

        const newImages: UploadedImage[] = await Promise.all(
          filesToProcess.map(async (file) => {
            const preview = await convertImageToJPEG(file);

            return {
              id: uuidv4(),
              file,
              preview,
              type: 'background-spot' as const,
            };
          })
        );

        onBackgroundSpotUpload?.([...backgroundSpotImages, ...newImages]);
        return;
      }

      const remainingSlots = maxImages - uploadedImages.length;
      const filesToProcess = fileArray.slice(0, remainingSlots);

      const newImages: UploadedImage[] = await Promise.all(
        filesToProcess.map(async (file) => {
          const preview = await convertImageToJPEG(file);

          const id = uuidv4();
          return {
            id,
            file,
            preview,
            type: 'garment' as const,
          };
        })
      );

      onUpload(newImages);

      // 자동 분류 실행
      if (autoClassify) {
        for (const img of newImages) {
          classifyGarment(img.id, img.preview);
        }
      }
    },
    [maxImages, uploadedImages.length, onUpload, onStyleReferenceUpload, styleReferenceImages, maxStyleReferenceImages, onBackgroundSpotUpload, backgroundSpotImages, maxBackgroundSpotImages, autoClassify, classifyGarment]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files, 'garment');
      }
    },
    [processFiles]
  );

  const handleStyleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsStyleDragOver(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files, 'style-reference');
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleStyleClick = () => {
    styleInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files, 'garment');
    }
  };

  const handleStyleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files, 'style-reference');
    }
  };

  const handleBackgroundSpotDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsBackgroundSpotDragOver(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files, 'background-spot');
      }
    },
    [processFiles]
  );

  const handleBackgroundSpotClick = () => {
    backgroundSpotInputRef.current?.click();
  };

  const handleBackgroundSpotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files, 'background-spot');
    }
  };

  // URL에서 이미지 크롤링
  const handleUrlFetch = async () => {
    if (!urlInput.trim()) {
      setUrlError('URL을 입력하세요');
      return;
    }

    setIsLoadingUrl(true);
    setUrlError('');

    try {
      const response = await fetch('/api/scrape-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput, maxImages: maxImages - uploadedImages.length }),
      });

      const data = await response.json();

      if (!data.success) {
        setUrlError(data.error || '이미지를 가져올 수 없습니다');
        return;
      }

      if (!data.images || data.images.length === 0) {
        setUrlError('이미지를 찾을 수 없습니다');
        return;
      }

      // base64 이미지를 JPEG로 변환 (webp 호환성 문제 해결)
      const convertedImages = await Promise.all(
        data.images.map(async (base64: string) => {
          try {
            // 이미 base64인 경우 JPEG로 변환
            return await new Promise<string>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Canvas context not available'));
                  return;
                }
                ctx.drawImage(img, 0, 0);
                const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
                resolve(jpegDataUrl);
              };
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = base64;
            });
          } catch {
            // 변환 실패 시 원본 사용
            return base64;
          }
        })
      );

      const newImages: UploadedImage[] = convertedImages.map((preview) => ({
        id: uuidv4(),
        preview,
        type: 'garment' as const,
      }));

      onUpload(newImages);

      // 자동 분류 실행
      if (autoClassify) {
        for (const img of newImages) {
          classifyGarment(img.id, img.preview);
        }
      }

      setUrlInput('');
      setUrlError('');
    } catch (error) {
      console.error('URL fetch error:', error);
      setUrlError('네트워크 오류가 발생했습니다');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Garment Upload Zone */}
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
            <svg
              className="w-8 h-8"
              style={{ color: 'var(--accent)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium">의류 이미지 업로드</p>
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
              드래그 앤 드롭 또는 클릭하여 선택
            </p>
          </div>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            PNG, JPG, WEBP (최대 {maxImages}장)
          </p>
          <p className="text-xs mt-2 px-3 py-1.5 rounded" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'rgb(217, 119, 6)' }}>
            스트라이프/체크 패턴은 왜곡될 수 있습니다. 단색 의류 권장
          </p>
        </div>
      </div>

      {/* URL 입력 영역 */}
      <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--background-secondary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-sm font-medium">쇼핑몰 URL에서 가져오기</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            자동
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
          지그재그, 에이블리, 무신사, yourbutton 등 쇼핑몰 상품 페이지 URL을 입력하세요
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setUrlError('');
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleUrlFetch()}
            placeholder="https://..."
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--background-tertiary)',
              border: `1px solid ${urlError ? 'rgb(239, 68, 68)' : 'var(--border)'}`,
              color: 'var(--foreground)'
            }}
            disabled={isLoadingUrl}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUrlFetch();
            }}
            disabled={isLoadingUrl || !urlInput.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--accent)',
              color: 'white',
            }}
          >
            {isLoadingUrl ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
            ) : '가져오기'}
          </button>
        </div>
        {urlError && (
          <p className="text-xs mt-2" style={{ color: 'rgb(239, 68, 68)' }}>
            {urlError}
          </p>
        )}
      </div>

      {/* Uploaded Garment Images Grid */}
      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {uploadedImages.map((image) => (
            <div
              key={image.id}
              className="relative group rounded-lg overflow-hidden"
              style={{ aspectRatio: '3/4', background: 'var(--background-tertiary)' }}
            >
              <img
                src={image.preview}
                alt="Uploaded garment"
                className="w-full h-full object-cover"
              />

              {/* 삭제 버튼 - 우상단 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(image.id);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Category badge - 좌하단 중앙, 탭하면 순환 */}
              <div className="absolute bottom-2 left-2 flex justify-start">
                {classifyingIds.has(image.id) ? (
                  <span className="px-2 py-1 text-[10px] bg-black/70 rounded flex items-center gap-1 text-white">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                    </svg>
                    분류중
                  </span>
                ) : (
                  /* 탭하면 다음 카테고리로 순환 */
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const categories: GarmentCategory[] = ['top', 'bottom', 'dress', 'outer', 'accessory'];
                      const currentIndex = categories.indexOf(image.category || 'top');
                      const nextCategory = categories[(currentIndex + 1) % categories.length];
                      handleManualCategoryChange(image.id, nextCategory);
                    }}
                    className={`h-6 px-2 text-xs rounded-full inline-flex items-center gap-1.5 whitespace-nowrap transition-all ${
                      image.category === 'top' ? 'bg-blue-500 text-white' :
                      image.category === 'bottom' ? 'bg-green-500 text-white' :
                      image.category === 'dress' ? 'bg-pink-500 text-white' :
                      image.category === 'outer' ? 'bg-orange-500 text-white' :
                      image.category === 'accessory' ? 'bg-purple-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}
                    title="탭하여 카테고리 변경"
                  >
                    <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                    {image.category ? CATEGORY_LABELS[image.category] : '선택'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload count */}
      <div className="flex justify-between items-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
        <span>{uploadedImages.length} / {maxImages} 이미지 업로드됨</span>
        {uploadedImages.length > 0 && (
          <button
            onClick={() => uploadedImages.forEach((img) => onRemove(img.id))}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      {/* Style Reference Section */}
      {onStyleReferenceUpload && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">스타일 참조 이미지 (선택)</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              추천
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
            원하는 촬영 스타일의 실제 사진을 업로드하면 더 자연스러운 결과를 얻을 수 있습니다. (최대 {maxStyleReferenceImages}장)
          </p>

          {/* Uploaded Style Reference Images Grid */}
          {styleReferenceImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {styleReferenceImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-lg overflow-hidden"
                  style={{ aspectRatio: '3/4', background: 'var(--background-tertiary)' }}
                >
                  <img
                    src={image.preview}
                    alt="Style reference"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onStyleReferenceUpload(styleReferenceImages.filter((img) => img.id !== image.id))}
                      className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute top-1 left-1">
                    <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--success)', color: 'white' }}>
                      참조
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Zone for Style Reference */}
          {styleReferenceImages.length < maxStyleReferenceImages && (
            <div
              className={`p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${isStyleDragOver ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] hover:border-[var(--accent)]'}`}
              onDrop={handleStyleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsStyleDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsStyleDragOver(false); }}
              onClick={handleStyleClick}
            >
              <input
                ref={styleInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleStyleFileChange}
              />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--background-tertiary)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">참조 이미지 추가</p>
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    지그재그, 에이블리 등 원하는 스타일의 사진 (일괄 선택 가능)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Style Reference Count & Clear All */}
          {styleReferenceImages.length > 0 && (
            <div className="flex justify-between items-center text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
              <span>{styleReferenceImages.length} / {maxStyleReferenceImages} 참조 이미지</span>
              <button
                onClick={() => onStyleReferenceUpload([])}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                전체 삭제
              </button>
            </div>
          )}
        </div>
      )}

      {/* Background Spot Section - 촬영 장소/배경 스팟 */}
      {onBackgroundSpotUpload && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">배경 스팟 이미지 (선택)</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'rgb(139, 92, 246)' }}>
              NEW
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
            야외 렌탈 스튜디오, 카페, 거리 등 원하는 촬영 장소 사진을 업로드하면 해당 배경으로 결과물이 생성됩니다. (최대 {maxBackgroundSpotImages}장)
          </p>

          {/* Uploaded Background Spot Images Grid */}
          {backgroundSpotImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {backgroundSpotImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-lg overflow-hidden"
                  style={{ aspectRatio: '4/3', background: 'var(--background-tertiary)' }}
                >
                  <img
                    src={image.preview}
                    alt="Background spot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onBackgroundSpotUpload(backgroundSpotImages.filter((img) => img.id !== image.id))}
                      className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute top-1 left-1">
                    <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgb(139, 92, 246)', color: 'white' }}>
                      배경
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Zone for Background Spot */}
          {backgroundSpotImages.length < maxBackgroundSpotImages && (
            <div
              className={`p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${isBackgroundSpotDragOver ? 'border-[rgb(139,92,246)] bg-[rgba(139,92,246,0.1)]' : 'border-[var(--border)] hover:border-[rgb(139,92,246)]'}`}
              onDrop={handleBackgroundSpotDrop}
              onDragOver={(e) => { e.preventDefault(); setIsBackgroundSpotDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsBackgroundSpotDragOver(false); }}
              onClick={handleBackgroundSpotClick}
            >
              <input
                ref={backgroundSpotInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBackgroundSpotFileChange}
              />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--background-tertiary)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">촬영 장소 이미지 추가</p>
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    렌탈 스튜디오, 카페, 야외 스팟 등 촬영 장소 사진
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Background Spot Count & Clear All */}
          {backgroundSpotImages.length > 0 && (
            <div className="flex justify-between items-center text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
              <span>{backgroundSpotImages.length} / {maxBackgroundSpotImages} 배경 스팟 이미지</span>
              <button
                onClick={() => onBackgroundSpotUpload([])}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                전체 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
