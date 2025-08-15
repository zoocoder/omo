# Japanese Song Learning App - Product Brief

## Project Overview / Description
A mobile app designed to help users learn Japanese through interactive song lyrics. The app allows users to upload Japanese songs with synchronized romaji, Japanese, and English translations displayed side-by-side. Users can control playback through voice commands and ask contextual questions about lyrics, grammar, and meaning. The initial version focuses on one song by Vaundy as a proof of concept.

## Target Audience
Japanese language learners who prefer audio-visual learning methods and want to use music as an engaging way to improve their listening comprehension, vocabulary, and grammar understanding.

## Primary Benefits / Features
- **Synchronized Lyrics Display**: View romaji, Japanese characters, and English translations simultaneously while listening
- **Voice Control**: Issue natural language commands like "go back 10 seconds and repeat 5 times" or "what did the last phrase mean?"
- **Interactive Learning**: Ask specific questions about grammar, conjugations, and word meanings in real-time
- **Audio Highlighting**: Visual highlighting of current lyrics as the song plays (nice-to-have)
- **Easy Content Upload**: Simple interface to upload songs with their translations and timing data

## High-Level Tech/Architecture
- **Mobile Platform**: React Native (supports both iOS and web deployment)
- **Audio Processing**: React Native Track Player for precise audio control and timing
- **Voice Recognition**: Speech-to-text API (iOS Speech Framework or Web Speech API)
- **AI Integration**: OpenAI API for answering contextual questions about lyrics and grammar
- **Data Storage**: Local storage for song files and lyrics data, with potential cloud sync
- **UI Framework**: Styled components with synchronized scrolling and highlighting capabilities


