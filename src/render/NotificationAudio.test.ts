import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeBadgeType,
  isNotificationAudioEnabled,
  setNotificationAudioEnabled,
  toggleNotificationAudio,
} from './notificationAudio';

describe('Notification Audio Manager (notificationAudio.ts)', () => {
  const storageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      writable: true,
    });
    storageMock.clear();
  });

  it('normalizes various badge strings into canonical channels', () => {
    expect(normalizeBadgeType('TRADE RUN')).toBe('TRADE RUN');
    expect(normalizeBadgeType('⛵ TRADE RUN')).toBe('TRADE RUN');
    expect(normalizeBadgeType('DAWN AWAKENING')).toBe('AWAKENING');
    expect(normalizeBadgeType('AWAKENING')).toBe('AWAKENING');
    expect(normalizeBadgeType('PANIGIRI FESTIVAL')).toBe('FESTIVAL');
    expect(normalizeBadgeType('OLIVE HARVEST BOOM')).toBe('FESTIVAL');
    expect(normalizeBadgeType('⚠️ CANNOT UNLOCK')).toBe('UNLOCKS');
    expect(normalizeBadgeType('SHIPYARD LOCKED')).toBe('VESSELS');
    expect(normalizeBadgeType('VESSEL COMMISSIONED')).toBe('VESSELS');
    expect(normalizeBadgeType('CAMERA FOCUS')).toBe('CAMERA');
    expect(normalizeBadgeType('DISPATCH')).toBe('DISPATCH');
  });

  it('defaults notification audio to enabled (true)', () => {
    expect(isNotificationAudioEnabled()).toBe(true);
    expect(isNotificationAudioEnabled('TRADE RUN')).toBe(true);
    expect(isNotificationAudioEnabled('AWAKENING')).toBe(true);
    expect(isNotificationAudioEnabled('FESTIVAL')).toBe(true);
    expect(isNotificationAudioEnabled('VESSELS')).toBe(true);
  });

  it('allows muting notification audio globally with a single control', () => {
    setNotificationAudioEnabled(false);

    expect(isNotificationAudioEnabled()).toBe(false);
    expect(isNotificationAudioEnabled('TRADE RUN')).toBe(false);
    expect(isNotificationAudioEnabled('AWAKENING')).toBe(false);
    expect(isNotificationAudioEnabled('FESTIVAL')).toBe(false);

    // Re-enabling restores audio across all channels
    setNotificationAudioEnabled(true);
    expect(isNotificationAudioEnabled()).toBe(true);
    expect(isNotificationAudioEnabled('TRADE RUN')).toBe(true);
  });

  it('toggles notification audio state on and off via toggleNotificationAudio()', () => {
    expect(isNotificationAudioEnabled()).toBe(true);

    const newState1 = toggleNotificationAudio();
    expect(newState1).toBe(false);
    expect(isNotificationAudioEnabled()).toBe(false);

    const newState2 = toggleNotificationAudio();
    expect(newState2).toBe(true);
    expect(isNotificationAudioEnabled()).toBe(true);
  });
});

