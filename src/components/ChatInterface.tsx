import React, { useState, useRef, useEffect } from 'react';
import { Song, LyricLine } from '../types/lyrics';
import { OpenAIService } from '../services/openaiService';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  song: Song | null;
  currentTime: number;
  isVisible: boolean;
  onToggle: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  song,
  currentTime,
  isVisible,
  onToggle,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Completely isolate background - freeze it in place when chat is visible
  useEffect(() => {
    if (!isVisible || window.innerWidth > 768) return;

    // Get current state
    const body = document.body;
    const html = document.documentElement;
    const app = document.querySelector('.app') as HTMLElement;
    
    // Store current scroll position
    const scrollY = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
    
    // Store original styles
    const originalBodyStyle = body.style.cssText;
    const originalHtmlStyle = html.style.cssText;
    const originalAppStyle = app?.style.cssText || '';
    
    // Freeze everything in place
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    
    if (app) {
      app.style.position = 'fixed';
      app.style.top = `-${scrollY}px`;
      app.style.left = '0';
      app.style.right = '0';
      app.style.overflow = 'hidden';
      app.style.height = '100vh';
      app.style.width = '100vw';
    }

    // Cleanup - restore everything exactly as it was
    return () => {
      body.style.cssText = originalBodyStyle;
      html.style.cssText = originalHtmlStyle;
      if (app) {
        app.style.cssText = originalAppStyle;
      }
      
      // Restore scroll position
      window.scrollTo(0, scrollY);
      html.scrollTop = scrollY;
      body.scrollTop = scrollY;
    };
  }, [isVisible]);



  // Get current lyric
  const getCurrentLyric = (): LyricLine | null => {
    if (!song?.lyricsData?.lyrics) return null;
    
    let currentLyric = null;
    for (const line of song.lyricsData.lyrics) {
      if (line.startTime <= currentTime) {
        currentLyric = line;
      } else {
        break;
      }
    }
    return currentLyric;
  };



  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const currentLyric = getCurrentLyric();
      const songInfo = song ? { 
        title: song.lyricsData.metadata.title, 
        artist: song.lyricsData.metadata.artist 
      } : null;
      
      const assistantContent = await OpenAIService.chatWithSongContext(
        userMessage.content, 
        songInfo, 
        currentLyric
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };



  if (!isVisible) {
    return null; // No floating button - using inline button instead
  }

  return (
    <>
      {/* Overlay for click-outside-to-close on mobile */}
      <div className="chat-overlay" onClick={onToggle} />
      
      <div className="chat-interface">
        <div className="chat-header" onClick={onToggle}>
          <h3>先生</h3>
          <button onClick={onToggle} className="chat-close-btn" aria-label="Close chat">
            ✕
          </button>
        </div>
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>👋 Hello! I'm your Japanese music tutor.</p>
            <p>Ask me anything about the current song, lyrics, grammar, or Japanese language!</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.type}`}>
            <div className="message-content">
              {message.content}
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputValue.trim() && !isLoading) {
                  sendMessage();
                }
              }
            }}
            placeholder="Ask about the song, lyrics, grammar..."
            className="chat-input"
            disabled={isLoading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        <button
          onClick={sendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="chat-send-btn"
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style jsx>{`


        .chat-interface {
          position: fixed;
          bottom: 24px;
          right: 12px;
          width: 400px;
          height: calc(100vh - 120px);
          max-height: 600px;
          background: #1a1a1a;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          border: 1px solid #333;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #333;
          background: #252525;
          border-radius: 12px 12px 0 0;
          cursor: pointer;
          user-select: none;
        }

        .chat-header h3 {
          margin: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
        }

        .chat-close-btn {
          background: none;
          border: none;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.2s ease;
        }

        .chat-close-btn:hover {
          color: #fff;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overscroll-behavior: contain;
        }

        .chat-welcome {
          text-align: center;
          color: #999;
          font-size: 14px;
          margin: 20px 0;
        }

        .chat-welcome p {
          margin: 8px 0;
        }

        .chat-message {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }

        .chat-message.user {
          align-self: flex-end;
          align-items: flex-end;
        }

        .chat-message.assistant {
          align-self: flex-start;
          align-items: flex-start;
        }

        .message-content {
          padding: 10px 14px;
          border-radius: 18px;
          word-wrap: break-word;
          line-height: 1.4;
        }

        .chat-message.user .message-content {
          background: #1db954;
          color: #fff;
        }

        .chat-message.assistant .message-content {
          background: #333;
          color: #fff;
        }

        .message-time {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
          padding: 0 4px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .typing-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #666;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .chat-input-container {
          display: flex;
          padding: 16px;
          border-top: 1px solid #333;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #444;
          border-radius: 20px;
          background: #2a2a2a;
          color: #fff;
          outline: none;
          font-size: 14px;
        }

        .chat-input:focus {
          border-color: #1db954;
        }

        .chat-input::placeholder {
          color: #666;
        }

        .chat-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #1db954;
          border: none;
          cursor: pointer;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease;
        }

        .chat-send-btn svg {
          width: 18px;
          height: 18px;
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-send-btn:not(:disabled):hover {
          background: #1ed760;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .chat-interface {
            position: fixed;
            top: 41%;
            left: 16px;
            right: 16px;
            height: 380px;
            max-height: 60vh;
            width: auto;
            border-radius: 16px;
            z-index: 50001;
            overflow: hidden;
            overscroll-behavior: contain;
            touch-action: pan-y;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            transform: none;
          }
          
          /* Even smaller on very small screens */
          @media (max-height: 600px) {
            .chat-interface {
              height: 300px;
              max-height: 50vh;
              top: 36%;
              z-index: 50001;
            }
          }
          
          .chat-header {
            padding: 12px 16px;
            border-bottom: 1px solid #333;
            flex-shrink: 0;
          }
          
          .chat-header h3 {
            font-size: 14px;
          }
          
          .chat-messages {
            flex: 1;
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 12px;
          }
          
          .chat-input-container {
            padding: 12px;
            border-top: 1px solid #333;
            flex-shrink: 0;
          }
          
          .chat-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #444;
            border-radius: 20px;
            background: #2a2a2a;
            color: #fff;
            outline: none;
            font-size: 14px;
          }
          
          .chat-input:focus {
            border-color: #1db954;
          }
          
          .chat-input::placeholder {
            color: #666;
          }
          
          .chat-input:focus {
            -webkit-appearance: none;
            appearance: none;
            outline: none;
            border-color: #1db954;
            -webkit-user-select: text;
            user-select: text;
            /* Prevent virtual keyboard toolbar */
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
          }
          
          /* Prevent iOS keyboard accessory */
          .chat-input::-webkit-input-placeholder {
            color: #666;
          }
          
          .chat-input[readonly] {
            -webkit-appearance: none;
            appearance: none;
          }
          
          /* Additional iOS keyboard prevention */
          .chat-input::-webkit-textfield-decoration-container {
            display: none;
          }
          
          .chat-input::-webkit-clear-button {
            display: none;
          }
        }

        .chat-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 50000;
          display: none;
          touch-action: none;
          pointer-events: auto;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        @media (max-width: 768px) {
          .chat-overlay {
            display: block;
          }
        }
      `}</style>
    </div>
    </>
  );
};
