import React, { useEffect, useRef } from 'react';
import { LyricLine } from '../types/lyrics';

interface GrammarPopupProps {
  line: LyricLine | null;
  lines: LyricLine[] | null;
  explanation: string;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export const GrammarPopup: React.FC<GrammarPopupProps> = ({
  line,
  lines,
  explanation,
  isLoading,
  error,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

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
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!line && !lines) return null;

  return (
    <div className="grammar-popup-overlay">
      <div 
        ref={popupRef}
        className="grammar-popup"
      >
        <div className="popup-header">
          <h3>{lines ? 'Multi-Line Grammar Analysis' : 'Grammar Explanation'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="lyric-reference">
          {lines ? (
            lines.map((lyricLine, index) => (
              <div key={index} className="lyric-line">
                <div className="line-number">Line {index + 1}:</div>
                <div className="japanese">{lyricLine.japanese}</div>
                <div className="romaji">{lyricLine.romaji}</div>
                <div className="english">{lyricLine.english}</div>
              </div>
            ))
          ) : line ? (
            <>
              <div className="japanese">{line.japanese}</div>
              <div className="romaji">{line.romaji}</div>
              <div className="english">{line.english}</div>
            </>
          ) : null}
        </div>

        <div className="explanation-content">
          {isLoading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Getting grammar explanation...</p>
            </div>
          )}
          
          {error && (
            <div className="error">
              <p>Error: {error}</p>
              <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
          )}
          
          {explanation && !isLoading && (
            <div className="explanation">
              {explanation.split('\n').map((line, index) => {
                if (line.trim() === '') return null;
                
                // Check if line is a section header (starts with **)
                if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                  const headerText = line.trim().slice(2, -2);
                  return (
                    <h4 key={index} className="section-header">
                      {headerText}
                    </h4>
                  );
                }
                
                // Regular content line
                return (
                  <p key={index} className="section-content">
                    {line.trim()}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .grammar-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0 20px;
          box-sizing: border-box;
          padding-top: 15vh;
        }

        .grammar-popup {
          position: relative;
          width: 100%;
          max-width: 500px;
          max-height: 70vh;
          background: #1a1a1a;
          border-radius: 12px;
          border: 1px solid #404040;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          overflow: hidden;
          animation: popupAppear 0.2s ease-out;
          box-sizing: border-box;
        }

        @keyframes popupAppear {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #7955f2;
          color: white;
        }

        .popup-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .lyric-reference {
          padding: 16px 20px;
          background: #2a2a2a;
          border-bottom: 1px solid #404040;
        }

        .lyric-reference .japanese {
          font-size: 18px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .lyric-reference .romaji {
          font-size: 14px;
          color: #b3b3b3;
          font-style: italic;
          margin-bottom: 4px;
        }

        .lyric-reference .english {
          font-size: 14px;
          color: #999999;
        }

        .lyric-line {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #404040;
        }

        .lyric-line:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .line-number {
          font-size: 12px;
          color: #7955f2;
          font-weight: 600;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .explanation-content {
          padding: 20px;
          max-height: 300px;
          overflow-y: auto;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #b3b3b3;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #404040;
          border-top: 2px solid #7955f2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error {
          text-align: center;
          color: #ff6b6b;
        }

        .error button {
          background: #7955f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 8px;
        }

        .explanation {
          color: #e0e0e0;
          line-height: 1.6;
        }

        .explanation p {
          margin: 0 0 12px 0;
        }

        .explanation p:last-child {
          margin-bottom: 0;
        }

        .section-header {
          color: #7955f2;
          font-size: 14px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(121, 85, 242, 0.3);
        }

        .section-header:first-child {
          margin-top: 0;
        }

        .section-content {
          margin: 4px 0 12px 0;
          line-height: 1.5;
          color: #e0e0e0;
        }

        .section-content:empty {
          display: none;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .grammar-popup-overlay {
            padding: 16px;
            padding-top: max(120px, env(safe-area-inset-top) + 104px);
            align-items: flex-start;
          }
          
          .grammar-popup {
            max-width: 100%;
            max-height: calc(100vh - max(140px, env(safe-area-inset-top) + 124px));
          }
        }
      `}</style>
    </div>
  );
};
