import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LyricLine } from '../types/lyrics';

interface LyricContextMenuProps {
  line: LyricLine;
  position: { x: number; y: number };
  onClose: () => void;
  onExplainGrammar: (line: LyricLine) => void;
  onStartLoop: (line: LyricLine, repeatCount: number) => void;
}

export const LyricContextMenu: React.FC<LyricContextMenuProps> = ({
  line,
  position,
  onClose,
  onExplainGrammar,
  onStartLoop,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [repeatCount, setRepeatCount] = React.useState(3);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleExplainGrammar = () => {
    onExplainGrammar(line);
    onClose();
  };

  const handleStartLoop = () => {
    onStartLoop(line, repeatCount);
    onClose();
  };



  const incrementRepeatCount = () => {
    setRepeatCount(prev => Math.min(prev + 1, 99));
  };

  const decrementRepeatCount = () => {
    setRepeatCount(prev => Math.max(prev - 1, 1));
  };

  const setInfiniteLoop = () => {
    setRepeatCount(0);
  };

  // Calculate menu position to ensure it fits on screen
  const getMenuPosition = () => {
    const menuWidth = 200;
    const menuHeight = 140;
    const padding = 20;
    
    let x = position.x;
    let y = position.y;
    
    // Adjust X position if menu would go off right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Adjust Y position if menu would go off bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      y = position.y - menuHeight;
    }
    
    // Ensure menu doesn't go off left or top edges
    x = Math.max(padding, x);
    y = Math.max(padding, y);
    
    return { x, y };
  };

  const menuPosition = getMenuPosition();

  const popupContent = (
    <div className="lyric-context-menu-overlay">
      <div 
        ref={menuRef}
        className="lyric-context-menu"
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
        }}
      >
        <div className="menu-options">
          <button 
            className="menu-option"
            onClick={handleExplainGrammar}
          >
            Grammar
          </button>

          <div className="loop-section">
            <div className="loop-header">Loop</div>
            <div className="loop-controls">
              <div className="repeat-counter">
                <button onClick={decrementRepeatCount} className="counter-btn">−</button>
                <span className="counter-display">
                  {repeatCount === 0 ? '∞' : repeatCount}
                </span>
                <button onClick={incrementRepeatCount} className="counter-btn">+</button>
                <button 
                  onClick={setInfiniteLoop} 
                  className={`infinite-toggle ${repeatCount === 0 ? 'active' : ''}`}
                >
                  ∞
                </button>
              </div>
              <button onClick={handleStartLoop} className="start-loop-btn">
                Start
              </button>
            </div>
          </div>


        </div>
      </div>

      <style jsx>{`
        .lyric-context-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000001;
          pointer-events: none;
        }

        .lyric-context-menu {
          position: fixed;
          width: 200px;
          background: #1a1a1a;
          border-radius: 12px;
          border: 1px solid #404040;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: menuAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-sizing: border-box;
          opacity: 0;
          transform: scale(0.95) translateY(-5px);
          pointer-events: auto;
          backdrop-filter: blur(20px);
        }

        @keyframes menuAppear {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .menu-options {
          padding: 12px 0;
        }

        .menu-option {
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          color: #ffffff;
          font-size: 15px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          transition: all 0.2s ease;
        }

        .menu-option:hover {
          background: rgba(121, 85, 242, 0.15);
          color: #f0f0f0;
        }

        .loop-section {
          padding: 12px 16px;
          border-top: 1px solid #404040;
        }

        .loop-header {
          color: #b3b3b3;
          font-size: 13px;
          margin-bottom: 8px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .loop-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .repeat-counter {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #404040;
          border-radius: 16px;
          padding: 3px;
          justify-content: center;
        }

        .counter-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: #535353;
          color: #ffffff;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .counter-btn:hover {
          background: #7955f2;
          transform: scale(1.05);
        }

        .counter-btn:active {
          transform: scale(0.98);
        }

        .counter-display {
          min-width: 32px;
          text-align: center;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .infinite-toggle {
          width: 28px;
          height: 24px;
          border: 1px solid #535353;
          background: transparent;
          color: #b3b3b3;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          transition: all 0.2s ease;
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

        .start-loop-btn {
          padding: 8px 12px;
          background: #7955f2;
          border: none;
          border-radius: 16px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .start-loop-btn:hover {
          background: #8b66f2;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(121, 85, 242, 0.3);
        }

        .start-loop-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(121, 85, 242, 0.3);
        }



        /* Mobile responsive */
        @media (max-width: 768px) {
          .lyric-context-menu {
            width: 180px;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(popupContent, document.body);
};
