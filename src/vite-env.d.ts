/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_AUDIO_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
