import OpenAI from "openai";
import { botConfig } from "../config/config";

export class TtsAiService {
  private client: OpenAI;
  constructor() {
    this.client = new OpenAI({
      apiKey: botConfig.ttsAi.apiKey,
      baseURL: botConfig.ttsAi.endpoint,
    });
  }

  async chat(messages: any[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: botConfig.ttsAi.model,
      messages,
    });
    return response.choices[0].message.content ?? '';
  }

  async generateSpeech(params: {
    model: string;
    voice: string;
    input: string;
    speed?: number;
  }): Promise<Response> {
    const response = await this.client.audio.speech.create({
      model: params.model,
      voice: params.voice as any,
      input: params.input,
      speed: params.speed,
    });
    return response;
  }
} 