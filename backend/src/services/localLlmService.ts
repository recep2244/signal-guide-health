/**
 * Local LLM Service
 * DeepSeek/Ollama-compatible adapter for structured clinical parsing.
 */

import { env } from '../config/env';
import { logger } from '../utils/logger';

type Triage = 'red' | 'amber' | 'green';

interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface WellbeingInterpretation {
  score: number | null;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'distressed' | 'unknown';
}

interface YesNoInterpretation {
  value: boolean | null;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'distressed' | 'unknown';
}

interface CompletionInterpretation {
  summary: string;
  triageSuggestion: Triage | null;
  riskFlags: string[];
  confidence: number;
}

interface CheckInSummaryInput {
  patientName: string;
  wellbeingScore: number | null;
  symptomsReported: boolean | null;
  medicationsTaken: boolean | null;
  ruleTriage: Triage;
  wearableContext: unknown;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const normalizeSentiment = (
  value: unknown
): 'positive' | 'neutral' | 'negative' | 'distressed' | 'unknown' => {
  if (value === 'positive' || value === 'neutral' || value === 'negative' || value === 'distressed') {
    return value;
  }
  return 'unknown';
};

const normalizeTriage = (value: unknown): Triage | null => {
  if (value === 'red' || value === 'amber' || value === 'green') {
    return value;
  }
  return null;
};

const stripThinking = (value: string): string => {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '```')
    .trim();
};

const extractJsonObject = (value: string): string | null => {
  const cleaned = stripThinking(value);
  if (!cleaned) return null;

  const fencedMatch = cleaned.match(/```([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      return candidate;
    }
  }

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return null;
};

class LocalLlmService {
  isEnabled(): boolean {
    return Boolean(env.LOCAL_LLM_ENABLED && env.LOCAL_LLM_MODEL);
  }

  getRuntimeConfig(): { enabled: boolean; model: string; baseUrl: string } {
    return {
      enabled: this.isEnabled(),
      model: env.LOCAL_LLM_MODEL,
      baseUrl: env.LOCAL_LLM_BASE_URL,
    };
  }

  async interpretWellbeingScore(text: string): Promise<WellbeingInterpretation | null> {
    const payload = await this.chatJson<{
      score?: unknown;
      confidence?: unknown;
      sentiment?: unknown;
    }>([
      {
        role: 'system',
        content:
          'Extract wellbeing score from patient message. Respond with JSON only: {"score": number|null, "confidence": 0..1, "sentiment": "positive|neutral|negative|distressed|unknown"}.',
      },
      {
        role: 'user',
        content: `Message: ${text}`,
      },
    ]);

    if (!payload) return null;

    const rawScore =
      typeof payload.score === 'number' && Number.isFinite(payload.score)
        ? payload.score
        : typeof payload.score === 'string'
          ? Number(payload.score)
          : NaN;
    const score =
      Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 10 ? Math.round(rawScore) : null;

    const confidence =
      typeof payload.confidence === 'number'
        ? clamp01(payload.confidence)
        : typeof payload.confidence === 'string'
          ? clamp01(Number(payload.confidence))
          : 0;

    return {
      score,
      confidence,
      sentiment: normalizeSentiment(payload.sentiment),
    };
  }

  async interpretYesNo(text: string, question: string): Promise<YesNoInterpretation | null> {
    const payload = await this.chatJson<{
      value?: unknown;
      confidence?: unknown;
      sentiment?: unknown;
    }>([
      {
        role: 'system',
        content:
          'Classify patient reply to a yes/no clinical question. Respond with JSON only: {"value": true|false|null, "confidence": 0..1, "sentiment": "positive|neutral|negative|distressed|unknown"}.',
      },
      {
        role: 'user',
        content: `Question: ${question}\nReply: ${text}`,
      },
    ]);

    if (!payload) return null;

    const value =
      typeof payload.value === 'boolean'
        ? payload.value
        : payload.value === 'yes' || payload.value === 'true'
          ? true
          : payload.value === 'no' || payload.value === 'false'
            ? false
            : null;

    const confidence =
      typeof payload.confidence === 'number'
        ? clamp01(payload.confidence)
        : typeof payload.confidence === 'string'
          ? clamp01(Number(payload.confidence))
          : 0;

    return {
      value,
      confidence,
      sentiment: normalizeSentiment(payload.sentiment),
    };
  }

  async summarizeCheckIn(input: CheckInSummaryInput): Promise<CompletionInterpretation | null> {
    const payload = await this.chatJson<{
      summary?: unknown;
      triageSuggestion?: unknown;
      riskFlags?: unknown;
      confidence?: unknown;
    }>([
      {
        role: 'system',
        content:
          'Create concise clinician-facing check-in summary. Keep to 2-4 sentences and be safety-first. Triage guidance: red for severe/urgent risk (e.g. chest pain, syncope, severe dyspnea, very low oxygen), amber for moderate risk, green for stable. Respond with JSON only: {"summary": string, "triageSuggestion": "red|amber|green|null", "riskFlags": string[], "confidence": 0..1}.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ]);

    if (!payload) return null;

    const summary =
      typeof payload.summary === 'string' && payload.summary.trim() !== ''
        ? payload.summary.trim().slice(0, 700)
        : '';

    const riskFlags = Array.isArray(payload.riskFlags)
      ? payload.riskFlags
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 8)
      : [];

    const confidence =
      typeof payload.confidence === 'number'
        ? clamp01(payload.confidence)
        : typeof payload.confidence === 'string'
          ? clamp01(Number(payload.confidence))
          : 0;

    if (!summary) {
      return null;
    }

    return {
      summary,
      triageSuggestion: normalizeTriage(payload.triageSuggestion),
      riskFlags,
      confidence,
    };
  }

  private async requestOpenAiCompatible(args: {
    url: string;
    headers: Record<string, string>;
    messages: LlmChatMessage[];
    signal: AbortSignal;
  }): Promise<string | null> {
    const response = await fetch(args.url, {
      method: 'POST',
      headers: args.headers,
      body: JSON.stringify({
        model: env.LOCAL_LLM_MODEL,
        temperature: 0.1,
        max_tokens: 300,
        messages: args.messages,
      }),
      signal: args.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({
        message: 'Local LLM OpenAI-compatible request failed',
        status: response.status,
        error: errorText.slice(0, 300),
      });
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content : null;
  }

  private async requestOllamaNative(args: {
    url: string;
    headers: Record<string, string>;
    messages: LlmChatMessage[];
    signal: AbortSignal;
  }): Promise<string | null> {
    const response = await fetch(args.url, {
      method: 'POST',
      headers: args.headers,
      body: JSON.stringify({
        model: env.LOCAL_LLM_MODEL,
        messages: args.messages,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 300,
        },
      }),
      signal: args.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({
        message: 'Local LLM Ollama native request failed',
        status: response.status,
        error: errorText.slice(0, 300),
      });
      return null;
    }

    const data = (await response.json()) as {
      message?: {
        content?: string;
      };
      response?: string;
    };

    if (typeof data.message?.content === 'string' && data.message.content.trim()) {
      return data.message.content;
    }

    if (typeof data.response === 'string' && data.response.trim()) {
      return data.response;
    }

    return null;
  }

  private parseJsonContent<T>(content: string): T | null {
    const jsonString = extractJsonObject(content);
    if (!jsonString) {
      logger.warn({
        message: 'Local LLM returned non-JSON content',
        sample: content.slice(0, 250),
      });
      return null;
    }

    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      logger.warn({
        message: 'Local LLM JSON parse failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private async chatJson<T>(messages: LlmChatMessage[]): Promise<T | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.LOCAL_LLM_TIMEOUT_MS);
    const normalizedBase = env.LOCAL_LLM_BASE_URL.replace(/\/$/, '');
    const openAiUrl = normalizedBase.endsWith('/v1')
      ? `${normalizedBase}/chat/completions`
      : `${normalizedBase}/v1/chat/completions`;
    const ollamaBase = normalizedBase.endsWith('/v1')
      ? normalizedBase.slice(0, -3).replace(/\/$/, '')
      : normalizedBase;
    const ollamaUrl = `${ollamaBase}/api/chat`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(env.LOCAL_LLM_API_KEY ? { authorization: `Bearer ${env.LOCAL_LLM_API_KEY}` } : {}),
    };

    try {
      const openAiContent = await this.requestOpenAiCompatible({
        url: openAiUrl,
        headers,
        messages,
        signal: controller.signal,
      });
      if (openAiContent) {
        const parsed = this.parseJsonContent<T>(openAiContent);
        if (parsed) return parsed;
      }

      const ollamaContent = await this.requestOllamaNative({
        url: ollamaUrl,
        headers,
        messages,
        signal: controller.signal,
      });
      if (ollamaContent) {
        return this.parseJsonContent<T>(ollamaContent);
      }

      return null;
    } catch (error) {
      logger.warn({
        message: 'Local LLM request error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const localLlmService = new LocalLlmService();
