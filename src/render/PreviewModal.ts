/**
 * PreviewModal.ts - First-Time User 5-Minute Preview & Transition UI System.
 * Renders the introductory executive preview modal, HUD countdown timer, and reset transition modal.
 */

import type { SimulationCore } from '../sim/simulation';
import {
  getPreviewRemainingSeconds,
  startPreviewSession,
  completePreviewSession,
  resetSimulationToCleanSlate,
} from '../sim/previewManager';
import { audio } from '../audio/AudioManager';

export interface PreviewModalCallbacks {
  onResetComplete: () => void;
  onNotification?: (badge: string, text: string, highlight?: boolean) => void;
}

export class PreviewModal {
  private timerInterval: number | null = null;
  private isTimerActive = false;

  private welcomeModalEl: HTMLElement | null = null;
  private endedModalEl: HTMLElement | null = null;
  private hudBarEl: HTMLElement | null = null;
  private hudTimerTextEl: HTMLElement | null = null;

  constructor(
    private sim: SimulationCore,
    private callbacks: PreviewModalCallbacks
  ) {
    this.initDOM();
  }

  /**
   * Initializes the session based on current preview status.
   * If already started, resumes countdown. If expired, shows ended modal.
   * If not yet started, displays the initial welcome modal.
   */
  public initSession(): void {
    const started = typeof localStorage !== 'undefined' && !!localStorage.getItem('aegean_preview_start_time');
    const remaining = getPreviewRemainingSeconds();

    if (!started) {
      this.showWelcomeModal();
    } else if (remaining <= 0) {
      this.showEndedModal();
    } else {
      this.startCountdown();
    }
  }

  private initDOM() {
    this.welcomeModalEl = document.getElementById('preview-welcome-modal');
    this.endedModalEl = document.getElementById('preview-ended-modal');
    this.hudBarEl = document.getElementById('preview-hud-bar');
    this.hudTimerTextEl = document.getElementById('preview-timer-display');

    // 1. Welcome Modal: Embark on Preview
    document.getElementById('btn-preview-embark')?.addEventListener('click', () => {
      audio.playClickSound();
      this.closeWelcomeModal();
      this.startCountdown();
    });

    // 2. Welcome Modal: Skip Preview Immediately
    document.getElementById('btn-preview-skip')?.addEventListener('click', () => {
      audio.playClickSound();
      this.closeWelcomeModal();
      this.performCleanSlateReset();
    });

    // 3. HUD Bar: Early Reset to Clean Slate
    document.getElementById('btn-preview-early-reset')?.addEventListener('click', () => {
      audio.playClickSound();
      this.showEndedModal();
    });

    // 4. Ended Modal: Begin Clean Slate Dynasty
    document.getElementById('btn-preview-start-dynasty')?.addEventListener('click', () => {
      audio.playClickSound();
      this.closeEndedModal();
      this.performCleanSlateReset();
    });
  }

  /**
   * Shows the Welcome Preview Modal explaining the 5-minute trial period.
   */
  public showWelcomeModal(): void {
    if (this.welcomeModalEl) {
      this.welcomeModalEl.classList.remove('closed');
    }
  }

  public closeWelcomeModal(): void {
    if (this.welcomeModalEl) {
      this.welcomeModalEl.classList.add('closed');
    }
  }

  /**
   * Starts the 5-minute countdown and displays the HUD preview bar.
   */
  public startCountdown(): void {
    startPreviewSession();
    this.isTimerActive = true;

    if (this.hudBarEl) {
      this.hudBarEl.classList.remove('hidden');
    }

    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
    }

    this.updateTimerDisplay();

    this.timerInterval = window.setInterval(() => {
      const remaining = getPreviewRemainingSeconds();
      this.updateTimerDisplay();

      if (remaining <= 0) {
        this.stopCountdown();
        this.showEndedModal();
      }
    }, 1000);
  }

  private updateTimerDisplay(): void {
    const remaining = getPreviewRemainingSeconds();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (this.hudTimerTextEl) {
      this.hudTimerTextEl.textContent = formatted;
    }

    // Visual pulse when under 60 seconds
    if (this.hudBarEl) {
      if (remaining <= 60 && remaining > 0) {
        this.hudBarEl.classList.add('ending-soon');
      } else {
        this.hudBarEl.classList.remove('ending-soon');
      }
    }
  }

  public stopCountdown(): void {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isTimerActive = false;
    if (this.hudBarEl) {
      this.hudBarEl.classList.add('hidden');
    }
  }

  /**
   * Shows the transition modal announcing that the 5-minute preview has ended.
   */
  public showEndedModal(): void {
    this.stopCountdown();
    if (this.endedModalEl) {
      this.endedModalEl.classList.remove('closed');
    }
    audio.playAwakeningFanfare();
  }

  public closeEndedModal(): void {
    if (this.endedModalEl) {
      this.endedModalEl.classList.add('closed');
    }
  }

  /**
   * Executes the full clean-slate reset to Day 1, marks preview completed,
   * saves state, and invokes the callback to refresh scene & UI.
   */
  public performCleanSlateReset(): void {
    this.stopCountdown();
    completePreviewSession();

    const ok = resetSimulationToCleanSlate(this.sim);
    if (ok) {
      this.callbacks.onResetComplete();
      this.callbacks.onNotification?.(
        'ARCHIPELAGO DYNASTY',
        'Welcome Captain! Your personal maritime trading empire begins today at <strong>Santorini</strong> with 🪙 120 drachmas and 2 fishing boats.',
        true
      );
    }
  }

  public isRunning(): boolean {
    return this.isTimerActive;
  }
}
