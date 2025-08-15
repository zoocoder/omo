import React from 'react';
import { SONGS } from '../data/songs';

interface PlaylistProps {
  currentSongId: string | null;
  onSongSelect: (songId: string) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export const Playlist: React.FC<PlaylistProps> = ({ 
  currentSongId, 
  onSongSelect, 
  isVisible, 
  onToggle 
}) => {
  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Touch/swipe handling for mobile
  const touchStartX = React.useRef<number>(0);
  const touchStartY = React.useRef<number>(0);
  const isSwiping = React.useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isVisible) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isVisible) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // If horizontal swipe is more significant than vertical, consider it a swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isVisible || !isSwiping.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    
    // If swiped left by at least 100px, close the playlist
    if (deltaX < -100) {
      onToggle();
    }
    
    isSwiping.current = false;
  };

  return (
    <>
      {/* Mobile overlay - click to close */}
      {isVisible && (
        <div 
          className="playlist-overlay"
          onClick={onToggle}
        />
      )}
      
      <div 
        className={`playlist-sidebar ${isVisible ? 'visible' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isVisible && (
          <>
            <div className="playlist-header">
              <h3>Songs</h3>
              <button onClick={onToggle} className="playlist-toggle-btn" aria-label="Toggle playlist">
                ‹
              </button>
            </div>
            
            <div className="playlist-songs">
              {SONGS.map((song) => (
                <div 
                  key={song.id}
                  className={`playlist-song ${currentSongId === song.id ? 'current' : ''}`}
                  onClick={() => onSongSelect(song.id)}
                >
                  <div className="song-info">
                    <div className="song-title">
                      <span className="japanese">{song.title}</span>
                      <span className="english">({song.titleEnglish})</span>
                    </div>
                    <div className="song-artist">{song.artist}</div>
                  </div>
                  <div className="song-duration">{formatDuration(song.duration)}</div>
                  {currentSongId === song.id && (
                    <div className="now-playing-indicator">♪</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {!isVisible && (
        <div className="reopen-btn-container">
          <button onClick={onToggle} className="playlist-reopen-btn" aria-label="Open playlist">
            ›
          </button>
        </div>
      )}

      <style jsx>{`
        .playlist-sidebar {
          width: ${isVisible ? '280px' : '0px'};
          min-height: 100vh;
          background: #1a1a1a;
          border-right: ${isVisible ? '1px solid #333' : 'none'};
          transition: width 0.3s ease, border-right 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          touch-action: pan-y;
        }

        .playlist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #333;
          background: #252525;
          flex-shrink: 0;
        }

        .playlist-header h3 {
          margin: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          -webkit-user-drag: none;
          user-select: none;
        }

        .playlist-toggle-btn {
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 6px;
          transition: all 0.2s;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .playlist-toggle-btn:hover {
          background: linear-gradient(135deg, #8b66f2, #a876f2);
          transform: scale(1.1);
        }

        .reopen-btn-container {
          position: absolute;
          top: 16px;
          left: 10px;
          z-index: 1300;
        }

        .playlist-reopen-btn {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(121, 85, 242, 0.4);
          transition: all 0.3s ease;
        }

        .playlist-reopen-btn:hover {
          background: linear-gradient(135deg, #8b66f2, #a876f2);
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(121, 85, 242, 0.6);
        }

        .playlist-songs {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .playlist-song {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.2s ease;
          position: relative;
        }

        .playlist-song:hover {
          background: rgba(121, 85, 242, 0.1);
        }

        .playlist-song.current {
          background: rgba(121, 85, 242, 0.2);
          border-left: 3px solid #7955f2;
        }

        .song-info {
          flex: 1;
          min-width: 0;
        }

        .song-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .song-title .japanese {
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-title .english {
          color: #999;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-artist {
          color: #666;
          font-size: 11px;
          margin-top: 2px;
        }

        .song-duration {
          color: #b3b3b3;
          font-size: 12px;
          margin-left: 12px;
          font-family: 'Circular', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Helvetica Neue', sans-serif;
          font-weight: 400;
          font-variant-numeric: tabular-nums;
        }

        .now-playing-indicator {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #7955f2;
          font-size: 12px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .playlist-sidebar {
            position: fixed;
            top: max(90px, env(safe-area-inset-top) + 50px);
            left: 0;
            height: calc(100vh - max(90px, env(safe-area-inset-top) + 50px) - env(safe-area-inset-bottom));
            width: 75vw;
            max-width: 320px;
            transform: translateX(${isVisible ? '0' : '-100%'});
            transition: transform 0.3s ease;
            box-shadow: 8px 0 24px rgba(0,0,0,0.5);
            border-right: 1px solid #333;
            z-index: 1200;
            border-top-right-radius: 12px;
            border-bottom-right-radius: 12px;
            touch-action: pan-y;
          }

          .reopen-btn-container {
            display: none; /* Hide reopen button on mobile; use header toggle instead */
          }

          .playlist-reopen-btn {
            width: 36px;
            height: 44px;
            border-radius: 8px;
          }

          .playlist-header h3 { font-size: 15px; }
          .song-title .japanese { font-size: 13px; }
          .song-title .english { font-size: 11px; }
        }

        .playlist-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          display: none;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .playlist-overlay {
            display: block;
          }
        }
      `}</style>
    </>
  );
};
