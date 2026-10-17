export const NOTIF_AUDIO_STORAGE_KEY = 'aegean_notification_audio_enabled';

/**
 * Normalizes message badges/categories into standardized notification audio channels.
 */
export function normalizeBadgeType(badge: string): string {
  const clean = badge.replace(/[⚠️⛵🏛️🪙✨🎉👑🎟️]/g, '').trim().toUpperCase();
  if (clean.includes('TRADE')) return 'TRADE RUN';
  if (clean.includes('AWAKEN') || clean.includes('DAWN')) return 'AWAKENING';
  if (
    clean.includes('FESTIVAL') ||
    clean.includes('PANIGIRI') ||
    clean.includes('HARVEST') ||
    clean.includes('VINTAGE') ||
    clean.includes('REGATTA')
  ) {
    return 'FESTIVAL';
  }
  if (clean.includes('COMMISSION') || clean.includes('SHIPYARD') || clean.includes('VESSEL')) {
    return 'VESSELS';
  }
  if (clean.includes('UNLOCK') || clean.includes('CANNOT')) return 'UNLOCKS';
  if (clean.includes('CAMERA')) return 'CAMERA';
  return clean || 'NOTIFICATIONS';
}

/**
 * Checks whether notification audio is enabled (defaults to true).
 * The optional badge argument is accepted for backward compatibility.
 */
export function isNotificationAudioEnabled(_badge?: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(NOTIF_AUDIO_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

/**
 * Sets whether notification sound effects are enabled.
 * Supports both setNotificationAudioEnabled(boolean) and setNotificationAudioEnabled(badge, boolean).
 */
export function setNotificationAudioEnabled(arg1: boolean | string, arg2?: boolean): void {
  const enabled = typeof arg1 === 'boolean' ? arg1 : arg2 !== undefined ? arg2 : true;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIF_AUDIO_STORAGE_KEY, String(enabled));
    }
  } catch (err) {
    console.warn('Failed saving notification audio setting:', err);
  }
}

/**
 * Toggles notification audio state on/off and returns the new state.
 */
export function toggleNotificationAudio(): boolean {
  const nextState = !isNotificationAudioEnabled();
  setNotificationAudioEnabled(nextState);
  return nextState;
}

export function getNotificationAudioSettings(): Record<string, boolean> {
  const enabled = isNotificationAudioEnabled();
  return {
    'TRADE RUN': enabled,
    'AWAKENING': enabled,
    'FESTIVAL': enabled,
    'VESSELS': enabled,
    'UNLOCKS': enabled,
    'CAMERA': enabled,
  };
}

