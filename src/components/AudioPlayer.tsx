import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { LoopState } from '../types/lyrics';

interface AudioPlayerProps {
  audioUrl: string;
  coverUrl?: string;
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  onLoadedData: () => void;
  onError: (error: string) => void;
  onLoopIteration?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onAudioElementReady?: (audioElement: HTMLAudioElement) => void;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  songTitle?: string;
  artist?: string;
}

export interface AudioPlayerRef {
  seekTo: (timeInMs: number) => void;
  setLoopRegion: (startTime: number, endTime: number, repeatCount: number) => void;
  clearLoop: () => void;
  getLoopState: () => LoopState | null;
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  startTemporaryLoop: (startTime: number, endTime: number, repeatCount: number) => void;
  prepareForTrackChange: (shouldAutoplay: boolean) => void;
  loadAndAutoplay: (sourceUrl: string) => void;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(({ 
  audioUrl,
  coverUrl,
  onTimeUpdate,
  onDurationChange,
  onLoadedData,
  onError,
  onLoopIteration,
  onPlayStateChange,
  onAudioElementReady,
  onEnded,
  onNext,
  onPrev,
  songTitle,
  artist,
}, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const demoTimerRef = useRef<number | null>(null);
  const autoplayOnNextLoadRef = useRef<boolean>(false);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Loop state
  const [loopRegion, setLoopRegion] = useState<{
    startTime: number;
    endTime: number;
    repeatCount: number;
    currentIteration: number;
    isActive: boolean;
  } | null>(null);



  // Update media session when play state changes
  const updateMediaSessionPlaybackState = useCallback(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Check loop boundary and handle looping
  const checkLoopBoundary = useCallback((time: number) => {
    if (!loopRegion || !loopRegion.isActive) return;
    
    if (time >= loopRegion.endTime) {
      console.log(`Loop boundary hit: iteration ${loopRegion.currentIteration}, repeatCount ${loopRegion.repeatCount}`);
      
      // Check if we should continue looping (currentIteration + 1 because we increment after this check)
      const shouldContinue = loopRegion.repeatCount === 0 || 
                             loopRegion.currentIteration + 1 < loopRegion.repeatCount;
      
      console.log(`Should continue: ${shouldContinue}`);
      
      if (shouldContinue) {
        // Continue loop - seek back to start
        const newIteration = loopRegion.currentIteration + 1;
        console.log(`Starting iteration ${newIteration}`);
        setLoopRegion(prev => prev ? { ...prev, currentIteration: newIteration } : null);
        
        if (isDemoMode) {
          setCurrentTime(loopRegion.startTime);
          onTimeUpdate(loopRegion.startTime);
        } else if (audioRef.current) {
          audioRef.current.currentTime = loopRegion.startTime / 1000;
          // Immediately update the time to ensure continuity
          const newTime = loopRegion.startTime;
          setCurrentTime(newTime);
          onTimeUpdate(newTime);
        }
        
        if (onLoopIteration) {
          onLoopIteration();
        }
      } else {
        // Loop complete - stop looping
        console.log('Loop complete, stopping');
        setLoopRegion(prev => prev ? { ...prev, isActive: false } : null);
        if (isPlaying) {
          setIsPlaying(false);
          updateMediaSessionPlaybackState();
        }
      }
    }
  }, [loopRegion, isDemoMode, onTimeUpdate, onLoopIteration]);

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime * 1000; // Convert to milliseconds
      setCurrentTime(time);
      onTimeUpdate(time);
      checkLoopBoundary(time);
    }
  }, [onTimeUpdate, checkLoopBoundary]);

  // High-frequency timer for smoother progress updates during real audio playback
  const audioUpdateTimerRef = useRef<number | null>(null);
  
  const startAudioUpdateTimer = useCallback(() => {
    if (audioUpdateTimerRef.current) clearInterval(audioUpdateTimerRef.current);
    
    audioUpdateTimerRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        const time = audioRef.current.currentTime * 1000;
        setCurrentTime(time);
        onTimeUpdate(time);
        checkLoopBoundary(time);
      }
    }, 16); // Update every 16ms for 60fps smoothness
  }, [onTimeUpdate, checkLoopBoundary]);

  const stopAudioUpdateTimer = useCallback(() => {
    if (audioUpdateTimerRef.current) {
      clearInterval(audioUpdateTimerRef.current);
      audioUpdateTimerRef.current = null;
    }
  }, []);

  // Handle duration change
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      console.log('AudioPlayer: Metadata loaded, current time before reset:', audioRef.current.currentTime);
      const dur = audioRef.current.duration * 1000; // Convert to milliseconds
      setDuration(dur);
      onDurationChange(dur);
      // Aggressively reset current time to beginning when new song loads
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      onTimeUpdate(0);
      console.log('AudioPlayer: After metadata reset, current time:', audioRef.current.currentTime);
      setIsLoading(false);
      onLoadedData();

      // If parent requested autoplay-on-load (from a user gesture), start playback now
      if (autoplayOnNextLoadRef.current) {
        autoplayOnNextLoadRef.current = false;
        try {
          const playPromise = audioRef.current.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
              startAudioUpdateTimer();
              setIsPlaying(true);
              updateMediaSessionPlaybackState();
              onPlayStateChange?.(true);
            }).catch(() => {
              // Ignore; mobile may block if gesture not recognized
            });
          }
        } catch {
          // Ignore play errors here
        }
      }
    }
  }, [onDurationChange, onLoadedData, onTimeUpdate]);

  // Handle audio errors
  const handleError = useCallback(() => {
    // Don't report errors in demo mode
    if (isDemoMode) return;
    
    const error = audioRef.current?.error;
    const errorMessage = error ? `Audio error: ${error.message}` : 'Unknown audio error';
    onError(errorMessage);
    setIsLoading(false);
  }, [onError, isDemoMode]);

  // Demo mode timer
  const startDemoTimer = useCallback(() => {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    
    demoTimerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 16; // Increment by 16ms for 60fps smoothness
        onTimeUpdate(newTime);
        checkLoopBoundary(newTime);
        
        if (newTime >= duration) {
          setIsPlaying(false);
          updateMediaSessionPlaybackState();
          if (demoTimerRef.current) clearInterval(demoTimerRef.current);
          return duration;
        }
        return newTime;
      });
    }, 16); // Update every 16ms for 60fps smoothness
  }, [duration, onTimeUpdate, checkLoopBoundary]);

  // Play/pause toggle
  const togglePlayPause = useCallback(async () => {
    if (isDemoMode) {
      // Demo mode logic
      if (isPlaying) {
        if (demoTimerRef.current) clearInterval(demoTimerRef.current);
        setIsPlaying(false);
        updateMediaSessionPlaybackState();
      } else {
        startDemoTimer();
        setIsPlaying(true);
        updateMediaSessionPlaybackState();
      }
      return;
    }

    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        stopAudioUpdateTimer();
        setIsPlaying(false);
        updateMediaSessionPlaybackState();
        onPlayStateChange?.(false);
      } else {
        await audioRef.current.play();
        startAudioUpdateTimer();
        setIsPlaying(true);
        updateMediaSessionPlaybackState();
        onPlayStateChange?.(true);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Playback error');
    }
  }, [isPlaying, onError, isDemoMode, startDemoTimer, startAudioUpdateTimer, stopAudioUpdateTimer, onPlayStateChange, updateMediaSessionPlaybackState]);

  // Resume audio context if suspended
  const resumeAudioContext = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        // Try to resume any suspended audio contexts
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          // Check if there are any suspended contexts
          const contexts = (window as any).__audioContexts || [];
          for (const ctx of contexts) {
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
          }
        }
        
        // Also ensure the audio element itself is ready
        if (audioRef.current) {
          audioRef.current.muted = false;
          audioRef.current.volume = volume;
        }
      } catch (error) {
        console.log('Audio context resume failed:', error);
      }
    }
  }, [volume]);

  // Play method
  const play = useCallback(async () => {
    if (isPlaying) return; // Already playing
    
    if (isDemoMode) {
      startDemoTimer();
      setIsPlaying(true);
      updateMediaSessionPlaybackState();
      onPlayStateChange?.(true);
      return;
    }

    if (!audioRef.current) return;

    try {
      // Resume audio context before playing
      await resumeAudioContext();
      await audioRef.current.play();
      startAudioUpdateTimer();
      setIsPlaying(true);
      updateMediaSessionPlaybackState();
      onPlayStateChange?.(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Playback error');
    }
  }, [isPlaying, onError, isDemoMode, startDemoTimer, startAudioUpdateTimer, resumeAudioContext, onPlayStateChange, updateMediaSessionPlaybackState]);

  // Pause method
  const pause = useCallback(() => {
    if (!isPlaying) return; // Already paused
    
    if (isDemoMode) {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      setIsPlaying(false);
      updateMediaSessionPlaybackState();
      onPlayStateChange?.(false);
      return;
    }

    if (!audioRef.current) return;

    audioRef.current.pause();
    stopAudioUpdateTimer();
    setIsPlaying(false);
    updateMediaSessionPlaybackState();
    onPlayStateChange?.(false);
  }, [isPlaying, isDemoMode, stopAudioUpdateTimer, onPlayStateChange, updateMediaSessionPlaybackState]);

  // Imperatively load a new source and autoplay from 0:00 (helps iOS treat it as same gesture)
  const loadAndAutoplay = useCallback(async (sourceUrl: string) => {
    if (isDemoMode) return;
    if (!audioRef.current) return;
    try {
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      onTimeUpdate(0);
      const absoluteUrl = new URL(sourceUrl, window.location.href).href;
      audioRef.current.src = absoluteUrl;
      lastLoadedUrlRef.current = absoluteUrl;
      audioRef.current.currentTime = 0;
      await resumeAudioContext();
      await audioRef.current.play();
      startAudioUpdateTimer();
      setIsPlaying(true);
      updateMediaSessionPlaybackState();
      onPlayStateChange?.(true);
    } catch (error) {
      setIsLoading(false);
    }
  }, [isDemoMode, onTimeUpdate, resumeAudioContext, startAudioUpdateTimer, onPlayStateChange, updateMediaSessionPlaybackState]);

  // MediaSession API for lock screen controls
  const updateMediaSession = useCallback(() => {
    if ('mediaSession' in navigator && songTitle && artist) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: songTitle,
        artist: artist,
        album: 'Japanese Learning Songs',
        artwork: coverUrl ? [
          { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: coverUrl, sizes: '128x128', type: 'image/jpeg' }
        ] : undefined
      });

      // Set up media session action handlers
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) {
          play();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) {
          pause();
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (onPrev) onPrev();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (onNext) onNext();
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10);
        }
      });
    }
  }, [songTitle, artist, coverUrl, onPrev, onNext, isPlaying, play, pause]);

  // Restart to beginning
  const restart = useCallback(() => {
    // If within first 1.5 seconds, go to previous track if available (Spotify-like behavior)
    if (currentTime <= 1500 && onPrev) {
      onPrev();
      return;
    }
    if (isDemoMode) {
      setCurrentTime(0);
      onTimeUpdate(0);
      if (!isPlaying) {
        startDemoTimer();
        setIsPlaying(true);
        updateMediaSessionPlaybackState();
      }
      return;
    }
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    onTimeUpdate(0);
  }, [currentTime, onPrev, isDemoMode, isPlaying, onTimeUpdate, startDemoTimer]);

  // Seek to specific time and start playing
  const seekTo = useCallback((timeInMs: number) => {
    if (isDemoMode) {
      // Demo mode seeking and playing
      const clampedTime = Math.max(0, Math.min(timeInMs, duration));
      setCurrentTime(clampedTime);
      onTimeUpdate(clampedTime);
      
      // Start playing if not already playing
      if (!isPlaying) {
        startDemoTimer();
        setIsPlaying(true);
        updateMediaSessionPlaybackState();
      }
    } else if (audioRef.current) {
      // Immediately update state BEFORE setting the media position to remove UI delay
      const clampedTime = Math.max(0, Math.min(timeInMs, duration));
      setCurrentTime(clampedTime);
      onTimeUpdate(clampedTime);
      
      // Set position after state so UI highlights instantly
      audioRef.current.currentTime = clampedTime / 1000;
      
      // Start playing if not already playing
      if (!isPlaying) {
        audioRef.current.play().then(() => {
          startAudioUpdateTimer();
          setIsPlaying(true);
          updateMediaSessionPlaybackState();
        }).catch((error) => {
          console.error('Error starting playback after seek:', error);
          onError('Failed to start playback: ' + (error instanceof Error ? error.message : String(error)));
        });
      }
    }
  }, [isDemoMode, duration, onTimeUpdate, isPlaying, startDemoTimer, startAudioUpdateTimer, onError]);

  // Loop management functions
  const setLoopRegionHandler = useCallback((startTime: number, endTime: number, repeatCount: number) => {
    setLoopRegion({
      startTime,
      endTime,
      repeatCount,
      currentIteration: 0,
      isActive: true,
    });
    
    // Automatically seek to loop start and start playing
    if (isDemoMode) {
      setCurrentTime(startTime);
      onTimeUpdate(startTime);
      if (!isPlaying) {
        startDemoTimer();
        setIsPlaying(true);
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = startTime / 1000;
      if (!isPlaying) {
        audioRef.current.play().then(() => {
          startAudioUpdateTimer();
          setIsPlaying(true);
        }).catch((error) => {
          console.error('Error starting playback:', error);
          onError('Failed to start loop playback: ' + error.message);
        });
      }
    }
  }, [isDemoMode, onTimeUpdate, isPlaying, startDemoTimer, startAudioUpdateTimer, onError]);

  const clearLoopHandler = useCallback(() => {
    setLoopRegion(null);
  }, []);

  const getLoopStateHandler = useCallback((): LoopState | null => {
    if (!loopRegion) return null;
    
    return {
      isActive: loopRegion.isActive,
      mode: null, // This is managed externally
      startTime: loopRegion.startTime,
      endTime: loopRegion.endTime,
      selectedLyricIndices: [], // This is managed externally
      repeatCount: loopRegion.repeatCount,
      currentIteration: loopRegion.currentIteration,
    };
  }, [loopRegion]);

  const startTemporaryLoop = useCallback((startTime: number, endTime: number, repeatCount: number) => {
    // Start a temporary loop (like for voice commands) - same as setLoopRegion but more explicit
    setLoopRegionHandler(startTime, endTime, repeatCount);
  }, [setLoopRegionHandler]);

  // Allow parent to indicate we should autoplay once the next source loads
  const prepareForTrackChange = useCallback((shouldAutoplay: boolean) => {
    autoplayOnNextLoadRef.current = shouldAutoplay;
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    seekTo,
    setLoopRegion: setLoopRegionHandler,
    clearLoop: clearLoopHandler,
    getLoopState: getLoopStateHandler,
    togglePlayPause,
    play,
    pause,
    startTemporaryLoop,
    prepareForTrackChange,
    loadAndAutoplay,
  }), [seekTo, setLoopRegionHandler, clearLoopHandler, getLoopStateHandler, togglePlayPause, play, pause, startTemporaryLoop, prepareForTrackChange, loadAndAutoplay]);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // Format time for display

  // Notify when audio element is ready
  useEffect(() => {
    if (audioRef.current && onAudioElementReady) {
      onAudioElementReady(audioRef.current);
    }
  }, [audioUrl, onAudioElementReady]);

  const formatTime = (timeInMs: number): string => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle audio ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    updateMediaSessionPlaybackState();
    if (onEnded) {
      onEnded();
    }
  }, [onEnded, updateMediaSessionPlaybackState]);

  // Set up event listeners and audio session
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isDemoMode) return;

    // Set up audio session for background playback
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleError, handleEnded, isDemoMode]);

  // Handle page visibility changes to resume audio context
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && isPlaying && audioRef.current) {
        // Page became visible and should be playing
        try {
          await resumeAudioContext();
          if (audioRef.current.paused) {
            await audioRef.current.play();
          }
        } catch (error) {
          console.log('Failed to resume playback:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, resumeAudioContext]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (demoTimerRef.current) {
        clearInterval(demoTimerRef.current);
      }
      if (audioUpdateTimerRef.current) {
        clearInterval(audioUpdateTimerRef.current);
      }
    };
  }, []);

  // Update media session when song info changes
  useEffect(() => {
    if (songTitle && artist) {
      updateMediaSession();
    }
  }, [songTitle, artist, coverUrl, updateMediaSession]);

  // Expose audio controls to native iOS for lock screen/background control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).capacitorPlayAudio = () => {
        if (!isPlaying) {
          play();
        }
      };
      (window as any).capacitorPauseAudio = () => {
        if (isPlaying) {
          pause();
        }
      };
      (window as any).capacitorNextTrack = () => {
        if (onNext) onNext();
      };
      (window as any).capacitorPrevTrack = () => {
        if (onPrev) onPrev();
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).capacitorPlayAudio;
        delete (window as any).capacitorPauseAudio;
        delete (window as any).capacitorNextTrack;
        delete (window as any).capacitorPrevTrack;
      }
    };
  }, [isPlaying, play, pause, onNext, onPrev]);

  // Update audio source when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      console.log('AudioPlayer: URL changed to', audioUrl, 'current time before reset:', audioRef.current.currentTime);
      // Don't show loading spinner - let the play button stay ready
      setIsPlaying(false);
      // Reset time immediately and notify parent
      setCurrentTime(0);
      onTimeUpdate(0);
      updateMediaSessionPlaybackState();
      // Set source and call load to ensure 'loadedmetadata' fires reliably across browsers
      const absolutePropUrl = new URL(audioUrl, window.location.href).href;
      if (lastLoadedUrlRef.current === absolutePropUrl) {
        return;
      }
      audioRef.current.src = absolutePropUrl;
      lastLoadedUrlRef.current = absolutePropUrl;
      audioRef.current.currentTime = 0; // Aggressive reset for mobile
      console.log('AudioPlayer: Set currentTime to 0, actual value:', audioRef.current.currentTime);
      audioRef.current.load();
    } else if (!audioUrl) {
      // Demo mode - no audio file
      setIsDemoMode(true);
      setIsLoading(false);
      setDuration(90000); // 90 seconds for demo
      onDurationChange(90000);
      onLoadedData();
    }
  }, [audioUrl, onTimeUpdate]);

  return (
    <div className="audio-player">
      {!isDemoMode && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          crossOrigin="anonymous"
        />
      )}
      
      {/* Mobile Spotify-style layout */}
      <div className="mobile-spotify-layout">
        {/* Layer 1: Album + Song info */}
        <div className="song-info-layer">
          {coverUrl && (
            <img
              src={coverUrl}
              alt="Album cover"
              className="mobile-cover-art"
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith('/cover.jpg')) {
                  img.src = img.src.replace('/cover.jpg', '/cover.png');
                }
              }}
            />
          )}
          <div className="song-text-info">
            <div className="song-title-container">
              <div className="song-title-scroll">
                {songTitle || 'Unknown Song'}
              </div>
            </div>
            <div className="song-artist">
              {artist || 'Unknown Artist'}
            </div>
          </div>
        </div>

        {/* Layer 2: Progress bar */}
        <div className="progress-layer">
          <div className="time-start">{formatTime(currentTime)}</div>
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="mobile-progress-bar"
            disabled={isLoading}
          />
          <div className="time-end">{formatTime(duration)}</div>
        </div>

        {/* Layer 3: Transport controls */}
        <div className="transport-layer">
                  <button
          onClick={restart}
          disabled={isLoading}
          className="mobile-transport-btn"
          aria-label="Previous / Go to beginning"
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/>
            </svg>
          </button>

          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            className="mobile-play-btn"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div className="mobile-loading-spinner"></div>
            ) : isPlaying ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button
            onClick={() => onNext && onNext()}
            disabled={isLoading}
            className="mobile-transport-btn"
            aria-label="Next song"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {isDemoMode && (
          <div className="mobile-demo-indicator">
            🎵 Demo Mode - Visual lyrics sync (no audio)
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="desktop-audio-controls">
        {coverUrl && (
          <img
            src={coverUrl}
            alt="Album cover"
            className="cover-art"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src.endsWith('/cover.jpg')) {
                img.src = img.src.replace('/cover.jpg', '/cover.png');
              }
            }}
          />
        )}
        {isDemoMode && (
          <div className="demo-indicator">
            🎵 Demo Mode - Visual lyrics sync (no audio)
          </div>
        )}
        
        <button
          onClick={restart}
          disabled={isLoading}
          className="transport-btn"
          aria-label="Previous / Go to beginning"
          title="Previous / Go to beginning"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3 2h2v12H3zM6 8l7-5v10L6 8z"/>
          </svg>
        </button>

        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="play-pause-btn"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="3" height="12" rx="1"/>
              <rect x="10" y="2" width="3" height="12" rx="1"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 2v12l10-6L3 2z"/>
            </svg>
          )}
        </button>

        <button
          onClick={() => onNext && onNext()}
          disabled={isLoading}
          className="transport-btn"
          aria-label="Next song"
          title="Next song"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13 2h-2v12h2zM10 8L3 13V3l7 5z"/>
          </svg>
        </button>

        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="progress-container">
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="progress-bar"
            disabled={isLoading}
          />
        </div>

        <div className="volume-container">
          <div className="volume-icon">
            {volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2.5v11L4.5 10H2V6h2.5L8 2.5zM11.854 7.854l-1.708-1.708a.5.5 0 0 0-.708.708L10.293 7.5 9.439 8.354a.5.5 0 1 0 .708.708l1.707-1.708z"/>
                <path d="M9.439 6.146a.5.5 0 0 1 .708 0l1.707 1.708 1.708-1.708a.5.5 0 1 1 .708.708L12.56 8.5l1.708 1.646a.5.5 0 0 1-.708.708L11.854 9.146 10.146 10.854a.5.5 0 0 1-.708-.708L11.146 8.5 9.439 6.854a.5.5 0 0 1 0-.708z"/>
              </svg>
            ) : volume < 0.5 ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2.5v11L4.5 10H2V6h2.5L8 2.5z"/>
                <path d="M10.5 6.5a2.5 2.5 0 0 1 0 3v-3z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2.5v11L4.5 10H2V6h2.5L8 2.5z"/>
                <path d="M10.5 4a4.5 4.5 0 0 1 0 8v-1a3.5 3.5 0 0 0 0-6v-1z"/>
                <path d="M10.5 6.5a2.5 2.5 0 0 1 0 3v-3z"/>
              </svg>
            )}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="volume-bar"
          />
        </div>
      </div>

      <style jsx>{`
        .audio-player {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0 4px 0;
          box-shadow: none;
          border: 1px solid #3e3e3e;
        }

        .desktop-audio-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cover-art {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          object-fit: cover;
          flex: 0 0 auto;
          border: 1px solid #3e3e3e;
          background: #111;
          -webkit-user-drag: none;
          user-select: none;
        }

        .transport-btn {
          background: transparent;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 18px;
          color: #b3b3b3;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }

        .transport-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #ffffff;
        }

        .transport-btn:active {
          transform: scale(0.96);
        }

        .demo-indicator {
          background: #1db954;
          color: white;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .play-pause-btn {
          background: #1db954;
          border: none;
          border-radius: 50%;
          width: 56px;
          height: 56px;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          color: #000;
          font-weight: bold;
        }

        .play-pause-btn:hover:not(:disabled) {
          background: #1ed760;
          transform: scale(1.05);
        }

        .play-pause-btn:disabled {
          background: #535353;
          cursor: not-allowed;
          color: #b3b3b3;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #535353;
          border-top: 2px solid #000;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .time-display {
          display: flex;
          gap: 5px;
          font-family: 'Circular', sans-serif;
          font-size: 12px;
          color: #b3b3b3;
          min-width: 100px;
          font-weight: 400;
        }

        .progress-container {
          flex: 1;
          min-width: 200px;
          margin-left: -6px; /* Slightly tuck slider closer to play button */
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: #404040;
          outline: none;
          cursor: pointer;
          -webkit-appearance: none;
          vertical-align: middle;
        }

        .progress-bar::-webkit-slider-track {
          background: #404040;
          border-radius: 2px;
        }

        .progress-bar::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1db954;
          cursor: pointer;
          transition: all 0.2s;
        }

        .progress-bar:hover::-webkit-slider-thumb {
          background: #1ed760;
          transform: scale(1.2);
        }

        .progress-bar::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #007AFF;
          cursor: pointer;
          border: none;
        }

        .volume-container {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 100%;
        }

        .volume-icon {
          color: #b3b3b3;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .volume-icon:hover {
          color: #ffffff;
        }

        .volume-bar {
          width: 80px;
          height: 4px;
          border-radius: 2px;
          background: #404040;
          outline: none;
          cursor: pointer;
          -webkit-appearance: none;
          vertical-align: middle;
          margin-top: 2px;
        }

        .volume-bar::-webkit-slider-track {
          background: #404040;
          border-radius: 2px;
        }

        .volume-bar::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1db954;
          cursor: pointer;
          transition: all 0.2s;
        }

        .volume-bar:hover::-webkit-slider-thumb {
          background: #1ed760;
          transform: scale(1.2);
        }

        .volume-bar::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #007AFF;
          cursor: pointer;
          border: none;
        }

        @media (max-width: 768px) {
          .audio-player { 
            padding: 16px; 
            margin: 8px 0; 
            border-radius: 16px; 
          }
          
          /* Hide desktop layout on mobile */
          .desktop-audio-controls { display: none; }
          
          /* Show mobile layout on mobile */
          .mobile-spotify-layout { 
            display: flex; 
            flex-direction: column; 
            gap: 20px; 
          }
          
          /* Layer 1: Song info */
          .song-info-layer {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          
          .mobile-cover-art {
            width: 64px;
            height: 64px;
            border-radius: 8px;
            object-fit: cover;
            flex-shrink: 0;
            border: 1px solid #3e3e3e;
          }
          
          .song-text-info {
            flex: 1;
            min-width: 0;
          }
          
          .song-title-container {
            margin-bottom: 4px;
          }
          
          .song-title-scroll {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .song-artist {
            font-size: 14px;
            color: #b3b3b3;
            font-weight: 400;
          }
          
          /* Layer 2: Progress bar */
          .progress-layer {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .time-start, .time-end {
            font-size: 12px;
            color: #b3b3b3;
            font-variant-numeric: tabular-nums;
            min-width: 40px;
            text-align: center;
          }
          
          .mobile-progress-bar {
            flex: 1;
            height: 4px;
            border-radius: 2px;
            background: #3e3e3e;
            outline: none;
            -webkit-appearance: none;
          }
          
          .mobile-progress-bar::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #1db954;
            cursor: pointer;
            border: 2px solid #000;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          }
          
          .mobile-progress-bar::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #1db954;
            cursor: pointer;
            border: 2px solid #000;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          }
          
          /* Layer 3: Transport controls */
          .transport-layer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 40px;
          }
          
          .mobile-transport-btn {
            background: none;
            border: none;
            color: #ffffff;
            cursor: pointer;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
          }
          
          .mobile-transport-btn:hover:not(:disabled) {
            color: #1db954;
            transform: scale(1.1);
          }
          
          .mobile-transport-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .mobile-play-btn {
            background: #ffffff;
            border: none;
            color: #000000;
            cursor: pointer;
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          
          .mobile-play-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
          }
          
          .mobile-play-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .mobile-loading-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid #666;
            border-top: 2px solid #000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          .mobile-demo-indicator {
            text-align: center;
            font-size: 12px;
            color: #b3b3b3;
            margin-top: 8px;
          }
        }
        
        @media (min-width: 769px) {
          /* Hide mobile layout on desktop */
          .mobile-spotify-layout { display: none; }
          
          /* Show desktop layout on desktop */
          .desktop-audio-controls { display: flex; }
        }
      `}</style>
    </div>
  );
});

