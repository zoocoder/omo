import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  beatIntensity: number;
  isBeatDetected: boolean;
  onFrequencyData?: (data: { 
    lowFreq: number; 
    midFreq: number; 
    highFreq: number; 
    overall: number;
  }) => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioElement,
  isPlaying,
  beatIntensity,
  isBeatDetected,
  onFrequencyData,
}) => {

  const animationFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);



  useEffect(() => {
    if (!audioElement || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const initializeAudioContext = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256; // Better frequency resolution
          analyserRef.current.smoothingTimeConstant = 0.6; // More smoothing for gentler transitions
        }

        if (!sourceRef.current && audioElement) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }

        if (!frequencyDataRef.current) {
          frequencyDataRef.current = new (Uint8Array as unknown as { new(length: number): Uint8Array<ArrayBuffer> })(analyserRef.current.frequencyBinCount);
        }
      } catch (error) {
        console.warn('Could not initialize audio visualizer:', error);
      }
    };

    const analyzeAudio = () => {
      if (!analyserRef.current || !frequencyDataRef.current) return;

      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);

      // Extract frequency ranges for gradient control
      const bufferLength = frequencyDataRef.current.length;
      const lowEnd = Math.floor(bufferLength * 0.2); // Bass frequencies
      const midEnd = Math.floor(bufferLength * 0.6); // Mid frequencies
      const highEnd = bufferLength; // High frequencies

      // Calculate average amplitude for each frequency range
      let lowFreq = 0, midFreq = 0, highFreq = 0;
      
      for (let i = 0; i < lowEnd; i++) {
        lowFreq += frequencyDataRef.current[i];
      }
      lowFreq = (lowFreq / lowEnd) / 255;

      for (let i = lowEnd; i < midEnd; i++) {
        midFreq += frequencyDataRef.current[i];
      }
      midFreq = (midFreq / (midEnd - lowEnd)) / 255;

      for (let i = midEnd; i < highEnd; i++) {
        highFreq += frequencyDataRef.current[i];
      }
      highFreq = (highFreq / (highEnd - midEnd)) / 255;

      // Overall amplitude
      const overall = (lowFreq + midFreq + highFreq) / 3;

      // Send frequency data to parent component
      if (onFrequencyData) {
        onFrequencyData({ lowFreq, midFreq, highFreq, overall });
        
        // Temporary debugging - remove this later
        if (Math.random() < 0.01) { // Log only 1% of the time to avoid spam
          console.log('Frequency Data:', { lowFreq: lowFreq.toFixed(3), midFreq: midFreq.toFixed(3), highFreq: highFreq.toFixed(3), overall: overall.toFixed(3) });
        }
      }

      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };

    initializeAudioContext();
    
    const startTimeout = setTimeout(() => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      analyzeAudio();
    }, 100);

    return () => {
      clearTimeout(startTimeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioElement, isPlaying, beatIntensity, isBeatDetected]);

  return null; // No visual component, just audio analysis
};
