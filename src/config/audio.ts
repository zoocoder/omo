/**
 * Audio hosting configuration
 * Change this to your CDN URL when deploying
 */

export const AUDIO_BASE_URL = import.meta.env.VITE_AUDIO_BASE_URL || '';

/**
 * Get the full audio URL for a song
 */
export const getAudioUrl = (songId: string): string => {
  if (AUDIO_BASE_URL) {
    // External hosting (e.g., Cloudflare R2, AWS S3)
    return `${AUDIO_BASE_URL}/${songId}/audio.mp3`;
  } else {
    // Local hosting (development)
    return `/data/songs/${songId}/audio.mp3`;
  }
};

/**
 * Get the full cover image URL for a song
 */
export const getCoverUrl = (songId: string): string => {
  if (AUDIO_BASE_URL) {
    // Try both jpg and png for external hosting
    return `${AUDIO_BASE_URL}/${songId}/cover.jpg`;
  } else {
    // Local hosting (development)
    return `/data/songs/${songId}/cover.jpg`;
  }
};
