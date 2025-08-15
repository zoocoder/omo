interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class OpenAIService {
  private static readonly API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
  private static readonly CHAT_URL = 'https://api.openai.com/v1/chat/completions';
  private static readonly SPEECH_TO_TEXT_URL = 'https://api.openai.com/v1/audio/transcriptions';
  private static readonly TEXT_TO_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

  static async explainJapaneseGrammar(
    japanese: string,
    romaji: string,
    english: string
  ): Promise<string>;
  static async explainJapaneseGrammar(
    lines: { japanese: string; romaji: string; english: string }[]
  ): Promise<string>;
  static async explainJapaneseGrammar(
    japaneseOrLines: string | { japanese: string; romaji: string; english: string }[],
    romaji?: string,
    english?: string
  ): Promise<string> {
    try {
      let prompt: string;

      if (Array.isArray(japaneseOrLines)) {
        // Multi-line analysis
        const lyricsText = japaneseOrLines
          .map((line, index) => 
            `Line ${index + 1}:\n  Japanese: ${line.japanese}\n  Romaji: ${line.romaji}\n  English: ${line.english}`
          )
          .join('\n\n');

        prompt = `Explain the grammar of these connected Japanese lyrics to a beginner:

${lyricsText}

Format your response with clear sections:

**Grammar Flow:**
How these lines connect grammatically.

**Key Patterns:**
Important particles, verbs, or constructions.

**Learning Tip:**
One practical tip for understanding this passage.

Keep each section to 1-2 sentences.`;
      } else {
        // Single line analysis
        prompt = `Explain this Japanese lyric to a beginner:

Japanese: ${japaneseOrLines}
Romaji: ${romaji}
English: ${english}

Format your response with clear sections:

**Grammar Pattern:**
Main grammar structure or pattern used.

**Key Elements:**
Important particles, verbs, or vocabulary.

**Learning Tip:**
One practical tip for remembering this.

Keep each section to 1 sentence.`;
      }

      const response = await fetch(this.CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: Array.isArray(japaneseOrLines) ? 300 : 200,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0]?.message?.content || 'No explanation available.';
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get grammar explanation');
    }
  }

  static async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch(this.SPEECH_TO_TEXT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Speech-to-text error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to transcribe audio');
    }
  }

  static async chatWithSongContext(
    question: string,
    song: { title: string; artist: string } | null,
    currentLyric: { japanese: string; romaji: string; english: string } | null
  ): Promise<string> {
    try {
      const songContext = song 
        ? `Current song: "${song.title}" by ${song.artist}` 
        : "No song currently playing";
      
      const lyricContext = currentLyric 
        ? `Current lyric: Japanese: "${currentLyric.japanese}" | Romaji: "${currentLyric.romaji}" | English: "${currentLyric.english}"`
        : "No current lyric";

      const prompt = `You are a helpful assistant for a Japanese music learning app called Omo. Answer questions about Japanese music, lyrics, language, and culture.

Context:
${songContext}
${lyricContext}

User question: ${question}

Provide a helpful, conversational response. If the question is about specific Japanese words or phrases, explain their meaning, pronunciation, and cultural context. Keep responses concise but informative.`;

      const response = await fetch(this.CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0]?.message?.content || 'I apologize, but I cannot answer that question right now.';
    } catch (error) {
      console.error('Error with OpenAI chat:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get AI response');
    }
  }

  static async synthesizeSpeech(text: string): Promise<Blob> {
    try {
      const response = await fetch(this.TEXT_TO_SPEECH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: text,
          speed: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error(`Text-to-speech error: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to synthesize speech');
    }
  }
}
