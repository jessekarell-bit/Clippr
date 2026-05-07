'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface HighlightPhase {
  start: number;
  end: number;
}

interface ShortPreviewPlayerProps {
  videoId: string;
  phases: HighlightPhase[];
  className?: string;
  showControls?: boolean;
  loopPlayback?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
}

function ensureYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.getElementById('youtube-iframe-api');
    if (existing) {
      const wait = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(wait);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    window.onYouTubeIframeAPIReady = () => resolve();
    document.body.appendChild(script);
  });
}

export default function ShortPreviewPlayer({
  videoId,
  phases,
  className,
  showControls = false,
  loopPlayback = false,
  autoPlay = true,
  muted = false,
}: ShortPreviewPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const phaseIndexRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const readyFallbackTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const virtualElapsedRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [virtualElapsed, setVirtualElapsed] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const [showTransitionFx, setShowTransitionFx] = useState(false);
  const playerElementId = useMemo(
    () => `short-player-${videoId}-${phases.map((phase) => `${phase.start}-${phase.end}`).join('-')}`,
    [videoId, phases],
  );
  const totalDuration = useMemo(
    () => Math.max(0, phases.reduce((total, phase) => total + Math.max(0, phase.end - phase.start), 0)),
    [phases],
  );
  const remainingSeconds = Math.max(0, Math.ceil(totalDuration - virtualElapsed));
  const shouldBootPlayer = autoPlay || showControls || isActivated;

  useEffect(() => {
    virtualElapsedRef.current = virtualElapsed;
  }, [virtualElapsed]);

  function virtualToPhasePosition(value: number): { phaseIndex: number; seekTo: number } {
    let cursor = 0;
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      const duration = Math.max(0, phase.end - phase.start);
      if (value <= cursor + duration || index === phases.length - 1) {
        return { phaseIndex: index, seekTo: phase.start + Math.max(0, value - cursor) };
      }
      cursor += duration;
    }
    return { phaseIndex: 0, seekTo: phases[0]?.start ?? 0 };
  }

  function updateVirtualElapsedFromPlayer(currentTime: number): void {
    const currentPhase = phases[phaseIndexRef.current];
    if (!currentPhase) return;
    const elapsedBefore = phases
      .slice(0, phaseIndexRef.current)
      .reduce((total, phase) => total + Math.max(0, phase.end - phase.start), 0);
    const elapsedInPhase = Math.max(0, Math.min(currentPhase.end - currentPhase.start, currentTime - currentPhase.start));
    setVirtualElapsed(Math.max(0, Math.min(totalDuration, elapsedBefore + elapsedInPhase)));
  }

  function seekVirtual(value: number): void {
    const clamped = Math.max(0, Math.min(totalDuration, value));
    const player = playerRef.current;
    if (!player?.seekTo || phases.length === 0) return;
    const { phaseIndex, seekTo } = virtualToPhasePosition(clamped);
    phaseIndexRef.current = phaseIndex;
    player.seekTo(seekTo, true);
    setVirtualElapsed(clamped);
    if (isPlaying) {
      player.playVideo?.();
    } else {
      player.pauseVideo?.();
    }
  }

  function triggerTransitionFx(): void {
    setShowTransitionFx(true);
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = window.setTimeout(() => {
      setShowTransitionFx(false);
    }, 420);
  }

  useEffect(() => {
    let destroyed = false;

    const boot = async () => {
      if (!shouldBootPlayer) return;
      if (!hostRef.current || phases.length === 0) return;
      await ensureYouTubeApi();
      if (destroyed || !window.YT?.Player) return;

      phaseIndexRef.current = 0;
      setVirtualElapsed(0);
      setIsPlaying(false);
      playerRef.current = new window.YT.Player(playerElementId, {
        videoId,
        playerVars: {
          autoplay: autoPlay && !showControls ? 1 : 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 0,
          disablekb: 1,
          start: phases[0].start,
          end: phases[0].end,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (muted) {
              playerRef.current?.mute?.();
            } else {
              playerRef.current?.unMute?.();
              playerRef.current?.setVolume?.(100);
            }
            playerRef.current?.seekTo?.(phases[0].start, true);
            setIsReady(true);
            if (autoPlay && !showControls) {
              playerRef.current?.playVideo?.();
            } else {
              playerRef.current?.pauseVideo?.();
              setIsPlaying(false);
            }
          },
          onStateChange: (event: { data: number }) => {
            const yt = window.YT;
            if (!yt?.PlayerState) return;
            setIsReady(true);
            if (!autoPlay && event.data === yt.PlayerState.PLAYING && virtualElapsedRef.current === 0) {
              playerRef.current?.pauseVideo?.();
              setIsPlaying(false);
              return;
            }
            setIsPlaying(event.data === yt.PlayerState.PLAYING);
          },
        },
      });

      readyFallbackTimeoutRef.current = window.setTimeout(() => {
        setIsReady(true);
      }, 2500);

      intervalRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (!player?.getCurrentTime || !player?.seekTo) return;

        const currentPhase = phases[phaseIndexRef.current];
        const time = Number(player.getCurrentTime());
        if (Number.isNaN(time) || !currentPhase) return;
        updateVirtualElapsedFromPlayer(time);

        if (time >= currentPhase.end) {
          if (phaseIndexRef.current < phases.length - 1) {
            phaseIndexRef.current += 1;
            const nextPhase = phases[phaseIndexRef.current];
            triggerTransitionFx();
            player.seekTo(nextPhase.start, true);
            player.playVideo?.();
            return;
          }

          if (!loopPlayback) {
            player.pauseVideo?.();
            phaseIndexRef.current = phases.length - 1;
            setVirtualElapsed(totalDuration);
          } else {
            phaseIndexRef.current = 0;
            const firstPhase = phases[0];
            triggerTransitionFx();
            player.seekTo(firstPhase.start, true);
            player.playVideo?.();
            setVirtualElapsed(0);
          }
        }
      }, 250);
    };

    void boot();

    return () => {
      destroyed = true;
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (readyFallbackTimeoutRef.current) {
        window.clearTimeout(readyFallbackTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      playerRef.current?.destroy?.();
    };
  }, [autoPlay, loopPlayback, playerElementId, phases, shouldBootPlayer, showControls, totalDuration, videoId]);

  return (
    <div className={className} ref={hostRef}>
      {shouldBootPlayer ? <div id={playerElementId} /> : <div className="short-idle-placeholder" />}
      {showTransitionFx ? <div className="short-transition-fx" aria-hidden="true" /> : null}
      <span className="short-remaining">Nog {remainingSeconds}s</span>
      {!showControls ? (
        <button
          type="button"
          className="short-start-button"
          onClick={() => {
            if (!isActivated) {
              setIsActivated(true);
              return;
            }
            const player = playerRef.current;
            if (!player) return;
            player.playVideo?.();
            setIsPlaying(true);
          }}
          disabled={false}
        >
          {!isActivated ? 'Start short' : !isReady ? 'Laden...' : isPlaying ? 'Speelt af' : 'Start short'}
        </button>
      ) : null}
      {showControls ? (
        <div className="short-controls-panel">
          <div className="short-controls">
            <button
              type="button"
              className="short-control-button"
              onClick={() => seekVirtual(virtualElapsed - 10)}
              disabled={!isReady}
            >
              -10s
            </button>
            <button
              type="button"
              className="short-control-button"
              onClick={() => {
                const player = playerRef.current;
                if (!player) return;
                if (isPlaying) {
                  player.pauseVideo?.();
                } else {
                  player.playVideo?.();
                }
              }}
              disabled={!isReady}
            >
              {isPlaying ? 'Pauze' : 'Play'}
            </button>
            <button
              type="button"
              className="short-control-button"
              onClick={() => seekVirtual(virtualElapsed + 10)}
              disabled={!isReady}
            >
              +10s
            </button>
          </div>
          <input
            type="range"
            className="short-timeline"
            min={0}
            max={Math.max(1, totalDuration)}
            step={1}
            value={Math.min(totalDuration, Math.max(0, Math.round(virtualElapsed)))}
            onChange={(event) => seekVirtual(Number(event.target.value))}
            disabled={!isReady}
            aria-label="Short tijdlijn"
          />
        </div>
      ) : null}
    </div>
  );
}
