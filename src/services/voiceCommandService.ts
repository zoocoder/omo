import { LyricLine, Song } from '../types/lyrics';

export interface VoiceCommandResult {
  success: boolean;
  action?: {
    type: 'replay_loop' | 'get_meaning' | 'speak_japanese' | 'play' | 'pause' | 'get_title_meaning' | 'ai_chat' | 'unknown';
    params?: any;
  };
  message: string;
}

export class VoiceCommandService {
  static processCommand(
    transcript: string,
    currentTime: number,
    lyricsData: LyricLine[] | null,
    duration: number,
    song: Song | null = null
  ): VoiceCommandResult {
    const text = transcript.toLowerCase().trim();

    
    // Find the current or most recent lyric line
    const getCurrentLine = (): LyricLine | null => {
      if (!lyricsData) return null;
      
      // Find the line that's currently playing or the most recent one
      let currentLine: LyricLine | null = null;
      for (const line of lyricsData) {
        if (line.startTime <= currentTime) {
          currentLine = line;
        } else {
          break;
        }
      }
      return currentLine;
    };

    // Command patterns
    const replayPatterns = [
      /replay.{0,10}last.{0,10}(\d+).{0,10}second/i,
      /loop.{0,10}last.{0,10}(\d+).{0,10}second/i,
      /play.{0,10}again.{0,10}(\d+).{0,10}second/i,
      /repeat.{0,10}(\d+).{0,10}second/i,
    ];

    const meaningPatterns = [
      /what.{0,15}(mean|meaning)/i,
      /what.{0,15}english/i,
      /translate/i,
      /what.{0,15}say/i,
      /what.{0,15}that.{0,15}mean/i,
    ];

    const speakPatterns = [
      /speak.{0,10}japanese/i,
      /say.{0,10}japanese/i,
      /pronounce/i,
      /how.{0,10}say/i,
      /repeat.{0,10}japanese/i,
    ];

    const playPatterns = [
      /play/i,
      /start/i,
      /resume/i,
      /unpause/i,
      /play.*song/i,
      /start.*song/i,
      /play.*music/i,
      /start.*music/i,
    ];

    const pausePatterns = [
      /pause/i,
      /stop/i,
      /halt/i,
    ];

    const titleMeaningPatterns = [
      /what.{0,15}title.{0,15}mean/i,
      /title.{0,15}meaning/i,
      /translate.{0,15}title/i,
      /what.{0,15}song.{0,15}title.{0,15}mean/i,
      /what.{0,15}name.{0,15}mean/i,
      /song.{0,15}name.{0,15}meaning/i,
    ];

    // Check for replay commands
    for (const pattern of replayPatterns) {
      const match = text.match(pattern);
      if (match) {
        const seconds = parseInt(match[1]) || 5;
        const startTime = Math.max(0, currentTime - (seconds * 1000));
        const endTime = Math.min(duration, currentTime + 1000); // Current time + 1 second
        
        return {
          success: true,
          action: {
            type: 'replay_loop',
            params: { startTime, endTime, seconds, repeatCount: 2 }
          },
          message: `Replaying last ${seconds} seconds`
        };
      }
    }

    // Check for meaning/translation commands
    for (const pattern of meaningPatterns) {
      if (pattern.test(text)) {
        const currentLine = getCurrentLine();
        if (!currentLine) {
          return {
            success: false,
            message: "No current lyric to translate"
          };
        }

        return {
          success: true,
          action: {
            type: 'get_meaning',
            params: { line: currentLine }
          },
          message: `The meaning is: ${currentLine.english}`
        };
      }
    }

    // Check for speak Japanese commands
    for (const pattern of speakPatterns) {
      if (pattern.test(text)) {
        const currentLine = getCurrentLine();
        if (!currentLine) {
          return {
            success: false,
            message: "No current lyric to speak"
          };
        }

        return {
          success: true,
          action: {
            type: 'speak_japanese',
            params: { text: currentLine.japanese }
          },
          message: "Speaking Japanese pronunciation"
        };
      }
    }

    // Check for play commands
    for (const pattern of playPatterns) {
      if (pattern.test(text)) {

        return {
          success: true,
          action: {
            type: 'play',
            params: {}
          },
          message: "Playing song"
        };
      }
    }

    // Check for pause commands
    for (const pattern of pausePatterns) {
      if (pattern.test(text)) {
        return {
          success: true,
          action: {
            type: 'pause',
            params: {}
          },
          message: "Pausing song"
        };
      }
    }

    // Check for title meaning commands
    for (const pattern of titleMeaningPatterns) {
      if (pattern.test(text)) {
        if (!song) {
          return {
            success: false,
            message: "No song information available"
          };
        }

        const title = song.lyricsData.metadata.title;
        const artist = song.lyricsData.metadata.artist;
        
        return {
          success: true,
          action: {
            type: 'get_title_meaning',
            params: { title, artist }
          },
          message: `The song title "${title}" by ${artist} means "Monster's Flower Song" in English`
        };
      }
    }

    // No specific command recognized - fallback to AI chat
    return {
      success: true,
      action: {
        type: 'ai_chat',
        params: { question: transcript, song, lyricsData }
      },
      message: "Let me think about that..."
    };
  }
}
