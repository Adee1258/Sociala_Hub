/**
 * profile.handlers.ts
 * Event handlers that connect the Profile screen UI to VexoraAI.
 */

import { VexoraAI } from './profile.vexora';
import type { UserProfileContext, BioOptions } from './ai.types';

export interface ProcessMessageResult {
  success: boolean;
  text: string;
  intent: string;
  bioOptions?: BioOptions;
  pendingEdit?: { field: string; value: string };
  themeId?: string;
  selectedOption?: 'a' | 'b' | 'c';
  isGathering?: boolean;
  error?: string;
}

/**
 * onProcessMessage
 * Single entry point for all natural language messages from the UI.
 */
export async function onProcessMessage(
  vexora: VexoraAI,
  userMessage: string
): Promise<ProcessMessageResult> {
  try {
    const result = await vexora.processMessage(userMessage);
    return {
      success: result.success,
      text: result.text,
      intent: result.intent ?? 'general',
      bioOptions: result.bioOptions,
      pendingEdit: result.pendingEdit,
      themeId: result.themeId,
      selectedOption: result.selectedOption,
      isGathering: result.isGathering,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      text: 'Kuch masla ho gaya, dobara try karo.',
      intent: 'error',
      error: err?.message,
    };
  }
}

/**
 * createVexoraInstance
 * Factory — creates instance and loads persistent history.
 */
export async function createVexoraInstance(
  user: UserProfileContext
): Promise<VexoraAI> {
  const instance = new VexoraAI(user);
  await instance.loadHistory();
  return instance;
}
