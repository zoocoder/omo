import { useState, useEffect, useRef, useCallback } from 'react';
import { LoopState, LyricsData } from '../types/lyrics';

interface LoopControlsProps {
  loopState: LoopState;
  lyricsData: LyricsData | null;
  duration: number;
  currentTime: number;
  onTimeRangeChange: (startTime: number, endTime: number) => void;
  onRepeatCountChange: (count: number) => void;
  onStartTimeLoop: (startTime: number, endTime: number, repeatCount: number) => void;
  onStartLyricsLoop: (repeatCount: number) => void;
  onStopLoop: () => void;
  onResetLoop: () => void;
  hasLyricsSelected: boolean;
  calculatedTimeRange: { startTime: number; endTime: number };
  isMobileWeb?: boolean;
}

export const LoopControls: React.FC<LoopControlsProps> = ({
  loopState,
  lyricsData: _lyricsData,
  duration,
  currentTime,
  onTimeRangeChange,
  onRepeatCountChange,
  onStartTimeLoop,
  onStartLyricsLoop,
  onStopLoop,
  onResetLoop,
  hasLyricsSelected,
  calculatedTimeRange,
  isMobileWeb = false,
}) => {
  const [timeLoopStart, setTimeLoopStart] = useState(0);
  const [timeLoopEnd, setTimeLoopEnd] = useState(Math.min(30000, duration)); // Default 30 seconds
  const [repeatCount, setRepeatCount] = useState(3);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Update repeat count when external state changes
  useEffect(() => {
    setRepeatCount(loopState.repeatCount ?? 3);
  }, [loopState.repeatCount]);

  // Update time range when duration changes
  useEffect(() => {
    if (duration > 0 && timeLoopEnd > duration) {
      setTimeLoopEnd(Math.min(30000, duration));
    }
  }, [duration, timeLoopEnd]);

  const formatTime = (timeInMs: number): string => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimelinePosition = (timeInMs: number): number => {
    if (duration === 0) return 0;
    return (timeInMs / duration) * 100;
  };

  const getTimeFromPosition = (positionPercent: number): number => {
    return (positionPercent / 100) * duration;
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const positionPercent = (clickX / rect.width) * 100;
    const clickTime = getTimeFromPosition(Math.max(0, Math.min(100, positionPercent)));
    
    // Determine if we should set start or end based on proximity
    const distanceToStart = Math.abs(clickTime - timeLoopStart);
    const distanceToEnd = Math.abs(clickTime - timeLoopEnd);
    
    if (distanceToStart < distanceToEnd) {
      const newStart = Math.min(clickTime, timeLoopEnd - 1000);
      setTimeLoopStart(newStart);
      onTimeRangeChange(newStart, timeLoopEnd);
    } else {
      const newEnd = Math.max(clickTime, timeLoopStart + 1000);
      setTimeLoopEnd(newEnd);
      onTimeRangeChange(timeLoopStart, newEnd);
    }
  }, [timeLoopStart, timeLoopEnd, duration, isDragging, onTimeRangeChange]);

  const handleMarkerDrag = useCallback((e: React.MouseEvent, type: 'start' | 'end') => {
    e.preventDefault();
    setIsDragging(type);
  }, []);

  const updateDragAtClientX = useCallback((clientX: number) => {
    if (!isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const positionPercent = (mouseX / rect.width) * 100;
    const newTime = getTimeFromPosition(Math.max(0, Math.min(100, positionPercent)));
    if (isDragging === 'start') {
      const newStart = Math.min(newTime, timeLoopEnd - 1000);
      setTimeLoopStart(newStart);
      onTimeRangeChange(newStart, timeLoopEnd);
    } else if (isDragging === 'end') {
      const newEnd = Math.max(newTime, timeLoopStart + 1000);
      setTimeLoopEnd(newEnd);
      onTimeRangeChange(timeLoopStart, newEnd);
    }
  }, [isDragging, timeLoopStart, timeLoopEnd, onTimeRangeChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    updateDragAtClientX(e.clientX);
  }, [isDragging, updateDragAtClientX]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    updateDragAtClientX(e.clientX);
  }, [isDragging, updateDragAtClientX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('pointerup', handleMouseUp as unknown as (e: PointerEvent) => void);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('pointerup', handleMouseUp as unknown as (e: PointerEvent) => void);
      };
    }
  }, [isDragging, handleMouseMove, handlePointerMove, handleMouseUp]);

  const handlePointerDownTrack = useCallback((e: React.PointerEvent) => {
    if (!timelineRef.current) return;
    e.preventDefault();
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const positionPercent = (clickX / rect.width) * 100;
    const clickTime = getTimeFromPosition(Math.max(0, Math.min(100, positionPercent)));
    const distanceToStart = Math.abs(clickTime - timeLoopStart);
    const distanceToEnd = Math.abs(clickTime - timeLoopEnd);
    if (distanceToStart < distanceToEnd) {
      setIsDragging('start');
      const newStart = Math.min(clickTime, timeLoopEnd - 1000);
      setTimeLoopStart(newStart);
      onTimeRangeChange(newStart, timeLoopEnd);
    } else {
      setIsDragging('end');
      const newEnd = Math.max(clickTime, timeLoopStart + 1000);
      setTimeLoopEnd(newEnd);
      onTimeRangeChange(timeLoopStart, newEnd);
    }
  }, [timeLoopStart, timeLoopEnd, onTimeRangeChange]);

  const incrementRepeatCount = () => {
    const newCount = repeatCount === 0 ? 1 : Math.min(repeatCount + 1, 999);
    onRepeatCountChange(newCount);
  };

  const decrementRepeatCount = () => {
    const newCount = Math.max(repeatCount - 1, 1);
    onRepeatCountChange(newCount);
  };

  const setInfiniteLoop = () => {
    // Toggle: if currently infinity (0), go to 1; otherwise go to infinity (0)
    const newCount = repeatCount === 0 ? 1 : 0;
    onRepeatCountChange(newCount);
  };

  const handleStartTimeLoop = () => {
    onStartTimeLoop(timeLoopStart, timeLoopEnd, repeatCount);
  };

  const handleStartLyricsLoop = () => {
    onStartLyricsLoop(repeatCount);
  };

  const getProgressText = (): string => {
    if (!loopState.isActive) return '';
    
    if (loopState.repeatCount === 0) {
      return `Loop ${loopState.currentIteration + 1} (∞)`;
    } else {
      return `Loop ${loopState.currentIteration + 1}/${loopState.repeatCount}`;
    }
  };

  return (
    <div className="loop-controls">
      <div className="loop-header">
        {loopState.isActive && (
          <div className="loop-status">
            <span className="status-indicator">●</span>
            <span className="status-text">{getProgressText()}</span>
          </div>
        )}
      </div>

      {/* Loop Sections Side by Side */}
      <div className="loop-sections-container">
        {/* Timeline Loop Section */}
        <div className="timeline-loop-section">
          <h3 className="section-title">Time Loop</h3>
          <div className="timeline-container">
            <div 
              ref={timelineRef}
              className="timeline-track"
              onPointerDown={handlePointerDownTrack}
              onClick={handleTimelineClick}
            >
              {/* Current time indicator */}
              <div 
                className="current-time-indicator"
                style={{ left: `${getTimelinePosition(currentTime)}%` }}
              />
              
              {/* Loop range highlight */}
              <div 
                className="loop-range-highlight"
                style={{
                  left: `${getTimelinePosition(timeLoopStart)}%`,
                  width: `${getTimelinePosition(timeLoopEnd) - getTimelinePosition(timeLoopStart)}%`
                }}
              />
              
              {/* Start marker */}
              <div 
                className="timeline-marker start-marker"
                style={{ left: `${getTimelinePosition(timeLoopStart)}%` }}
                onMouseDown={(e) => handleMarkerDrag(e, 'start')}
              >
                <div className="marker-time">{formatTime(timeLoopStart)}</div>
              </div>
              
              {/* End marker */}
              <div 
                className="timeline-marker end-marker"
                style={{ left: `${getTimelinePosition(timeLoopEnd)}%` }}
                onMouseDown={(e) => handleMarkerDrag(e, 'end')}
              >
                <div className="marker-time">{formatTime(timeLoopEnd)}</div>
              </div>
            </div>
          </div>

          <div className="timeline-controls">
            <div className="repeat-counter">
              <button onClick={decrementRepeatCount} className="counter-btn">−</button>
              <span className="counter-display">
                {repeatCount === 0 ? '∞' : `${repeatCount}x`}
              </span>
              <button onClick={incrementRepeatCount} className="counter-btn">+</button>
              <button onClick={setInfiniteLoop} className={`infinite-toggle ${repeatCount === 0 ? 'active' : ''}`}>
                ∞
              </button>
            </div>
            <button onClick={handleStartTimeLoop} className="start-timeline-loop-btn">
              Play Loop
            </button>
          </div>
        </div>

        {/* Lyrics Loop Section - Hidden on mobile web */}
        {!isMobileWeb && (
          <div className="lyrics-loop-section">
            <h3 className="section-title">Selected Lyrics</h3>
            {!hasLyricsSelected && (
              <p className="no-selection-text">Drag across lyric cards to select a range for looping</p>
            )}
            <div className="lyrics-loop-info">
              {hasLyricsSelected && (
                <>
                  <p>Range: {formatTime(calculatedTimeRange.startTime)} - {formatTime(calculatedTimeRange.endTime)}</p>
                  <div className="lyrics-controls">
                    <div className="repeat-counter">
                      <button onClick={decrementRepeatCount} className="counter-btn">−</button>
                      <span className="counter-display">
                        {repeatCount === 0 ? '∞' : `${repeatCount}x`}
                      </span>
                      <button onClick={incrementRepeatCount} className="counter-btn">+</button>
                      <button onClick={setInfiniteLoop} className={`infinite-toggle ${repeatCount === 0 ? 'active' : ''}`}>
                        ∞
                      </button>
                    </div>
                    <button onClick={handleStartLyricsLoop} className="start-lyrics-loop-btn">
                      Play Loop
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Loop Controls */}
      {loopState.isActive && (
        <div className="active-loop-controls">
          <button onClick={onStopLoop} className="stop-loop-btn">
            Stop Loop
          </button>
          <button onClick={onResetLoop} className="reset-loop-btn">
            Reset
          </button>
        </div>
      )}

      <style jsx>{`
        .loop-controls {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 20px;
          margin: 8px 0 16px 0;
          border: 1px solid #3e3e3e;
        }

        .loop-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .loop-header h3 {
          margin: 0;
          color: #ffffff;
          font-size: 18px;
          font-weight: 600;
        }

        .loop-sections-container {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          align-items: stretch;
        }

        /* Single column layout when lyrics section is hidden */
        .loop-sections-container:has(.timeline-loop-section:only-child) {
          grid-template-columns: 1fr;
        }

        .loop-status {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #7955f2;
          padding: 4px 12px;
          border-radius: 16px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .status-indicator {
          color: #ffffff;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .timeline-loop-section, .lyrics-loop-section {
          background: rgba(0, 122, 255, 0.1);
          border-radius: 8px;
          padding: 18px;
          margin-bottom: 0;
          border: 1px solid rgba(0, 122, 255, 0.3);
          display: flex;
          flex-direction: column;
        }

        .lyrics-loop-section {
          justify-content: space-between;
          min-height: 100%;
        }

        .section-title {
          margin: 0 0 12px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .no-selection-text {
          color: #999999;
          font-style: italic;
          margin: 4px 0 16px 0;
          text-align: center;
          flex: 1;
        }

        .timeline-loop-section h4, .lyrics-loop-section h4 {
          margin: 0 0 12px 0;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .timeline-container {
          margin-bottom: 16px;
          padding: 0 20px;
        }

        .timeline-track {
          position: relative;
          height: 40px;
          background: #2a2a2a;
          border-radius: 20px;
          cursor: pointer;
          overflow: visible;
        }

        .current-time-indicator {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background: #ffffff;
          z-index: 2;
          pointer-events: none;
        }

        .loop-range-highlight {
          position: absolute;
          top: 4px;
          height: 32px;
          background: linear-gradient(90deg, rgba(121, 85, 242, 0.7), rgba(153, 111, 242, 0.7));
          border-radius: 16px;
          z-index: 1;
          box-shadow: 0 0 20px rgba(121, 85, 242, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          animation: loopGlow 3s ease-in-out infinite;
        }

        @keyframes loopGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(121, 85, 242, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2); }
          50% { box-shadow: 0 0 30px rgba(121, 85, 242, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
        }

        .timeline-marker {
          position: absolute;
          top: -8px;
          width: 16px;
          height: 56px;
          cursor: grab;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateX(-50%);
        }

        .timeline-marker:active {
          cursor: grabbing;
        }

        .timeline-marker::before {
          content: '';
          width: 18px;
          height: 18px;
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          border-radius: 50%;
          border: 2px solid #ffffff;
          margin-bottom: 4px;
          box-shadow: 0 4px 12px rgba(121, 85, 242, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .timeline-marker:hover::before {
          transform: scale(1.2);
          box-shadow: 0 6px 18px rgba(121, 85, 242, 0.6), 0 3px 6px rgba(0, 0, 0, 0.4);
        }

        .marker-time {
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          color: white;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(121, 85, 242, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .timeline-controls, .lyrics-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .repeat-counter {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #404040;
          border-radius: 20px;
          padding: 4px;
        }

        .counter-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: #535353;
          color: #ffffff;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .counter-btn:hover {
          background: linear-gradient(135deg, #8b66f2, #a876f2);
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(121, 85, 242, 0.4);
          color: white;
        }

        .counter-btn:active {
          transform: scale(0.95);
          transition: transform 0.1s;
        }

        .counter-display {
          min-width: 40px;
          text-align: center;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
        }

        .infinite-toggle {
          width: 32px;
          height: 28px;
          border: 1px solid #535353;
          background: transparent;
          color: #b3b3b3;
          border-radius: 14px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .infinite-toggle:hover {
          border-color: #7955f2;
          color: #ffffff;
        }

        .infinite-toggle.active {
          background: #7955f2;
          border-color: #7955f2;
          color: #ffffff;
        }

        .start-timeline-loop-btn, .start-lyrics-loop-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          border: none;
          border-radius: 20px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(121, 85, 242, 0.3);
          position: relative;
          overflow: hidden;
        }

        .start-timeline-loop-btn:hover, .start-lyrics-loop-btn:hover {
          background: linear-gradient(135deg, #8b66f2, #a876f2);
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 4px 15px rgba(121, 85, 242, 0.5);
        }

        .start-timeline-loop-btn:active, .start-lyrics-loop-btn:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s;
        }

        .lyrics-loop-info p {
          margin: 0 0 12px 0;
          color: #b3b3b3;
          font-size: 13px;
        }

        .active-loop-controls {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #404040;
        }

        .stop-loop-btn, .reset-loop-btn {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .stop-loop-btn {
          background: #ff4757;
          color: #ffffff;
        }

        .stop-loop-btn:hover {
          background: #ff3844;
          transform: translateY(-1px);
        }

        .reset-loop-btn {
          background: #404040;
          color: #b3b3b3;
        }

        .reset-loop-btn:hover {
          background: #535353;
          color: #ffffff;
          transform: translateY(-1px);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .loop-controls {
            padding: 16px;
          }

          .loop-sections-container {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .timeline-controls, .lyrics-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .repeat-counter {
            justify-content: center;
            margin-bottom: 8px;
          }

          .active-loop-controls {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};