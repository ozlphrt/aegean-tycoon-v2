/**
 * ConfirmModal.ts — In-Game Glassmorphic Confirmation Modal
 * 
 * Replaces native browser window.confirm() dialogs with an immersive,
 * dark Aegean-themed modal that seamlessly integrates with the audio engine
 * and trilingual i18n system.
 */

import { audio } from '../audio/AudioManager';
import { t } from '../ui/i18n';

export interface ConfirmModalOptions {
  title?: string;
  subtitle?: string;
  icon?: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export class ConfirmModal {
  private overlayEl: HTMLElement | null = null;
  private resolveCallback: ((value: boolean) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('confirm-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-modal-overlay';
      overlay.className = 'modal-overlay confirm-modal-overlay closed';
      overlay.innerHTML = `
        <div class="glass-panel confirm-modal-container" id="confirm-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <div class="confirm-modal-header">
            <div class="confirm-modal-icon-badge" id="confirm-modal-icon">🔨</div>
            <div class="confirm-modal-title-group">
              <h3 id="confirm-modal-title" class="confirm-modal-title">Confirm Action</h3>
              <p id="confirm-modal-subtitle" class="confirm-modal-subtitle">Harbor Authority Directives</p>
            </div>
            <button id="btn-confirm-modal-close" class="btn-close" aria-label="Close" title="Close (Esc)">✕</button>
          </div>

          <div class="confirm-modal-body">
            <p id="confirm-modal-message" class="confirm-modal-message"></p>
            <ul id="confirm-modal-details" class="confirm-modal-details-list"></ul>
          </div>

          <div class="confirm-modal-footer">
            <button id="btn-confirm-modal-cancel" class="btn btn-secondary confirm-btn-cancel">
              Cancel
            </button>
            <button id="btn-confirm-modal-action" class="btn btn-danger confirm-btn-action">
              Confirm
            </button>
          </div>
        </div>
      `;

      const targetParent = document.getElementById('hud-overlay') || document.body;
      targetParent.appendChild(overlay);
    }

    this.overlayEl = overlay;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Overlay backdrop click dismisses with false
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        audio.playClickSound();
        this.close(false);
      }
    });

    // Close 'X' button
    const closeBtn = document.getElementById('btn-confirm-modal-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playClickSound();
      this.close(false);
    });

    // Cancel button
    const cancelBtn = document.getElementById('btn-confirm-modal-cancel');
    cancelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playClickSound();
      this.close(false);
    });

    // Action button
    const actionBtn = document.getElementById('btn-confirm-modal-action');
    actionBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(true);
    });
  }

  /**
   * Prompts the user with an in-game modal, returning a promise that resolves to
   * true if confirmed or false if cancelled.
   */
  public confirm(options: ConfirmModalOptions): Promise<boolean> {
    if (!this.overlayEl) {
      this.createDom();
    }

    // If already waiting on a confirmation, resolve previous with false
    if (this.resolveCallback) {
      this.resolveCallback(false);
      this.resolveCallback = null;
    }

    return new Promise<boolean>((resolve) => {
      this.resolveCallback = resolve;
      this.render(options);
      this.open();
    });
  }

  /**
   * Specialized helper for vessel decommission & scrap confirmations
   */
  public confirmDecommissionShip(shipName: string, homeName: string, refund: number): Promise<boolean> {
    return this.confirm({
      title: t('modal.confirm.decommission_title'),
      subtitle: `${homeName} • Harbor Shipyard`,
      icon: '🔨',
      message: `Decommission and scrap ${shipName}?`,
      details: [
        `Frees <strong>1 harbor berth</strong> at ${homeName}`,
        `Recover salvage value: <strong>+🪙 ${refund.toLocaleString()} drachmas</strong>`,
      ],
      confirmText: t('modal.confirm.decommission_action'),
      cancelText: t('modal.confirm.cancel'),
      variant: 'danger',
    });
  }

  /**
   * Specialized helper for game reset confirmation
   */
  public confirmGameReset(): Promise<boolean> {
    return this.confirm({
      title: t('modal.confirm.reset_title'),
      subtitle: 'Aegean Archipelago • Dawn Re-initialization',
      icon: '⚠️',
      message: 'Are you sure you want to reset your Aegean maritime empire?',
      details: [
        'Clears all saved game state and treasury progress from local storage',
        'Re-initializes Santorini & Naxos to starting dawn state',
      ],
      confirmText: t('modal.confirm.reset_action'),
      cancelText: t('modal.confirm.cancel'),
      variant: 'danger',
    });
  }

  private render(options: ConfirmModalOptions): void {
    if (!this.overlayEl) return;

    const dialog = document.getElementById('confirm-modal-dialog');
    const iconEl = document.getElementById('confirm-modal-icon');
    const titleEl = document.getElementById('confirm-modal-title');
    const subtitleEl = document.getElementById('confirm-modal-subtitle');
    const msgEl = document.getElementById('confirm-modal-message');
    const detailsListEl = document.getElementById('confirm-modal-details');
    const cancelBtn = document.getElementById('btn-confirm-modal-cancel');
    const actionBtn = document.getElementById('btn-confirm-modal-action');

    const variant = options.variant || 'danger';

    // Update variant classes on dialog
    if (dialog) {
      dialog.classList.remove('variant-danger', 'variant-warning', 'variant-primary');
      dialog.classList.add(`variant-${variant}`);
    }

    if (iconEl) {
      iconEl.textContent = options.icon || (variant === 'danger' ? '🔨' : '⚠️');
      iconEl.className = `confirm-modal-icon-badge variant-${variant}`;
    }

    if (titleEl) {
      titleEl.textContent = options.title || t('modal.confirm.title');
    }

    if (subtitleEl) {
      if (options.subtitle) {
        subtitleEl.textContent = options.subtitle;
        subtitleEl.style.display = 'block';
      } else {
        subtitleEl.style.display = 'none';
      }
    }

    if (msgEl) {
      msgEl.innerHTML = options.message;
    }

    if (detailsListEl) {
      if (options.details && options.details.length > 0) {
        detailsListEl.innerHTML = options.details
          .map(
            (item) => `
            <li class="confirm-modal-detail-item">
              <span class="confirm-detail-bullet">▪</span>
              <span class="confirm-detail-text">${item}</span>
            </li>
          `
          )
          .join('');
        detailsListEl.style.display = 'flex';
      } else {
        detailsListEl.innerHTML = '';
        detailsListEl.style.display = 'none';
      }
    }

    if (cancelBtn) {
      cancelBtn.textContent = options.cancelText || t('modal.confirm.cancel');
    }

    if (actionBtn) {
      actionBtn.textContent = options.confirmText || t('modal.confirm.ok');
      actionBtn.className = `btn confirm-btn-action ${variant === 'danger' ? 'btn-danger' : variant === 'warning' ? 'btn-warning' : 'btn-primary'}`;
    }
  }

  private open(): void {
    if (!this.overlayEl) return;

    audio.playClickSound();
    this.overlayEl.classList.remove('closed');

    // Attach global keyboard listener for Escape & Enter
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }

    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.overlayEl?.classList.contains('closed')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        audio.playClickSound();
        this.close(false);
      } else if (e.key === 'Enter') {
        // If Enter is pressed and active element is not the cancel button, confirm
        if (document.activeElement?.id === 'btn-confirm-modal-cancel') {
          e.preventDefault();
          audio.playClickSound();
          this.close(false);
        } else {
          e.preventDefault();
          this.close(true);
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);

    // Auto-focus confirm button
    window.setTimeout(() => {
      const actionBtn = document.getElementById('btn-confirm-modal-action');
      actionBtn?.focus();
    }, 50);
  }

  private close(result: boolean): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.overlayEl) {
      this.overlayEl.classList.add('closed');
    }

    if (this.resolveCallback) {
      const cb = this.resolveCallback;
      this.resolveCallback = null;
      cb(result);
    }
  }
}

// Export singleton instance for seamless application-wide usage
export const confirmModal = new ConfirmModal();
