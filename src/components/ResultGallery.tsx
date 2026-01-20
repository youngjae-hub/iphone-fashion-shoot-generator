'use client';

import { useState } from 'react';
import { GeneratedImage, PoseType, POSE_CONFIGS } from '@/types';

interface ResultGalleryProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  onDownload: (image: GeneratedImage) => void;
  onDownloadAll: () => void;
  onRegenerate: (image: GeneratedImage) => void;
  onUpscale?: (image: GeneratedImage, upscaledUrl: string) => void;
}

export default function ResultGallery({
  images,
  isGenerating,
  onDownload,
  onDownloadAll,
  onRegenerate,
  onUpscale,
}: ResultGalleryProps) {
  const [selectedPose, setSelectedPose] = useState<PoseType | 'all'>('all');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [upscalingIds, setUpscalingIds] = useState<Set<string>>(new Set());
  const [upscaleError, setUpscaleError] = useState<string | null>(null);

  // 이미지 업스케일
  const handleUpscale = async (image: GeneratedImage) => {
    if (upscalingIds.has(image.id)) return;

    setUpscalingIds(prev => new Set(prev).add(image.id));
    setUpscaleError(null);

    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: image.url,
          scale: 2,
          model: 'real-esrgan',
        }),
      });

      const data = await response.json();

      if (data.success && data.upscaledImage) {
        // 업스케일된 이미지 콜백 또는 직접 다운로드
        if (onUpscale) {
          onUpscale(image, data.upscaledImage);
        } else {
          // 직접 다운로드
          const a = document.createElement('a');
          a.href = data.upscaledImage;
          a.download = `upscaled_${image.pose}_${image.id.slice(0, 8)}.png`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        setUpscaleError(data.error || '업스케일 실패');
      }
    } catch (err) {
      console.error('Upscale error:', err);
      setUpscaleError('업스케일 중 오류가 발생했습니다.');
    } finally {
      setUpscalingIds(prev => {
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
    }
  };

  // ZIP 다운로드
  const handleDownloadZip = async () => {
    if (images.length === 0) return;

    setIsDownloadingZip(true);
    try {
      const response = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map((img, index) => ({
            url: img.url,
            filename: `fashion_${img.pose}_${index + 1}.png`,
          })),
          zipFilename: `fashion_lookbook_${Date.now()}.zip`,
        }),
      });

      if (!response.ok) {
        throw new Error('ZIP 생성 실패');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fashion_lookbook_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP download error:', err);
      alert('ZIP 다운로드에 실패했습니다.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const filteredImages = selectedPose === 'all'
    ? images
    : images.filter((img) => img.pose === selectedPose);

  const getPoseLabel = (pose: PoseType) => {
    return POSE_CONFIGS.find((p) => p.type === pose)?.label || pose;
  };

  const uniquePoses = Array.from(new Set(images.map((img) => img.pose)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="font-semibold">생성 결과</h3>
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            ({images.length}장)
          </span>
        </div>

        {/* Upscale Error */}
        {upscaleError && (
          <div className="px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {upscaleError}
            <button onClick={() => setUpscaleError(null)} className="ml-auto hover:text-red-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {images.length > 0 && (
          <div className="flex gap-2">
            <button onClick={onDownloadAll} className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              개별 다운로드
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="btn-primary flex items-center gap-2"
            >
              {isDownloadingZip ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                  </svg>
                  ZIP 생성중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  ZIP 다운로드
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Pose Filter */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPose('all')}
            className={`pose-chip ${selectedPose === 'all' ? 'active' : ''}`}
          >
            전체 ({images.length})
          </button>
          {uniquePoses.map((pose) => (
            <button
              key={pose}
              onClick={() => setSelectedPose(pose)}
              className={`pose-chip ${selectedPose === pose ? 'active' : ''}`}
            >
              {getPoseLabel(pose)} ({images.filter((img) => img.pose === pose).length})
            </button>
          ))}
        </div>
      )}

      {/* Generation Status */}
      {isGenerating && (
        <div className="generation-status">
          <div className="status-dot generating" />
          <div className="flex-1">
            <p className="font-medium">이미지 생성 중...</p>
            <div className="progress-bar mt-2">
              <div className="progress-bar-fill animate-pulse-slow" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--background-tertiary)' }}>
            <svg className="w-10 h-10" style={{ color: 'var(--foreground-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium mb-1">아직 생성된 이미지가 없습니다</p>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            의류 이미지를 업로드하고 생성 버튼을 눌러주세요
          </p>
        </div>
      )}

      {/* Image Grid */}
      {filteredImages.length > 0 && (
        <div className="image-grid">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="result-card cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <img src={image.url} alt={`Generated ${image.pose}`} />
              <div className="result-card-overlay">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(image);
                    }}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
                    title="다운로드"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpscale(image);
                    }}
                    disabled={upscalingIds.has(image.id)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur transition-colors disabled:opacity-50"
                    title="업스케일 (2x)"
                  >
                    {upscalingIds.has(image.id) ? (
                      <svg className="w-5 h-5 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerate(image);
                    }}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
                    title="재생성"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Upscaling indicator */}
              {upscalingIds.has(image.id) && (
                <div className="absolute bottom-2 right-2">
                  <span className="px-2 py-1 text-xs rounded bg-blue-500 text-white">
                    업스케일 중...
                  </span>
                </div>
              )}

              {/* Pose Badge */}
              <div className="absolute top-2 left-2">
                <span className="provider-badge">{getPoseLabel(image.pose)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.url}
              alt={`Generated ${selectedImage.pose}`}
              className="max-w-full max-h-[90vh] rounded-lg object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image Info */}
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-lg bg-black/50 backdrop-blur">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">{getPoseLabel(selectedImage.pose)}</p>
                  <p className="text-sm text-white/70">
                    {new Date(selectedImage.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDownload(selectedImage)}
                    className="btn-primary"
                  >
                    다운로드
                  </button>
                  <button
                    onClick={() => handleUpscale(selectedImage)}
                    disabled={upscalingIds.has(selectedImage.id)}
                    className="btn-secondary disabled:opacity-50"
                  >
                    {upscalingIds.has(selectedImage.id) ? '업스케일 중...' : '업스케일 2x'}
                  </button>
                  <button
                    onClick={() => {
                      onRegenerate(selectedImage);
                      setSelectedImage(null);
                    }}
                    className="btn-secondary"
                  >
                    재생성
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
