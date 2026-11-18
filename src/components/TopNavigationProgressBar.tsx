import React, { useEffect, useRef, useState } from 'react';
import { computeNextProgressValue, type TopProgressPhase } from '../lib/onegovRules';

interface TopNavigationProgressBarProps {
  isLoading: boolean;
}

export const TopNavigationProgressBar: React.FC<TopNavigationProgressBarProps> = ({ isLoading }) => {
  const [phase, setPhase] = useState<TopProgressPhase>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [fadingOut, setFadingOut] = useState<boolean>(false);
  const phaseRef = useRef<TopProgressPhase>('idle');

  const updatePhase = (next: TopProgressPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    if (isLoading) {
      setFadingOut(false);
      updatePhase('loading');
      setProgress((prev) => (prev > 0 && prev < 92 ? prev : computeNextProgressValue(0, 'loading')));
      return;
    }

    if (phaseRef.current === 'loading') {
      updatePhase('completing');
      setProgress(100);
      const fadeTimer = window.setTimeout(() => {
        setFadingOut(true);
      }, 170);
      const doneTimer = window.setTimeout(() => {
        updatePhase('idle');
        setProgress(0);
        setFadingOut(false);
      }, 330);
      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(doneTimer);
      };
    }
  }, [isLoading]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const interval = window.setInterval(() => {
      setProgress((prev) => computeNextProgressValue(prev, 'loading'));
    }, 180);
    return () => window.clearInterval(interval);
  }, [phase]);

  if (phase === 'idle') {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Loading module data"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      data-testid="workspace-top-progress-bar"
      data-phase={phase}
      className={`fixed top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none bg-emerald-500/15 overflow-hidden transition-opacity duration-150 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-[#059669] via-[#10b981] to-[#34d399] shadow-[0_0_8px_rgba(16,185,129,0.45)] transition-transform ease-out"
        style={{
          transform: `scaleX(${Math.max(0.06, progress / 100)})`,
          transitionDuration: phase === 'completing' ? '160ms' : '280ms',
        }}
      />
    </div>
  );
};
