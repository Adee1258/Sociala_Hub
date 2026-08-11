/**
 * ai.types.ts
 * Shared TypeScript types used across all AI feature modules.
 */

// ── Core message shape (mirrors Claude's message format) ──────────────────────
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Detected intent from user input ──────────────────────────────────────────
export type Intent =
  | 'bio_suggest'
  | 'bio_seo'
  | 'profile_audit'
  | 'hashtags'
  | 'post_ideas'
  | 'theme'
  | 'direct_edit'
  | 'option_select'
  | 'smart_reply'
  | 'translate'
  | 'caption'
  | 'moderate'
  | 'general'
  | 'help'
  | 'regenerate'
  | 'error';

export interface IntentResult {
  intent: 'bio_generate' | 'bio_edit' | 'profile_audit' | 'hashtags' |
  'post_ideas' | 'seo_bio' | 'theme_change' | 'direct_edit' |
  'option_select' | 'regenerate' | 'general';
  topic: string | null;
  profession: string | null;
  /** Format/style instruction from the user e.g. "single line only", "write a sher", "5 options" */
  userInstruction: string | null;
  editField: 'bio' | 'name' | 'username' | 'website' | 'location' | null;
  editValue: string | null;
  selectedOption: 'a' | 'b' | 'c' | null;
  themeId: string | null;
  isRegenerate: boolean;
  language: 'en' | 'ur';
}

export interface VexoraMessage {
  sender: 'user' | 'ai';
  text: string;
  actionId?: string | null;
  timestamp?: number;
}

// ── Standard AI response envelope ────────────────────────────────────────────
export interface AIResponse {
  success: boolean;
  text: string;
  /** Optional structured payload for specific intents */
  data?: Record<string, unknown>;
  /** Which intent was matched/handled */
  intent?: string;
  error?: string;
}

// ── Profile-specific types ────────────────────────────────────────────────────
export interface BioOptions {
  a: string;
  b: string;
  c: string;
}

export interface ProfileAuditResult {
  score: number;
  items: { label: string; passed: boolean; suggestion?: string }[];
  summary: string;
}

export interface HashtagResult {
  highVolume: string[];
  niche: string[];
  trending: string[];
  formatted: string;
}

// ── User context passed to AI calls ──────────────────────────────────────────
export interface UserProfileContext {
  _id?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  address?: string;
  website?: string;
  profilePicture?: string;
  profileCover?: string;
  level?: number;
  streakCount?: number;
  emailVerified?: boolean;
}

// ── Chat-specific types ───────────────────────────────────────────────────────
export interface SmartReplyOptions {
  replies: string[];
  tone: 'friendly' | 'professional' | 'casual' | 'supportive';
}

export interface TranslationResult {
  original: string;
  translated: string;
  detectedLanguage: string;
  targetLanguage: string;
}

// ── Feed-specific types ───────────────────────────────────────────────────────
export interface CaptionResult {
  captions: string[];
  hashtags: string[];
}

export interface ModerationResult {
  safe: boolean;
  flags: string[];
  reason?: string;
}
