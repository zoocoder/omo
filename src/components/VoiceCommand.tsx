import React, { useState, useRef, useCallback } from 'react';
import { OpenAIService } from '../services/openaiService';
import { VoiceCommandService, VoiceCommandResult } from '../services/voiceCommandService';
import { LyricLine, Song } from '../types/lyrics';

interface VoiceCommandProps {
  currentTime: number;
  lyricsData: LyricLine[] | null;
  duration: number;
  song: Song | null;
  onCommand: (result: VoiceCommandResult) => void;
}

export const VoiceCommand: React.FC<VoiceCommandProps> = ({
  currentTime,
  lyricsData,
  duration,
  song,
  onCommand,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        setStatus('Processing voice command...');
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const transcript = await OpenAIService.transcribeAudio(audioBlob);
          

          
          const commandResult = VoiceCommandService.processCommand(
            transcript,
            currentTime,
            lyricsData,
            duration,
            song
          );

          onCommand(commandResult);
          
          // Provide audio feedback
          const feedbackBlob = await OpenAIService.synthesizeSpeech(commandResult.message);
          const audio = new Audio(URL.createObjectURL(feedbackBlob));
          audio.play();
          
          setStatus(commandResult.message);
          setTimeout(() => setStatus(''), 3000);
          
        } catch (error) {
          console.error('Voice command error:', error);
          const errorMessage = 'Sorry, I had trouble processing your voice command';
          setStatus(errorMessage);
          
          try {
            const errorBlob = await OpenAIService.synthesizeSpeech(errorMessage);
            const audio = new Audio(URL.createObjectURL(errorBlob));
            audio.play();
          } catch (ttsError) {
            console.error('TTS error:', ttsError);
          }
          
          setTimeout(() => setStatus(''), 3000);
        } finally {
          setIsProcessing(false);
        }

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Listening... (speak your command)');
      
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Microphone access denied');
      setTimeout(() => setStatus(''), 3000);
    }
  }, [currentTime, lyricsData, duration, onCommand]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  }, [isRecording, isProcessing, startRecording, stopRecording]);

  return (
    <div className="voice-command">
      <button 
        className={`voice-btn ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={handleClick}
        disabled={isProcessing}
        title="Voice Command - Click to speak"
      >
        {isRecording ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
          </svg>
        ) : isProcessing ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="spin"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      
      {status && (
        <div className="voice-status">
          {status}
        </div>
      )}

      <style jsx>{`
        .voice-command {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .voice-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid #7955f2;
          background: linear-gradient(135deg, rgba(42, 42, 42, 0.8), rgba(121, 85, 242, 0.1));
          color: #7955f2;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          box-shadow: 0 4px 15px rgba(121, 85, 242, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .voice-btn:hover {
          background: linear-gradient(135deg, #7955f2, #9a6ff2);
          color: white;
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(121, 85, 242, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .voice-btn:active {
          transform: scale(0.95);
        }

        .voice-btn.recording {
          background: #ff4444;
          border-color: #ff4444;
          color: white;
          animation: pulse 1.5s infinite;
        }

        .voice-btn.processing {
          background: #7955f2;
          color: white;
          cursor: not-allowed;
        }

        .voice-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @keyframes pulse {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7);
          }
          50% { 
            box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
          }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        .voice-status {
          font-size: 12px;
          color: #b3b3b3;
          text-align: center;
          max-width: 200px;
          line-height: 1.3;
          background: rgba(42, 42, 42, 0.9);
          padding: 6px 12px;
          border-radius: 16px;
          border: 1px solid #404040;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .voice-btn {
            width: 44px;
            height: 44px;
          }
          
          .voice-status {
            font-size: 11px;
            max-width: 180px;
          }
        }
      `}</style>
    </div>
  );
};
