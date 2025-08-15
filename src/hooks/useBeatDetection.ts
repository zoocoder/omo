import { useEffect, useRef, useState } from 'react';

interface BeatDetectionHook {
  isBeatDetected: boolean;
  beatIntensity: number;
  tempo: number;
}

export const useBeatDetection = (
  audioElement: HTMLAudioElement | null,
  isPlaying: boolean
): BeatDetectionHook => {
  const [isBeatDetected, setIsBeatDetected] = useState(false);
  const [beatIntensity, setBeatIntensity] = useState(0);
  const [tempo, setTempo] = useState(120); // Default BPM
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const lastBeatTimeRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(0);
  const energyHistoryRef = useRef<number[]>([]);

  // Detect iOS (including iPadOS on Safari)
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );

  useEffect(() => {
    // On iOS or when page is hidden, skip Web Audio graph to preserve native audio output (prevents silent playback in background/lock screen)
    if (isIOS || (typeof document !== 'undefined' && document.hidden)) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsBeatDetected(false);
      setBeatIntensity(0);
      return;
    }

    if (!audioElement || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsBeatDetected(false);
      setBeatIntensity(0);
      return;
    }

    // Initialize audio context and analyser
    const initializeAudioContext = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 512;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        if (!sourceRef.current && audioElement) {
          try {
            // IMPORTANT: Only connect to analyser. Do NOT connect to destination on iOS as it can mute native element output in background.
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            sourceRef.current.connect(analyserRef.current);
            // Do not connect analyser to destination; we only sample, not route audio
          } catch (error) {
            // Element already connected to another AudioContext, skip beat detection
            console.warn('Audio element already connected, skipping beat detection:', error);
            return;
          }
        }

        if (!frequencyDataRef.current) {
          frequencyDataRef.current = new (Uint8Array as unknown as { new(length: number): Uint8Array<ArrayBuffer> })(analyserRef.current.frequencyBinCount);
        }
      } catch (error) {
        console.warn('Could not initialize audio context for beat detection:', error);
      }
    };

    // Beat detection algorithm
    const detectBeat = () => {
      if (!analyserRef.current || !frequencyDataRef.current) return;

      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      
      // Focus on bass frequencies (roughly 60-120 Hz)
      const bassRange = Array.prototype.slice.call(frequencyDataRef.current, 2, 8) as number[];
      const bassEnergy = (bassRange as number[]).reduce((sum, value) => sum + (value as number), 0) / bassRange.length;
      
      // Update energy history for adaptive threshold
      energyHistoryRef.current.push(bassEnergy);
      if (energyHistoryRef.current.length > 40) { // Keep last ~1 second of data
        energyHistoryRef.current.shift();
      }

      // Calculate adaptive threshold (made more sensitive)
      const avgEnergy = energyHistoryRef.current.reduce((sum, val) => sum + val, 0) / energyHistoryRef.current.length;
      const variance = energyHistoryRef.current.reduce((sum, val) => sum + Math.pow(val - avgEnergy, 2), 0) / energyHistoryRef.current.length;
      beatThresholdRef.current = avgEnergy + Math.sqrt(variance) * 1.0; // Reduced from 1.5 to 1.0 for sensitivity

      const now = Date.now();
      const timeSinceLastBeat = now - lastBeatTimeRef.current;
      
      // Prevent beats closer than 200ms (300 BPM max) - more responsive
      const minBeatInterval = 200;
      
      if (bassEnergy > beatThresholdRef.current && timeSinceLastBeat > minBeatInterval) {
        setIsBeatDetected(true);
        const intensity = Math.min((bassEnergy / beatThresholdRef.current) - 1, 1);
        setBeatIntensity(intensity);
        lastBeatTimeRef.current = now;
        
        // Estimate tempo based on beat intervals
        if (lastBeatTimeRef.current > 0) {
          const bpm = Math.round(60000 / timeSinceLastBeat);
          if (bpm >= 60 && bpm <= 200) {
            setTempo(bpm);
          }
        }
        
        // Reset beat flag after longer duration for more visible animation
        setTimeout(() => setIsBeatDetected(false), 300);
      } else {
        setBeatIntensity(0);
      }
    };

    // Animation loop
    const animate = () => {
      detectBeat();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start beat detection
    initializeAudioContext();
    
    // Small delay to ensure audio context is ready
    const startTimeout = setTimeout(() => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      animate();
    }, 100);

    return () => {
      clearTimeout(startTimeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioElement, isPlaying, isIOS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isBeatDetected,
    beatIntensity,
    tempo,
  };
};
