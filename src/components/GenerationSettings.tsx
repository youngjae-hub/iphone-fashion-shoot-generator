'use client';

import type { GenerationSettings as GenerationSettingsType, PoseType } from '@/types';
import { POSE_CONFIGS } from '@/types';

interface GenerationSettingsProps {
  settings: GenerationSettingsType;
  onChange: (settings: GenerationSettingsType) => void;
}

const MODEL_STYLES = [
  { value: 'iphone-natural', label: '아이폰 내추럴', description: '자연스러운 아이폰 촬영 스타일' },
  { value: 'studio', label: '스튜디오', description: '전문 스튜디오 촬영 스타일' },
  { value: 'casual', label: '캐주얼', description: '일상적인 스냅 스타일' },
];

const BACKGROUND_STYLES = [
  { value: 'room-corner', label: '방 코너', description: '자연광이 들어오는 심플한 방 코너' },
  { value: 'cream-wall', label: '크림색 벽', description: '깔끔한 크림/아이보리 벽면' },
  { value: 'cafe', label: '카페', description: '아늑한 카페 코너' },
  { value: 'mirror', label: '거울샷', description: '전신거울 셀카 느낌' },
  { value: 'outdoor', label: '아웃도어', description: '야외 스트릿 느낌' },
];

export default function GenerationSettings({
  settings,
  onChange,
}: GenerationSettingsProps) {
  const togglePose = (pose: PoseType) => {
    const poses = settings.poses.includes(pose)
      ? settings.poses.filter((p) => p !== pose)
      : [...settings.poses, pose];

    // 최소 1개 포즈는 선택되어 있어야 함
    if (poses.length === 0) return;

    onChange({
      ...settings,
      poses,
      totalShots: poses.length * settings.shotsPerPose,
    });
  };

  const updateShotsPerPose = (value: number) => {
    onChange({
      ...settings,
      shotsPerPose: value,
      totalShots: settings.poses.length * value,
    });
  };

  return (
    <div className="space-y-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <h3 className="font-semibold">생성 설정</h3>
      </div>

      {/* Model Style */}
      <div className="settings-group">
        <label className="settings-label">모델 스타일</label>
        <select
          value={settings.modelStyle}
          onChange={(e) => onChange({ ...settings, modelStyle: e.target.value as GenerationSettingsType['modelStyle'] })}
          className="select"
        >
          {MODEL_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label} - {style.description}
            </option>
          ))}
        </select>
      </div>

      {/* Background Style */}
      <div className="settings-group">
        <label className="settings-label">배경 스타일</label>
        <select
          value={settings.backgroundStyle}
          onChange={(e) => onChange({ ...settings, backgroundStyle: e.target.value })}
          className="select"
        >
          {BACKGROUND_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label} - {style.description}
            </option>
          ))}
        </select>
      </div>

      {/* Pose Selection */}
      <div className="settings-group">
        <label className="settings-label">포즈 선택</label>
        <div className="flex flex-wrap gap-2">
          {POSE_CONFIGS.map((pose) => (
            <button
              key={pose.type}
              onClick={() => togglePose(pose.type)}
              className={`pose-chip ${settings.poses.includes(pose.type) ? 'active' : ''}`}
            >
              {pose.label}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
          {settings.poses.length}개 포즈 선택됨
        </p>
      </div>

      {/* Shots per Pose */}
      <div className="settings-group">
        <label className="settings-label">
          포즈당 컷 수: <span className="font-bold" style={{ color: 'var(--accent)' }}>{settings.shotsPerPose}</span>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={settings.shotsPerPose}
          onChange={(e) => updateShotsPerPose(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{ background: 'var(--background-tertiary)' }}
        />
        <div className="flex justify-between text-xs" style={{ color: 'var(--foreground-muted)' }}>
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* Total Shots Summary */}
      <div className="p-4 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
        <div className="flex justify-between items-center">
          <span className="text-sm">총 생성 이미지</span>
          <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            {settings.totalShots}컷
          </span>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
          {settings.poses.length}개 포즈 × {settings.shotsPerPose}컷
        </p>
      </div>

      {/* Seed (Optional) */}
      <div className="settings-group">
        <label className="settings-label">시드 값 (선택사항)</label>
        <input
          type="number"
          placeholder="랜덤 생성 (비워두면 매번 다른 결과)"
          value={settings.seed || ''}
          onChange={(e) => onChange({ ...settings, seed: e.target.value ? parseInt(e.target.value) : undefined })}
          className="input"
        />
        <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
          동일한 시드 값을 사용하면 비슷한 결과를 재현할 수 있습니다.
        </p>
      </div>

      {/* Negative Prompt (Advanced) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          고급 설정
        </summary>
        <div className="mt-4 space-y-4">
          <div className="settings-group">
            <label className="settings-label">네거티브 프롬프트</label>
            <textarea
              placeholder="생성에서 제외할 요소들..."
              value={settings.negativePrompt || ''}
              onChange={(e) => onChange({ ...settings, negativePrompt: e.target.value })}
              className="input min-h-[100px] resize-y"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
