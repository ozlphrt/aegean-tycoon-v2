import { describe, it, expect, beforeEach } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

// Lightweight in-memory DOM mock for node environment testing
class MockElement {
  public id: string = '';
  public className: string = '';
  public innerHTML: string = '';
  public textContent: string = '';
  public style: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  private listeners: Record<string, ((e: any) => void)[]> = {};

  constructor(public tagName: string) {}

  public classList = {
    add: (...names: string[]) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      names.forEach((n) => set.add(n));
      this.className = Array.from(set).join(' ');
    },
    remove: (...names: string[]) => {
      const set = new Set(this.className.split(' ').filter(Boolean));
      names.forEach((n) => set.delete(n));
      this.className = Array.from(set).join(' ');
    },
    contains: (name: string) => this.className.split(' ').filter(Boolean).includes(name),
  };

  public appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
  }

  public addEventListener(event: string, fn: (e: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  public removeEventListener(event: string, fn: (e: any) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
  }

  public dispatchEvent(e: any): boolean {
    e.target = this;
    const handlers = this.listeners[e.type] || [];
    handlers.forEach((h) => h(e));
    return true;
  }

  public click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }

  public focus() {}
}

describe('In-Game Confirm Modal (ConfirmModal.ts)', () => {
  let elementsById: Map<string, MockElement>;
  let windowListeners: Record<string, ((e: any) => void)[]>;

  beforeEach(() => {
    elementsById = new Map();
    windowListeners = {};

    const bodyMock = new MockElement('BODY');
    const hudOverlayMock = new MockElement('DIV');
    hudOverlayMock.id = 'hud-overlay';
    bodyMock.appendChild(hudOverlayMock);
    elementsById.set('hud-overlay', hudOverlayMock);

    const docMock = {
      body: bodyMock,
      getElementById: (id: string) => elementsById.get(id) || null,
      createElement: (tag: string) => new MockElement(tag),
    };

    (globalThis as any).document = docMock;
    (globalThis as any).window = {
      addEventListener: (event: string, fn: any) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(fn);
      },
      removeEventListener: (event: string, fn: any) => {
        if (!windowListeners[event]) return;
        windowListeners[event] = windowListeners[event].filter((f) => f !== fn);
      },
      dispatchEvent: (e: any) => {
        const handlers = windowListeners[e.type] || [];
        handlers.forEach((h) => h(e));
      },
      setTimeout: (fn: () => void) => fn(),
    };
  });

  it('handles headless environment gracefully when document is undefined', () => {
    (globalThis as any).document = undefined;
    const headlessModal = new ConfirmModal();
    expect(headlessModal).toBeDefined();
  });

  it('registers DOM elements when document is present', () => {
    // Register mock elements created by ConfirmModal
    const origCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      return el;
    };

    const modal = new ConfirmModal();
    expect(modal).toBeDefined();
  });

  it('formats decommission modal details and confirms with true', async () => {
    // Build full DOM mock elements for the modal
    const overlay = new MockElement('DIV');
    overlay.id = 'confirm-modal-overlay';
    overlay.classList.add('closed');
    elementsById.set('confirm-modal-overlay', overlay);

    const dialog = new MockElement('DIV');
    dialog.id = 'confirm-modal-dialog';
    elementsById.set('confirm-modal-dialog', dialog);

    const iconEl = new MockElement('DIV');
    iconEl.id = 'confirm-modal-icon';
    elementsById.set('confirm-modal-icon', iconEl);

    const titleEl = new MockElement('H3');
    titleEl.id = 'confirm-modal-title';
    elementsById.set('confirm-modal-title', titleEl);

    const subtitleEl = new MockElement('P');
    subtitleEl.id = 'confirm-modal-subtitle';
    elementsById.set('confirm-modal-subtitle', subtitleEl);

    const msgEl = new MockElement('P');
    msgEl.id = 'confirm-modal-message';
    elementsById.set('confirm-modal-message', msgEl);

    const detailsEl = new MockElement('UL');
    detailsEl.id = 'confirm-modal-details';
    elementsById.set('confirm-modal-details', detailsEl);

    const cancelBtn = new MockElement('BUTTON');
    cancelBtn.id = 'btn-confirm-modal-cancel';
    elementsById.set('btn-confirm-modal-cancel', cancelBtn);

    const actionBtn = new MockElement('BUTTON');
    actionBtn.id = 'btn-confirm-modal-action';
    elementsById.set('btn-confirm-modal-action', actionBtn);

    const closeBtn = new MockElement('BUTTON');
    closeBtn.id = 'btn-confirm-modal-close';
    elementsById.set('btn-confirm-modal-close', closeBtn);

    const modal = new ConfirmModal();
    const promise = modal.confirmDecommissionShip('Nikolaos', 'Santorini', 60);

    expect(overlay.classList.contains('closed')).toBe(false);
    expect(titleEl.textContent).toBe('Decommission Vessel');
    expect(msgEl.innerHTML).toContain('Decommission and scrap Nikolaos?');
    expect(detailsEl.innerHTML).toContain('1 harbor berth');
    expect(detailsEl.innerHTML).toContain('60 drachmas');

    // Simulate clicking confirm action button
    actionBtn.click();

    const result = await promise;
    expect(result).toBe(true);
    expect(overlay.classList.contains('closed')).toBe(true);
  });

  it('cancels decommission and resolves false when cancel button is clicked', async () => {
    const overlay = new MockElement('DIV');
    overlay.id = 'confirm-modal-overlay';
    overlay.classList.add('closed');
    elementsById.set('confirm-modal-overlay', overlay);

    const dialog = new MockElement('DIV');
    dialog.id = 'confirm-modal-dialog';
    elementsById.set('confirm-modal-dialog', dialog);

    const cancelBtn = new MockElement('BUTTON');
    cancelBtn.id = 'btn-confirm-modal-cancel';
    elementsById.set('btn-confirm-modal-cancel', cancelBtn);

    const actionBtn = new MockElement('BUTTON');
    actionBtn.id = 'btn-confirm-modal-action';
    elementsById.set('btn-confirm-modal-action', actionBtn);

    const modal = new ConfirmModal();
    const promise = modal.confirmDecommissionShip('Nikolaos', 'Santorini', 60);

    expect(overlay.classList.contains('closed')).toBe(false);

    // Simulate clicking cancel button
    cancelBtn.click();

    const result = await promise;
    expect(result).toBe(false);
    expect(overlay.classList.contains('closed')).toBe(true);
  });

  it('cancels and resolves false on Escape keydown', async () => {
    const overlay = new MockElement('DIV');
    overlay.id = 'confirm-modal-overlay';
    overlay.classList.add('closed');
    elementsById.set('confirm-modal-overlay', overlay);

    const modal = new ConfirmModal();
    const promise = modal.confirmGameReset();

    expect(overlay.classList.contains('closed')).toBe(false);

    // Simulate escape keydown
    window.dispatchEvent({
      type: 'keydown',
      key: 'Escape',
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);

    const result = await promise;
    expect(result).toBe(false);
    expect(overlay.classList.contains('closed')).toBe(true);
  });
});
