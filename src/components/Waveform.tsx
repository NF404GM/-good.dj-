import React, { useRef, useEffect } from 'react';

import WaveformWorker from '../services/waveform-render.worker?worker';

// 8 hot cue colors — resolved from CSS tokens at runtime for canvas use
function getCueColors(): string[] {
    const style = getComputedStyle(document.documentElement);
    return [
        style.getPropertyValue('--color-cue-1').trim() || '#FF2D55',
        style.getPropertyValue('--color-cue-2').trim() || '#FF7A00',
        style.getPropertyValue('--color-cue-3').trim() || '#FFB800',
        style.getPropertyValue('--color-cue-4').trim() || '#00E87A',
        style.getPropertyValue('--color-cue-5').trim() || '#00C8FF',
        style.getPropertyValue('--color-cue-6').trim() || '#3B82F6',
        style.getPropertyValue('--color-cue-7').trim() || '#8B5CF6',
        style.getPropertyValue('--color-cue-8').trim() || '#EC4899',
    ];
}

interface WaveformProps {
  isPlaying: boolean;
  color: string;
  progress: number;
  data: any[] | null;
  cuePoints?: (number | null)[];
  loopRegion?: { start: number; end: number } | null;
}

export const Waveform: React.FC<WaveformProps> = ({ isPlaying, color, progress, data, cuePoints, loopRegion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !('transferControlToOffscreen' in canvas)) return;

    // Sticky Worker Pattern: Attach the worker to the canvas DOM node itself.
    // This survives React Strict Mode's double-mount and avoids InvalidStateError.
    let worker = (canvas as any)._worker;

    if (!worker) {
      try {
        worker = new WaveformWorker();
        const offscreen = canvas.transferControlToOffscreen();
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement?.getBoundingClientRect() || { width: 500, height: 100 };

        worker.postMessage({
          type: 'INIT',
          canvas: offscreen,
          width: rect.width * dpr,
          height: rect.height * dpr,
          dpr,
          data,
          color,
          cuePoints,
          cueColors: getCueColors(),
          loopRegion,
          progress,
          isPlaying
        }, [offscreen]);

        (canvas as any)._worker = worker;
        console.log('[Waveform] New Worker initialized & transferred');
      } catch (e) {
        console.error('[Waveform] Fatal: OffscreenCanvas transfer failed:', e);
        return;
      }
    } else {
      console.log('[Waveform] Re-attached to existing worker');
    }

    workerRef.current = worker;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent && workerRef.current) {
        const newDpr = window.devicePixelRatio || 1;
        const newRect = parent.getBoundingClientRect();
        workerRef.current.postMessage({
          type: 'RESIZE',
          width: newRect.width * newDpr,
          height: newRect.height * newDpr,
          dpr: newDpr
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      // NOTE: We DO NOT terminate the worker here if it's attached to the canvas,
      // because if this is a StrictMode double-mount, we need the worker alive.
      // The worker will be Garbage Collected when the canvas DOM node is truly destroyed.
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Sync state changes to worker (always use workerRef.current)
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_DATA',
        data,
        color,
        cuePoints,
        cueColors: getCueColors(),
        loopRegion
      });
    }
  }, [data, color, cuePoints, loopRegion]);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_STATE',
        progress,
        isPlaying
      });
    }
  }, [progress, isPlaying]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};
