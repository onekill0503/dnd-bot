import type { ElevenLabsVoiceStyle } from '../types/elevenlabs';

export const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export const ELEVEN_LABS_DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam voice
export const ELEVEN_LABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

// Default settings optimized for DM narration (Natural mode - balanced expressiveness)
export const ELEVEN_LABS_DEFAULT_SETTINGS: Partial<ElevenLabsVoiceStyle> = {
  stability: 0.4, // Slightly lower for more emotional range
  similarityBoost: 0.75,
  style: 0.6, // Higher for more dramatic narration
  useSpeakerBoost: true,
};

// Voice settings optimized for ElevenLabs V3 emotional diversity
// Stability: 0.1-0.3 = Creative (expressive), 0.4-0.6 = Natural (balanced), 0.7-1.0 = Robust (consistent)
// Style: Higher = more dramatic/expressive
export const EXPRESSION_VOICE_SETTINGS: Record<
  string,
  Partial<ElevenLabsVoiceStyle>
> = {
  // === LAUGHTER VARIANTS (Creative mode - very expressive) ===
  laughs: {
    stability: 0.15,
    similarityBoost: 0.75,
    style: 0.95,
  },
  giggles: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  chuckles: {
    stability: 0.25,
    similarityBoost: 0.75,
    style: 0.85,
  },
  wheezing: {
    stability: 0.1,
    similarityBoost: 0.7,
    style: 1.0,
  },
  snorts: {
    stability: 0.15,
    similarityBoost: 0.7,
    style: 0.9,
  },

  // === VOCAL TECHNIQUES (Natural mode) ===
  whispers: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.2,
  },
  sighs: {
    stability: 0.45,
    similarityBoost: 0.7,
    style: 0.3,
  },
  exhales: {
    stability: 0.5,
    similarityBoost: 0.65,
    style: 0.25,
  },
  gasps: {
    stability: 0.25,
    similarityBoost: 0.75,
    style: 0.7,
  },
  'clears throat': {
    stability: 0.6,
    similarityBoost: 0.8,
    style: 0.3,
  },

  // === EMOTIONAL STATES (Creative to Natural mode) ===
  sarcastic: {
    stability: 0.3,
    similarityBoost: 0.7,
    style: 0.8,
  },
  excited: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  angry: {
    stability: 0.15,
    similarityBoost: 0.85,
    style: 0.95,
  },
  sad: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.25,
  },
  crying: {
    stability: 0.3,
    similarityBoost: 0.65,
    style: 0.4,
  },
  curious: {
    stability: 0.4,
    similarityBoost: 0.75,
    style: 0.6,
  },
  mischievously: {
    stability: 0.25,
    similarityBoost: 0.75,
    style: 0.85,
  },
  fearful: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.5,
  },
  mysterious: {
    stability: 0.45,
    similarityBoost: 0.7,
    style: 0.55,
  },

  // === ALIASES for backward compatibility ===
  laughing: {
    stability: 0.15,
    similarityBoost: 0.75,
    style: 0.95,
  },
  giggle: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  whisper: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.2,
  },
  whispering: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.2,
  },
  sarcastically: {
    stability: 0.3,
    similarityBoost: 0.7,
    style: 0.8,
  },
  excitedly: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  angrily: {
    stability: 0.15,
    similarityBoost: 0.85,
    style: 0.95,
  },
  sadly: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.25,
  },
  fearfully: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.5,
  },
  scared: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.5,
  },
  mysteriously: {
    stability: 0.45,
    similarityBoost: 0.7,
    style: 0.55,
  },
};

export const LANGUAGE_VOICE_IDS: Record<string, string[]> = {
  en: [
    'pNInz6obpgDQGcFmaJgB', // Adam
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
    'EXAVITQu4vr4xnSDxMaL', // Bella
    'VR6AewLTigWG4xSOukaG', // Arnold
    'yoZ06aMxZJJ28mfd3POQ', // Josh
    'TxGEqnHWrfWFTfGW9XjX', // Elli
    'VR6AewLTigWG4xSOukaG', // Arnold
    'pNInz6obpgDQGcFmaJgB', // Adam
    '21m00Tcm4TlvDq8ikWAM', // Rachel
  ],
  id: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for Indonesian)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  fr: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for French)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  es: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for Spanish)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  de: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for German)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  ja: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for Japanese)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  ko: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for Korean)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
  zh: [
    'pNInz6obpgDQGcFmaJgB', // Adam (English voice for Chinese)
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
  ],
};

export const LANGUAGE_ISO_CODES: Record<string, string> = {
  en: 'en',
  id: 'id',
  fr: 'fr',
  es: 'es',
  de: 'de',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh',
};
