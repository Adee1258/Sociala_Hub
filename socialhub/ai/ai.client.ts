/**
 * ai.client.ts
 * Talks to OpenRouter API — drop-in replacement for Anthropic SDK.
 * OpenRouter gives access to Claude, Gemini, Llama, and more via one key.
 *
 * Set EXPO_PUBLIC_OPENROUTER_API_KEY in your .env to your OpenRouter key.
 * Get free key at: https://openrouter.ai/keys
 */

import { AI_CONFIG } from './ai.config';
import type { AIMessage, AIResponse } from './ai.types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Core API call with model fallback support.
 *
 * @param systemPrompt  - Instructions that shape the AI persona / task
 * @param messages      - Conversation history (role + content)
 * @param maxTokens     - Upper token limit for this request
 * @param temperature   - 0–1 creativity level
 * @param modelOverride - Optional model to use instead of the default
 */
export async function callClaude(
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number = AI_CONFIG.maxTokens.profile,
  temperature: number = AI_CONFIG.temperature.profile,
  modelOverride?: string
): Promise<AIResponse> {
  const apiKey = AI_CONFIG.apiKey;

  if (!apiKey) {
    console.error('[AI Client] EXPO_PUBLIC_OPENROUTER_API_KEY is not set.');
    return {
      success: false,
      text: '',
      error: 'API key not set. Add EXPO_PUBLIC_OPENROUTER_API_KEY to your .env file.',
    };
  }

  const model = modelOverride ?? AI_CONFIG.model;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://socialhub.app',
        'X-Title': 'SocialHub Vexora AI',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[AI Client] OpenRouter error:', response.status, errBody);

      // Parse retry-after from error body if 429
      let retryAfter: number | undefined;
      if (response.status === 429) {
        try {
          const parsed = JSON.parse(errBody);
          retryAfter = parsed?.error?.metadata?.retry_after_seconds;
        } catch { /* ignore */ }
      }

      return {
        success: false,
        text: '',
        error: 'API error ' + response.status + ': ' + errBody,
        data: {
          statusCode: response.status,
          retryAfter,
        },
      };
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!text) {
      return { success: false, text: '', error: 'Empty response from API' };
    }

    return { success: true, text };

  } catch (err: any) {
    console.error('[AI Client] Network error:', err?.message ?? err);
    return {
      success: false,
      text: '',
      error: err?.message ?? 'Network error',
    };
  }
}
