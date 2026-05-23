import { randomUUID } from 'crypto';
import { Agent, type Dispatcher } from 'undici';
import type { AppConfig } from '../config';

type GigaChatConfig = AppConfig['gigachat'];

interface GigaChatTokenResponse {
  access_token?: unknown;
  tok?: unknown;
}

interface GigaChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

export class GigaChatClient {
  private readonly dispatcher: Dispatcher | undefined;

  constructor(private readonly config: GigaChatConfig) {
    this.dispatcher = config.tlsRejectUnauthorized ? undefined : new Agent({
      connect: { rejectUnauthorized: false }
    });
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.accessToken?.trim() ||
      this.config.credentials?.trim() ||
      (this.config.username?.trim() && this.config.password?.trim())
    );
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
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
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
    const accessToken = this.config.accessToken?.trim();
    if (accessToken) {
      return accessToken;
    }

    const credentials = this.getBasicCredentials();
    if (!credentials) {
      throw new Error('GigaChat credentials are not configured');
    }

    const body = new URLSearchParams();
    if (this.config.scope?.trim()) {
      body.set('scope', this.config.scope.trim());
    }

    const response = await fetch(this.config.authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        RqUID: randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`GigaChat auth request failed with status ${response.status}`);
    }

    const payload = await response.json() as GigaChatTokenResponse;
    const parsedAccessToken = typeof payload.access_token === 'string' ? payload.access_token : payload.tok;
    if (typeof parsedAccessToken !== 'string' || !parsedAccessToken.trim()) {
      throw new Error('GigaChat auth response is missing access token');
    }

    return parsedAccessToken;
  }

  private getBasicCredentials(): string | undefined {
    const credentials = this.config.credentials?.trim();
    if (credentials) {
      return credentials;
    }

    const username = this.config.username?.trim();
    const password = this.config.password?.trim();
    if (!username || !password) {
      return undefined;
    }

    return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
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
