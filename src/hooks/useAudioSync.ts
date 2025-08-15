import { useState, useEffect, useCallback } from 'react';
import { LyricsData, CurrentLine } from '../types/lyrics';
import { LyricsParser } from '../utils/lyricsParser';

interface UseAudioSyncProps {
  lyricsData: LyricsData | null;
  currentTime: number;
  isPlaying?: boolean;
}

interface UseAudioSyncReturn {
  currentLine: CurrentLine;
  previousLineIndex: number;
  nextLineIndex: number;
  progress: number; // Progress through current line (0-1)
}

export const useAudioSync = ({ lyricsData, currentTime, isPlaying = false }: UseAudioSyncProps): UseAudioSyncReturn => {
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
  }, [lyricsData, currentTime, isPlaying]);

  // Calculate progress through current line
  const calculateProgress = useCallback((line: CurrentLine): number => {
    if (!line.line || !line.isActive) return 0;
    
    const duration = line.line.endTime - line.line.startTime;
    const elapsed = currentTime - line.line.startTime;
    
    return Math.max(0, Math.min(1, elapsed / duration));
  }, [currentTime]);

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


