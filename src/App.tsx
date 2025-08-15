import { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from './types/lyrics';
import { LyricsParser } from './utils/lyricsParser';
import { AudioPlayer, AudioPlayerRef } from './components/AudioPlayer';
import { LyricsDisplay } from './components/LyricsDisplay';
import { LoopControls } from './components/LoopControls';
import { VoiceCommand } from './components/VoiceCommand';
import { AudioVisualizer } from './components/AudioVisualizer';
import { ChatInterface } from './components/ChatInterface';
import { Playlist } from './components/Playlist';
import { useLoopState } from './hooks/useLoopState';
import { useBeatDetection } from './hooks/useBeatDetection';
import { VoiceCommandResult } from './services/voiceCommandService';
import { OpenAIService } from './services/openaiService';
import { getNextSong, getPreviousSong } from './data/songs';

function App() {
  const [song, setSong] = useState<Song | null>(null);
  const [previousSong, setPreviousSong] = useState<Song | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const songRef = useRef<Song | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [autoplayRequested, setAutoplayRequested] = useState(false);

  // Check if device is mobile web (not native app)
  const isMobileWeb = useCallback(() => {
    return window.innerWidth <= 768 && 'ontouchstart' in window;
  }, []);

  // Loop state management
  const {
    loopState,
    setMode,
    toggleLyricSelection,
    setTimeRange,
    setRepeatCount,
    startLoop,
    stopLoop,
    incrementIteration,
    resetLoop,
    getCalculatedTimeRange,
    isLyricSelected,
  } = useLoopState();

  // Beat detection for animations
  const { isBeatDetected, beatIntensity } = useBeatDetection(audioElement, isPlaying);

  // Audio frequency data not currently used; visualizer still runs without callback

  // Chat interface state
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const appEl = document.querySelector('.app') as HTMLElement | null;
    const scrollTarget: HTMLElement | Window = appEl || window;
    let lastY = appEl ? appEl.scrollTop : window.scrollY;
    let ticking = false;

    const getScrollY = () => (appEl ? appEl.scrollTop : window.scrollY);

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = getScrollY();
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          const delta = currentY - lastY;
          if (currentY <= 0) {
            setIsHeaderHidden(false);
          } else if (delta < -4) {
            // scrolling up → hide header (requested behavior)
            setIsHeaderHidden(true);
          } else if (delta > 4) {
            // scrolling down → show header
            setIsHeaderHidden(false);
          }
        } else {
          setIsHeaderHidden(false);
        }
        lastY = currentY;
        ticking = false;
      });
    };

    const add = (el: HTMLElement | Window) => el.addEventListener('scroll', onScroll as any, { passive: true } as any);
    const remove = (el: HTMLElement | Window) => el.removeEventListener('scroll', onScroll as any);

    add(scrollTarget);
    return () => remove(scrollTarget);
  }, []);

  // Playlist state - start closed on mobile, open on desktop
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(window.innerWidth > 768);
  const [currentSongId, setCurrentSongId] = useState<string>('vaundy-001');

  // Keep songRef in sync with song state
  useEffect(() => {
    songRef.current = song;
  }, [song]);

  // Load song when currentSongId changes
  useEffect(() => {
    const loadSong = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedSong = await LyricsParser.loadSong(currentSongId);
        // Keep current song as previous for smooth transitions
        if (songRef.current) {
          setPreviousSong(songRef.current);
        }
        setSong(loadedSong);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load song';
        setError(errorMessage);
        console.error('Error loading song:', err);
        // Keep previous song visible on error to prevent layout flash
      } finally {
        setIsLoading(false);
      }
    };

    loadSong();
  }, [currentSongId]);

  // Handle audio time updates
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle duration change
  const handleDurationChange = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  // Handle audio loaded
  const handleAudioLoaded = useCallback(() => {
    console.log('Audio loaded successfully');
    setError(null); // Clear any previous errors
    // If user selected a song and requested autoplay, start playing now
    if (autoplayRequested && audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setAutoplayRequested(false);
    }
  }, [autoplayRequested]);

  // Handle audio errors
  const handleAudioError = useCallback((errorMessage: string) => {
    setError(`Audio error: ${errorMessage}`);
  }, []);

  // Handle play state changes
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Handle audio element ready
  const handleAudioElementReady = useCallback((audio: HTMLAudioElement) => {
    setAudioElement(audio);
  }, []);

  // Handle seeking from lyrics click
  const handleSeek = useCallback((timeInMs: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(timeInMs);
    }
  }, []);

  // Handle loop iteration callback from AudioPlayer
  const handleLoopIteration = useCallback(() => {
    incrementIteration();
  }, [incrementIteration]);

  // Handle starting time-based loop
  const handleStartTimeLoop = useCallback((startTime: number, endTime: number, repeatCount: number) => {
    // Optimistically set state and kick off playback immediately
    setTimeRange(startTime, endTime);
    setRepeatCount(repeatCount);
    setMode('time');
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setLoopRegion(startTime, endTime, repeatCount);
    }
    // Also update internal loop state so UI reflects active loop immediately
    startLoop(song?.lyricsData || null, duration);
  }, [setTimeRange, setRepeatCount, setMode, startLoop, song?.lyricsData, duration]);

  // Handle starting lyrics-based loop
  const handleStartLyricsLoop = useCallback((repeatCount: number) => {
    setRepeatCount(repeatCount);
    setMode('lyrics');
    const success = startLoop(song?.lyricsData || null, duration);
    if (success && audioPlayerRef.current) {
      const timeRange = getCalculatedTimeRange(song?.lyricsData || null);
      audioPlayerRef.current.setLoopRegion(
        timeRange.startTime,
        timeRange.endTime,
        repeatCount
      );
    }
  }, [setRepeatCount, setMode, startLoop, song?.lyricsData, duration, getCalculatedTimeRange]);

  // Handle stopping loop
  const handleStopLoop = useCallback(() => {
    stopLoop();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.clearLoop();
    }
  }, [stopLoop]);

  // Handle resetting loop
  const handleResetLoop = useCallback(() => {
    resetLoop();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.clearLoop();
    }
  }, [resetLoop]);

  // Enhanced lyric selection handler that auto-enables lyrics mode
  const handleLyricSelection = useCallback((index: number, selected: boolean) => {
    const wasSelected = loopState.selectedLyricIndices.includes(index);
    toggleLyricSelection(index);
    
    // Auto-enable lyrics mode when first selection is made
    if (selected && !wasSelected && loopState.selectedLyricIndices.length === 0) {
      setMode('lyrics');
    }
    // Auto-disable lyrics mode when all selections are cleared
    else if (!selected && wasSelected && loopState.selectedLyricIndices.length === 1) {
      setMode(null);
    }
  }, [toggleLyricSelection, loopState.selectedLyricIndices, setMode]);

  // Handle voice commands
  const handleVoiceCommand = useCallback(async (result: VoiceCommandResult) => {
    if (!result.success || !result.action) return;

    switch (result.action.type) {
      case 'replay_loop':
        if (audioPlayerRef.current) {
          const { startTime, endTime, repeatCount } = result.action.params;
          audioPlayerRef.current.startTemporaryLoop(startTime, endTime, repeatCount);
        }
        break;

      case 'get_meaning':
        // Meaning is already spoken in the feedback, no additional action needed
        break;

      case 'speak_japanese':
        try {
          const { text } = result.action.params;
          const speechBlob = await OpenAIService.synthesizeSpeech(text);
          const audio = new Audio(URL.createObjectURL(speechBlob));
          audio.play();
        } catch (error) {
          console.error('Error speaking Japanese:', error);
        }
        break;

      case 'play':
        if (audioPlayerRef.current) {
          audioPlayerRef.current.play();
        }
        break;

      case 'pause':
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
        }
        break;

      case 'ai_chat':
        try {
          const { question, song, lyricsData } = result.action.params;
          
          // Get current lyric if available
          const getCurrentLyric = () => {
            if (!lyricsData || !Array.isArray(lyricsData)) return null;
            
            // Find the line that's currently playing or the most recent one
            let currentLyric = null;
            for (const line of lyricsData) {
              if (line.startTime <= currentTime) {
                currentLyric = line;
              } else {
                break;
              }
            }
            return currentLyric;
          };

          const currentLyric = getCurrentLyric();
          const songInfo = song ? { title: song.lyricsData.metadata.title, artist: song.lyricsData.metadata.artist } : null;
          
          const aiResponse = await OpenAIService.chatWithSongContext(question, songInfo, currentLyric);
          
          // Speak the AI response
          const speechBlob = await OpenAIService.synthesizeSpeech(aiResponse);
          const audio = new Audio(URL.createObjectURL(speechBlob));
          audio.play();
        } catch (error) {
          console.error('Error with AI chat:', error);
          // Fallback speech
          try {
            const fallbackBlob = await OpenAIService.synthesizeSpeech("I'm sorry, I couldn't process that question right now.");
            const audio = new Audio(URL.createObjectURL(fallbackBlob));
            audio.play();
          } catch (fallbackError) {
            console.error('Error with fallback speech:', fallbackError);
          }
        }
        break;

      default:
        break;
    }
  }, [currentTime]);

  // Handle song selection from playlist
  const handleSongSelect = useCallback(async (songId: string) => {
    setCurrentSongId(songId);
    setAutoplayRequested(true);
    setIsPlaying(true); // Immediately set playing state to avoid button flash
    // Keep sidebar open on desktop, close on small screens
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsPlaylistVisible(false);
    } else {
      setIsPlaylistVisible(true);
    }
  }, []);

  // Handle autoplay when song ends
  const handleSongEnd = useCallback(() => {
    const nextSong = getNextSong(currentSongId);
    if (nextSong) {
      setCurrentSongId(nextSong.id);
      setAutoplayRequested(true);
      setIsPlaying(true); // Immediately set playing state to avoid button flash
    }
  }, [currentSongId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts if not typing in an input/textarea
      if (event.target instanceof HTMLElement && 
          ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (audioPlayerRef.current) {
            audioPlayerRef.current.togglePlayPause();
          }
          break;
        
        case 'ArrowLeft':
          event.preventDefault();
          // Go back 5 seconds
          if (audioPlayerRef.current) {
            const newTime = Math.max(0, currentTime - 5000); // 5 seconds in milliseconds
            audioPlayerRef.current.seekTo(newTime);
          }
          break;
        
        case 'ArrowRight':
          event.preventDefault();
          // Go forward 5 seconds
          if (audioPlayerRef.current) {
            const newTime = Math.min(duration, currentTime + 5000); // 5 seconds in milliseconds
            audioPlayerRef.current.seekTo(newTime);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration]);

  // Simple smooth gradient that changes at a fixed pace
  const getSimpleGradient = () => {
    return `linear-gradient(135deg, #1db954 0%, #1ed760 30%, #ff6b6b 70%, #4ecdc4 100%)`;
  };



  // Periodic pig bounce for liveliness
  const [pigBounce, setPigBounce] = useState(false);
  useEffect(() => {
    const bounceInterval = setInterval(() => {
      setPigBounce(true);
      setTimeout(() => setPigBounce(false), 400);
    }, 3000); // Bounce every 3 seconds

    return () => clearInterval(bounceInterval);
  }, []);

  return (
    <div className="app">
      <header className={`app-header ${isHeaderHidden ? 'header-hidden' : ''}`}>
        <div className="header-content">
          <AudioVisualizer
            audioElement={audioElement}
            isPlaying={isPlaying}
            beatIntensity={beatIntensity}
            isBeatDetected={isBeatDetected}
          />


          
          <div className="header-row">
            <div className="header-left">
              <div className="app-branding">
                <svg className="pig-mascot" width="48" height="84" viewBox="-8 -24 80 128" aria-label="Ghibli pig mascot" role="img" style={{ 
                  overflow: 'visible',
                  transform: (isBeatDetected || pigBounce) ? `translateY(-${Math.max(beatIntensity * 15, pigBounce ? 12 : 0)}px)` : 'translateY(0px)',
                  transition: 'transform 0.3s ease-out'
                }}>
                  <defs>
                    <radialGradient id="ghibliFace" cx="0.5" cy="0.35" r="0.8">
                      <stop offset="0%" stopColor="#FFF4F6"/>
                      <stop offset="70%" stopColor="#FFD6DC"/>
                      <stop offset="100%" stopColor="#FFC1CB"/>
                    </radialGradient>
                    <radialGradient id="ghibliEar" cx="0.5" cy="0.5" r="0.9">
                      <stop offset="0%" stopColor="#FFDCE1"/>
                      <stop offset="100%" stopColor="#FFB8C4"/>
                    </radialGradient>
                    <radialGradient id="ghibliSnout" cx="0.5" cy="0.5" r="0.9">
                      <stop offset="0%" stopColor="#FFB7C2"/>
                      <stop offset="100%" stopColor="#FFA1B0"/>
                    </radialGradient>
                    <linearGradient id="noteGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#9a6ff2"/>
                      <stop offset="100%" stopColor="#7955f2"/>
                    </linearGradient>
                  </defs>

                  {/* Head group */}
                  <g>
                    {/* Face */}
                    <ellipse cx="32" cy="34" rx="24" ry="22" fill="url(#ghibliFace)" stroke="#E6A5B0" strokeWidth="1"/>

                    {/* Ears */}
                    <ellipse cx="17" cy="16" rx="8.5" ry="12" fill="url(#ghibliEar)" stroke="#E6A5B0" strokeWidth="0.8" transform="rotate(-20 17 16)"/>
                    <ellipse cx="47" cy="16" rx="8.5" ry="12" fill="url(#ghibliEar)" stroke="#E6A5B0" strokeWidth="0.8" transform="rotate(20 47 16)"/>

                    {/* Eyes (gentle closed arcs) */}
                    <path d="M22 28 q 4 4 8 0" stroke="#3A3A3A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                    <path d="M34 28 q 4 4 8 0" stroke="#3A3A3A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>

                    {/* Cheeks */}
                    <circle cx="18" cy="34" r="3.2" fill="#FFB3C1" opacity="0.55"/>
                    <circle cx="46" cy="34" r="3.2" fill="#FFB3C1" opacity="0.55"/>

                    {/* Snout */}
                    <ellipse cx="32" cy="40" rx="9" ry="7" fill="url(#ghibliSnout)" stroke="#E6A5B0" strokeWidth="0.8"/>
                    <ellipse cx="29.5" cy="40" rx="1.6" ry="2.2" fill="#D98292"/>
                    <ellipse cx="34.5" cy="40" rx="1.6" ry="2.2" fill="#D98292"/>

                    {/* Gentle smile */}
                    <path d="M26 46 q 6 4 12 0" stroke="#E6A6B0" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                  </g>

                  {/* Musical note on head with subtle sway */}
                  <g transform="translate(32,22)">
                    <g>
                      {/* Stem */}
                      <rect x="1.4" y="-4" width="1.2" height="13" rx="0.6" fill="url(#noteGrad)" stroke="#5a46c9" strokeWidth="0.4"/>
                      {/* Flag */}
                      <path d="M2.6 -4 q 6 2 6 6 q -1.2 2.2 -3.4 1.2 q 1.2 -2.6 -2.6 -3.6 z" fill="url(#noteGrad)" stroke="#5a46c9" strokeWidth="0.4"/>
                      {/* Note head */}
                      <ellipse cx="0" cy="8.5" rx="3.2" ry="2.6" fill="url(#noteGrad)" stroke="#5a46c9" strokeWidth="0.5"/>
                    </g>
                    <animateTransform attributeName="transform" attributeType="XML" type="rotate" values="-5 0 0; 5 0 0; -5 0 0" dur="4s" repeatCount="indefinite"/>
                  </g>
                </svg>
                <div className="brand-text">
                  <div className="brand-title">
                    <h1 className="app-name">Omo</h1>
                    <span className="app-subtitle">Learn Japanese Through Music</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="header-center">
              {song && (
                <div className="current-song">
                  Now Playing: <strong>{song.lyricsData.metadata.title}</strong> by <strong>{song.lyricsData.metadata.artist}</strong>
                </div>
              )}
            </div>

            <div className="header-right">
              {/* Spacer for balanced layout */}
            </div>
          </div>
        </div>
      </header>

      <div className="app-layout">
        {/* Playlist */}
                <Playlist 
          currentSongId={currentSongId}
          onSongSelect={handleSongSelect}
          isVisible={isPlaylistVisible}
          onToggle={() => setIsPlaylistVisible(!isPlaylistVisible)}
        />

        {/* Mobile playlist toggle button - fixed overlay */}
        <button 
          onClick={() => setIsPlaylistVisible(!isPlaylistVisible)}
          className="mobile-playlist-toggle"
          aria-label={isPlaylistVisible ? "Close playlist" : "Open playlist"}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startTime = Date.now();
            
            const handleTouchMove = (moveEvent: TouchEvent) => {
              const currentTouch = moveEvent.touches[0];
              const deltaX = currentTouch.clientX - startX;
              const deltaTime = Date.now() - startTime;
              
              // If dragged right more than 30px and it's a quick gesture
              if (deltaX > 30 && deltaTime < 500) {
                if (!isPlaylistVisible) {
                  setIsPlaylistVisible(true);
                }
              }
            };
            
            const handleTouchEnd = () => {
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          {isPlaylistVisible ? '‹' : '›'}
        </button>

        <main className="app-main">
        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <button 
                className="error-dismiss"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}



        {(song || previousSong) && (
          <>
            <div className="player-controls">
              <AudioPlayer
                ref={audioPlayerRef}
                audioUrl={(song || previousSong)!.audioUrl}
                coverUrl={(song || previousSong)!.coverUrl}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onLoadedData={handleAudioLoaded}
                onError={handleAudioError}
                onLoopIteration={handleLoopIteration}
                onPlayStateChange={handlePlayStateChange}
                onAudioElementReady={handleAudioElementReady}
                onEnded={handleSongEnd}
                songTitle={(song || previousSong)!.lyricsData.metadata.title}
                artist={(song || previousSong)!.lyricsData.metadata.artist}
                onNext={() => {
                  const next = getNextSong(currentSongId);
                  if (next) {
                    setCurrentSongId(next.id);
                    setAutoplayRequested(true);
                    setIsPlaying(true); // Immediately set playing state to avoid button flash
                  }
                }}
                onPrev={() => {
                  const prev = getPreviousSong(currentSongId);
                  if (prev) {
                    setCurrentSongId(prev.id);
                    setAutoplayRequested(true);
                    setIsPlaying(true); // Immediately set playing state to avoid button flash
                  }
                }}
              />
              
              {/* Voice Command temporarily hidden - keeping code for future use */}
              {false && (
                <VoiceCommand
                  currentTime={currentTime}
                  lyricsData={song?.lyricsData?.lyrics || null}
                  duration={duration}
                  song={song}
                  onCommand={handleVoiceCommand}
                />
              )}
              
              {/* Chat Button */}
              <button
                onClick={() => setIsChatVisible(!isChatVisible)}
                className="chat-toggle-inline-btn"
                aria-label="Toggle chat with sensei"
              >
                💬 先生
              </button>
            </div>
            
            <div className="loop-controls-desktop">
            <LoopControls
              loopState={loopState}
              lyricsData={(song || previousSong)?.lyricsData || null}
              duration={duration}
              currentTime={currentTime}
              onTimeRangeChange={setTimeRange}
              onRepeatCountChange={setRepeatCount}
              onStartTimeLoop={handleStartTimeLoop}
              onStartLyricsLoop={handleStartLyricsLoop}
              onStopLoop={handleStopLoop}
              onResetLoop={handleResetLoop}
              hasLyricsSelected={loopState.selectedLyricIndices.length > 0}
              calculatedTimeRange={getCalculatedTimeRange((song || previousSong)?.lyricsData || null)}
            />
            </div>
          </>
        )}

        <LyricsDisplay
          lyricsData={(song || previousSong)?.lyricsData || null}
          currentTime={currentTime}
          isLoading={isLoading}
          isPlaying={isPlaying || loopState.isActive}
          onSeek={handleSeek}
          loopState={loopState}
          onLineSelect={handleLyricSelection}
          isLyricSelected={isLyricSelected}
          calculatedTimeRange={getCalculatedTimeRange((song || previousSong)?.lyricsData || null)}
        />

        {/* Loop Controls (mobile placement after lyrics) */}
        {(song || previousSong) && (
          <div className="loop-controls-mobile">
            <LoopControls
              loopState={loopState}
              lyricsData={(song || previousSong)?.lyricsData || null}
              duration={duration}
              currentTime={currentTime}
              onTimeRangeChange={setTimeRange}
              onRepeatCountChange={setRepeatCount}
              onStartTimeLoop={handleStartTimeLoop}
              onStartLyricsLoop={handleStartLyricsLoop}
              onStopLoop={handleStopLoop}
              onResetLoop={handleResetLoop}
              hasLyricsSelected={loopState.selectedLyricIndices.length > 0}
              calculatedTimeRange={getCalculatedTimeRange((song || previousSong)?.lyricsData || null)}
              isMobileWeb={isMobileWeb()}
            />
          </div>
        )}

        {/* Chat Interface */}
        <ChatInterface
          song={song}
          currentTime={currentTime}
          isVisible={isChatVisible}
          onToggle={() => setIsChatVisible(!isChatVisible)}
        />

        </main>
      </div>

      {/* Floating chat button - outside main for proper positioning */}
      {!isChatVisible && (
        <button
          onClick={() => setIsChatVisible(true)}
          className="chat-fab-btn"
          aria-label="Open chat with sensei"
        >
          💬
        </button>
      )}

      <style jsx global>{`
        html, body, #root {
          width: 100%;
          height: 100vh;
          max-width: 100vw;
          overscroll-behavior: none;
          touch-action: pan-y;
          margin: 0;
          padding: 0;
        }
        
        body {
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
          -webkit-overflow-scrolling: touch;
        }
        
        /* Prevent screen dragging on iOS */
        * {
          -webkit-user-drag: none;
        }
        
        @media (max-width: 768px) {
          html, body, #root {
            position: relative;
            height: 100vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          body {
            padding-top: 0;
            padding-bottom: env(safe-area-inset-bottom);
            background: linear-gradient(-45deg, #000000, #0a0a0a, #1a1a1a, #111111);
            background-size: 400% 400%;
            animation: backgroundShift 20s ease infinite;
          }
        }
      `}</style>
      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(-45deg, #000000, #0a0a0a, #1a1a1a, #111111);
          background-size: 400% 400%;
          animation: backgroundShift 20s ease infinite;
          font-family: 'Circular', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color: #ffffff;
          overscroll-behavior: none;
          max-width: 100vw;
          width: 100%;
          touch-action: pan-y;
        }
        
        @media (max-width: 768px) {
          .app {
            min-height: 100vh;
            position: relative;
            /* Prevent viewport shifting when keyboard opens */
            height: 100vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
        }
        
        @media (max-width: 768px) {
          .app-main {
            margin-bottom: max(20px, env(safe-area-inset-bottom) + 20px);
          }
        }

        @keyframes backgroundShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }



        .app-header {
          padding: max(12px, env(safe-area-inset-top)) 16px 16px;
          background: ${getSimpleGradient()};
          background-size: 300% 300%;
          animation: gradientShift 8s ease infinite;
          border-bottom: none;
          box-shadow: 0 4px 20px rgba(29, 185, 84, 0.3), 0 2px 10px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 3;
          overflow: hidden;
          transition: background 0.2s ease, box-shadow 0.4s ease;
        }

        @media (max-width: 768px) {
          .app-header.header-hidden {
            display: none;
          }
        }

        .app-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, ${isBeatDetected ? 0.2 + beatIntensity * 0.3 : 0.1}), transparent);
          animation: ${isBeatDetected ? 'beatShimmer 0.3s ease-out' : 'shimmer 3s infinite'};
          pointer-events: none;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        @keyframes beatGradient {
          0% { background-size: 300% 300%; }
          50% { background-size: 350% 350%; }
          100% { background-size: 300% 300%; }
        }

        @keyframes beatShimmer {
          0% { left: -100%; opacity: 0.8; }
          100% { left: 100%; opacity: 0; }
        }

        .header-content {
          max-width: 1280px;
          margin: 0;
          margin-left: 0;
          margin-right: auto;
          position: relative;
          z-index: 2;
          width: 100%;
          overflow: hidden;
        }

        .header-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          position: relative;
          min-height: 60px;
        }

        .header-left {
          grid-column: 1;
          padding-left: 24px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
        }

        .header-center {
          grid-column: 2;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .header-right {
          grid-column: 3;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding-right: 24px;
        }

        .app-branding {
          display: flex;
          align-items: center;
          gap: 8px;
          transform: translateX(-8px);
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          transform: translateX(0);
        }

        /* Desktop uses grid layout by default, mobile overrides below */
        @media (min-width: 769px) {
          .header-content {
            margin: 0;
            max-width: none;
          }
          .header-left {
            padding-left: 40px;
          }
          .app-branding {
            transform: translateX(0);
          }
          .brand-title {
            transform: translateX(0);
          }
          .mobile-playlist-toggle {
            display: none !important;
          }
          .header-row {
            display: grid !important;
            grid-template-columns: 1fr auto 1fr !important;
            justify-content: unset !important;
          }
          .header-center {
            display: flex !important;
          }
          .header-right {
            display: flex !important;
          }
          .app-subtitle {
            display: block !important;
          }
        }

        .mobile-playlist-toggle {
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          border: none;
          color: white;
          font-size: 14px;
          width: 60px;
          height: 32px;
          border-radius: 0 16px 16px 0;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 2px 0 12px rgba(121, 85, 242, 0.4);
          position: fixed;
          top: 310px;
          left: 0;
          transform: none;
          z-index: 1100;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          touch-action: pan-x;
        }

        .mobile-playlist-toggle:hover {
          background: linear-gradient(135deg, #8b66f2, #a876f2);
          transform: translateX(4px);
          box-shadow: 4px 0 16px rgba(121, 85, 242, 0.6);
          width: 64px;
        }

        .app-name {
          font-size: 32px;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: -1px;
          margin: 0;
          font-family: 'Helvetica Neue', 'Arial', sans-serif;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .pig-mascot {
          animation: ${isBeatDetected 
            ? `beatBounce 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), breathe 4s ease-in-out infinite, musicBob 2s ease-in-out infinite` 
            : 'breathe 4s ease-in-out infinite, musicBob 2s ease-in-out infinite'};
          filter: drop-shadow(0 6px 15px rgba(${isBeatDetected ? '255, 23, 68' : '121, 85, 242'}, ${isBeatDetected ? 0.9 + beatIntensity * 0.6 : 0.3})) 
                 drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))
                 ${isBeatDetected ? `drop-shadow(0 0 20px rgba(255, 23, 68, ${beatIntensity * 0.8}))` : ''};
          margin-right: 4px;
          overflow: visible;
          position: relative;
          transform: ${isBeatDetected ? `scale(${1 + beatIntensity * 0.2}) rotate(${beatIntensity * 5}deg)` : 'scale(1)'};
          transition: transform 0.1s ease-out, filter 0.1s ease-out;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin-top: 0 !important;
          display: block;
          line-height: 0;
          isolation: isolate;
          contain: layout style paint;
          will-change: transform;
        }







        @keyframes musicBob {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          25% { transform: translateY(-2px) rotate(0deg); }
          50% { transform: translateY(0) rotate(1deg); }
          75% { transform: translateY(-1px) rotate(0deg); }
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }

        @keyframes beatBounce {
          0% { transform: scale(1) translateY(0) rotate(0deg); }
          25% { transform: scale(1.3) translateY(-8px) rotate(-2deg); }
          50% { transform: scale(1.4) translateY(-12px) rotate(0deg); }
          75% { transform: scale(1.2) translateY(-4px) rotate(2deg); }
          100% { transform: scale(1) translateY(0) rotate(0deg); }
        }

        .name-text {
          color: #ffffff;
        }

        @keyframes breathe {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1px) scale(1.02); }
          100% { transform: translateY(0) scale(1); }
        }



        .app-subtitle {
          font-size: 10px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0.3px;
          text-transform: uppercase;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          margin-top: 2px;
        }

        .song-info {
          text-align: center;
        }

        .current-song {
          color: white;
          font-size: 14px;
          font-weight: 500;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          max-width: 400px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .app-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px 16px 24px;
          background: #1a1a1a;
          position: relative;
          z-index: 1;
        }
        
        @media (max-width: 768px) {
          .app-main {
            padding: 20px 16px 24px;
            overflow-y: visible;
          }
        }
          border-radius: 0;
          margin-top: 0;
          position: relative;
          z-index: 1;
          box-shadow: none;
          border: none;
          border-top: none;
          backdrop-filter: none;
          overflow: hidden;
        }

        .player-controls {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 8px;
          width: 100%;
        }

        /* Show desktop loop controls, hide mobile by default */
        .loop-controls-desktop { display: block; }
        .loop-controls-mobile { display: none; }

        .chat-toggle-inline-btn {
          background: #1db954;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3);
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .chat-toggle-inline-btn:hover {
          background: #1ed760;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(29, 185, 84, 0.4);
        }

        .chat-toggle-inline-btn:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .app-header { 
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            padding: max(8px, env(safe-area-inset-top) + 2px) 12px 4px;
            background: ${getSimpleGradient()};
            background-size: 300% 300%;
            animation: gradientShift 8s ease infinite;
            z-index: 1000;
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            overflow: visible;
          }

          .header-row { 
            display: flex !important;
            justify-content: center !important; 
            grid-template-columns: none !important;
          }
          .header-left { 
            flex: 1; 
            display: flex; 
            justify-content: center !important; 
            padding-left: 4px !important;
            grid-column: unset !important;
          }
          .header-center { 
            display: none !important;
            grid-column: unset !important;
          }
          .header-right { 
            display: none !important;
            grid-column: unset !important;
          }
          .app-name { font-size: 24px; }
          .app-subtitle { display: none; }
          .pig-mascot { 
            width: 45px; 
            height: 63px; 
            margin-top: 3px !important;
          }
          .app-branding { 
            transform: translateX(0) !important; 
            margin: 0 0 -8px 0 !important;
            padding: 4px 0 0 0 !important;
            overflow: visible !important;
            position: relative;
            left: -20px;
          }
          .brand-title { transform: translateX(0) !important; }
          .player-controls { grid-template-columns: 1fr; gap: 6px; touch-action: pan-y; margin-bottom: 2px; }
          .loop-controls-desktop { display: none; }
          .loop-controls-mobile { display: block; margin-top: 8px; }
          .mobile-playlist-toggle { display: flex; }
        }
        }

        .error-banner {
          margin: 20px 0;
          background: rgba(255, 59, 48, 0.9);
          border-radius: 12px;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .error-content {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }

        .error-icon {
          font-size: 18px;
        }

        .error-message {
          flex: 1;
          font-weight: 500;
        }

        .error-dismiss {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .error-dismiss:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .song-info {
          margin-top: 16px;
          text-align: center;
        }

        .current-song {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 400;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .app-layout {
          display: flex;
          min-height: calc(100vh - 120px);
          position: relative;
        }

        .app-main {
          flex: 1;
          padding: 0 12px calc(56px + env(safe-area-inset-bottom)) 12px;
          min-width: 0;
        }

        /* Floating chat button */
        .chat-fab-btn {
          position: fixed;
          right: 16px;
          bottom: 16px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #1db954;
          color: #000;
          font-size: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 22px rgba(29,185,84,0.45);
          z-index: 9999;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .chat-fab-btn:hover {
          background: #1ed760;
          transform: scale(1.05);
          box-shadow: 0 10px 28px rgba(29,185,84,0.6);
        }

        @media (max-width: 768px) {
          .chat-fab-btn { 
            width: 56px; 
            height: 56px; 
            font-size: 24px;
            right: 12px;
            bottom: max(20px, env(safe-area-inset-bottom) + 20px);
          }
        }

        /* Hide inline chat button completely */
        .chat-toggle-inline-btn { display: none; }

        .demo-info {
          margin: 20px 0;
          background: linear-gradient(135deg, #4ECDC4, #44A08D);
          border-radius: 12px;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .demo-content {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }

        .demo-icon {
          font-size: 18px;
        }

        .demo-text {
          flex: 1;
          font-weight: 500;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .app-header {
            padding: 16px;
          }

          .app-name {
            font-size: 36px;
          }

          .app-subtitle {
            font-size: 16px;
          }

          .current-song {
            font-size: 14px;
            padding: 10px 16px;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
          }

          .app-layout {
            flex-direction: column;
          }

          .app-main {
            padding: 24px 16px max(100px, env(safe-area-inset-bottom) + 64px);
            margin-top: max(88px, env(safe-area-inset-top) + 72px);
            min-height: calc(100vh - max(88px, env(safe-area-inset-top) + 72px) - max(100px, env(safe-area-inset-bottom) + 64px));
          }

          .player-controls {
            min-height: 200px; /* Stable height during transitions */
          }
        }

        /* Tablet responsive */
        @media (max-width: 1024px) and (min-width: 769px) {
          .app-name {
            font-size: 42px;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .app {
            background: #000;
          }

          .app-header {
            background: #333;
            border-bottom-color: #666;
          }

          .app-name {
            color: #fff;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .app {
            animation: none;
            background: #667eea;
          }
        }
      `}</style>
    </div>
  );
}

export default App;

