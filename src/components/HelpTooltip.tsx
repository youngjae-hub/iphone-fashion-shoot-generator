'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface HelpTooltipProps {
  title: string;
  children: ReactNode;
}

export default function HelpTooltip({ title, children }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  return (
    <span className="relative inline-flex">
      <span
        ref={triggerRef}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] cursor-help transition-colors hover:bg-[var(--border)]"
        style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        title={title}
      >
        ?
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 left-0 top-6 w-64 p-3 rounded-lg shadow-lg text-xs"
          style={{
            background: 'var(--background-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className="font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            {title}
          </div>
          <div style={{ color: 'var(--foreground-muted)' }}>
            {children}
          </div>
        </div>
      )}
    </span>
  );
}
