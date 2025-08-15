# Omo - Japanese Learning App

A Japanese learning application with synchronized audio and lyrics, featuring interactive chat and loop controls.

## Features

- 🎵 Audio playback with synchronized lyrics
- 📱 Mobile and web responsive design
- 🔄 Loop controls for practice
- 💬 AI-powered Japanese learning chat
- 📚 Grammar explanations
- 🎯 Interactive lyrics selection

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add audio files:
   - Place MP3 files in `public/data/songs/[song-id]/audio.mp3`
   - Audio files are excluded from git due to size

3. Add OpenAI API key (optional, for chat feature):
   ```bash
   # Create .env.local file
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

## Deployment

- The app is configured for Vercel deployment
- Audio files need to be uploaded separately or hosted on a CDN
- Environment variables can be set in Vercel dashboard

## iOS App

This project includes Capacitor configuration for iOS deployment:

```bash
npm run build
npx cap sync ios
```

Then open `ios/App/App.xcworkspace` in Xcode to build for iOS.
