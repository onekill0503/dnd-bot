import OpenAI from "openai";
import { botConfig } from "../config/config";

export class DmAiService {
  private client: OpenAI;
  constructor() {
    this.client = new OpenAI({
      apiKey: botConfig.dmAi.apiKey,
      baseURL: botConfig.dmAi.endpoint,
    });
  }

  async chat(messages: any[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: botConfig.dmAi.model,
      messages,
    });
    return response.choices[0].message.content ?? '';
  }
} 