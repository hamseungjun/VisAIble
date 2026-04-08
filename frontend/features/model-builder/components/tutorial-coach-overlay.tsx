'use client';

import { useEffect, useMemo, useState } from 'react';

type TutorialCoachOverlayProps = {
  open: boolean;
  stepKey: string;
  stepIndex: number;
  totalSteps: number;
  title: string;
  description: string;
  targetName?: string | null;
  targetNames?: string[];
  accentLabel?: string;
  canAdvance?: boolean;
  advanceLabel?: string;
  backdropMode?: 'spotlight' | 'none';
  cardPlacement?: 'auto' | 'top-right' | 'top-left' | 'right';
  onAdvance?: () => void;
  onSkip: () => void;
};

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TutorialCoachOverlay({
  open,
  stepKey,
  stepIndex,
  totalSteps,
  title,
  description,
  targetName,
  targetNames,
  accentLabel = 'VisAible Guide',
  canAdvance = false,
  advanceLabel = '다음',
  backdropMode = 'spotlight',
  cardPlacement = 'auto',
  onAdvance,
  onSkip,
}: TutorialCoachOverlayProps) {
  const [targetRect, setTargetRect] = useState<RectState | null>(null);
  const [cardAnchorRect, setCardAnchorRect] = useState<RectState | null>(null);
  const resolvedTargetNames = targetNames && targetNames.length > 0
    ? targetNames
    : targetName
      ? [targetName]
      : [];

  useEffect(() => {
    if (!open || resolvedTargetNames.length === 0) {
      setTargetRect(null);
      setCardAnchorRect(null);
      return;
    }

    setCardAnchorRect(null);
    let frameId: number | null = null;
    let intervalId: number | null = null;

    const syncRect = () => {
      frameId = null;
      const targets = resolvedTargetNames
        .map((name) => document.querySelector<HTMLElement>(`[data-tutorial-target="${name}"]`))
        .filter((element): element is HTMLElement => element !== null);
      if (targets.length === 0) {
        setTargetRect(null);
        return;
      }

      const rects = targets.map((target) => target.getBoundingClientRect());
      const rect = rects.reduce(
        (union, current) => ({
          top: Math.min(union.top, current.top),
          left: Math.min(union.left, current.left),
          right: Math.max(union.right, current.right),
          bottom: Math.max(union.bottom, current.bottom),
        }),
        {
          top: rects[0].top,
          left: rects[0].left,
          right: rects[0].right,
          bottom: rects[0].bottom,
        },
      );
      const nextRect = {
        top: rect.top,
        left: rect.left,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      };

      setTargetRect(nextRect);
      setCardAnchorRect((current) => current ?? nextRect);
    };

    const scheduleSync = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(syncRect);
    };

    scheduleSync();
    intervalId = window.setInterval(scheduleSync, 180);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('scroll', scheduleSync, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync, true);
    };
  }, [open, resolvedTargetNames, stepKey]);

  const spotlightRect = useMemo(() => {
    if (!targetRect) {
      return null;
    }

    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    const padding = 12;
    const top = clamp(targetRect.top - padding, 8, viewportHeight - 8);
    const left = clamp(targetRect.left - padding, 8, viewportWidth - 8);
    const right = clamp(targetRect.left + targetRect.width + padding, 8, viewportWidth - 8);
    const bottom = clamp(targetRect.top + targetRect.height + padding, 8, viewportHeight - 8);

    if (right - left < 24 || bottom - top < 24) {
      return null;
    }

    return {
      top,
      left,
      width: right - left,
      height: bottom - top,
    };
  }, [targetRect]);

  const cardPosition = useMemo(() => {
    const cardWidth = 360;
    const cardHeight = 300;
    const viewportPadding = 24;
    const gap = 20;
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    const anchorRect = spotlightRect ?? cardAnchorRect;

    if (cardPlacement === 'top-right') {
      return {
        top: clamp(96, viewportPadding, viewportHeight - cardHeight - viewportPadding),
        left: clamp(
          viewportWidth - cardWidth - 40,
          viewportPadding,
          viewportWidth - cardWidth - viewportPadding,
        ),
      };
    }

    if (cardPlacement === 'top-left') {
      return {
        top: clamp(96, viewportPadding, viewportHeight - cardHeight - viewportPadding),
        left: clamp(40, viewportPadding, viewportWidth - cardWidth - viewportPadding),
      };
    }

    if (cardPlacement === 'right') {
      return {
        top: clamp(
          viewportHeight * 0.2,
          viewportPadding,
          viewportHeight - cardHeight - viewportPadding,
        ),
        left: clamp(
          viewportWidth - cardWidth - 40,
          viewportPadding,
          viewportWidth - cardWidth - viewportPadding,
        ),
      };
    }

    if (!anchorRect) {
      return {
        top: clamp(viewportHeight * 0.16, viewportPadding, viewportHeight - cardHeight - viewportPadding),
        left: clamp(
          (viewportWidth - cardWidth) / 2,
          viewportPadding,
          viewportWidth - cardWidth - viewportPadding,
        ),
      };
    }

    const clampLeft = (left: number) =>
      clamp(left, viewportPadding, viewportWidth - cardWidth - viewportPadding);
    const clampTop = (top: number) =>
      clamp(top, viewportPadding, viewportHeight - cardHeight - viewportPadding);

    const candidates = [
      {
        top: clampTop(anchorRect.top + anchorRect.height + gap),
        left: clampLeft(anchorRect.left + anchorRect.width / 2 - cardWidth / 2),
        priority: 0,
      },
      {
        top: clampTop(anchorRect.top - cardHeight - gap),
        left: clampLeft(anchorRect.left + anchorRect.width / 2 - cardWidth / 2),
        priority: 1,
      },
      {
        top: clampTop(anchorRect.top + anchorRect.height / 2 - cardHeight / 2),
        left: clampLeft(anchorRect.left + anchorRect.width + gap),
        priority: 2,
      },
      {
        top: clampTop(anchorRect.top + anchorRect.height / 2 - cardHeight / 2),
        left: clampLeft(anchorRect.left - cardWidth - gap),
        priority: 3,
      },
    ];

    const overlapArea = (candidate: { top: number; left: number }) => {
      const overlapWidth =
        Math.max(
          0,
          Math.min(candidate.left + cardWidth, anchorRect.left + anchorRect.width) -
            Math.max(candidate.left, anchorRect.left),
        );
      const overlapHeight =
        Math.max(
          0,
          Math.min(candidate.top + cardHeight, anchorRect.top + anchorRect.height) -
            Math.max(candidate.top, anchorRect.top),
        );
      return overlapWidth * overlapHeight;
    };

    const bestCandidate = candidates
      .map((candidate) => ({
        ...candidate,
        overlap: overlapArea(candidate),
      }))
      .sort((a, b) => (a.overlap === b.overlap ? a.priority - b.priority : a.overlap - b.overlap))[0];

    return { top: bestCandidate.top, left: bestCandidate.left };
  }, [cardAnchorRect, spotlightRect]);

  if (!open) {
    return null;
  }

  if (backdropMode === 'none') {
    return (
      <section
        className="fixed z-[10020] max-h-[calc(100vh-48px)] w-[min(360px,calc(100vw-48px))] overflow-y-auto rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(18,24,39,0.96),rgba(11,17,29,0.98))] px-5 py-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9eb7ff]">
          {accentLabel}
        </div>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] font-bold leading-[1.02] tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-white/78">
              {description}
            </p>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-bold text-white/75">
            {stepIndex + 1}/{totalSteps}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-white/14 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/72 transition hover:bg-white/8 hover:text-white"
          >
            가이드 닫기
          </button>
          {canAdvance && onAdvance ? (
            <button
              type="button"
              onClick={onAdvance}
              className="rounded-full bg-[linear-gradient(135deg,#1151ff,#4d7cff)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_14px_28px_rgba(17,81,255,0.3)] transition hover:brightness-105"
            >
              {advanceLabel}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[10020]">
      {spotlightRect ? (
        <>
          <div
            className="pointer-events-none fixed left-0 top-0 bg-[rgba(6,10,18,0.68)] backdrop-blur-[2px]"
            style={{ width: '100vw', height: spotlightRect.top }}
          />
          <div
            className="pointer-events-none fixed left-0 bg-[rgba(6,10,18,0.68)] backdrop-blur-[2px]"
            style={{
              top: spotlightRect.top,
              width: spotlightRect.left,
              height: spotlightRect.height,
            }}
          />
          <div
            className="pointer-events-none fixed bg-[rgba(6,10,18,0.68)] backdrop-blur-[2px]"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left + spotlightRect.width,
              width: `calc(100vw - ${spotlightRect.left + spotlightRect.width}px)`,
              height: spotlightRect.height,
            }}
          />
          <div
            className="pointer-events-none fixed left-0 bg-[rgba(6,10,18,0.68)] backdrop-blur-[2px]"
            style={{
              top: spotlightRect.top + spotlightRect.height,
              width: '100vw',
              height: `calc(100vh - ${spotlightRect.top + spotlightRect.height}px)`,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-[28px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0)] tutorial-spotlight-ring"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
            }}
          />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-[rgba(6,10,18,0.72)] backdrop-blur-[3px]" />
      )}

      <section
        className="pointer-events-auto fixed max-h-[calc(100vh-48px)] w-[min(360px,calc(100vw-48px))] overflow-y-auto rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(18,24,39,0.96),rgba(11,17,29,0.98))] px-5 py-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9eb7ff]">
          {accentLabel}
        </div>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] font-bold leading-[1.02] tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-white/78">
              {description}
            </p>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-bold text-white/75">
            {stepIndex + 1}/{totalSteps}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-white/14 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/72 transition hover:bg-white/8 hover:text-white"
          >
            가이드 닫기
          </button>
          {canAdvance && onAdvance ? (
            <button
              type="button"
              onClick={onAdvance}
              className="rounded-full bg-[linear-gradient(135deg,#1151ff,#4d7cff)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_14px_28px_rgba(17,81,255,0.3)] transition hover:brightness-105"
            >
              {advanceLabel}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
