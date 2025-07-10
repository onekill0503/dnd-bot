import type { ElevenLabsVoiceStyle } from '../types/elevenlabs';

export const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export const ELEVEN_LABS_DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam voice
export const ELEVEN_LABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

export const ELEVEN_LABS_DEFAULT_SETTINGS: Partial<ElevenLabsVoiceStyle> = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.5,
  useSpeakerBoost: true,
};

export const EXPRESSION_VOICE_SETTINGS: Record<
  string,
  Partial<ElevenLabsVoiceStyle>
> = {
  sarcastically: {
    stability: 0.3,
    similarityBoost: 0.7,
    style: 0.8,
  },
  sarcastic: {
    stability: 0.3,
    similarityBoost: 0.7,
    style: 0.8,
  },
  whispers: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.3,
  },
  whisper: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.3,
  },
  whispering: {
    stability: 0.5,
    similarityBoost: 0.6,
    style: 0.3,
  },
  giggles: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  giggle: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  laughing: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.9,
  },
  angrily: {
    stability: 0.1,
    similarityBoost: 0.9,
    style: 0.9,
  },
  angry: {
    stability: 0.1,
    similarityBoost: 0.9,
    style: 0.9,
  },
  sadly: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.2,
  },
  sad: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.2,
  },
  excitedly: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.8,
  },
  excited: {
    stability: 0.2,
    similarityBoost: 0.8,
    style: 0.8,
  },
  fearfully: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.4,
  },
  fearful: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.4,
  },
  scared: {
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.4,
  },
  mysteriously: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.6,
  },
  mysterious: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.6,
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
