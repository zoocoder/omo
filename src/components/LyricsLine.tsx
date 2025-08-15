import React, { useRef, useCallback } from 'react';
import { LyricLine } from '../types/lyrics';

interface LyricsLineProps {
  line: LyricLine;
  isActive: boolean;
  isPrevious: boolean;
  isNext: boolean;
  progress: number;
  index: number;
  onLineClick?: (startTime: number) => void;
  isSelected?: boolean;
  onLineSelect?: (index: number, selected: boolean) => void;
  isInLoopRange?: boolean;
  loopMode?: 'lyrics' | 'time' | null;
  onPointerDownLine?: (index: number, isSelected: boolean) => void;
  onPointerEnterLine?: (index: number) => void;
  onLongPress?: (line: LyricLine, position: { x: number; y: number }) => void;
}

export const LyricsLineComponent: React.FC<LyricsLineProps> = ({
  line,
  isActive,
  isPrevious,
  isNext,
  progress,
  index,
  onLineClick,
  isSelected = false,
  onLineSelect: _onLineSelect,
  isInLoopRange = false,
  loopMode = null,
  onPointerDownLine,
  onPointerEnterLine,
  onLongPress,
}) => {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Store the initial position for the popup
    longPressStartPos.current = { x: e.clientX, y: e.clientY };
    
    // Call existing drag handler
    if (onPointerDownLine) {
      onPointerDownLine(index, isSelected);
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = window.setTimeout(() => {
        if (longPressStartPos.current) {
          onLongPress(line, longPressStartPos.current);
        }
      }, 800); // 800ms for long press
    }
  }, [onPointerDownLine, onLongPress, index, isSelected, line]);

  const handlePointerUp = useCallback(() => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPos.current = null;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Call existing drag handler
    if (onPointerEnterLine) {
      onPointerEnterLine(index);
    }

    // Cancel long press if moved too much
    if (longPressStartPos.current && longPressTimerRef.current) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - longPressStartPos.current.x, 2) +
        Math.pow(e.clientY - longPressStartPos.current.y, 2)
      );
      
      if (distance > 10) { // More than 10px movement cancels long press
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, [onPointerEnterLine, index]);

  const getLineClasses = (): string => {
    const baseClass = 'lyrics-line';
    const classes = [baseClass];
    
    if (isActive) classes.push('active');
    if (isPrevious) classes.push('previous');
    if (isNext) classes.push('next');
    if (isSelected) classes.push('selected');
    if (isInLoopRange) classes.push('in-loop-range');
    if (loopMode === 'lyrics') classes.push('selectable');
    
    return classes.join(' ');
  };

  const handleClick = () => {
    // Handle regular seek click (main content area)
    if (onLineClick && line.startTime !== undefined) {
      onLineClick(line.startTime);
    }
  };



  const getCursorStyle = (): string => {
    if (loopMode === 'lyrics') {
      return 'pointer'; // Selection cursor
    } else if (onLineClick) {
      return 'pointer'; // Seek cursor
    }
    return 'default';
  };

  return (
    <div 
      className={getLineClasses()} 
      data-line-index={index}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
      style={{ cursor: getCursorStyle() }}
    >
      {/* Selection indicator (minimal visual feedback only) */}
      {isSelected && (
        <div className="selection-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M8 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      <div className="line-content">
        <div className="japanese-text">
          {line.japanese}
        </div>
        <div className="romaji-text">
          {line.romaji}
        </div>
        <div className="english-text">
          {line.english}
        </div>
      </div>
      
      {isActive && (
        <div 
          className="progress-indicator"
          style={{ width: `${progress * 100}%` }}
        />
      )}

      <style jsx>{`
        .lyrics-line {
          padding: 16px 20px;
          margin: 8px 0;
          border-radius: 12px;
          transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.18s ease;
          position: relative;
          overflow: hidden;
          border: 2px solid transparent;
          background: rgba(121, 85, 242, 0.15);
          backdrop-filter: blur(10px);
          color: #b3b3b3;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          will-change: transform, background-color, box-shadow;
          backface-visibility: hidden;
          transform: translateZ(0);
        }

        .lyrics-line:hover {
          background: rgba(121, 85, 242, 0.22);
          transform: translateY(-1px) scale(1.005);
          box-shadow: 0 10px 28px rgba(121, 85, 242, 0.35), 0 0 16px rgba(121, 85, 242, 0.2);
          color: #ffffff;
          border-color: rgba(121, 85, 242, 0.45);
        }

        .lyrics-line[style*="cursor: pointer"]:hover {
          background: rgba(121, 85, 242, 0.3);
          border-color: rgba(121, 85, 242, 0.4);
          color: #ffffff;
        }

        .lyrics-line[style*="cursor: pointer"]:active {
          transform: translateY(-1px) scale(0.98);
          transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .lyrics-line.selected {
          background: linear-gradient(135deg, #7955f2 0%, #9a6ff2 100%) !important;
          color: white !important;
          border-color: rgba(185, 127, 242, 0.3) !important;
          transform: scale(1.01);
          box-shadow: 0 6px 25px rgba(121, 85, 242, 0.5), inset 0 1px 0 rgba(185, 127, 242, 0.2) !important;
          animation: selectedPulse 2s ease-in-out infinite;
        }

        @keyframes selectedPulse {
          0%, 100% { box-shadow: 0 6px 25px rgba(121, 85, 242, 0.5), inset 0 1px 0 rgba(185, 127, 242, 0.2); }
          50% { box-shadow: 0 8px 30px rgba(121, 85, 242, 0.7), inset 0 1px 0 rgba(185, 127, 242, 0.3); }
        }

        .lyrics-line.selectable {
          border-color: rgba(121, 85, 242, 0.3);
          position: relative;
        }

        .lyrics-line.selectable:hover:not(.selected) {
          background: rgba(121, 85, 242, 0.1);
          border-color: rgba(121, 85, 242, 0.5);
          color: #ffffff;
        }

        .lyrics-line.in-loop-range:not(.selected) {
          background: rgba(121, 85, 242, 0.1);
          border-color: rgba(121, 85, 242, 0.3);
        }

        .selection-indicator {
          position: absolute;
          top: 50%;
          left: 12px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          background: rgba(121, 85, 242, 0.9);
          border-radius: 50%;
          backdrop-filter: blur(8px);
          transition: all 0.2s;
          transform: translateY(-50%);
        }

        .lyrics-line.active {
          background: linear-gradient(135deg, #7f63ff 0%, #a686ff 100%);
          color: white;
          transform: scale(1.01);
          box-shadow: 0 10px 28px rgba(121, 85, 242, 0.38);
          border-color: rgba(185, 127, 242, 0.36);
        }

        .lyrics-line.previous {
          background: rgba(121, 85, 242, 0.12);
          color: #c0c0c0;
        }

        .lyrics-line.next {
          background: rgba(121, 85, 242, 0.1);
          color: #b0b0b0;
          border-color: rgba(121, 85, 242, 0.2);
        }

        .line-content {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          align-items: center;
          position: relative;
          z-index: 2;
          margin-left: ${isSelected ? '40px' : '0px'};
          transition: margin-left 0.2s ease;
        }

        .japanese-text {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
          text-align: left;
        }

        .romaji-text {
          font-size: 14px;
          font-weight: 400;
          font-style: italic;
          line-height: 1.4;
          text-align: center;
          opacity: 0.9;
        }

        .english-text {
          font-size: 14px;
          font-weight: 400;
          line-height: 1.4;
          text-align: right;
          opacity: 0.9;
        }

        .lyrics-line.active .japanese-text {
          font-size: 20px;
          font-weight: 700;
        }

        .lyrics-line.active .romaji-text,
        .lyrics-line.active .english-text {
          opacity: 1;
          font-weight: 500;
        }

        .progress-indicator {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85));
          border-radius: 0 3px 3px 0;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.65), 0 0 6px rgba(255, 255, 255, 0.45);
          overflow: hidden;
          transition: none;
          will-change: width;
        }

        .progress-indicator::after {
          content: '';
          position: absolute;
          top: -1px;
          right: -8px;
          width: 16px;
          height: 5px;
          background: radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.9), transparent 60%);
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(255,255,255,0.7);
          animation: none;
        }



        /* Mobile responsive */
        @media (max-width: 768px) {
          .lyrics-line {
            padding: 12px 16px;
            margin: 6px 0;
          }

          .line-content {
            grid-template-columns: 1fr;
            gap: 8px;
            text-align: center;
            margin-left: 0 !important;
          }

          .japanese-text {
            font-size: 16px;
            order: 1;
            text-align: center;
          }

          .romaji-text {
            font-size: 13px;
            order: 2;
          }

          .english-text {
            font-size: 13px;
            order: 3;
            text-align: center;
          }

          .lyrics-line.active .japanese-text {
            font-size: 18px;
          }
        }

        /* Tablet responsive */
        @media (max-width: 1024px) and (min-width: 769px) {
          .line-content {
            gap: 15px;
          }

          .japanese-text {
            font-size: 17px;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .lyrics-line {
            border: 2px solid #333;
          }

          .lyrics-line.active {
            border-color: #fff;
            background: #0066CC;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .lyrics-line {
            transition: none;
          }

          .lyrics-line.active {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

