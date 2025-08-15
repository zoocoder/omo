import { LyricsData, Song } from '../types/lyrics';

export class LyricsParser {
  /**
   * Parse lyrics JSON data and validate structure
   */
  static parseJSON(jsonData: any): LyricsData {
    if (!jsonData.metadata || !jsonData.lyrics) {
      throw new Error('Invalid lyrics data: missing metadata or lyrics');
    }

    const { metadata, lyrics } = jsonData;

    // Validate metadata
    if (!metadata.title || !metadata.artist || typeof metadata.duration !== 'number') {
      throw new Error('Invalid metadata: missing title, artist, or duration');
    }

    // Validate and sort lyrics by startTime
    const validatedLyrics = lyrics.map((line: any, index: number) => {
      if (
        typeof line.startTime !== 'number' ||
        typeof line.endTime !== 'number' ||
        typeof line.japanese !== 'string' ||
        typeof line.romaji !== 'string' ||
        typeof line.english !== 'string'
      ) {
        throw new Error(`Invalid lyric line at index ${index}: missing required fields`);
      }

      if (line.startTime >= line.endTime) {
        throw new Error(`Invalid lyric line at index ${index}: startTime must be less than endTime`);
      }

      return {
        startTime: line.startTime,
        endTime: line.endTime,
        japanese: line.japanese,
        romaji: line.romaji,
        english: line.english,
      };
    });

    // Sort lyrics by startTime
    validatedLyrics.sort((a: any, b: any) => a.startTime - b.startTime);

    return {
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
      },
      lyrics: validatedLyrics,
    };
  }

  /**
   * Load lyrics data from a file path
   */
  static async loadFromFile(filePath: string): Promise<LyricsData> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load lyrics file: ${response.statusText}`);
      }
      const jsonData = await response.json();
      return this.parseJSON(jsonData);
    } catch (error) {
      throw new Error(`Error loading lyrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a complete Song object with lyrics and audio URL
   */
  static async loadSong(songId: string): Promise<Song> {
    const lyricsPath = `/data/songs/${songId}/lyrics.json`;
    const audioPath = `/data/songs/${songId}/audio.mp3`;
    const coverJpg = `/data/songs/${songId}/cover.jpg`;
    
    const lyricsData = await this.loadFromFile(lyricsPath);
    
    // Default to JPG; component will auto-fallback to PNG on load error
    const coverUrl: string | undefined = coverJpg;

    return {
      id: songId,
      audioUrl: audioPath,
      lyricsData,
      // @ts-ignore - extend Song shape at runtime with coverUrl
      coverUrl,
    };
  }

  /**
   * Binary search to find the current active lyric line
   */
  static findCurrentLineIndex(lyrics: LyricsData['lyrics'], currentTime: number): number {
    if (lyrics.length === 0) return -1;
    
    let left = 0;
    let right = lyrics.length - 1;
    let result = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const line = lyrics[mid];
      
      if (currentTime >= line.startTime && currentTime < line.endTime) {
        return mid; // Found exact match
      } else if (currentTime >= line.startTime) {
        result = mid; // Potential candidate
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // Check if we're still within the end time of the result line
    if (result >= 0 && currentTime >= lyrics[result].startTime && currentTime < lyrics[result].endTime) {
      return result;
    }
    
    return -1; // No active line found
  }
}
