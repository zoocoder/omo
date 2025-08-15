import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LyricsData, LoopState, LyricLine } from '../types/lyrics';
import { useAudioSync } from '../hooks/useAudioSync';
import { LyricsLineComponent } from './LyricsLine';
import { LyricContextMenu } from './LyricContextMenu';

interface LyricsDisplayProps {
  lyricsData: LyricsData | null;
  currentTime: number;
  isLoading?: boolean;
  isPlaying?: boolean;
  onSeek?: (timeInMs: number) => void;
  loopState?: LoopState;
  individualLyricLoop?: {
    isActive: boolean;
    startTime: number;
    endTime: number;
    repeatCount: number;
    currentIteration: number;
  } | null;
  onLineSelect?: (index: number, selected: boolean) => void;
  isLyricSelected?: (index: number) => boolean;
  calculatedTimeRange?: { startTime: number; endTime: number };
  onExplainGrammar?: (line: LyricLine) => void;
  onStartLoop?: (line: LyricLine, repeatCount: number) => void;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyricsData,
  currentTime,
  isLoading = false,
  isPlaying = false,
  onSeek,
  loopState,
  individualLyricLoop,
  onLineSelect,
  isLyricSelected,
  calculatedTimeRange,
  onExplainGrammar,
  onStartLoop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentLine, previousLineIndex, nextLineIndex, progress } = useAudioSync({
    lyricsData,
    currentTime,
    isPlaying,
    loopState,
    individualLyricLoop,
  });

  // Check if device is mobile web (not native app)
  const isMobileWeb = useCallback(() => {
    return window.innerWidth <= 768 && 'ontouchstart' in window;
  }, []);

  // Pointer-based drag selection state (touch + mouse unified)
  const isDraggingRef = useRef(false);
  const dragAnchorIndexRef = useRef<number | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [inDragBuffer, setInDragBuffer] = useState(false);





  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    line: LyricLine;
    position: { x: number; y: number };
  } | null>(null);

  const clearDrag = useCallback(() => {
    isDraggingRef.current = false;
    dragAnchorIndexRef.current = null;
    setDragging(false);
    setInDragBuffer(false);
    // Restore smooth scroll immediately after drag ends
    if (containerRef.current) {
      containerRef.current.style.scrollBehavior = 'smooth';
    }
  }, []);

  useEffect(() => {
    const endAll = () => clearDrag();
    window.addEventListener('pointerup', endAll);
    window.addEventListener('pointercancel', endAll);
    return () => {
      window.removeEventListener('pointerup', endAll);
      window.removeEventListener('pointercancel', endAll);
    };
  }, [clearDrag]);

  // Helper function to check if a line is in the loop range for time mode
  const isLineInLoopRange = (line: any): boolean => {
    if (!loopState || loopState.mode !== 'time' || !calculatedTimeRange) {
      return false;
    }
    
    return (
      line.startTime >= calculatedTimeRange.startTime &&
      line.endTime <= calculatedTimeRange.endTime
    );
  };

  // Drag selection handlers 
  const handlePointerDownLine = useCallback((index: number) => {
    if (!onLineSelect || isMobileWeb()) return; // Skip drag functionality on mobile web
    
    // Record start time and anchor, but don't start selecting yet
    dragStartTimeRef.current = Date.now();
    dragAnchorIndexRef.current = index;
    isDraggingRef.current = false; // Will be set to true only on actual drag
    setDragging(false);
    // Do not enter buffer or change scroll behavior on simple tap/click
    
    // Clear all existing selections when starting a new drag
    if (lyricsData?.lyrics) {
      lyricsData.lyrics.forEach((_, i) => {
        if (isLyricSelected && isLyricSelected(i)) {
          onLineSelect(i, false);
        }
      });
    }
  }, [onLineSelect, lyricsData, isLyricSelected, isMobileWeb]);

  const handlePointerEnterLine = useCallback((index: number) => {
    if (!onLineSelect || isMobileWeb()) return; // Skip drag functionality on mobile web
    const anchor = dragAnchorIndexRef.current;
    if (anchor === null || anchor === index) return;
    
    // Check if enough time has passed to consider this a drag (300ms threshold)
    const now = Date.now();
    const timeSinceStart = now - dragStartTimeRef.current;
    
    if (timeSinceStart < 300) return; // Too quick, likely just a click
    
    // This is a real drag - start drag selection
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      setDragging(true);
      // Enter buffer and prevent auto-scroll during selection
      setInDragBuffer(true);
      if (containerRef.current) {
        containerRef.current.style.scrollBehavior = 'auto';
      }
    }
    
    // Select the new range (previous selections already cleared)
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    
    // Select all items in the new range
    for (let i = start; i <= end; i++) {
      if (!isLyricSelected || !isLyricSelected(i)) {
        onLineSelect(i, true);
      }
    }
  }, [onLineSelect, isLyricSelected, lyricsData, isMobileWeb]);

  // Handle long press (500ms) to show context menu
  const handleLongPress = useCallback((line: LyricLine, position: { x: number; y: number }) => {
    // Don't show menu during drag operations
    if (isDraggingRef.current || dragging) return;

    // Prevent lyric selection when long press is detected
    // Clear any existing selections to avoid interference
    if (onLineSelect) {
      lyricsData?.lyrics.forEach((_, index) => {
        if (isLyricSelected && isLyricSelected(index)) {
          onLineSelect(index, false);
        }
      });
    }

    // Check if there are selected lyrics for multi-line analysis
    const selectedIndices = lyricsData?.lyrics
      .map((_, index) => isLyricSelected && isLyricSelected(index) ? index : null)
      .filter(index => index !== null) as number[];

    const hasSelectedLyrics = selectedIndices && selectedIndices.length > 1;

    if (hasSelectedLyrics) {
      // For multi-line selection, directly show grammar popup (existing behavior)
      if (onExplainGrammar) {
        onExplainGrammar(line);
      }
    } else {
      // For single line, show context menu
      setContextMenu({ line, position });
    }
  }, [dragging, lyricsData, isLyricSelected, onExplainGrammar, onLineSelect]);



  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuExplainGrammar = useCallback((line: LyricLine) => {
    if (onExplainGrammar) {
      onExplainGrammar(line);
    }
  }, [onExplainGrammar]);

  const handleContextMenuStartLoop = useCallback((line: LyricLine, repeatCount: number) => {
    if (onStartLoop) {
      onStartLoop(line, repeatCount);
    }
  }, [onStartLoop]);

  // Auto-scroll to keep active line centered (but not during drag selection or shortly after)
  useEffect(() => {
    if (!containerRef.current || currentLine.index < 0 || isDraggingRef.current || dragging) return;
    
    // Don't auto-scroll if we just finished a drag (give 500ms buffer)
    const timeSinceLastDrag = Date.now() - dragStartTimeRef.current;
    if (timeSinceLastDrag < 500) return;

    const container = containerRef.current;
    const activeLineElement = container.querySelector(`[data-line-index="${currentLine.index}"]`) as HTMLElement;
    
    if (activeLineElement) {
      const containerHeight = container.clientHeight;
      const elementTop = activeLineElement.offsetTop;
      const targetOffsetFromTop = Math.max(0, Math.floor(containerHeight * 0.2));
      
      // Scroll so the active line sits near the top (around 20% viewport height)
      const targetScrollTop = Math.max(0, elementTop - targetOffsetFromTop);
      
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    }
  }, [currentLine.index, dragging]);

  // Only show loading state if we're actually loading lyrics (not initial page load)
  if (isLoading && !lyricsData) {
    return null; // Don't show anything during initial load
  }
  
  if (isLoading) {
    return (
      <div className="lyrics-display loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading lyrics...</p>
        </div>
        
        <style jsx>{`
          .lyrics-display.loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
          }

          .loading-content {
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top: 4px solid rgba(29, 185, 84, 0.8);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!lyricsData) {
    return (
      <div className="lyrics-display error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>No lyrics available</h3>
          <p>Please load a song to see lyrics</p>
        </div>
        
        <style jsx>{`
          .lyrics-display.error {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            border-radius: 16px;
            margin: 20px 0;
          }

          .error-content {
            text-align: center;
            color: #d73502;
          }

          .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .error-content h3 {
            margin: 0 0 8px 0;
            font-size: 18px;
          }

          .error-content p {
            margin: 0;
            opacity: 0.8;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="lyrics-display" ref={containerRef}>
      <div className="lyrics-container">
        <div className="column-headers">
          <div className="header japanese-header">Japanese</div>
          <div className="header romaji-header">Romaji</div>
          <div className="header english-header">English</div>
        </div>

        <div className="lyrics-list">
          {lyricsData.lyrics.map((line, index) => (
            <LyricsLineComponent
              key={`${line.startTime}-${line.endTime}-${index}`}
              line={line}
              isActive={!dragging && !inDragBuffer && currentLine.index === index && currentLine.isActive}
              isPrevious={!dragging && !inDragBuffer && previousLineIndex === index}
              isNext={!dragging && !inDragBuffer && nextLineIndex === index}
              progress={!dragging && !inDragBuffer && currentLine.index === index ? progress : 0}
              index={index}
              onLineClick={onSeek}
              isSelected={isLyricSelected ? isLyricSelected(index) : false}
              onLineSelect={onLineSelect}
              onPointerDownLine={isMobileWeb() ? undefined : handlePointerDownLine}
              onPointerEnterLine={isMobileWeb() ? undefined : handlePointerEnterLine}
              onLongPress={handleLongPress}
              isInLoopRange={isLineInLoopRange(line)}
              loopMode={loopState?.mode || null}
            />
          ))}
        </div>
      </div>



      {/* Context menu for lyric actions */}
      {contextMenu && (
        <LyricContextMenu
          line={contextMenu.line}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onExplainGrammar={handleContextMenuExplainGrammar}
          onStartLoop={handleContextMenuStartLoop}
        />
      )}

      <style jsx>{`
        .lyrics-display {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 16px 24px 24px 24px;
          margin: 12px 0;
          max-height: calc(100vh - 280px);
          overflow-y: auto;
          box-shadow: none;
          position: relative;
          border: 1px solid #3e3e3e;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
        .lyrics-display * {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .lyrics-display::-webkit-scrollbar {
          width: 8px;
        }

        .lyrics-display::-webkit-scrollbar-track {
          background: #121212;
          border-radius: 4px;
        }

        .lyrics-display::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 4px;
        }

        .lyrics-display::-webkit-scrollbar-thumb:hover {
          background: #535353;
        }



        .lyrics-container {
          background: transparent;
          border-radius: 0;
          padding: 0;
        }

        .column-headers {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 16px;
          padding: 8px 0;
          border-bottom: 1px solid #404040;
        }

        .header {
          font-weight: 600;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .japanese-header {
          text-align: left;
        }

        .romaji-header {
          text-align: center;
        }

        .english-header {
          text-align: right;
        }

        .lyrics-list {
          min-height: 300px;
        }

        /* Drag selection affordance (subtle while dragging) */
        :global(.lyrics-line.selectable) {
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }

        :global(.lyrics-line.selectable)::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          pointer-events: none;
          box-shadow: ${dragging ? 'inset 0 0 0 2px rgba(121, 85, 242, 0.25)' : 'none'};
          transition: box-shadow 0.15s ease;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .lyrics-display {
            padding: 8px;
            margin: 0px 0 8px 0;
            border-radius: 16px;
            max-height: calc(100vh - 240px);
          }

          .song-title {
            font-size: 24px;
          }

          .artist-name {
            font-size: 16px;
          }

          .lyrics-container {
            padding: 6px 12px 12px;
          }

          .column-headers {
            display: none; /* Hide headers on mobile since layout changes */
          }
        }

        /* Tablet responsive */
        @media (max-width: 1024px) and (min-width: 769px) {
          .lyrics-display {
            padding: 20px;
          }

          .song-title {
            font-size: 26px;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .lyrics-display {
            background: #000;
            border: 2px solid #fff;
          }

          .lyrics-header {
            color: #fff;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .lyrics-display {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </div>
  );
};

