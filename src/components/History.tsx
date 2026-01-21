'use client';

import { useState, useEffect } from 'react';
import { GenerationSession, HistoryItem } from '@/types';

interface HistoryProps {
  onLoadSession?: (session: GenerationSession) => void;
}

export default function History({ onLoadSession }: HistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessions, setSessions] = useState<GenerationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kvConnected, setKvConnected] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GenerationSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history?limit=50');
      const data = await res.json();

      if (data.success) {
        setHistory(data.history || []);
        setSessions(data.sessions || []);
        setKvConnected(data.kvConnected || false);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('히스토리를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/history?sessionId=${sessionId}`);
      const data = await res.json();

      if (data.success && data.session) {
        setSelectedSession(data.session);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setHistory(prev => prev.filter(h => h.sessionId !== sessionId));
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          히스토리
          {kvConnected && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
              저장됨
            </span>
          )}
        </h3>
        <button
          onClick={loadHistory}
          className="text-xs px-2 py-1 rounded hover:bg-[var(--background-tertiary)]"
          disabled={isLoading}
        >
          {isLoading ? '로딩...' : '새로고침'}
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-2 rounded text-sm bg-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* KV 미연결 안내 */}
      {!kvConnected && !isLoading && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--background-tertiary)' }}>
          <p style={{ color: 'var(--foreground-muted)' }}>
            데이터베이스가 연결되지 않아 히스토리가 저장되지 않습니다.
          </p>
        </div>
      )}

      {/* 히스토리 목록 */}
      {!isLoading && history.length === 0 && kvConnected && (
        <div className="p-4 rounded-lg text-center" style={{ background: 'var(--background-tertiary)' }}>
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            아직 생성 기록이 없습니다.
          </p>
        </div>
      )}

      {/* 세션 목록 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-3 rounded-lg cursor-pointer transition-all ${
              selectedSession?.id === session.id
                ? 'ring-2 ring-[var(--accent)]'
                : 'hover:bg-[var(--background-tertiary)]'
            }`}
            style={{ background: 'var(--background-secondary)' }}
            onClick={() => loadSession(session.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {session.name || `세션 ${session.id.slice(0, 8)}`}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--background-tertiary)' }}>
                    {session.generatedImages.length}장
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                  {formatDate(session.updatedAt)}
                </p>
              </div>

              {/* 썸네일 */}
              {session.generatedImages[0]?.url && (
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 ml-2">
                  <img
                    src={session.generatedImages[0].url}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 mt-2">
              {onLoadSession && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSession(session);
                  }}
                  className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-[var(--background)] hover:opacity-90"
                >
                  불러오기
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="text-xs px-2 py-1 rounded hover:bg-red-500/20 text-red-400"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 선택된 세션 상세 */}
      {selectedSession && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--background-tertiary)' }}>
          <h4 className="text-sm font-medium mb-2">생성된 이미지</h4>
          <div className="grid grid-cols-4 gap-2">
            {selectedSession.generatedImages.slice(0, 8).map((img) => (
              <div key={img.id} className="aspect-square rounded overflow-hidden">
                <img
                  src={img.url}
                  alt={img.pose}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {selectedSession.generatedImages.length > 8 && (
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--foreground-muted)' }}>
              +{selectedSession.generatedImages.length - 8}장 더
            </p>
          )}
        </div>
      )}
    </div>
  );
}
