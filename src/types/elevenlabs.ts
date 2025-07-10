export interface ElevenLabsVoiceStyle {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ExpressionSegment {
  text: string;
  expression: string;
  startIndex: number;
  endIndex: number;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  description?: string;
  preview_url?: string;
}

export interface ElevenLabsGenerateSpeechParams {
  text: string;
  voiceId?: string;
  modelId?: string;
  style?: Partial<ElevenLabsVoiceStyle>;
  language?: string;
  sessionId?: string;
}

export interface ElevenLabsSingleSpeechParams {
  text: string;
  voiceId: string;
  modelId: string;
  style: Partial<ElevenLabsVoiceStyle>;
  language: string;
}
