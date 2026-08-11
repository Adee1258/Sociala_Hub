/**
 * profile.vexora.ts — Hybrid Architecture
 *
 * LOCAL (no API call):
 *   option_select, theme_change, direct_edit, regenerate-trigger,
 *   help, confirm/cancel, simple greetings, gathering questions
 *
 * CLOUD API (Claude):
 *   bio_generate, profile_audit, hashtags, post_ideas, seo_bio,
 *   regenerate (actual generation), general chat
 *
 * Savings: ~60% of messages handled locally = ~60% less API cost
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { callClaude } from './ai.client';
import { AI_CONFIG } from './ai.config';
import {
  buildVexoraSystemPrompt,
  buildBioPrompt,
  buildAuditPrompt,
  buildHashtagPrompt,
  buildPostIdeasPrompt,
  buildSEOBioPrompt,
} from './profile.prompts';
import type {
  AIMessage,
  AIResponse,
  BioOptions,
  ProfileAuditResult,
  HashtagResult,
  UserProfileContext,
} from './ai.types';

// ── Return type ──────────────────────────────────────────────────────────────
export interface VexoraResponse extends AIResponse {
  intent: string;
  pendingEdit?: { field: string; value: string };
  themeId?: string;
  bioOptions?: BioOptions;
  audit?: ProfileAuditResult;
  hashtags?: HashtagResult;
  isGathering?: boolean;
}

// ── Local intent detection result ────────────────────────────────────────────
interface LocalIntent {
  type:
  | 'option_select'
  | 'regenerate'
  | 'theme_change'
  | 'direct_edit'
  | 'confirm'
  | 'cancel'
  | 'help'
  | 'greeting'
  | 'bio_generate'
  | 'hashtags'
  | 'post_ideas'
  | 'profile_audit'
  | 'seo_bio'
  | 'general'
  | 'unknown';
  option?: 'a' | 'b' | 'c';
  themeId?: string;
  editField?: string;
  editValue?: string;
  profession?: string;
  topic?: string;
  userInstruction?: string;
  language: 'en' | 'ur';
}

// ── Gathering state ──────────────────────────────────────────────────────────
type GatheringState =
  | { active: false }
  | {
    active: true;
    intent: 'bio_generate' | 'hashtags' | 'post_ideas';
    collectedInfo: {
      profession?: string;
      tone?: string;
      topic?: string;
    };
    lastQuestion: 'profession' | 'tone';
  };

export class VexoraAI {
  private conversationHistory: AIMessage[] = [];
  private user: UserProfileContext;
  private lastBioOptions: BioOptions | null = null;
  private lastDetectedProfession: string | null = null;
  private gatheringState: GatheringState = { active: false };

  private readonly HISTORY_KEY: string;
  private readonly PROFESSION_KEY: string;
  private readonly MAX_HISTORY = 20;

  constructor(user: UserProfileContext) {
    this.user = user;
    this.HISTORY_KEY = 'vexora_history_' + (user._id || 'guest');
    this.PROFESSION_KEY = 'vexora_profession_' + (user._id || 'guest');
  }

  updateUser(user: UserProfileContext) {
    this.user = user;
  }

  // ── History ───────────────────────────────────────────────────────────────

  async loadHistory(): Promise<void> {
    try {
      const [h, p] = await Promise.all([
        AsyncStorage.getItem(this.HISTORY_KEY),
        AsyncStorage.getItem(this.PROFESSION_KEY),
      ]);
      if (h) this.conversationHistory = JSON.parse(h);
      if (p) this.lastDetectedProfession = p;
    } catch {
      this.conversationHistory = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      const trimmed = this.conversationHistory.slice(-this.MAX_HISTORY);
      this.conversationHistory = trimmed;
      const ops: Promise<void>[] = [
        AsyncStorage.setItem(this.HISTORY_KEY, JSON.stringify(trimmed)),
      ];
      if (this.lastDetectedProfession) {
        ops.push(AsyncStorage.setItem(this.PROFESSION_KEY, this.lastDetectedProfession));
      }
      await Promise.all(ops);
    } catch { }
  }

  async clearHistory(): Promise<void> {
    this.conversationHistory = [];
    this.lastBioOptions = null;
    this.lastDetectedProfession = null;
    this.gatheringState = { active: false };
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.HISTORY_KEY),
        AsyncStorage.removeItem(this.PROFESSION_KEY),
      ]);
    } catch { }
  }

  // ── Smart retry wrapper with model fallback ──────────────────────────────
  //
  // Strategy:
  //  1. Try primary model (AI_CONFIG.model)
  //  2. On 429 → do NOT retry the same model immediately (that makes it worse)
  //     Instead, move to the next fallback model right away
  //  3. On 404 (model removed) → skip to next fallback immediately
  //  4. On other errors (network, 5xx) → wait briefly and retry same model once
  //  5. If ALL models exhausted → return friendly error

  private async _callWithRetry(
    system: string,
    messages: AIMessage[],
    maxTokens: number,
    temperature: number,
  ): Promise<AIResponse> {
    const allModels = [AI_CONFIG.model, ...AI_CONFIG.fallbackModels];
    let lastError = 'API unavailable';

    for (const model of allModels) {
      const res = await callClaude(system, messages, maxTokens, temperature, model);

      // Success
      if (res.success && res.text.trim()) return res;

      const statusCode = (res.data as any)?.statusCode as number | undefined;

      // 429 rate limit — skip this model, try next immediately
      if (statusCode === 429) {
        console.warn(`[Vexora] Model ${model} rate-limited, trying next fallback...`);
        lastError = 'rate_limited';
        continue;
      }

      // 404 model not found — skip this model, try next
      if (statusCode === 404) {
        console.warn(`[Vexora] Model ${model} not found (404), trying next fallback...`);
        lastError = 'model_not_found';
        continue;
      }

      // Network / 5xx — wait a moment, then try next model
      await new Promise(r => setTimeout(r, 1000));
      lastError = res.error ?? 'unknown error';
    }

    console.error('[Vexora] All models exhausted. Last error:', lastError);
    return { success: false, text: '', error: lastError };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ════════════════════════════════════════════════════════════════════════════

  async processMessage(userMessage: string): Promise<VexoraResponse> {
    // Add to history
    this.conversationHistory.push({ role: 'user', content: userMessage });
    await this.saveHistory();

    // If mid-gathering — continue local flow (no API)
    if (this.gatheringState.active) {
      return this._continueGathering(userMessage);
    }

    // ── STEP 1: Try local intent detection first (no API) ─────────────────
    const local = this._detectIntentLocally(userMessage);

    // ── STEP 2: Handle locally if possible ───────────────────────────────
    switch (local.type) {
      case 'option_select':
        return this._localOptionSelect(local.option!, local.language);

      case 'confirm':
        return this._localConfirm(local.language);

      case 'cancel':
        return this._localCancel(local.language);

      case 'theme_change':
        return this._localThemeChange(local.themeId!, local.language);

      case 'direct_edit':
        return this._localDirectEdit(local.editField!, local.editValue!, local.language);

      case 'help':
        return this._localHelp(local.language);

      case 'greeting':
        return this._localGreeting(local.language);

      case 'regenerate':
        // Actual generation needs API
        return this._cloudRegenerate(local.language);

      case 'bio_generate':
        return this._startBioGathering(local);

      case 'hashtags':
        return this._startHashtagGathering(local);

      case 'post_ideas':
        return this._startPostIdeasGathering(local);

      case 'profile_audit':
        return this._cloudAudit(local.language);

      case 'seo_bio':
        return this._cloudSEOBio(local.language);

      case 'general':
      default:
        return this._cloudChat(userMessage, local.language);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOCAL INTENT DETECTION — pure regex/rules, zero API cost
  // ════════════════════════════════════════════════════════════════════════════

  private _detectIntentLocally(msg: string): LocalIntent {
    const text = msg.trim().toLowerCase();
    const lang = this._detectLanguage(msg);

    // ── Option select: A / B / C ─────────────────────────────────────────
    if (/^["\s]*a["\s]*$|^option\s*a$|^a\s*select|^a\s*chahiye|^pehla|^first one$/i.test(text)) {
      return { type: 'option_select', option: 'a', language: lang };
    }
    if (/^["\s]*b["\s]*$|^option\s*b$|^b\s*select|^doosra|^second one$/i.test(text)) {
      return { type: 'option_select', option: 'b', language: lang };
    }
    if (/^["\s]*c["\s]*$|^option\s*c$|^c\s*select|^teesra|^third one$/i.test(text)) {
      return { type: 'option_select', option: 'c', language: lang };
    }

    // ── Confirm / Cancel ─────────────────────────────────────────────────
    if (/^(yes|haan|ha|apply|save|kr do|kar do|theek hai|ok|okay|confirm|bilkul|zaroor|yes apply|apply it)$/i.test(text)) {
      return { type: 'confirm', language: lang };
    }
    if (/^(no|nahi|nai|cancel|mat karo|rehne do|band karo|nope|nah)$/i.test(text)) {
      return { type: 'cancel', language: lang };
    }

    // ── Regenerate ───────────────────────────────────────────────────────
    if (/ye nhi|yeh nhi|koi aur|different|not these|dobara|again|change karo|naye do|alag do|aur do|different ones|try again|give me more/i.test(text)) {
      return { type: 'regenerate', language: lang };
    }

    // ── Theme change ─────────────────────────────────────────────────────
    const themeMatch = text.match(/\b(cyberpunk|sunset|ocean|forest|default|violet)\b/);
    if (themeMatch || /theme|colour|color|gradient/i.test(text)) {
      const themeId = themeMatch ? themeMatch[1] : 'default';
      return { type: 'theme_change', themeId, language: lang };
    }

    // ── Direct edit with value ────────────────────────────────────────────
    // "bio: I love coding" or "naam: Ali Hassan" or "location: Karachi"
    const bioEdit = msg.match(/^bio\s*[:=]\s*(.+)$/i);
    if (bioEdit) return { type: 'direct_edit', editField: 'bio', editValue: bioEdit[1].trim(), language: lang };

    const nameEdit = msg.match(/^(name|naam)\s*[:=]\s*(.+)$/i);
    if (nameEdit) return { type: 'direct_edit', editField: 'name', editValue: nameEdit[2].trim(), language: lang };

    const usernameEdit = msg.match(/^(username|handle)\s*[:=]\s*(.+)$/i);
    if (usernameEdit) return { type: 'direct_edit', editField: 'username', editValue: usernameEdit[2].trim(), language: lang };

    const locationEdit = msg.match(/^(location|city|address|jagah)\s*[:=]\s*(.+)$/i);
    if (locationEdit) return { type: 'direct_edit', editField: 'location', editValue: locationEdit[2].trim(), language: lang };

    const websiteEdit = msg.match(/^(website|link|url)\s*[:=]\s*(.+)$/i);
    if (websiteEdit) return { type: 'direct_edit', editField: 'website', editValue: websiteEdit[2].trim(), language: lang };

    // ── Help ─────────────────────────────────────────────────────────────
    if (/^(help|madad|kya kar sakte|kya kr skte|what can you|features|menu)$/i.test(text)) {
      return { type: 'help', language: lang };
    }

    // ── Greeting ─────────────────────────────────────────────────────────
    if (/^(hi|hello|hey|salam|assalam|helo|hii|heyyy|yo|sup)[\s!]*$/i.test(text)) {
      return { type: 'greeting', language: lang };
    }

    // ── Bio generate ─────────────────────────────────────────────────────
    if (/bio\s*(do|bana|likho|chahiye|generate|suggest|write|create|bnao|banao)|suggest.*bio|write.*bio|create.*bio|mera bio|my bio|new bio/i.test(text)) {
      // Check if profession is mentioned in same message
      const profession = this._extractProfession(msg);
      const userInstruction = this._extractFormatInstruction(msg);
      return { type: 'bio_generate', profession, userInstruction, language: lang };
    }

    // ── Hashtags ─────────────────────────────────────────────────────────
    if (/hashtag|#\s*tag|tags\s*do|tags\s*chahiye|hash tag/i.test(text)) {
      const profession = this._extractProfession(msg) ?? this.lastDetectedProfession ?? undefined;
      return { type: 'hashtags', profession, language: lang };
    }

    // ── Post ideas ───────────────────────────────────────────────────────
    if (/post\s*idea|content\s*idea|post\s*banao|kya\s*post|what to post|ideas do|ideas chahiye/i.test(text)) {
      const topic = this._extractProfession(msg) ?? this.lastDetectedProfession ?? undefined;
      return { type: 'post_ideas', topic, language: lang };
    }

    // ── Profile audit ─────────────────────────────────────────────────────
    if (/audit|profile\s*check|score|review\s*my|improve\s*my|profile\s*score/i.test(text)) {
      return { type: 'profile_audit', language: lang };
    }

    // ── SEO bio ──────────────────────────────────────────────────────────
    if (/seo|optimize|searchable|discoverable|seo\s*bio/i.test(text)) {
      return { type: 'seo_bio', language: lang };
    }

    // ── Profession mention (user introducing themselves) ──────────────────
    const profession = this._extractProfession(msg);
    if (profession) {
      this.lastDetectedProfession = profession;
      AsyncStorage.setItem(this.PROFESSION_KEY, profession).catch(() => { });
      return { type: 'bio_generate', profession, language: lang };
    }

    return { type: 'general', language: lang };
  }

  // ── Extract profession from message ──────────────────────────────────────

  private _extractProfession(msg: string): string | undefined {
    const text = msg.toLowerCase();

    // "main X hun" / "I am a X" / "I'm a X"
    const urduMatch = msg.match(/main\s+([a-zA-Z\u0600-\u06FF\s]{2,25})\s+(hun|hoon|hu)/i);
    if (urduMatch) return urduMatch[1].trim();

    const engMatch = msg.match(/i(?:'m|\s+am)\s+a(?:n)?\s+([a-zA-Z\s]{2,25})/i);
    if (engMatch) return engMatch[1].trim();

    // "doctor hun" / "teacher hun"
    const professions = [
      'doctor', 'engineer', 'teacher', 'student', 'vlogger', 'blogger', 'photographer',
      'designer', 'developer', 'programmer', 'artist', 'musician', 'chef', 'cook',
      'lawyer', 'advocate', 'nurse', 'pharmacist', 'dentist', 'architect', 'writer',
      'journalist', 'actor', 'model', 'influencer', 'coach', 'trainer', 'qawwal',
      'shair', 'poet', 'gamer', 'streamer', 'freelancer', 'entrepreneur', 'business',
      'trader', 'investor', 'scientist', 'researcher', 'professor', 'lecturer',
      'rickshaw', 'driver', 'shopkeeper', 'farmer', 'sportsman', 'cricketer',
      'footballer', 'boxer', 'swimmer', 'dancer', 'tailor', 'hairdresser', 'barber',
    ];
    for (const p of professions) {
      if (text.includes(p)) return p;
    }

    return undefined;
  }

  // ── Extract format instruction ────────────────────────────────────────────

  private _extractFormatInstruction(msg: string): string | undefined {
    const text = msg.toLowerCase();

    if (/single\s*line|ek\s*line|1\s*line/.test(text)) return 'single line only';
    if (/funny|mazedaar|comedy/.test(text)) return 'funny tone';
    if (/serious|professional|formal/.test(text)) return 'formal, no emojis';
    if (/poetic|sher|poetry|couplet/.test(text)) return 'write a sher/couplet style';
    if (/simple|seedha|plain/.test(text)) return 'simple, plain, no emojis';
    if (/emoji/.test(text)) return 'use lots of emojis';
    if (/urdu\s*script|اردو/.test(text)) return 'write in Urdu script';
    const wordMatch = msg.match(/(\d+)\s*words?/i);
    if (wordMatch) return `maximum ${wordMatch[1]} words`;
    const optionMatch = msg.match(/(\d+)\s*options?/i);
    if (optionMatch) return `give ${optionMatch[1]} options`;

    return undefined;
  }

  // ── Language detection ────────────────────────────────────────────────────

  private _detectLanguage(text: string): 'en' | 'ur' {
    const urdu = /\b(hun|hu|karo|do|mera|meri|yaar|nahi|hai|hain|tha|thi|ka|ki|ke|ko|se|mein|aur|ya|kya|kuch|jo|ye|yeh|wo|woh|ab|phir|dobara|theek|acha|bilkul|zaroor|chahiye|likho|bana|banao)\b/i;
    return urdu.test(text) ? 'ur' : 'en';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOCAL HANDLERS — zero API cost
  // ════════════════════════════════════════════════════════════════════════════

  private async _localOptionSelect(option: 'a' | 'b' | 'c', lang: string): Promise<VexoraResponse> {
    if (!this.lastBioOptions?.[option]) {
      const msg = lang === 'ur'
        ? 'Pichle options expire ho gaye 😅 Dobara generate karun? **"bio do"** likho.'
        : 'Previous options expired 😅 Want me to generate new ones? Type **"bio do"**.';
      this._pushAssistant(msg);
      await this.saveHistory();
      return { success: true, text: msg, intent: 'option_select' };
    }

    const selected = this.lastBioOptions[option];
    const label = option.toUpperCase();
    const msg = lang === 'ur'
      ? `**Option ${label}** choose kiya! ✅\n\n"${selected}"\n\nIs bio ko profile pe save karun?`
      : `**Option ${label}** selected! ✅\n\n"${selected}"\n\nShall I save this to your profile?`;

    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'option_select', pendingEdit: { field: 'bio', value: selected } };
  }

  private async _localConfirm(lang: string): Promise<VexoraResponse> {
    // This is just an acknowledgment — actual saving happens in handleAiAction in profile.tsx
    // If there's no pending context, guide user
    const msg = lang === 'ur'
      ? '✅ Theek hai! Apply kar raha hun...'
      : '✅ Got it! Applying now...';
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'confirm' };
  }

  private async _localCancel(lang: string): Promise<VexoraResponse> {
    const msg = lang === 'ur'
      ? 'Theek hai, koi changes nahi kiye 😊\n\nAur kuch chahiye toh batao!'
      : "No problem, nothing was changed 😊\n\nLet me know if you need anything else!";
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'cancel' };
  }

  private async _localThemeChange(themeId: string, lang: string): Promise<VexoraResponse> {
    const msg = lang === 'ur'
      ? `**${themeId}** theme apply karun? Aapki profile ka color change ho jayega.`
      : `Apply **${themeId}** theme? Your profile gradient will be updated.`;
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'theme_change', themeId };
  }

  private async _localDirectEdit(field: string, value: string, lang: string): Promise<VexoraResponse> {
    const labels: Record<string, string> = {
      bio: 'Bio', name: 'Name', username: 'Username', website: 'Website', location: 'Location',
    };
    const fieldName = labels[field] || field;
    const msg = lang === 'ur'
      ? `**${fieldName}** yeh update karun?\n\n"${value}"\n\nConfirm?`
      : `Update your **${fieldName}** to:\n\n"${value}"\n\nConfirm?`;
    this._pushAssistant(msg);
    await this.saveHistory();
    return {
      success: true, text: msg, intent: 'direct_edit',
      pendingEdit: { field: field === 'location' ? 'address' : field, value },
    };
  }

  private async _localHelp(lang: string): Promise<VexoraResponse> {
    const msg = lang === 'ur'
      ? `Yeh hai jo main kar sakta hun:\n\n• **Bio** → "bio do" ya "funny bio chahiye"\n• **Audit** → "profile check karo"\n• **Hashtags** → "hashtags do"\n• **Post Ideas** → "post ideas do"\n• **SEO Bio** → "seo bio"\n• **Theme** → "cyberpunk theme lagao"\n• **Edit** → "bio: [apna bio likho]"\n• **Name** → "naam: Ali Hassan"\n• **Location** → "location: Karachi"\n\nKya karna hai? 😊`
      : `Here's what I can do:\n\n• **Bio** → "generate bio" or "funny bio please"\n• **Audit** → "audit my profile"\n• **Hashtags** → "give me hashtags"\n• **Post Ideas** → "post ideas"\n• **SEO Bio** → "seo bio"\n• **Theme** → "apply cyberpunk theme"\n• **Edit** → "bio: [your bio text]"\n• **Name** → "name: John Doe"\n• **Location** → "location: Karachi"\n\nWhat would you like? 😊`;
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'help' };
  }

  private async _localGreeting(lang: string): Promise<VexoraResponse> {
    const name = this.user.firstName || (lang === 'ur' ? 'aap' : 'there');
    const msg = lang === 'ur'
      ? `Salam ${name}! 👋 Main Vexora hun — aapka AI Profile Assistant.\n\nKya karna hai aaj? Bio, hashtags, audit, ya kuch aur?`
      : `Hey ${name}! 👋 I'm Vexora — your AI Profile Assistant.\n\nWhat can I help you with today? Bio, hashtags, audit, or something else?`;
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'greeting' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GATHERING FLOW — local questions, cloud generation at the end
  // ════════════════════════════════════════════════════════════════════════════

  private async _startBioGathering(local: LocalIntent): Promise<VexoraResponse> {
    const profession = local.profession ?? this.lastDetectedProfession;
    const lang = local.language;

    // If profession AND instruction both known — go straight to cloud
    if (profession && local.userInstruction) {
      return this._cloudGenerateBio(profession, lang, local.userInstruction);
    }

    // If profession known but no tone — ask tone (local)
    if (profession && !local.userInstruction) {
      this.gatheringState = {
        active: true, intent: 'bio_generate',
        collectedInfo: { profession }, lastQuestion: 'tone',
      };
      const msg = lang === 'ur'
        ? `**${profession}** — perfect! 🎯\n\nBio ka style kaisa chahiye?\n\n• **Professional** — formal, clean\n• **Funny** — mazedaar 😄\n• **Poetic** — sher/adabi andaaz ✍️\n• **Bold** — motivational 💪\n• **Simple** — seedha saadha\n\nYa apni marzi mein describe karo.`
        : `**${profession}** — nice! 🎯\n\nWhat style should your bio have?\n\n• **Professional** — clean, formal\n• **Funny** — witty & entertaining 😄\n• **Poetic** — lyrical or couplet ✍️\n• **Bold** — ambitious & motivational 💪\n• **Simple** — plain and clear\n\nOr describe your own.`;
      this._pushAssistant(msg);
      await this.saveHistory();
      return { success: true, text: msg, intent: 'bio_generate', isGathering: true };
    }

    // No profession — ask profession (local)
    this.gatheringState = {
      active: true, intent: 'bio_generate',
      collectedInfo: {}, lastQuestion: 'profession',
    };
    const msg = lang === 'ur'
      ? 'Bio banane se pehle batao 😊\n\n**Aap kya karte hain?** Profession, job, ya kaam — kuch bhi batao.\n\n_Jaise: doctor, vlogger, shair, teacher, gamer, rickshaw driver..._'
      : "Let me understand you first 😊\n\n**What do you do?** Your profession, job, or what you're known for.\n\n_e.g. doctor, travel vlogger, poet, teacher, gamer, chef..._";
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'bio_generate', isGathering: true };
  }

  private async _startHashtagGathering(local: LocalIntent): Promise<VexoraResponse> {
    const profession = local.profession ?? this.lastDetectedProfession;
    const lang = local.language;

    // Already know profession — go to cloud
    if (profession) return this._cloudGenerateHashtags(profession, lang);

    // Ask profession (local)
    this.gatheringState = {
      active: true, intent: 'hashtags',
      collectedInfo: {}, lastQuestion: 'profession',
    };
    const msg = lang === 'ur'
      ? 'Hashtags ke liye batao — **aapka niche ya profession kya hai?**\n\n_Jaise: photography, cooking, tech, fashion, travel..._'
      : 'For hashtags, tell me — **what is your niche or profession?**\n\n_e.g. photography, cooking, tech, travel, fashion..._';
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'hashtags', isGathering: true };
  }

  private async _startPostIdeasGathering(local: LocalIntent): Promise<VexoraResponse> {
    const topic = local.topic ?? this.lastDetectedProfession;
    const lang = local.language;

    if (topic) return this._cloudGeneratePostIdeas(topic, lang);

    this.gatheringState = {
      active: true, intent: 'post_ideas',
      collectedInfo: {}, lastQuestion: 'profession',
    };
    const msg = lang === 'ur'
      ? 'Post ideas ke liye batao — **konse topic ya niche ke liye?**\n\n_Jaise: travel, fitness, food, coding, Islamic content..._'
      : 'For post ideas, tell me — **what niche or topic?**\n\n_e.g. travel, fitness, food, coding, Islamic content..._';
    this._pushAssistant(msg);
    await this.saveHistory();
    return { success: true, text: msg, intent: 'post_ideas', isGathering: true };
  }

  private async _continueGathering(userMessage: string): Promise<VexoraResponse> {
    if (!this.gatheringState.active) return this._cloudChat(userMessage, this._detectLanguage(userMessage));

    const { intent, collectedInfo, lastQuestion } = this.gatheringState;
    const lang = this._detectLanguage(userMessage);

    if (lastQuestion === 'profession') {
      collectedInfo.profession = userMessage.trim();
      if (this.lastDetectedProfession === null) {
        this.lastDetectedProfession = collectedInfo.profession;
        AsyncStorage.setItem(this.PROFESSION_KEY, collectedInfo.profession).catch(() => { });
      }

      if (intent === 'bio_generate') {
        // Ask tone (local)
        this.gatheringState = { active: true, intent, collectedInfo, lastQuestion: 'tone' };
        const msg = lang === 'ur'
          ? `**${collectedInfo.profession}** — 🎯\n\nBio ka style?\n\n• **Professional** — formal\n• **Funny** — mazedaar 😄\n• **Poetic** — adabi ✍️\n• **Bold** — motivational 💪\n• **Simple** — seedha\n\nYa apna style describe karo.`
          : `**${collectedInfo.profession}** — great! 🎯\n\nWhat style for the bio?\n\n• **Professional** — clean & formal\n• **Funny** — witty 😄\n• **Poetic** — lyrical ✍️\n• **Bold** — motivational 💪\n• **Simple** — plain & clear\n\nOr describe your own.`;
        this._pushAssistant(msg);
        await this.saveHistory();
        return { success: true, text: msg, intent, isGathering: true };
      }

      // hashtags / post_ideas — profession is enough, go to cloud
      this.gatheringState = { active: false };
      if (intent === 'hashtags') return this._cloudGenerateHashtags(collectedInfo.profession!, lang);
      if (intent === 'post_ideas') return this._cloudGeneratePostIdeas(collectedInfo.profession!, lang);
    }

    if (lastQuestion === 'tone') {
      collectedInfo.tone = userMessage.trim();
      this.gatheringState = { active: false };
      // Cloud generation with collected info
      return this._cloudGenerateBio(collectedInfo.profession, lang, collectedInfo.tone);
    }

    this.gatheringState = { active: false };
    return this._cloudChat(userMessage, lang);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLOUD HANDLERS — API calls happen here
  // ════════════════════════════════════════════════════════════════════════════

  private async _cloudGenerateBio(
    profession?: string | null,
    language: string = 'en',
    userInstruction?: string
  ): Promise<VexoraResponse> {
    const prompt = buildBioPrompt(this.user, profession ?? undefined, userInstruction, language);
    const system = buildVexoraSystemPrompt(
      this.user,
      profession ?? this.lastDetectedProfession,
      language as 'en' | 'ur'
    );

    const res = await this._callWithRetry(
      system,
      [...this.conversationHistory, { role: 'user', content: prompt }],
      AI_CONFIG.maxTokens.profile,
      AI_CONFIG.temperature.profile
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: res.text });
      await this.saveHistory();

      const bioOptions = this._parseBioOptions(res.text);
      if (bioOptions.a) this.lastBioOptions = bioOptions;

      const followUp = this._followUp(language, 'bio');
      return { success: true, text: res.text + followUp, intent: 'bio_generate', bioOptions };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'bio_generate' };
  }

  private async _cloudGenerateHashtags(profession?: string, language: string = 'en'): Promise<VexoraResponse> {
    const langNote = language === 'ur' ? ' Categories in Roman Urdu.' : '';
    const prompt = buildHashtagPrompt(this.user, profession) + langNote;
    const system = buildVexoraSystemPrompt(this.user, profession ?? this.lastDetectedProfession, language as 'en' | 'ur');

    const res = await this._callWithRetry(
      system,
      [...this.conversationHistory, { role: 'user', content: prompt }],
      AI_CONFIG.maxTokens.profile,
      AI_CONFIG.temperature.profile
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: res.text });
      await this.saveHistory();
      const hashtags = this._parseHashtags(res.text);
      const followUp = this._followUp(language, 'hashtags');
      return { success: true, text: res.text + followUp, intent: 'hashtags', hashtags };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'hashtags' };
  }

  private async _cloudGeneratePostIdeas(topic?: string, language: string = 'en'): Promise<VexoraResponse> {
    const prompt = buildPostIdeasPrompt(this.user, topic, language);
    const system = buildVexoraSystemPrompt(this.user, topic ?? this.lastDetectedProfession, language as 'en' | 'ur');

    const res = await this._callWithRetry(
      system,
      [...this.conversationHistory, { role: 'user' as const, content: prompt }],
      AI_CONFIG.maxTokens.profile,
      AI_CONFIG.temperature.profile
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: res.text });
      await this.saveHistory();
      const followUp = this._followUp(language, 'post_ideas');
      return { success: true, text: res.text + followUp, intent: 'post_ideas' };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'post_ideas' };
  }

  private async _cloudAudit(language: string = 'en'): Promise<VexoraResponse> {
    const prompt = buildAuditPrompt(this.user) + (language === 'ur' ? ' Reply in Roman Urdu.' : '');
    const system = buildVexoraSystemPrompt(this.user, this.lastDetectedProfession, language as 'en' | 'ur');

    const res = await this._callWithRetry(
      system,
      [...this.conversationHistory, { role: 'user', content: prompt }],
      AI_CONFIG.maxTokens.profile,
      0.3
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: res.text });
      await this.saveHistory();
      const scoreMatch = res.text.match(/\*\*?(\d{1,3})(?:\/100)?\*\*?/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
      const audit: ProfileAuditResult = { score, items: [], summary: res.text };
      const followUp = language === 'ur'
        ? '\n\n---\n💡 **Agle steps:** Bio? **"bio do"** | Hashtags? **"hashtags do"** | Post ideas? **"post ideas do"**'
        : '\n\n---\n💡 **Next steps:** Better bio? **"generate bio"** | Hashtags? **"hashtags"** | Content ideas? **"post ideas"**';
      return { success: true, text: res.text + followUp, intent: 'profile_audit', audit };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'profile_audit' };
  }

  private async _cloudSEOBio(language: string = 'en'): Promise<VexoraResponse> {
    const prompt = buildSEOBioPrompt(this.user, language);
    const system = buildVexoraSystemPrompt(this.user, this.lastDetectedProfession, language as 'en' | 'ur');

    const res = await this._callWithRetry(
      system,
      [...this.conversationHistory, { role: 'user' as const, content: prompt }],
      AI_CONFIG.maxTokens.profile,
      0.4
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: res.text });
      await this.saveHistory();
      const bioMatch = res.text.match(/"([^"]{10,})"/);
      if (bioMatch) {
        return { success: true, text: res.text, intent: 'seo_bio', pendingEdit: { field: 'bio', value: bioMatch[1] } };
      }
      return { success: true, text: res.text, intent: 'seo_bio' };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'seo_bio' };
  }

  private async _cloudRegenerate(language: string): Promise<VexoraResponse> {
    const regenerateMsg = language === 'ur'
      ? 'Ye options nahi chahiye. Bilkul alag aur naye options do.'
      : 'These options are not what I want. Give me completely different ones.';

    this.conversationHistory.push({ role: 'user', content: regenerateMsg });
    const system = buildVexoraSystemPrompt(this.user, this.lastDetectedProfession, language as 'en' | 'ur');

    const res = await this._callWithRetry(system, this.conversationHistory, AI_CONFIG.maxTokens.profile, 0.9);

    if (res.success) {
      this.conversationHistory.push({ role: 'assistant', content: res.text });
      await this.saveHistory();
      const bioOptions = this._parseBioOptions(res.text);
      if (bioOptions.a) this.lastBioOptions = bioOptions;
      const followUp = this._followUp(language, 'bio');
      return { success: true, text: res.text + followUp, intent: 'regenerate', bioOptions };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'regenerate' };
  }

  private async _cloudChat(userMessage: string, language: string): Promise<VexoraResponse> {
    const system = buildVexoraSystemPrompt(
      this.user,
      this.lastDetectedProfession,
      language as 'en' | 'ur'
    );

    const res = await this._callWithRetry(
      system,
      this.conversationHistory,
      AI_CONFIG.maxTokens.profile,
      AI_CONFIG.temperature.profile
    );

    if (res.success) {
      this.conversationHistory.push({ role: 'assistant', content: res.text });
      await this.saveHistory();
      return { success: true, text: res.text, intent: 'general' };
    }

    return { success: false, text: this._errMsg(language, res.error), intent: 'general' };
  }

  // Public aliases for handlers.ts compatibility
  async generateBioOptions(p?: string, lang: string = 'en', inst?: string) {
    return this._cloudGenerateBio(p, lang, inst);
  }
  async auditProfile(lang: string = 'en') { return this._cloudAudit(lang); }
  async generateHashtags(p?: string, lang: string = 'en') { return this._cloudGenerateHashtags(p, lang); }
  async generatePostIdeas(t?: string, lang: string = 'en') { return this._cloudGeneratePostIdeas(t, lang); }
  async generateSEOBio(lang: string = 'en') { return this._cloudSEOBio(lang); }
  async chat(msg: string) { return this._cloudChat(msg, this._detectLanguage(msg)); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _pushAssistant(msg: string) {
    this.conversationHistory.push({ role: 'assistant', content: msg });
  }

  private _errMsg(lang: string, errorType?: string): string {
    // Rate limit — specific helpful message
    if (errorType === 'rate_limited') {
      return lang === 'ur'
        ? '⏳ Abhi AI thoda busy hai (rate limit). 30 seconds baad dobara try karo.'
        : '⏳ AI is a bit busy right now (rate limit). Please try again in 30 seconds.';
    }
    return lang === 'ur'
      ? 'Kuch masla ho gaya 😕 Dobara try karo ya internet check karo.'
      : 'Something went wrong 😕 Please try again or check your connection.';
  }

  private _followUp(lang: string, type: 'bio' | 'hashtags' | 'post_ideas'): string {
    if (lang === 'ur') {
      const map: Record<string, string> = {
        bio: '\n\n---\n💡 **Kya karna hai?**\n• Pasand nahi? → **"koi aur do"**\n• Choose karo: **A**, **B**, ya **C**\n• Hashtags chahiye? → **"hashtags do"**',
        hashtags: '\n\n---\n💡 **Aur chahiye?**\n• Bio? → **"bio do"** | Post ideas? → **"post ideas do"**',
        post_ideas: '\n\n---\n💡 **Aur chahiye?**\n• Hashtags? → **"hashtags do"** | Bio? → **"bio do"**',
      };
      return map[type] || '';
    }
    const map: Record<string, string> = {
      bio: '\n\n---\n💡 **What next?**\n• Not happy? → **"give me different ones"**\n• Choose one: type **A**, **B**, or **C**\n• Need hashtags? → **"hashtags"**',
      hashtags: '\n\n---\n💡 **Want more?**\n• Bio? → **"generate bio"** | Post ideas? → **"post ideas"**',
      post_ideas: '\n\n---\n💡 **Want more?**\n• Hashtags? → **"hashtags"** | Bio? → **"generate bio"**',
    };
    return map[type] || '';
  }

  private _parseBioOptions(text: string): BioOptions {
    // Strategy 1: Option A/B/C labels
    const a1 = text.match(/\*{0,2}[Oo]ption\s+A\*{0,2}:?\*{0,2}\s*([\s\S]*?)(?=\*{0,2}[Oo]ption\s+[BC]|$)/)?.[1]?.trim() || '';
    const b1 = text.match(/\*{0,2}[Oo]ption\s+B\*{0,2}:?\*{0,2}\s*([\s\S]*?)(?=\*{0,2}[Oo]ption\s+[C]|$)/)?.[1]?.trim() || '';
    const c1 = text.match(/\*{0,2}[Oo]ption\s+C\*{0,2}:?\*{0,2}\s*([\s\S]*?)$/)?.[1]?.trim() || '';
    if (a1) return { a: a1, b: b1, c: c1 };

    // Strategy 2: A) B) C)
    const a2 = text.match(/^A[):\.]\s*([\s\S]*?)(?=^B[):\.]|$)/m)?.[1]?.trim() || '';
    const b2 = text.match(/^B[):\.]\s*([\s\S]*?)(?=^C[):\.]|$)/m)?.[1]?.trim() || '';
    const c2 = text.match(/^C[):\.]\s*([\s\S]*?)$/m)?.[1]?.trim() || '';
    if (a2) return { a: a2, b: b2, c: c2 };

    // Strategy 3: Chunks
    const chunks = text.split(/\n{2,}|---/).map(s => s.trim()).filter(s => s.length > 10);
    if (chunks.length >= 2) return { a: chunks[0] || '', b: chunks[1] || '', c: chunks[2] || '' };

    return { a: text.trim(), b: '', c: '' };
  }

  private _parseHashtags(text: string): HashtagResult {
    const get = (p: RegExp) => (text.match(p)?.[1]?.match(/#[\w]+/g) ?? []);
    return {
      highVolume: get(/📈[^:]*:[^\n]*\n([^\n]+)/),
      niche: get(/🎯[^:]*:[^\n]*\n([^\n]+)/),
      trending: get(/🔥[^:]*:[^\n]*\n([^\n]+)/),
      formatted: text,
    };
  }
}
