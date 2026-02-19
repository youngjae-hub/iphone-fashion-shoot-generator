'use client';

import { useState, useEffect } from 'react';
import type { GenerationSettings as GenerationSettingsType, PoseType, LoRAModel } from '@/types';
import { DEFAULT_POSES } from '@/types';
import HelpTooltip from './HelpTooltip';

interface GenerationSettingsProps {
  settings: GenerationSettingsType;
  onChange: (settings: GenerationSettingsType) => void;
  activeLoRA?: LoRAModel | null;
  onLoRAChange?: (model: LoRAModel | null) => void;
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
  activeLoRA,
  onLoRAChange,
}: GenerationSettingsProps) {
  const [loraModels, setLoraModels] = useState<LoRAModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // LoRA 모델 목록 로드
  useEffect(() => {
    async function fetchModels() {
      setIsLoadingModels(true);
      try {
        const res = await fetch('/api/lora');
        const data = await res.json();
        if (data.success && data.models) {
          setLoraModels(data.models.filter((m: LoRAModel) => m.status === 'completed'));
        }
      } catch (err) {
        console.error('Failed to fetch LoRA models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
    fetchModels();
  }, []);

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

      {/* LoRA Model Selector */}
      {onLoRAChange && (
        <div className="settings-group">
          <label className="settings-label flex items-center gap-2">
            학습된 스타일 모델
            <HelpTooltip title="학습된 스타일 모델이란?">
              <p className="mb-2">LoRA 학습을 통해 만든 커스텀 스타일 모델을 선택합니다.</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>기본(없음):</strong> 일반 AI 모델로 생성</li>
                <li><strong>학습 모델:</strong> 특정 스타일이 반영된 결과물 생성</li>
              </ul>
              <p className="mt-2 text-[11px]">Train 탭에서 새 스타일을 학습할 수 있습니다.</p>
            </HelpTooltip>
          </label>

          {isLoadingModels ? (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>모델 목록 로딩 중...</span>
            </div>
          ) : loraModels.length === 0 ? (
            <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}>
              학습된 모델이 없습니다. Train 탭에서 스타일을 학습해보세요.
            </div>
          ) : (
            <div className="space-y-2">
              {/* 기본 모델 (LoRA 없음) */}
              <button
                onClick={() => onLoRAChange(null)}
                className="w-full text-left p-3 rounded-lg border transition-all"
                style={{
                  borderColor: !activeLoRA ? 'var(--accent)' : 'var(--border)',
                  background: !activeLoRA ? 'rgba(99, 102, 241, 0.1)' : 'var(--background-secondary)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full border-2"
                    style={{
                      borderColor: !activeLoRA ? 'var(--accent)' : 'var(--border)',
                      background: !activeLoRA ? 'var(--accent)' : 'transparent',
                    }}
                  />
                  <span className="text-sm font-medium">기본 모델</span>
                </div>
                <p className="text-xs mt-1 ml-5" style={{ color: 'var(--foreground-muted)' }}>
                  LoRA 없이 기본 AI 모델로 생성
                </p>
              </button>

              {/* 학습된 LoRA 모델 목록 */}
              {loraModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => onLoRAChange(model)}
                  className="w-full text-left p-3 rounded-lg border transition-all"
                  style={{
                    borderColor: activeLoRA?.id === model.id ? 'var(--accent)' : 'var(--border)',
                    background: activeLoRA?.id === model.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--background-secondary)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border-2"
                      style={{
                        borderColor: activeLoRA?.id === model.id ? 'var(--accent)' : 'var(--border)',
                        background: activeLoRA?.id === model.id ? 'var(--accent)' : 'transparent',
                      }}
                    />
                    <span className="text-sm font-medium">{model.name}</span>
                  </div>
                  <div className="ml-5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      트리거: <code className="px-1 rounded" style={{ background: 'var(--background-tertiary)' }}>{model.triggerWord}</code>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Style */}
      <div className="settings-group">
        <label className="settings-label flex items-center gap-2">
          모델 스타일
          <HelpTooltip title="모델 스타일이란?">
            <p className="mb-2">생성될 모델(사람)의 전체적인 촬영 분위기를 결정합니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>아이폰 내추럴:</strong> 실제 아이폰으로 찍은 듯한 자연스러운 느낌</li>
              <li><strong>스튜디오:</strong> 전문 스튜디오에서 조명을 세팅한 느낌</li>
              <li><strong>캐주얼:</strong> 일상에서 편하게 찍은 스냅 느낌</li>
            </ul>
          </HelpTooltip>
        </label>
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
        <label className="settings-label flex items-center gap-2">
          배경 스타일
          <HelpTooltip title="배경 스타일이란?">
            <p className="mb-2">이미지의 배경 장소와 분위기를 결정합니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>방 코너:</strong> 자연광이 들어오는 집 안</li>
              <li><strong>크림색 벽:</strong> 깔끔한 무지 배경</li>
              <li><strong>카페:</strong> 아늑한 분위기의 카페</li>
              <li><strong>거울샷:</strong> 전신거울 앞 셀피 스타일</li>
              <li><strong>아웃도어:</strong> 야외 거리 촬영 느낌</li>
            </ul>
          </HelpTooltip>
        </label>
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
        <label className="settings-label flex items-center gap-2">
          포즈 선택
          <HelpTooltip title="포즈 선택이란?">
            <p className="mb-2">생성할 이미지의 모델 포즈를 선택합니다. 여러 개를 선택할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>정면:</strong> 앞에서 바라본 기본 포즈</li>
              <li><strong>뒷면:</strong> 뒤에서 바라본 백샷</li>
              <li><strong>측면:</strong> 3/4 각도의 프로필 샷</li>
              <li><strong>앉은:</strong> 소파/의자에 앉은 포즈</li>
              <li><strong>연출:</strong> 머리 만지기 등 자연스러운 연출</li>
              <li><strong>전신:</strong> 발끝까지 보이는 풀샷</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 다양한 포즈를 선택하면 룩북의 완성도가 높아집니다!</p>
          </HelpTooltip>
        </label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_POSES.map((pose) => (
            <button
              key={pose.type}
              onClick={() => togglePose(pose.type)}
              className={`pose-chip ${settings.poses.includes(pose.type) ? 'active' : ''}`}
            >
              {pose.labelKr}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
          {settings.poses.length}개 포즈 선택됨
        </p>
      </div>

      {/* Shots per Pose */}
      <div className="settings-group">
        <label className="settings-label flex items-center gap-2">
          포즈당 컷 수: <span className="font-bold" style={{ color: 'var(--accent)' }}>{settings.shotsPerPose}</span>
          <HelpTooltip title="포즈당 컷 수란?">
            <p className="mb-2">각 포즈별로 생성할 이미지 개수입니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>1~2컷:</strong> 빠른 테스트용</li>
              <li><strong>3~5컷:</strong> 기본 룩북 제작용</li>
              <li><strong>6~10컷:</strong> 다양한 선택지가 필요할 때</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 컷 수가 많을수록 생성 시간이 길어지고 비용이 증가합니다.</p>
          </HelpTooltip>
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
        {settings.totalShots > 3 && (
          <p className="text-xs mt-2 p-2 rounded" style={{ background: 'rgba(255, 180, 0, 0.2)', color: '#f59e0b' }}>
            ⚠️ 4개 이상 생성 시 일부가 시간 초과될 수 있습니다
          </p>
        )}
      </div>

      {/* Seed (Optional) */}
      <div className="settings-group">
        <label className="settings-label flex items-center gap-2">
          시드 값 (선택사항)
          <HelpTooltip title="시드(Seed)란?">
            <p className="mb-2">AI가 이미지를 생성할 때 사용하는 난수의 시작점입니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>비워두면:</strong> 매번 완전히 다른 이미지 생성</li>
              <li><strong>같은 숫자 입력:</strong> 비슷한 구도/스타일의 이미지 재현 가능</li>
            </ul>
            <p className="mt-2 text-[11px]">💡 마음에 드는 결과가 나오면 해당 시드 값을 메모해두세요!</p>
          </HelpTooltip>
        </label>
        <input
          type="number"
          placeholder="비워두면 매번 다른 결과"
          value={settings.seed || ''}
          onChange={(e) => onChange({ ...settings, seed: e.target.value ? parseInt(e.target.value) : undefined })}
          className="input"
        />
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
            <label className="settings-label flex items-center gap-2">
              네거티브 프롬프트
              <HelpTooltip title="네거티브 프롬프트란?">
                <p className="mb-2">생성 결과에서 <strong>제외</strong>하고 싶은 요소들을 입력합니다.</p>
                <p className="mb-2">예시:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>blurry, low quality (흐릿한 이미지 방지)</li>
                  <li>distorted hands (손 왜곡 방지)</li>
                  <li>bad anatomy (신체 비율 오류 방지)</li>
                </ul>
                <p className="mt-2 text-[11px]">💡 기본값을 그대로 사용하셔도 충분합니다.</p>
              </HelpTooltip>
            </label>
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
