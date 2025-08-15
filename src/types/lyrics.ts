export interface LyricLine {
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
  japanese: string;
  romaji: string;
  english: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  duration: number; // total duration in milliseconds
}

export interface LyricsData {
  metadata: SongMetadata;
  lyrics: LyricLine[];
}

export interface Song {
  id: string;
  audioUrl: string;
  lyricsData: LyricsData;
  coverUrl?: string;
}

// Helper type for current line detection
export interface CurrentLine {
  index: number;
  line: LyricLine | null;
  isActive: boolean;
}

// Loop state management
export interface LoopState {
  isActive: boolean;
  mode: 'lyrics' | 'time' | null;
  startTime: number;
  endTime: number;
  selectedLyricIndices: number[];
  repeatCount: number;
  currentIteration: number;
}


