import { useState, useEffect, useCallback } from 'react';
import { LyricsData, CurrentLine } from '../types/lyrics';
import { LyricsParser } from '../utils/lyricsParser';

interface UseAudioSyncProps {
  lyricsData: LyricsData | null;
  currentTime: number;
  isPlaying?: boolean;
  loopState?: {
    isActive: boolean;
    startTime: number;
    endTime: number;
    currentIteration: number;
    repeatCount: number;
    mode: 'lyrics' | 'time' | null;
    selectedLyricIndices: number[];
  } | null;
  individualLyricLoop?: {
    isActive: boolean;
    startTime: number;
    endTime: number;
    repeatCount: number;
    currentIteration: number;
  } | null;
}

interface UseAudioSyncReturn {
  currentLine: CurrentLine;
  previousLineIndex: number;
  nextLineIndex: number;
  progress: number; // Progress through current line (0-1)
}

export const useAudioSync = ({ lyricsData, currentTime, isPlaying = false, loopState = null, individualLyricLoop = null }: UseAudioSyncProps): UseAudioSyncReturn => {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [previousLineIndex, setPreviousLineIndex] = useState(-1);



  // Find current active line using binary search
  const findCurrentLine = useCallback((): CurrentLine => {
    if (!lyricsData || lyricsData.lyrics.length === 0) {
      return {
        index: -1,
        line: null,
        isActive: false,
      };
    }
    
    // Check if we're in a loop state - this takes priority over everything else
    if (loopState && loopState.isActive) {
      // For both selected lyrics loops and time loops, use current time to find the active line
      // This ensures the highlighted card follows the actual audio playback position
      const timeToUse = currentTime;
      
      // First, try the standard search
      const loopLineIndex = LyricsParser.findCurrentLineIndex(lyricsData.lyrics, timeToUse);
      
      if (loopLineIndex >= 0) {
        const loopLine = lyricsData.lyrics[loopLineIndex];
        return {
          index: loopLineIndex,
          line: loopLine,
          isActive: true,
        };
      }
      
      // If no exact match, find the most appropriate line for the current time
      // This handles gaps between lyric lines more gracefully
      let bestIndex = -1;
      let bestScore = Infinity;
      
      for (let i = 0; i < lyricsData.lyrics.length; i++) {
        const line = lyricsData.lyrics[i];
        
        // If we're within the line's time range, this is perfect
        if (timeToUse >= line.startTime && timeToUse <= line.endTime) {
          return {
            index: i,
            line: line,
            isActive: true,
          };
        }
        
        // Calculate a score based on proximity to the line
        let score;
        if (timeToUse < line.startTime) {
          // Before the line starts
          score = line.startTime - timeToUse;
        } else {
          // After the line ends
          score = timeToUse - line.endTime;
        }
        
        // Prefer lines that we've recently passed over lines that are far in the future
        if (timeToUse > line.endTime) {
          score *= 0.5; // Reduce penalty for recently passed lines
        }
        
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      
      if (bestIndex >= 0) {
        return {
          index: bestIndex,
          line: lyricsData.lyrics[bestIndex],
          isActive: true,
        };
      }
      
      // Absolute fallback: return the first line
      return {
        index: 0,
        line: lyricsData.lyrics[0],
        isActive: true,
      };
    }

    // Check if we're in an individual lyric loop state - this also takes priority
    if (individualLyricLoop && individualLyricLoop.isActive) {
      const loopStartTime = individualLyricLoop.startTime;
      const loopEndTime = individualLyricLoop.endTime;
      
      // Find the line that contains the individual lyric loop start time
      const loopLineIndex = LyricsParser.findCurrentLineIndex(lyricsData.lyrics, loopStartTime);
      
      if (loopLineIndex >= 0) {
        const loopLine = lyricsData.lyrics[loopLineIndex];
        return {
          index: loopLineIndex,
          line: loopLine,
          isActive: true,
        };
      }
      
      // Fallback: find any line that overlaps with the loop region
      for (let i = 0; i < lyricsData.lyrics.length; i++) {
        const line = lyricsData.lyrics[i];
        // Check if this line overlaps with the loop region
        if (line.startTime <= loopEndTime && line.endTime >= loopStartTime) {
          return {
            index: i,
            line: line,
            isActive: true,
          };
        }
      }
      
      // Last resort: find the closest line to the loop start time
      let closestIndex = 0;
      let closestDistance = Math.abs(lyricsData.lyrics[0].startTime - loopStartTime);
      
      for (let i = 1; i < lyricsData.lyrics.length; i++) {
        const distance = Math.abs(lyricsData.lyrics[i].startTime - loopStartTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
      
      return {
        index: closestIndex,
        line: lyricsData.lyrics[closestIndex],
        isActive: true,
      };
    }

    // Only prevent highlighting if music truly hasn't started (currentTime is essentially 0)
    // This allows highlighting during pauses and loops where currentTime > 0
    if (!isPlaying && currentTime <= 0) {
      return {
        index: -1,
        line: null,
        isActive: false,
      };
    }

    const foundIndex = LyricsParser.findCurrentLineIndex(lyricsData.lyrics, currentTime);
    
    if (foundIndex >= 0) {
      return {
        index: foundIndex,
        line: lyricsData.lyrics[foundIndex],
        isActive: true,
      };
    }

    // Check if we're before the first line or after the last line
    const firstLine = lyricsData.lyrics[0];
    const lastLine = lyricsData.lyrics[lyricsData.lyrics.length - 1];

    if (currentTime < firstLine.startTime) {
      // Before first line - show upcoming line but not active
      return {
        index: 0,
        line: firstLine,
        isActive: false,
      };
    }

    if (currentTime > lastLine.endTime) {
      // After last line - show last line but not active
      return {
        index: lyricsData.lyrics.length - 1,
        line: lastLine,
        isActive: false,
      };
    }

    // Between lines - find the most recent line
    for (let i = lyricsData.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsData.lyrics[i].endTime) {
        return {
          index: i,
          line: lyricsData.lyrics[i],
          isActive: false,
        };
      }
    }

    return {
      index: -1,
      line: null,
      isActive: false,
    };
  }, [lyricsData, currentTime, isPlaying, loopState, individualLyricLoop]);

  // Calculate progress through current line
  const calculateProgress = useCallback((line: CurrentLine): number => {
    if (!line.line || !line.isActive) return 0;
    
    // If we're in a selected lyrics loop, calculate progress the same way as time loops
    if (loopState && loopState.isActive && loopState.mode === 'lyrics') {
      // Calculate progress within the current individual lyric line (same as time loops)
      const lineStartTime = line.line.startTime;
      const lineEndTime = line.line.endTime;
      const lineDuration = lineEndTime - lineStartTime;
      
      // Calculate progress within the current line
      if (currentTime >= lineStartTime && currentTime <= lineEndTime) {
        const elapsedInLine = currentTime - lineStartTime;
        return Math.max(0, Math.min(1, elapsedInLine / lineDuration));
      } else if (currentTime < lineStartTime) {
        // Before line starts
        return 0;
      } else {
        // After line ends
        return 1;
      }
    }
    
    // If we're in a time-based loop, calculate progress based on the current line
    if (loopState && loopState.isActive && loopState.mode === 'time') {
      // Calculate progress within the current individual lyric line
      const lineStartTime = line.line.startTime;
      const lineEndTime = line.line.endTime;
      const lineDuration = lineEndTime - lineStartTime;
      
      // Calculate progress within the current line
      if (currentTime >= lineStartTime && currentTime <= lineEndTime) {
        const elapsedInLine = currentTime - lineStartTime;
        return Math.max(0, Math.min(1, elapsedInLine / lineDuration));
      } else if (currentTime < lineStartTime) {
        // Before line starts
        return 0;
      } else {
        // After line ends
        return 1;
      }
    }
    
    // If we're in an individual lyric loop, calculate progress based on that
    if (individualLyricLoop && individualLyricLoop.isActive) {
      const loopStartTime = individualLyricLoop.startTime;
      const loopEndTime = individualLyricLoop.endTime;
      const loopDuration = loopEndTime - loopStartTime;
      
      // Calculate progress within the individual lyric loop region
      if (currentTime >= loopStartTime && currentTime <= loopEndTime) {
        const elapsedInLoop = currentTime - loopStartTime;
        return Math.max(0, Math.min(1, elapsedInLoop / loopDuration));
      } else if (currentTime < loopStartTime) {
        // Before loop starts
        return 0;
      } else {
        // After loop ends
        return 1;
      }
    }
    
    // Normal progress calculation
    const duration = line.line.endTime - line.line.startTime;
    const elapsed = currentTime - line.line.startTime;
    
    return Math.max(0, Math.min(1, elapsed / duration));
  }, [currentTime, loopState, individualLyricLoop, lyricsData]);

  // Update current line when time changes
  useEffect(() => {
    const newCurrentLine = findCurrentLine();
    
    if (newCurrentLine.index !== currentLineIndex) {
      setPreviousLineIndex(currentLineIndex);
      setCurrentLineIndex(newCurrentLine.index);
    }
  }, [currentTime, lyricsData, findCurrentLine, currentLineIndex]);

  const currentLine = findCurrentLine();
  const progress = calculateProgress(currentLine);

  // Calculate next line index
  const nextLineIndex = lyricsData && currentLineIndex >= 0 && currentLineIndex < lyricsData.lyrics.length - 1
    ? currentLineIndex + 1
    : -1;

  return {
    currentLine,
    previousLineIndex,
    nextLineIndex,
    progress,
  };
};


