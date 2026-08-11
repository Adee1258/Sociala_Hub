/**
 * ai.config.ts
 * Central configuration for all AI features.
 *
 * Using OpenRouter — one API key for all models.
 * Free models available at: https://openrouter.ai/models?q=free
 *
 * Set EXPO_PUBLIC_OPENROUTER_API_KEY in your .env to your OpenRouter key.
 */

export const AI_CONFIG = {
  /** OpenRouter API key */
  apiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',

  /**
   * Primary model — used for all requests.
   * If it gets rate-limited, fallbackModels are tried in order.
   *
   * Free models verified working as of June 2026:
   *   'meta-llama/llama-3.2-3b-instruct:free'      — fast, low rate-limit pressure
   *   'meta-llama/llama-3.3-70b-instruct:free'     — best quality (higher rate-limit risk)
   *   'nousresearch/hermes-3-llama-3.1-405b:free'  — very capable
   *   'openai/gpt-oss-20b:free'                    — OpenAI OSS
   *   'google/gemma-4-31b-it:free'                 — Google free
   *
   * Previously listed models that are now DEAD (404) — do NOT use:
   *   'meta-llama/llama-3.1-8b-instruct:free'
   *   'mistralai/mistral-7b-instruct:free'
   *   'google/gemma-3-27b-it:free'
   *   'deepseek/deepseek-chat:free'
   */
  model: 'meta-llama/llama-3.2-3b-instruct:free',

  /**
   * Fallback models — tried in order if the primary model returns 429 or 404.
   * Having multiple spread across providers reduces rate-limit failures.
   */
  fallbackModels: [
    'meta-llama/llama-3.3-70b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'openai/gpt-oss-20b:free',
  ] as string[],

  /** Per-request token limits */
  maxTokens: {
    profile: 1024,
    chat: 512,
    feed: 768,
  },

  /** Temperature tuning per feature */
  temperature: {
    profile: 0.8,
    chat: 0.5,
    feed: 0.7,
  },
} as const;
