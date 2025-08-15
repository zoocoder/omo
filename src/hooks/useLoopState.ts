import { useReducer, useCallback } from 'react';
import { LoopState, LyricsData } from '../types/lyrics';

// Initial loop state
const initialLoopState: LoopState = {
  isActive: false,
  mode: null,
  startTime: 0,
  endTime: 0,
  selectedLyricIndices: [],
  repeatCount: 1,
  currentIteration: 0,
};

// Action types
type LoopAction =
  | { type: 'SET_MODE'; mode: 'lyrics' | 'time' | null }
  | { type: 'TOGGLE_LYRIC_SELECTION'; index: number }
  | { type: 'SET_TIME_RANGE'; startTime: number; endTime: number }
  | { type: 'SET_REPEAT_COUNT'; count: number }
  | { type: 'START_LOOP'; startTime: number; endTime: number }
  | { type: 'STOP_LOOP' }
  | { type: 'INCREMENT_ITERATION' }
  | { type: 'RESET_LOOP' };

// Loop state reducer
function loopReducer(state: LoopState, action: LoopAction): LoopState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        selectedLyricIndices: action.mode === 'lyrics' ? state.selectedLyricIndices : [],
      };

    case 'TOGGLE_LYRIC_SELECTION':
      const isSelected = state.selectedLyricIndices.includes(action.index);
      const newIndices = isSelected
        ? state.selectedLyricIndices.filter(i => i !== action.index)
        : [...state.selectedLyricIndices, action.index].sort((a, b) => a - b);
      
      return {
        ...state,
        selectedLyricIndices: newIndices,
      };

    case 'SET_TIME_RANGE':
      return {
        ...state,
        startTime: action.startTime,
        endTime: action.endTime,
      };

    case 'SET_REPEAT_COUNT':
      return {
        ...state,
        repeatCount: Math.max(0, action.count),
      };

    case 'START_LOOP':
      return {
        ...state,
        isActive: true,
        startTime: action.startTime,
        endTime: action.endTime,
        currentIteration: 0,
      };

    case 'STOP_LOOP':
      return {
        ...state,
        isActive: false,
      };

    case 'INCREMENT_ITERATION':
      return {
        ...state,
        currentIteration: state.currentIteration + 1,
      };

    case 'RESET_LOOP':
      return initialLoopState;

    default:
      return state;
  }
}

// Helper functions
function calculateTimeRangeFromLyrics(
  selectedIndices: number[],
  lyricsData: LyricsData | null
): { startTime: number; endTime: number } {
  if (!lyricsData || selectedIndices.length === 0) {
    return { startTime: 0, endTime: 0 };
  }

  const selectedLines = selectedIndices.map(i => lyricsData.lyrics[i]).filter(Boolean);
  
  if (selectedLines.length === 0) {
    return { startTime: 0, endTime: 0 };
  }

  const startTime = Math.min(...selectedLines.map(line => line.startTime));
  const endTime = Math.max(...selectedLines.map(line => line.endTime));

  return { startTime, endTime };
}

function validateTimeRange(
  startTime: number,
  endTime: number,
  duration: number
): { startTime: number; endTime: number } {
  const clampedStart = Math.max(0, Math.min(startTime, duration));
  const clampedEnd = Math.max(clampedStart + 1000, Math.min(endTime, duration)); // Minimum 1 second loop

  return {
    startTime: clampedStart,
    endTime: clampedEnd,
  };
}

// Hook interface
export interface UseLoopStateReturn {
  loopState: LoopState;
  setMode: (mode: 'lyrics' | 'time' | null) => void;
  toggleLyricSelection: (index: number) => void;
  setTimeRange: (startTime: number, endTime: number) => void;
  setRepeatCount: (count: number) => void;
  startLoop: (lyricsData: LyricsData | null, duration: number) => boolean;
  startLoopWithRange: (startTime: number, endTime: number, duration: number) => void;
  stopLoop: () => void;
  incrementIteration: () => void;
  resetLoop: () => void;
  getCalculatedTimeRange: (lyricsData: LyricsData | null) => { startTime: number; endTime: number };
  isLyricSelected: (index: number) => boolean;
  canStartLoop: (lyricsData: LyricsData | null) => boolean;
}

export const useLoopState = (): UseLoopStateReturn => {
  const [loopState, dispatch] = useReducer(loopReducer, initialLoopState);

  const setMode = useCallback((mode: 'lyrics' | 'time' | null) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const toggleLyricSelection = useCallback((index: number) => {
    dispatch({ type: 'TOGGLE_LYRIC_SELECTION', index });
  }, []);

  const setTimeRange = useCallback((startTime: number, endTime: number) => {
    dispatch({ type: 'SET_TIME_RANGE', startTime, endTime });
  }, []);

  const setRepeatCount = useCallback((count: number) => {
    dispatch({ type: 'SET_REPEAT_COUNT', count });
  }, []);

  const startLoop = useCallback((lyricsData: LyricsData | null, duration: number): boolean => {
    let startTime: number, endTime: number;

    if (loopState.mode === 'lyrics') {
      const timeRange = calculateTimeRangeFromLyrics(loopState.selectedLyricIndices, lyricsData);
      if (timeRange.startTime === timeRange.endTime) {
        return false; // No valid selection
      }
      startTime = timeRange.startTime;
      endTime = timeRange.endTime;
    } else if (loopState.mode === 'time') {
      startTime = loopState.startTime;
      endTime = loopState.endTime;
    } else {
      return false; // No mode selected
    }

    const validatedRange = validateTimeRange(startTime, endTime, duration);
    dispatch({ 
      type: 'START_LOOP', 
      startTime: validatedRange.startTime, 
      endTime: validatedRange.endTime 
    });
    
    return true;
  }, [loopState.mode, loopState.selectedLyricIndices, loopState.startTime, loopState.endTime]);

  const stopLoop = useCallback(() => {
    dispatch({ type: 'STOP_LOOP' });
  }, []);

  // Start loop with explicit start/end (bypasses selection/time mode reliance)
  const startLoopWithRange = useCallback((startTime: number, endTime: number, duration: number) => {
    const validated = validateTimeRange(startTime, endTime, duration);
    dispatch({ type: 'START_LOOP', startTime: validated.startTime, endTime: validated.endTime });
  }, []);

  const incrementIteration = useCallback(() => {
    dispatch({ type: 'INCREMENT_ITERATION' });
  }, []);

  const resetLoop = useCallback(() => {
    dispatch({ type: 'RESET_LOOP' });
  }, []);

  const getCalculatedTimeRange = useCallback((lyricsData: LyricsData | null) => {
    if (loopState.mode === 'lyrics') {
      return calculateTimeRangeFromLyrics(loopState.selectedLyricIndices, lyricsData);
    } else if (loopState.mode === 'time') {
      return { startTime: loopState.startTime, endTime: loopState.endTime };
    }
    return { startTime: 0, endTime: 0 };
  }, [loopState.mode, loopState.selectedLyricIndices, loopState.startTime, loopState.endTime]);

  const isLyricSelected = useCallback((index: number): boolean => {
    return loopState.selectedLyricIndices.includes(index);
  }, [loopState.selectedLyricIndices]);

  const canStartLoop = useCallback((lyricsData: LyricsData | null): boolean => {
    if (loopState.mode === 'lyrics') {
      const timeRange = calculateTimeRangeFromLyrics(loopState.selectedLyricIndices, lyricsData);
      return timeRange.startTime < timeRange.endTime;
    } else if (loopState.mode === 'time') {
      return loopState.startTime < loopState.endTime;
    }
    return false;
  }, [loopState.mode, loopState.selectedLyricIndices, loopState.startTime, loopState.endTime]);

  return {
    loopState,
    setMode,
    toggleLyricSelection,
    setTimeRange,
    setRepeatCount,
    startLoop,
    startLoopWithRange,
    stopLoop,
    incrementIteration,
    resetLoop,
    getCalculatedTimeRange,
    isLyricSelected,
    canStartLoop,
  };
};
