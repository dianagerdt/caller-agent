import { randomUUID } from 'crypto';
import type { AppConfig } from '../config';

type GigaChatConfig = AppConfig['gigachat'];

interface GigaChatTokenResponse {
  access_token?: unknown;
}

interface GigaChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

export class GigaChatClient {
  constructor(private readonly config: GigaChatConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.credentials?.trim());
  }

  async completeJson(prompt: string): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new Error('GigaChat credentials are not configured');
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`GigaChat completion request failed with status ${response.status}`);
    }

    const payload = await response.json() as GigaChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('GigaChat completion response is missing message content');
    }

    return parseJsonContent(content);
  }

  private async getAccessToken(): Promise<string> {
    const credentials = this.config.credentials?.trim();
    if (!credentials) {
      throw new Error('GigaChat credentials are not configured');
    }

    const response = await fetch(this.config.authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        RqUID: randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ scope: this.config.scope }).toString()
    });

    if (!response.ok) {
      throw new Error(`GigaChat auth request failed with status ${response.status}`);
    }

    const payload = await response.json() as GigaChatTokenResponse;
    if (typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
      throw new Error('GigaChat auth response is missing access token');
    }

    return payload.access_token;
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`GigaChat completion content is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
