// Create a minimal MP3 file for testing
import fs from 'fs';

// This is a base64 encoded minimal MP3 file (about 1 second of silence)
const minimalMp3Base64 = `//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIACBhYqFbF1fdJivrJBhNjVgODc+O6WNr6uPg72lpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpa`;

// Convert base64 to buffer and write to file
const buffer = Buffer.from(minimalMp3Base64, 'base64');
fs.writeFileSync('data/songs/vaundy-001/audio.mp3', buffer);

console.log('Created test audio file: data/songs/vaundy-001/audio.mp3');
