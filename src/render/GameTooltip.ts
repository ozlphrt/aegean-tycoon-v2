/**
 * GameTooltip.ts — In-Game Themed Tooltip & Popover System
 * 
 * Replaces native OS browser tooltips with a rich, responsive, glassmorphic card
 * aligned with Aegean Tycoon's classical Hellenic & obsidian modal theme.
 * Works seamlessly across all HUD panels and on top of all modal dialogs.
 */

export interface TooltipData {
  title?: string;
  badge?: string;
  badgeType?: 'warning' | 'high' | 'medium' | 'info' | 'gold' | 'success';
  body: string;
  recommendation?: string;
  shortcut?: string;
  actionHint?: string;
  icon?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTooltipSegment(itemText: string): string {
  const trimmed = itemText.trim();
  if (!trimmed) return '';

  // 1. Distress Alert Banner: e.g. "⚠️ Distress Alert: Supplies Depleted (74% distress)" or "⚠️ Critical Shortage: Depleted Wine, Grain!"
  const distressAlertMatch = trimmed.match(/^⚠️?\s*(?:Distress Alert|Critical Shortage):\s*(.+?)(?:\s*\((.+?)\))?!*$/i);
  if (distressAlertMatch) {
    const mainDesc = distressAlertMatch[1].trim();
    const subNote = distressAlertMatch[2]?.trim() || '';
    
    // Check if subNote or mainDesc contains distress percentage
    const pctMatch = (subNote || mainDesc).match(/(\d+%\s*(?:distress)?)/i);
    const badgeText = pctMatch ? pctMatch[1].toUpperCase() : 'ALERT';
    
    return `<div class="tooltip-alert-banner alert-distress">` +
      `<div class="alert-banner-header">` +
        `<span class="alert-banner-title">⚠️ ${escapeHtml(mainDesc)}</span>` +
        `<span class="alert-banner-pct">${escapeHtml(badgeText)}</span>` +
      `</div>` +
      `<div class="alert-banner-desc">${subNote ? escapeHtml(subNote) : 'Critical shortage affecting island population and harbor commerce'}</div>` +
    `</div>`;
  }

  // 2. Format numbers, percentages, currency, and rates with rich chips
  let formatted = escapeHtml(trimmed);

  // Currency: 🪙 12.5k or 1,200 coins/drachmas
  formatted = formatted.replace(
    /(🪙\s*[\d,.]+[kKmM]?|\b[\d,.]+[kKmM]?\s*(?:coins|gold|drachmas?)\b)/gi,
    '<span class="tooltip-chip chip-coin">$1</span>'
  );

  // Distress: 74% distress
  formatted = formatted.replace(
    /(\b\d+%\s*distress\b)/gi,
    '<span class="tooltip-chip chip-distress">⚠️ $1</span>'
  );

  // Prosperity: 85% prosperity or Booming Prosperity (90%)
  formatted = formatted.replace(
    /(\b\d+%\s*(?:prosperity)?\b)/gi,
    '<span class="tooltip-chip chip-prosperity">$1</span>'
  );

  // Rates: +5/d, -3.2/d, +12/h
  formatted = formatted.replace(
    /([+]\d+(?:\.\d+)?\/[dh])/gi,
    '<span class="tooltip-chip chip-rate-pos">$1</span>'
  );
  formatted = formatted.replace(
    /([−-]\d+(?:\.\d+)?\/[dh])/gi,
    '<span class="tooltip-chip chip-rate-neg">$1</span>'
  );

  // Stock fractions: 120/500 tons or 45/100 units
  formatted = formatted.replace(
    /(\b\d+\/\d+(?:\s*(?:tons|units|cargo))?\b)/gi,
    '<span class="tooltip-chip chip-stock">$1</span>'
  );

  return formatted;
}

export function parseTooltipContent(raw: string, isInteractive = false): TooltipData {
  let text = raw.trim();
  let shortcut: string | undefined;
  let badge: string | undefined;
  let badgeType: TooltipData['badgeType'] = 'info';
  let icon: string | undefined;
  let title: string | undefined;
  let recommendation: string | undefined;
  let actionHint: string | undefined;

  // Check for keyboard shortcut like (Space), (1), (Esc), (V)
  const shortcutMatch = text.match(/\(([A-Za-z0-9\s+]+)\)$/);
  if (shortcutMatch) {
    shortcut = shortcutMatch[1];
    text = text.replace(/\(([A-Za-z0-9\s+]+)\)$/, '').trim();
  }

  // Check for recommendations ("💡" or "Recommendation:")
  if (text.includes('💡')) {
    const parts = text.split('💡');
    text = parts[0].trim();
    recommendation = parts[1].trim();
  } else if (text.toLowerCase().includes('recommendation:')) {
    const idx = text.toLowerCase().indexOf('recommendation:');
    recommendation = text.substring(idx + 15).trim();
    text = text.substring(0, idx).trim();
  }

  // Check for leading warning icon
  if (text.startsWith('⚠️')) {
    icon = '⚠️';
    text = text.substring(2).trim();
    badgeType = 'warning';
  }

  if (isInteractive) {
    actionHint = 'Click to inspect in modal';
  }

  // Detect bullet points or titles
  let body = text;
  if (text.includes(' • ')) {
    const segments = text.split(' • ');
    title = segments[0].trim();
    const bodySegments = segments.slice(1);
    body = bodySegments.join(' • ');
  }

  // Contextually enhance badge and severity from body if not set
  const lowerBody = body.toLowerCase();
  if (lowerBody.includes('distress') || lowerBody.includes('critical shortage') || lowerBody.includes('depleted') || body.includes('⚠️')) {
    badgeType = 'warning';
    if (!icon) icon = '⚠️';
    if (!badge) {
      const distPct = body.match(/(\d+)%\s*distress/i);
      badge = distPct ? `⚠️ ${distPct[1]}% DISTRESS` : '⚠️ DISTRESSED';
    }
  } else if (lowerBody.includes('booming') || (lowerBody.includes('prosperity') && !lowerBody.includes('low'))) {
    const prospPct = body.match(/(\d+)%\s*(?:prosperity)?/i);
    if (!badgeType || badgeType === 'info') badgeType = 'gold';
    if (!icon) icon = '✨';
    if (!badge) {
      badge = prospPct ? `✨ ${prospPct[1]}% PROSPERITY` : '✨ BOOMING';
    }
  } else if (lowerBody.includes('struggling') || lowerBody.includes('low supplies')) {
    if (!badgeType || badgeType === 'info') badgeType = 'medium';
    if (!icon) icon = '📉';
    if (!badge) {
      const prospPct = body.match(/(\d+)%\s*(?:prosperity)?/i);
      badge = prospPct ? `📉 ${prospPct[1]}% PROSPERITY` : '📉 LOW SUPPLIES';
    }
  } else if (lowerBody.includes('stable')) {
    if (!badgeType || badgeType === 'info') badgeType = 'info';
    if (!icon) icon = '⚓';
    if (!badge) {
      const prospPct = body.match(/(\d+)%\s*(?:prosperity)?/i);
      badge = prospPct ? `⚓ ${prospPct[1]}% STABLE` : '⚓ STABLE';
    }
  }

  return {
    title,
    badge,
    badgeType,
    body,
    recommendation,
    shortcut,
    actionHint,
    icon,
  };
}

export class GameTooltip {
  private static instance: GameTooltip | null = null;
  private container: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private isVisible = false;
  private mouseX = 0;
  private mouseY = 0;
  private hideTimeout: number | null = null;
  private showTimeout: number | null = null;

  public static init(): GameTooltip {
    if (!GameTooltip.instance) {
      GameTooltip.instance = new GameTooltip();
    }
    return GameTooltip.instance;
  }

  public static getInstance(): GameTooltip | null {
    return GameTooltip.instance;
  }

  constructor() {
    this.createDom();
    this.bindEvents();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('game-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'game-tooltip';
      el.className = 'game-tooltip-card closed';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  private bindEvents(): void {
    if (typeof document === 'undefined') return;

    // Use event delegation for high performance across dynamic DOM updates
    document.addEventListener('pointerover', (e) => this.handlePointerOver(e), { passive: true });
    document.addEventListener('pointerout', (e) => this.handlePointerOut(e), { passive: true });
    document.addEventListener('pointermove', (e) => this.handlePointerMove(e), { passive: true });

    // Instantly dismiss on clicks or escape
    window.addEventListener('click', () => this.hide(true), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide(true);
    });
    window.addEventListener('wheel', () => this.hide(false), { passive: true });
  }

  private handlePointerOver(e: PointerEvent): void {
    // Suppress tooltips on language selector or elements marked with data-no-tooltip
    if ((e.target as HTMLElement)?.closest?.('[data-no-tooltip], .no-tooltip, .lang-selector-wrap, #top-lang-selector, #btn-lang-toggle')) {
      this.hide(true);
      return;
    }

    // Prefer higher-level composite card container (like .good-pill) if it has a tooltip
    const pillRoot = (e.target as HTMLElement)?.closest?.('.good-pill, [data-tooltip-root]') as HTMLElement | null;
    let target: HTMLElement | null = null;

    if (pillRoot && (pillRoot.hasAttribute('title') || pillRoot.hasAttribute('data-game-tooltip') || pillRoot.hasAttribute('data-tooltip'))) {
      target = pillRoot;
    } else {
      target = (e.target as HTMLElement)?.closest?.(
        '[title], [data-tooltip], [data-game-tooltip], [data-tooltip-title], [data-tooltip-body]'
      ) as HTMLElement | null;
    }

    if (!target) return;

    // Suppress browser native tooltip by transferring `title` to `data-game-tooltip`
    if (target.hasAttribute('title')) {
      const rawTitle = target.getAttribute('title') || '';
      if (rawTitle.trim()) {
        target.setAttribute('data-game-tooltip', rawTitle);
      }
      target.removeAttribute('title');
    }

    // If already active and showing for this exact target, avoid re-triggering timers and jumps
    if (this.currentTarget === target && this.isVisible) {
      return;
    }

    this.currentTarget = target;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    // Snappy 60ms delay prevents flickering on rapid mouse movements
    this.showTimeout = window.setTimeout(() => {
      if (this.currentTarget === target) {
        this.renderForElement(target);
      }
    }, 60);
  }

  private handlePointerOut(e: PointerEvent): void {
    const related = e.relatedTarget as HTMLElement | null;
    if (!this.currentTarget) return;

    // If moving within the current target or into one of its children, do not hide
    if (related && (this.currentTarget.contains(related) || this.currentTarget === related)) {
      return;
    }

    // If related belongs to the same composite card root, maintain active state
    const relatedPill = related?.closest?.('.good-pill, [data-tooltip-root]');
    if (relatedPill && relatedPill === this.currentTarget) {
      return;
    }

    this.currentTarget = null;
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    this.hideTimeout = window.setTimeout(() => {
      this.hide(false);
    }, 50);
  }

  private handlePointerMove(e: PointerEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (this.isVisible && this.container) {
      this.updatePosition();
    }
  }

  private parseTooltipData(el: HTMLElement): TooltipData | null {
    // 1. Explicit data attributes take highest priority
    const explicitTitle = el.getAttribute('data-tooltip-title');
    const explicitBody = el.getAttribute('data-tooltip-body');
    const explicitRec = el.getAttribute('data-tooltip-rec');
    const explicitBadge = el.getAttribute('data-tooltip-badge') || el.getAttribute('data-tooltip-label');
    const explicitSeverity = (el.getAttribute('data-tooltip-severity') || 'info') as TooltipData['badgeType'];
    const explicitShortcut = el.getAttribute('data-tooltip-shortcut');
    const explicitIcon = el.getAttribute('data-tooltip-icon');
    const explicitHint = el.getAttribute('data-tooltip-hint');

    if (explicitTitle || explicitBody) {
      return {
        title: explicitTitle || undefined,
        body: explicitBody || '',
        recommendation: explicitRec || undefined,
        badge: explicitBadge || undefined,
        badgeType: explicitSeverity,
        shortcut: explicitShortcut || undefined,
        actionHint: explicitHint || undefined,
        icon: explicitIcon || undefined,
      };
    }

    // 2. Parse general data-game-tooltip or data-tooltip string
    const raw = el.getAttribute('data-game-tooltip') || el.getAttribute('data-tooltip') || '';
    if (!raw.trim()) return null;

    const isInteractive = el.tagName === 'BUTTON' || el.classList.contains('interactive') || el.hasAttribute('data-ship-id') || el.classList.contains('vessel-underutilized-chip');
    return parseTooltipContent(raw, isInteractive);
  }

  public renderForElement(el: HTMLElement): void {
    const data = this.parseTooltipData(el);
    if (!data || (!data.title && !data.body)) {
      this.hide(false);
      return;
    }

    this.render(data);
  }

  public render(data: TooltipData): void {
    if (!this.container) return;

    let headerHtml = '';
    const hasHeader = data.title || data.badge || data.shortcut || data.icon;

    if (hasHeader) {
      headerHtml = `
        <div class="game-tooltip-header">
          <div class="game-tooltip-title-wrap">
            ${data.icon ? `<span class="game-tooltip-icon">${data.icon}</span>` : ''}
            ${data.title ? `<span class="game-tooltip-title">${data.title}</span>` : ''}
          </div>
          <div class="game-tooltip-header-tags">
            ${data.badge ? `<span class="game-tooltip-badge badge-${data.badgeType || 'info'}">${data.badge}</span>` : ''}
            ${data.shortcut ? `<span class="game-tooltip-kbd"><kbd>${data.shortcut}</kbd></span>` : ''}
          </div>
        </div>
      `;
    }

    // Split body by bullet dots ' • ' for clean multi-line breakdown if present
    let bodyHtml = '';
    if (data.body.includes(' • ')) {
      const items = data.body.split(' • ').filter(s => s.trim().length > 0);
      bodyHtml = `
        <div class="game-tooltip-bullets">
          ${items.map(item => `<div class="game-tooltip-bullet-item"><span class="bullet-dot">▸</span><span>${formatTooltipSegment(item)}</span></div>`).join('')}
        </div>
      `;
    } else {
      bodyHtml = `<div class="game-tooltip-text">${formatTooltipSegment(data.body)}</div>`;
    }

    // Recommendation card
    let recHtml = '';
    if (data.recommendation) {
      recHtml = `
        <div class="game-tooltip-rec">
          <span class="rec-icon">💡</span>
          <div class="rec-content">
            <span class="rec-label">Advisory Recommendation:</span>
            <span class="rec-text">${data.recommendation}</span>
          </div>
        </div>
      `;
    }

    // Footer action hint
    let footerHtml = '';
    if (data.actionHint) {
      footerHtml = `
        <div class="game-tooltip-footer">
          <span class="footer-hint-icon">👆</span>
          <span class="footer-hint-text">${data.actionHint}</span>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="game-tooltip-inner ${data.badgeType || 'info'}">
        ${headerHtml}
        ${bodyHtml}
        ${recHtml}
        ${footerHtml}
      </div>
    `;

    this.container.classList.remove('closed');
    this.isVisible = true;
    this.updatePosition();
  }

  private updatePosition(): void {
    if (!this.container || !this.isVisible) return;

    const pad = 14;
    const tooltipRect = this.container.getBoundingClientRect();
    const tooltipW = tooltipRect.width || 280;
    const tooltipH = tooltipRect.height || 80;

    let posX = this.mouseX + 16;
    let posY = this.mouseY + 16;

    // If target element is available, anchor relative to it gracefully
    if (this.currentTarget) {
      const targetRect = this.currentTarget.getBoundingClientRect();
      
      // Center horizontally on target
      posX = targetRect.left + (targetRect.width / 2) - (tooltipW / 2);
      
      // Position above target by default
      posY = targetRect.top - tooltipH - 10;

      // If overflowing above viewport, flip below target
      if (posY < pad) {
        posY = targetRect.bottom + 10;
      }
    }

    // Viewport horizontal clamping
    if (posX + tooltipW > window.innerWidth - pad) {
      posX = window.innerWidth - tooltipW - pad;
    }
    if (posX < pad) {
      posX = pad;
    }

    // Viewport vertical clamping
    if (posY + tooltipH > window.innerHeight - pad) {
      posY = window.innerHeight - tooltipH - pad;
    }
    if (posY < pad) {
      posY = pad;
    }

    this.container.style.transform = `translate3d(${Math.round(posX)}px, ${Math.round(posY)}px, 0)`;
  }

  public hide(immediate = false): void {
    if (!this.container) return;
    this.isVisible = false;
    this.currentTarget = null;
    if (immediate) {
      this.container.classList.add('closed');
    } else {
      this.container.classList.add('closed');
    }
  }
}
