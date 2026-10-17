/**
 * Aegean Classical Vector Icon System.
 * Provides scalable, themeable SVG icons inspired by Classical Aegean Antiquity,
 * Ancient Greek numismatics (Athenian tetradrachm), Olympic laurel wreaths,
 * the Antikythera mechanism, Doric columns, and Mediterranean maritime navigation.
 */

export type IconStyle = 'antiquity' | 'minimalist' | 'imperial' | 'emoji';

export interface IconThemeDef {
  id: IconStyle;
  name: string;
  desc: string;
  badge: string;
  primaryColor: string;
  accentColor: string;
}

export const ICON_THEMES: IconThemeDef[] = [
  {
    id: 'antiquity',
    name: 'Classical Antiquity',
    desc: 'Engraved ancient Greek motifs, bronze, terracotta & Olympian gold',
    badge: '🏛️ Antiquity',
    primaryColor: '#e0a96d',
    accentColor: '#f59e0b',
  },
  {
    id: 'minimalist',
    name: 'Minimalist Hellenic',
    desc: 'Crisp geometric vector lines with Aegean azure and Cycladic white',
    badge: '✨ Hellenic',
    primaryColor: '#38bdf8',
    accentColor: '#e0f2fe',
  },
  {
    id: 'imperial',
    name: 'Imperial Athenian',
    desc: 'High-contrast radiant polished gold with deep obsidian luster',
    badge: '👑 Imperial',
    primaryColor: '#fbbf24',
    accentColor: '#fef08a',
  },
  {
    id: 'emoji',
    name: 'Standard Emojis',
    desc: 'Default system OS emojis',
    badge: '😀 Emojis',
    primaryColor: '#cbd5e1',
    accentColor: '#94a3b8',
  },
];

export const STORAGE_KEY_ICON_STYLE = 'aegean_icon_style_v1';

/**
 * Returns raw SVG string for a given icon name and style
 */
export function getIconSvg(name: string, style: IconStyle = 'antiquity', size = 22): string {
  if (style === 'emoji') {
    return getFallbackEmoji(name);
  }

  const s = size;

  switch (name) {
    case 'treasury':
    case 'drachma':
    case 'coin':
      // Classical Athenian Owl (Glaux) Tetradrachm Numismatic Coin
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-drachma antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="drachma-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="50%" stop-color="#d97706"/>
                <stop offset="100%" stop-color="#92400e"/>
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#drachma-grad)" stroke-width="2" fill="#24180d"/>
            <circle cx="12" cy="12" r="8.2" stroke="#b45309" stroke-width="0.7" stroke-dasharray="1.5 1.5"/>
            <!-- Classical Athenian Owl Body & Eyes -->
            <ellipse cx="12" cy="13.2" rx="3.5" ry="4.5" fill="url(#drachma-grad)"/>
            <circle cx="10.2" cy="10.5" r="1.8" fill="#fef3c7" stroke="#78350f" stroke-width="0.8"/>
            <circle cx="13.8" cy="10.5" r="1.8" fill="#fef3c7" stroke="#78350f" stroke-width="0.8"/>
            <circle cx="10.2" cy="10.5" r="0.8" fill="#78350f"/>
            <circle cx="13.8" cy="10.5" r="0.8" fill="#78350f"/>
            <!-- Beak & Olive Sprig -->
            <polygon points="12,11.8 11.2,13.2 12.8,13.2" fill="#fde68a"/>
            <!-- Olive sprig on left (symbol of Athena) -->
            <path d="M6.5 7.5C7.2 9 6.8 11 5.5 12" stroke="#a3e635" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="5.6" cy="8.2" r="1" fill="#84cc16"/>
            <!-- Greek Letters A-TH-E (Athenian inscription) -->
            <text x="16.5" y="14" font-family="'Outfit', serif" font-size="4.2" font-weight="bold" fill="#fde68a" text-anchor="middle">ΑΘΕ</text>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-drachma minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9.5" stroke="#38bdf8" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="7.5" stroke="#0284c7" stroke-width="0.8" stroke-dasharray="2 1.5"/>
            <path d="M9 10C9 8.3 10.3 7 12 7C13.7 7 15 8.3 15 10C15 11.5 13.5 12.5 12 13V15.5" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="17.8" r="0.9" fill="#38bdf8"/>
          </svg>
        `;
      } else {
        // Imperial Gold
        return `
          <svg class="aegean-icon icon-drachma imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9.5" stroke="#f59e0b" stroke-width="2" fill="#291e0a"/>
            <circle cx="12" cy="12" r="7" stroke="#fde68a" stroke-width="1"/>
            <path d="M12 5V19M8 9H16M8 15H16" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'trade-points':
    case 'tp':
    case 'laurel':
    case 'star':
      // Classical Olympic Laurel Wreath of Victory & Civic Honor
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-laurel antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="laurel-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#34d399"/>
                <stop offset="50%" stop-color="#059669"/>
                <stop offset="100%" stop-color="#047857"/>
              </linearGradient>
            </defs>
            <!-- Left Laurel Branch -->
            <path d="M11 20C7 19 4 14 5 8C5.5 6 6.5 4.5 7.5 3.5" stroke="url(#laurel-grad)" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="6" cy="6" rx="2" ry="1.2" transform="rotate(-35 6 6)" fill="#6ee7b7"/>
            <ellipse cx="4.5" cy="10" rx="2.2" ry="1.2" transform="rotate(-15 4.5 10)" fill="#34d399"/>
            <ellipse cx="5.2" cy="14" rx="2.2" ry="1.2" transform="rotate(15 5.2 14)" fill="#10b981"/>
            <ellipse cx="7.5" cy="17.5" rx="2" ry="1.2" transform="rotate(45 7.5 17.5)" fill="#059669"/>
            <!-- Right Laurel Branch -->
            <path d="M13 20C17 19 20 14 19 8C18.5 6 17.5 4.5 16.5 3.5" stroke="url(#laurel-grad)" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="18" cy="6" rx="2" ry="1.2" transform="rotate(35 18 6)" fill="#6ee7b7"/>
            <ellipse cx="19.5" cy="10" rx="2.2" ry="1.2" transform="rotate(15 19.5 10)" fill="#34d399"/>
            <ellipse cx="18.8" cy="14" rx="2.2" ry="1.2" transform="rotate(-15 18.8 14)" fill="#10b981"/>
            <ellipse cx="16.5" cy="17.5" rx="2" ry="1.2" transform="rotate(-45 16.5 17.5)" fill="#059669"/>
            <!-- Ribbon Knot & Hellenic Star -->
            <path d="M10 20C11 21 13 21 14 20" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            <polygon points="12,7 13.5,11 17.5,11.5 14.5,14 15.5,18 12,16 8.5,18 9.5,14 6.5,11.5 10.5,11" fill="#f59e0b" stroke="#78350f" stroke-width="0.6"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-laurel minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 15,8.5 22,9.5 17,14.5 18.5,21.5 12,18 5.5,21.5 7,14.5 2,9.5 9,8.5" stroke="#38bdf8" stroke-width="1.8" fill="rgba(56, 189, 248, 0.15)"/>
            <circle cx="12" cy="12" r="3" stroke="#e0f2fe" stroke-width="1.2"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-laurel imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 15,8.5 22,9.5 17,14.5 18.5,21.5 12,18 5.5,21.5 7,14.5 2,9.5 9,8.5" fill="#f59e0b" stroke="#fef08a" stroke-width="1"/>
          </svg>
        `;
      }

    case 'archipelago':
    case 'islands':
      // Aegean Archipelago & Greek Trireme Galley
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-archipelago antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Aegean Waves -->
            <path d="M2 19C4 18 6 18 8 19C10 20 12 20 14 19C16 18 18 18 20 19C21 19.5 22 19.5 23 19" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M3 21C5 20.5 7 20.5 9 21C11 21.5 13 21.5 15 21C17 20.5 19 20.5 21 21" stroke="#0284c7" stroke-width="1.2" stroke-linecap="round"/>
            <!-- Volcanic Cyclades Islands Silhouette -->
            <path d="M3 17C4.5 14 7 13 8.5 15C9.5 13.5 11 14 12 17" fill="#b45309" stroke="#d97706" stroke-width="0.8"/>
            <path d="M13 17C14.5 12 17 11 18.5 14C19.5 13 20.5 14.5 21.5 17" fill="#78350f" stroke="#b45309" stroke-width="0.8"/>
            <!-- Classical Hellenic Trireme Ship -->
            <path d="M6 14C8 14 15 14 17 15C15 16 7 16 5 15C4.5 14.5 5 14 6 14Z" fill="#e0a96d" stroke="#92400e" stroke-width="0.8"/>
            <line x1="11" y1="9" x2="11" y2="14" stroke="#92400e" stroke-width="1.2"/>
            <path d="M11 9.5C13 9 14.5 10 14 13C12.5 13 11.5 12.5 11 12" fill="#fef3c7" stroke="#b45309" stroke-width="0.6"/>
            <!-- Stylized Sun over Aegean -->
            <circle cx="10" cy="5" r="2" fill="#fbbf24" stroke="#f59e0b" stroke-width="0.6"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-archipelago minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 18C6 17 9 19 12 18C15 17 18 19 21 18" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M4 14C6 10 9 11 11 14" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M13 14C15 8 18 9 20 14" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="8" cy="6" r="2.5" stroke="#38bdf8" stroke-width="1.5"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-archipelago imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 19C5 18 8 19 12 18C16 17 19 19 22 18" stroke="#f59e0b" stroke-width="2"/>
            <path d="M4 15C6 11 9 12 11 15" fill="#f59e0b"/>
            <path d="M13 15C15 9 18 10 20 15" fill="#fbbf24"/>
          </svg>
        `;
      }

    case 'settings':
    case 'gear':
      // The Ancient Antikythera Mechanism Astronomical Cogwheel (Sleek Metallic Silver & Titanium Slate)
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-settings antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="antikythera-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#f1f5f9"/>
                <stop offset="50%" stop-color="#94a3b8"/>
                <stop offset="100%" stop-color="#475569"/>
              </linearGradient>
            </defs>
            <!-- Precision Silver Mechanical Gear Ring with 8 Centered Classical Teeth -->
            <path d="M10.8 1.9L13.2 1.9L14.1 4.5L15.8 5.2L18.3 4L20 5.7L18.8 8.2L19.5 9.9L22.1 10.8L22.1 13.2L19.5 14.1L18.8 15.8L20 18.3L18.3 20L15.8 18.8L14.1 19.5L13.2 22.1L10.8 22.1L9.9 19.5L8.2 18.8L5.7 20L4 18.3L5.2 15.8L4.5 14.1L1.9 13.2L1.9 10.8L4.5 9.9L5.2 8.2L4 5.7L5.7 4L8.2 5.2L9.9 4.5Z" fill="url(#antikythera-grad)" stroke="#f1f5f9" stroke-width="0.8"/>
            <!-- Inner Metallic Hub with 4-Spoke Hellenic Cross -->
            <circle cx="12" cy="12" r="5.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
            <line x1="12" y1="6.8" x2="12" y2="17.2" stroke="#e2e8f0" stroke-width="1.3"/>
            <line x1="6.8" y1="12" x2="17.2" y2="12" stroke="#e2e8f0" stroke-width="1.3"/>
            <circle cx="12" cy="12" r="2.3" fill="#f8fafc" stroke="#475569" stroke-width="0.8"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-settings minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3.5" stroke="#38bdf8" stroke-width="2"/>
            <path d="M19.4 15A2 2 0 0 0 20 17.5L20.3 17.8A2 2 0 0 1 18.9 21.2L18.5 21.1A2 2 0 0 0 16 21.8L15.6 22.3A2 2 0 0 1 12.2 21.4L12.1 21A2 2 0 0 0 10.2 19.4H9.6A2 2 0 0 0 7.7 21L7.6 21.4A2 2 0 0 1 4.2 20.5L4.5 20.1A2 2 0 0 0 4 17.6L3.7 17.3A2 2 0 0 1 5.1 13.9L5.5 14A2 2 0 0 0 8 13.3L8.4 12.8A2 2 0 0 1 11.8 13.7L11.9 14.1A2 2 0 0 0 13.8 15.7H14.4A2 2 0 0 0 16.3 14.1L16.4 13.7A2 2 0 0 1 19.8 14.6L19.5 15Z" stroke="#e0f2fe" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-settings imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="#94a3b8" stroke-width="1.8" fill="#0f172a"/>
            <circle cx="12" cy="12" r="4" fill="#cbd5e1"/>
            <path d="M12 3V21M3 12H21M5.6 5.6L18.4 18.4M5.6 18.4L18.4 5.6" stroke="#f8fafc" stroke-width="1.2"/>
          </svg>
        `;
      }

    case 'pause':
      // Classical Fluted Doric Columns Pause Glyph
      return `
        <svg class="aegean-icon icon-pause" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Left Doric Column -->
          <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#92400e'}" stroke-width="1"/>
          <line x1="8.2" y1="7" x2="8.2" y2="17" stroke="${style === 'minimalist' ? '#0284c7' : '#fde68a'}" stroke-width="0.8"/>
          <rect x="5" y="4" width="6.5" height="1.8" rx="0.5" fill="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}"/>
          <rect x="5" y="18.2" width="6.5" height="1.8" rx="0.5" fill="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}"/>
          <!-- Right Doric Column -->
          <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#92400e'}" stroke-width="1"/>
          <line x1="15.7" y1="7" x2="15.7" y2="17" stroke="${style === 'minimalist' ? '#0284c7' : '#fde68a'}" stroke-width="0.8"/>
          <rect x="12.5" y="4" width="6.5" height="1.8" rx="0.5" fill="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}"/>
          <rect x="12.5" y="18.2" width="6.5" height="1.8" rx="0.5" fill="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}"/>
        </svg>
      `;

    case 'play':
    case 'speed-1x':
      // Classical Spearhead / Arrow of Apollo
      return `
        <svg class="aegean-icon icon-play" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="7,4 19,12 7,20" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.6" stroke-linejoin="round"/>
          <line x1="7" y1="12" x2="16" y2="12" stroke="${style === 'minimalist' ? '#0369a1' : '#78350f'}" stroke-width="1"/>
        </svg>
      `;

    case 'speed-4x':
    case 'fastForward':
      // Dual Hellenic Spearheads
      return `
        <svg class="aegean-icon icon-fast" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="5,5 13,12 5,19" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.4" stroke-linejoin="round"/>
          <polygon points="12,5 20,12 12,19" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
      `;

    case 'speed-16x':
    case 'ultraForward':
      // Winged Sandals of Hermes / Triple Spearheads
      return `
        <svg class="aegean-icon icon-ultra" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="4,6 10,12 4,18" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.2" stroke-linejoin="round"/>
          <polygon points="9,6 15,12 9,18" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.2" stroke-linejoin="round"/>
          <polygon points="14,6 20,12 14,18" fill="${style === 'minimalist' ? '#38bdf8' : '#e0a96d'}" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      `;

    case 'dem':
    case 'mountain':
      // Mount Olympus / Mount Ida Elevation Peak
      return `
        <svg class="aegean-icon icon-dem" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 20L9 8L13 14L16 10L22 20H2Z" fill="${style === 'minimalist' ? 'rgba(56, 189, 248, 0.2)' : '#453828'}" stroke="${style === 'minimalist' ? '#38bdf8' : '#d97706'}" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M9 8L11 11.5L9.5 13L8 11.5L9 8Z" fill="#f8fafc"/>
          <path d="M16 10L17.5 12.5L16.5 13.5L15 12.5L16 10Z" fill="#f8fafc"/>
          <line x1="4" y1="20" x2="20" y2="20" stroke="${style === 'minimalist' ? '#e0f2fe' : '#f59e0b'}" stroke-width="1.5"/>
        </svg>
      `;

    case 'night':
    case 'moon':
      // Radiant Selene Crescent Moon & Celestial Stars
      return `
        <svg class="aegean-icon icon-night" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.8C20 17.5 15.5 21 10.5 21C5.2 21 1 16.8 1 11.5C1 6.5 4.5 2 9.2 1C8.2 2.8 7.8 4.8 7.8 7C7.8 12 11.8 16 16.8 16C18.2 16 19.8 15.5 21 12.8Z" fill="${style === 'minimalist' ? 'rgba(56, 189, 248, 0.25)' : '#1e293b'}" stroke="${style === 'minimalist' ? '#38bdf8' : '#93c5fd'}" stroke-width="1.6"/>
          <circle cx="16" cy="5" r="1.2" fill="#fef08a"/>
          <circle cx="19" cy="9" r="0.8" fill="#fef08a"/>
        </svg>
      `;

    case 'day':
    case 'sun':
      // Radiant Helios Solar Disc
      return `
        <svg class="aegean-icon icon-day" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4.5" fill="#f59e0b" stroke="#fde68a" stroke-width="1.2"/>
          <path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7.1 7.1M16.9 16.9L19.1 19.1M4.9 19.1L7.1 16.9M16.9 7.1L19.1 4.9" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      `;

    case 'wake':
    case 'wave':
      // Hydrodynamic Seafoam & Aegean Wave Crests
      return `
        <svg class="aegean-icon icon-wake" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 15C5 12 8 18 12 15C16 12 19 18 22 15" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
          <path d="M2 10C5 7 8 13 12 10C16 7 19 13 22 10" stroke="#bae6fd" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M5 19C8 17 11 21 14 19C17 17 20 21 22 19" stroke="#0284c7" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      `;

    case 'amphora':
    case 'cargo':
      // Classical Greek Terracotta Amphora Vase
      return `
        <svg class="aegean-icon icon-amphora" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3H15M10 3V6C8 7 6 9 6 12C6 16 9 19 10 21H14C15 19 18 16 18 12C18 9 16 7 14 6V3" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round" fill="rgba(234, 88, 12, 0.25)"/>
          <!-- Handles -->
          <path d="M6 9C4 9 4 13 6 13M18 9C20 9 20 13 18 13" stroke="#f97316" stroke-width="1.4" stroke-linecap="round"/>
          <!-- Classical Meander Line -->
          <line x1="8" y1="12" x2="16" y2="12" stroke="#fed7aa" stroke-width="1" stroke-dasharray="1.5 1"/>
        </svg>
      `;

    case 'fleet':
    case 'temple':
    case 'parthenon':
      // Classical Hellenic Temple / Parthenon of Athena
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-temple antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="temple-marble-${s}" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="60%" stop-color="#e2e8f0"/>
                <stop offset="100%" stop-color="#cbd5e1"/>
              </linearGradient>
              <linearGradient id="temple-gold-${s}" x1="4" y1="3" x2="20" y2="10" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#fde68a"/>
                <stop offset="50%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#d97706"/>
              </linearGradient>
            </defs>
            <!-- Triangular Pediment / Gable Roof -->
            <polygon points="12,2.2 1.5,7.8 22.5,7.8" fill="url(#temple-marble-${s})" stroke="#94a3b8" stroke-width="0.8"/>
            <polygon points="12,3.8 3.8,7.2 20.2,7.2" fill="#1e293b" opacity="0.35"/>
            <!-- Acroterion Apex Finial -->
            <circle cx="12" cy="1.9" r="1.1" fill="url(#temple-gold-${s})"/>
            <!-- Entablature & Architrave Frieze Beam -->
            <rect x="1.5" y="7.8" width="21" height="2" rx="0.4" fill="url(#temple-gold-${s})" stroke="#b45309" stroke-width="0.6"/>
            <!-- 4 Classical Fluted Columns -->
            <rect x="3.2" y="9.8" width="2.8" height="8.6" rx="0.4" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.7"/>
            <rect x="8.0" y="9.8" width="2.8" height="8.6" rx="0.4" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.7"/>
            <rect x="13.2" y="9.8" width="2.8" height="8.6" rx="0.4" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.7"/>
            <rect x="18.0" y="9.8" width="2.8" height="8.6" rx="0.4" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.7"/>
            <!-- Column Capitals -->
            <rect x="2.5" y="9.8" width="4.2" height="0.9" rx="0.3" fill="#cbd5e1"/>
            <rect x="7.3" y="9.8" width="4.2" height="0.9" rx="0.3" fill="#cbd5e1"/>
            <rect x="12.5" y="9.8" width="4.2" height="0.9" rx="0.3" fill="#cbd5e1"/>
            <rect x="17.3" y="9.8" width="4.2" height="0.9" rx="0.3" fill="#cbd5e1"/>
            <!-- Stepped Stylobate Plinth Base -->
            <rect x="2" y="18.4" width="20" height="1.6" rx="0.3" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.6"/>
            <rect x="1" y="20.0" width="22" height="1.8" rx="0.3" fill="#cbd5e1" stroke="#64748b" stroke-width="0.6"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-temple minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2.5 2,7.5 22,7.5" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)"/>
            <rect x="2" y="7.5" width="20" height="2" stroke="#38bdf8" stroke-width="1.2"/>
            <line x1="4.5" y1="9.5" x2="4.5" y2="19" stroke="#e0f2fe" stroke-width="1.6"/>
            <line x1="9.5" y1="9.5" x2="9.5" y2="19" stroke="#e0f2fe" stroke-width="1.6"/>
            <line x1="14.5" y1="9.5" x2="14.5" y2="19" stroke="#e0f2fe" stroke-width="1.6"/>
            <line x1="19.5" y1="9.5" x2="19.5" y2="19" stroke="#e0f2fe" stroke-width="1.6"/>
            <rect x="1" y="19" width="22" height="3" stroke="#38bdf8" stroke-width="1.4" rx="0.5"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-temple imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 1.5,7.5 22.5,7.5" fill="#f59e0b" stroke="#fde68a" stroke-width="1.2"/>
            <rect x="1.5" y="7.5" width="21" height="2" fill="#fbbf24" stroke="#d97706" stroke-width="0.8"/>
            <rect x="3.5" y="9.5" width="2.6" height="9" fill="#fde68a" stroke="#d97706" stroke-width="0.8"/>
            <rect x="8.5" y="9.5" width="2.6" height="9" fill="#fde68a" stroke="#d97706" stroke-width="0.8"/>
            <rect x="13.2" y="9.5" width="2.6" height="9" fill="#fde68a" stroke="#d97706" stroke-width="0.8"/>
            <rect x="18" y="9.5" width="2.6" height="9" fill="#fde68a" stroke="#d97706" stroke-width="0.8"/>
            <rect x="1" y="18.5" width="22" height="3.5" fill="#f59e0b" stroke="#fde68a" stroke-width="1"/>
          </svg>
        `;
      }

    case 'ship':
    case 'boat':
    case 'kaiki':
    case 'fishing_boat':
    case 'vessel':
    case 'tier-1':
      // Tier 1: Traditional Wooden Kaiki Sailing Boat
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-vessel icon-kaiki antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="kaiki-hull-${s}" x1="2" y1="12" x2="22" y2="18" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#d97706"/>
                <stop offset="40%" stop-color="#b45309"/>
                <stop offset="100%" stop-color="#78350f"/>
              </linearGradient>
              <linearGradient id="kaiki-sail-main-${s}" x1="11" y1="3" x2="20" y2="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="35%" stop-color="#fef3c7"/>
                <stop offset="80%" stop-color="#fde68a"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
              <linearGradient id="kaiki-sail-jib-${s}" x1="4" y1="5" x2="11" y2="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="50%" stop-color="#fef3c7"/>
                <stop offset="100%" stop-color="#fcd34d"/>
              </linearGradient>
            </defs>
            <!-- Mast & Shrouds -->
            <line x1="11.5" y1="2.5" x2="11.5" y2="16.5" stroke="#78350f" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="11.5" y1="3" x2="3.8" y2="14.8" stroke="#92400e" stroke-width="0.5" stroke-dasharray="1.2 0.8" opacity="0.6"/>
            <line x1="11.5" y1="3" x2="20.5" y2="14.8" stroke="#92400e" stroke-width="0.5" stroke-dasharray="1.2 0.8" opacity="0.6"/>
            <!-- Masthead Golden Pennant -->
            <polygon points="11.5,2.5 15,3.6 11.5,4.8" fill="#f59e0b"/>
            <!-- Billowing Main Lug Sail -->
            <path d="M12.2 3.8C15 6 18.8 9.5 18.6 14.2C16.8 14.5 13.8 14.3 12.2 14Z" fill="url(#kaiki-sail-main-${s})" stroke="#b45309" stroke-width="0.75" stroke-linejoin="round"/>
            <path d="M12.2 8C14.5 9.8 16.5 11.8 17.2 14.2" stroke="#d97706" stroke-width="0.5" opacity="0.5"/>
            <!-- Fore Jib Staysail -->
            <path d="M10.8 5C9 8 5.5 12 4.2 14C6.5 14.1 9.5 13.9 10.8 13.7Z" fill="url(#kaiki-sail-jib-${s})" stroke="#b45309" stroke-width="0.7" stroke-linejoin="round"/>
            <!-- Traditional Wooden Kaiki Hull -->
            <path d="M2.5 14.2C3.8 17.5 7.5 19.2 12.5 19C17 18.8 20.8 16.8 22.5 14.2C19.5 15.2 14.5 15.5 2.5 14.2Z" fill="url(#kaiki-hull-${s})" stroke="#d97706" stroke-width="0.9" stroke-linejoin="round"/>
            <path d="M2.8 14.5C8 15.5 15 15.5 22.2 14.5" stroke="#fbbf24" stroke-width="0.7"/>
            <!-- Mati / Greek Eye of Protection on Prow -->
            <circle cx="20.5" cy="15.2" r="0.75" fill="#38bdf8" stroke="#ffffff" stroke-width="0.4"/>
            <!-- Aegean Waterline Wave Crest -->
            <path d="M1 18.8C3.5 17.8 6 19.4 9 18.6C12 17.8 15 19.2 18 18.4C20.5 17.8 22.5 18.6 23.5 18.2" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-vessel icon-kaiki minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="11.5" y1="3" x2="11.5" y2="16" stroke="#38bdf8" stroke-width="1.5"/>
            <path d="M12.5 4.5L18.5 14H12.5V4.5Z" stroke="#e0f2fe" stroke-width="1.3" fill="rgba(56, 189, 248, 0.25)"/>
            <path d="M10.5 6L5 14H10.5V6Z" stroke="#38bdf8" stroke-width="1.2" fill="rgba(56, 189, 248, 0.15)"/>
            <path d="M2.5 14.5C4 18.5 8 19 12 19C16 19 20 18.5 22.5 14.5H2.5Z" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.3)"/>
            <path d="M1 19.5C5 18.5 8 20.5 12 19.5C16 18.5 19 20.5 23 19.5" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-vessel icon-kaiki imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="11.5" y1="2.5" x2="11.5" y2="16" stroke="#f59e0b" stroke-width="1.8"/>
            <polygon points="11.5,2.5 15,3.6 11.5,4.8" fill="#fef08a"/>
            <path d="M12.5 4.5C15.5 7 18.5 10 18.5 14H12.5V4.5Z" fill="#fbbf24" stroke="#fef08a" stroke-width="1"/>
            <path d="M10.5 6L5 14H10.5V6Z" fill="#d97706" stroke="#fbbf24" stroke-width="0.9"/>
            <path d="M2.5 14.5C4 18.5 8 19 12 19C16 19 20 18.5 22.5 14.5Z" fill="#78350f" stroke="#fbbf24" stroke-width="1.5"/>
            <path d="M1 19.5C5 18.5 8 20.5 12 19.5C16 18.5 19 20.5 23 19.5" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'caique':
    case 'tier-2':
      // Tier 2: Aegean Motorized Cargo Caique (Two-Masted Schooner)
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-vessel icon-caique antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="caique-hull-${s}" x1="2" y1="12" x2="22" y2="19" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#b45309"/>
                <stop offset="60%" stop-color="#78350f"/>
                <stop offset="100%" stop-color="#451a03"/>
              </linearGradient>
            </defs>
            <!-- Bowsprit -->
            <line x1="20" y1="14" x2="23.5" y2="12.5" stroke="#d97706" stroke-width="1.2" stroke-linecap="round"/>
            <!-- Dual Masts -->
            <line x1="9" y1="3.5" x2="9" y2="15.5" stroke="#78350f" stroke-width="1.3"/>
            <line x1="16" y1="4.5" x2="16" y2="15.5" stroke="#78350f" stroke-width="1.3"/>
            <!-- Foremast & Mainmast Sails -->
            <path d="M9.5 4.5L14.5 13.5H9.5V4.5Z" fill="#fef3c7" stroke="#b45309" stroke-width="0.75"/>
            <path d="M16.5 5.5L20.5 13.5H16.5V5.5Z" fill="#fde68a" stroke="#b45309" stroke-width="0.75"/>
            <path d="M8.5 6.5L4.5 13.5H8.5V6.5Z" fill="#fef3c7" stroke="#b45309" stroke-width="0.7"/>
            <!-- Aft Pilot House / Cabin -->
            <rect x="3.5" y="11.5" width="4" height="3" rx="0.5" fill="#f59e0b" stroke="#78350f" stroke-width="0.7"/>
            <rect x="4.2" y="12.2" width="1.2" height="1.2" fill="#38bdf8"/>
            <!-- Robust Wooden Hull -->
            <path d="M1.5 14C3 17.5 7 19.5 12.5 19.5C18 19.5 21.5 17 22.5 13.5C19 14.8 13.5 15.2 1.5 14Z" fill="url(#caique-hull-${s})" stroke="#d97706" stroke-width="0.9"/>
            <path d="M1 18.5C4 17.5 7 19.5 11 18.5C15 17.5 19 19 23 18" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-vessel icon-caique minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="9" y1="4" x2="9" y2="15" stroke="#38bdf8" stroke-width="1.4"/>
            <line x1="16" y1="5" x2="16" y2="15" stroke="#38bdf8" stroke-width="1.4"/>
            <path d="M9.5 5L14.5 13.5H9.5V5Z" stroke="#e0f2fe" stroke-width="1" fill="rgba(56, 189, 248, 0.2)"/>
            <path d="M16.5 6L20.5 13.5H16.5V6Z" stroke="#e0f2fe" stroke-width="1" fill="rgba(56, 189, 248, 0.2)"/>
            <path d="M1.5 14C3 18 7 19 12 19C17 19 21 17.5 22.5 14H1.5Z" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.25)"/>
            <path d="M1 19C5 18 8 20 12 19C16 18 19 20 23 19" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-vessel icon-caique imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="9" y1="3.5" x2="9" y2="15" stroke="#f59e0b" stroke-width="1.6"/>
            <line x1="16" y1="4.5" x2="16" y2="15" stroke="#f59e0b" stroke-width="1.6"/>
            <polygon points="9.5,4.5 14.5,13.5 9.5,13.5" fill="#fbbf24" stroke="#fef08a" stroke-width="0.8"/>
            <polygon points="16.5,5.5 20.5,13.5 16.5,13.5" fill="#f59e0b" stroke="#fef08a" stroke-width="0.8"/>
            <path d="M1.5 14C3 18 7 19.5 12 19.5C17 19.5 21 17.5 22.5 14Z" fill="#78350f" stroke="#fbbf24" stroke-width="1.6"/>
            <path d="M1 19C5 18 8 20 12 19C16 18 19 20 23 19" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'ferry':
    case 'tier-3':
      // Tier 3: Island Passenger Ferry
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-vessel icon-ferry antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ferry-hull-${s}" x1="2" y1="13" x2="22" y2="19" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#0284c7"/>
                <stop offset="50%" stop-color="#0369a1"/>
                <stop offset="100%" stop-color="#075985"/>
              </linearGradient>
            </defs>
            <!-- Radar Mast -->
            <line x1="15" y1="2.5" x2="15" y2="6.5" stroke="#f59e0b" stroke-width="1.2"/>
            <circle cx="15" cy="2.5" r="1" fill="#fbbf24"/>
            <!-- Multi-Deck White Superstructure -->
            <path d="M5 8.5H16.5L18.5 12.5H4L5 8.5Z" fill="#ffffff" stroke="#94a3b8" stroke-width="0.7"/>
            <path d="M6.5 6.5H14L15 8.5H6L6.5 6.5Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.6"/>
            <!-- Funnel / Exhaust Stack -->
            <polygon points="8.5,4.5 10.5,4.5 10,7 8.8,7" fill="#ea580c" stroke="#c2410c" stroke-width="0.5"/>
            <!-- Passenger Observation Windows -->
            <line x1="6" y1="10.5" x2="16.5" y2="10.5" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="1.5 1"/>
            <!-- Cycladic Blue Streamlined Hull -->
            <path d="M2 12.8L3 18C7 19.5 14 19.5 22.5 15.5L21.5 12.8H2Z" fill="url(#ferry-hull-${s})" stroke="#38bdf8" stroke-width="0.8"/>
            <path d="M2.5 14H21" stroke="#ffffff" stroke-width="0.6" opacity="0.8"/>
            <path d="M1 18.5C4 17.5 7 19.5 11 18.5C15 17.5 19 19 23 18" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-vessel icon-ferry minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="14" y1="3" x2="14" y2="7" stroke="#38bdf8" stroke-width="1.2"/>
            <path d="M5 7H15L17 12H4L5 7Z" stroke="#e0f2fe" stroke-width="1.2" fill="rgba(224, 242, 254, 0.2)"/>
            <path d="M2 12.5L3.5 17.5C8 19 15 19 22 15L21 12.5H2Z" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.3)"/>
            <path d="M1 18.5C5 17.5 8 19.5 12 18.5C16 17.5 19 19 23 18" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-vessel icon-ferry imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 7H15L17 12H4L5 7Z" fill="#fde68a" stroke="#f59e0b" stroke-width="0.8"/>
            <path d="M2 12.5L3.5 18C8 19.5 15 19.5 22 15.5L21 12.5H2Z" fill="#1e293b" stroke="#fbbf24" stroke-width="1.5"/>
            <path d="M3 14.5H20.5" stroke="#fbbf24" stroke-width="1"/>
            <path d="M1 18.5C5 17.5 8 19.5 12 18.5C16 17.5 19 19 23 18" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'freighter':
    case 'cargo_ship':
    case 'cargo-ship':
    case 'tier-4':
      // Tier 4: Heavy Bulk Merchant Freighter
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-vessel icon-freighter antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="freight-hull-${s}" x1="1" y1="13" x2="23" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#991b1b"/>
                <stop offset="45%" stop-color="#7f1d1d"/>
                <stop offset="100%" stop-color="#450a0a"/>
              </linearGradient>
            </defs>
            <!-- Aft Navigation Bridge & Funnel -->
            <rect x="3" y="7" width="4.5" height="6.5" rx="0.4" fill="#ffffff" stroke="#94a3b8" stroke-width="0.6"/>
            <polygon points="4.2,4.5 5.8,4.5 5.5,7 4.5,7" fill="#ea580c"/>
            <line x1="5" y1="2" x2="5" y2="4.5" stroke="#f59e0b" stroke-width="1.2"/>
            <!-- Tiered Cargo Containers -->
            <rect x="8.5" y="9.5" width="3.2" height="3.5" rx="0.3" fill="#d97706" stroke="#92400e" stroke-width="0.5"/>
            <rect x="12" y="9.5" width="3.2" height="3.5" rx="0.3" fill="#0284c7" stroke="#0369a1" stroke-width="0.5"/>
            <rect x="15.5" y="9.5" width="3.2" height="3.5" rx="0.3" fill="#16a34a" stroke="#15803d" stroke-width="0.5"/>
            <rect x="10" y="6.8" width="3.2" height="2.7" rx="0.3" fill="#ea580c" stroke="#c2410c" stroke-width="0.5"/>
            <rect x="13.5" y="6.8" width="3.2" height="2.7" rx="0.3" fill="#eab308" stroke="#ca8a04" stroke-width="0.5"/>
            <!-- Heavy Merchant Steel Hull -->
            <path d="M1.5 13.5L2.5 18C7 19.5 16 19.5 22.5 15.5L22 13.5H1.5Z" fill="url(#freight-hull-${s})" stroke="#ef4444" stroke-width="0.8"/>
            <line x1="2" y1="15.2" x2="21.5" y2="15.2" stroke="#fbbf24" stroke-width="0.6"/>
            <path d="M1 18.5C4 17.5 7 19.5 11 18.5C15 17.5 19 19 23 18" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-vessel icon-freighter minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="7" width="4" height="6" stroke="#e0f2fe" stroke-width="1" fill="rgba(224, 242, 254, 0.2)"/>
            <rect x="8" y="9" width="3.5" height="4" stroke="#38bdf8" stroke-width="0.8"/>
            <rect x="12" y="9" width="3.5" height="4" stroke="#38bdf8" stroke-width="0.8"/>
            <rect x="16" y="9" width="3.5" height="4" stroke="#38bdf8" stroke-width="0.8"/>
            <path d="M1.5 13H22L21.5 16C15 19 7 19 2.5 17L1.5 13Z" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.25)"/>
            <path d="M1 19C5 18 8 20 12 19C16 18 19 20 23 19" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-vessel icon-freighter imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="7" width="4" height="6" fill="#fde68a" stroke="#f59e0b" stroke-width="0.8"/>
            <rect x="8" y="9" width="3.2" height="4" fill="#fbbf24" stroke="#d97706" stroke-width="0.6"/>
            <rect x="12" y="9" width="3.2" height="4" fill="#f59e0b" stroke="#b45309" stroke-width="0.6"/>
            <rect x="16" y="9" width="3.2" height="4" fill="#d97706" stroke="#92400e" stroke-width="0.6"/>
            <path d="M1.5 13.5L2.5 18C7 19.5 16 19.5 22.5 15.5L22 13.5H1.5Z" fill="#291e0a" stroke="#fbbf24" stroke-width="1.5"/>
            <path d="M1 18.5C4 17.5 7 19.5 11 18.5C15 17.5 19 19 23 18" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'yacht':
    case 'charter_yacht':
    case 'luxury_yacht':
    case 'tier-5':
      // Tier 5: High-Speed Luxury Motor Yacht
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-vessel icon-yacht antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="yacht-hull-${s}" x1="2" y1="13" x2="22" y2="19" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="45%" stop-color="#f8fafc"/>
                <stop offset="100%" stop-color="#cbd5e1"/>
              </linearGradient>
            </defs>
            <!-- Swept-Back Radar Arch -->
            <path d="M11 6C12 4.5 14 4.5 15 6L14 8.5H10L11 6Z" fill="#fbbf24" stroke="#d97706" stroke-width="0.6"/>
            <!-- Tinted Wraparound Salon Bridge -->
            <path d="M5 10H16L19 13.5H4L5 10Z" fill="#0f172a" stroke="#94a3b8" stroke-width="0.6"/>
            <path d="M7 11.2H15.5L17.2 13H5.8L7 11.2Z" fill="#38bdf8" opacity="0.7"/>
            <!-- Aerodynamic Luxury White Hull -->
            <path d="M1.5 13.8L3 17.8C8 19 16 18.5 22.8 14.5L21 13.8H1.5Z" fill="url(#yacht-hull-${s})" stroke="#e2e8f0" stroke-width="0.8"/>
            <path d="M2.5 15H21.5" stroke="#fbbf24" stroke-width="0.8"/>
            <path d="M1 18.8C4 18 7 19.8 11 18.8C15 17.8 19 19.2 23 18.4" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-vessel icon-yacht minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 10H15L18 13.5H4.5L6 10Z" stroke="#e0f2fe" stroke-width="1.2" fill="rgba(224, 242, 254, 0.2)"/>
            <path d="M1.5 13.8L3 17.5C8 18.5 16 18 22.5 14.5L21 13.8H1.5Z" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.3)"/>
            <path d="M1 18.8C4 18 7 19.8 11 18.8C15 17.8 19 19.2 23 18.4" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-vessel icon-yacht imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 10H15L18 13.5H4.5L6 10Z" fill="#fde68a" stroke="#f59e0b" stroke-width="0.8"/>
            <path d="M1.5 13.8L3 18C8 19 16 18.5 22.5 14.5L21 13.8H1.5Z" fill="#1e293b" stroke="#fbbf24" stroke-width="1.6"/>
            <path d="M2.5 15.5H21.5" stroke="#fef08a" stroke-width="0.9"/>
            <path d="M1 18.8C4 18 7 19.8 11 18.8C15 17.8 19 19.2 23 18.4" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      }


    case 'follow':
    case 'camera':
      // Classical Astrolabe / Viewfinder
      return `
        <svg class="aegean-icon icon-follow" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" stroke="${style === 'minimalist' ? '#38bdf8' : '#f59e0b'}" stroke-width="1.6"/>
          <line x1="12" y1="2" x2="12" y2="6" stroke="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}" stroke-width="1.4"/>
          <line x1="12" y1="18" x2="12" y2="22" stroke="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}" stroke-width="1.4"/>
          <line x1="2" y1="12" x2="6" y2="12" stroke="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}" stroke-width="1.4"/>
          <line x1="18" y1="12" x2="22" y2="12" stroke="${style === 'minimalist' ? '#e0f2fe' : '#fbbf24'}" stroke-width="1.4"/>
          <circle cx="12" cy="12" r="2.5" fill="${style === 'minimalist' ? '#38bdf8' : '#f59e0b'}"/>
        </svg>
      `;

    case 'target':
    case 'bullseye':
      // Archon Navigation Target Ring
      return `
        <svg class="aegean-icon icon-target" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="#38bdf8" stroke-width="1.6"/>
          <circle cx="12" cy="12" r="5" stroke="#e0f2fe" stroke-width="1.4"/>
          <circle cx="12" cy="12" r="1.8" fill="#38bdf8"/>
        </svg>
      `;

    case 'wine':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-wine antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="wine-liquid-${s}" x1="6" y1="5" x2="18" y2="15" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#fb7185"/>
                <stop offset="50%" stop-color="#e11d48"/>
                <stop offset="100%" stop-color="#881337"/>
              </linearGradient>
              <linearGradient id="wine-chalice-${s}" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#92400e"/>
              </linearGradient>
            </defs>
            <!-- Dionysian Kylix Cup -->
            <path d="M5.5 5.5C5.5 11 8.5 14 12 14C15.5 14 18.5 11 18.5 5.5H5.5Z" fill="url(#wine-liquid-${s})" stroke="url(#wine-chalice-${s})" stroke-width="1.3"/>
            <path d="M7.5 7.5C9 9 15 9 16.5 7.5" stroke="#fecdd3" stroke-width="0.9" stroke-linecap="round"/>
            <!-- Stem and Base -->
            <line x1="12" y1="14" x2="12" y2="19.5" stroke="url(#wine-chalice-${s})" stroke-width="1.8"/>
            <ellipse cx="12" cy="20" rx="4.5" ry="1.2" fill="url(#wine-chalice-${s})"/>
            <!-- Vine tendril flourish -->
            <path d="M17.5 6C19 4.8 20.5 5.5 20 7C19.5 8.2 18.2 8.2 18 7.2" stroke="#a3e635" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-wine minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4.5C6 10 9 13.5 12 13.5C15 13.5 18 10 18 4.5H6Z" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)"/>
            <line x1="8" y1="7.5" x2="16" y2="7.5" stroke="#e0f2fe" stroke-width="1"/>
            <line x1="12" y1="13.5" x2="12" y2="19.5" stroke="#38bdf8" stroke-width="1.6"/>
            <line x1="8.5" y1="19.5" x2="15.5" y2="19.5" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-wine imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 5C5.5 11 8.5 14 12 14C15.5 14 18.5 11 18.5 5H5.5Z" fill="#991b1b" stroke="#f59e0b" stroke-width="1.6"/>
            <line x1="12" y1="14" x2="12" y2="19.5" stroke="#fbbf24" stroke-width="2"/>
            <ellipse cx="12" cy="19.5" rx="5" ry="1.5" fill="#f59e0b"/>
          </svg>
        `;
      }

    case 'water':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-water antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="water-grad-${s}" x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#bae6fd"/>
                <stop offset="45%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#0284c7"/>
              </linearGradient>
            </defs>
            <path d="M12 3C12 3 6 10.5 6 15C6 18.3 8.7 21 12 21C15.3 21 18 18.3 18 15C18 10.5 12 3 12 3Z" fill="url(#water-grad-${s})" stroke="#e0f2fe" stroke-width="1.2"/>
            <path d="M9.5 14.5C9.5 12.5 11 10 12 8.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="14" cy="16.5" r="1.2" fill="#e0f2fe" fill-opacity="0.85"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-water minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3.5C12 3.5 6.5 11 6.5 15.2C6.5 18.2 9 20.5 12 20.5C15 20.5 17.5 18.2 17.5 15.2C17.5 11 12 3.5 12 3.5Z" stroke="#38bdf8" stroke-width="1.8" fill="rgba(56, 189, 248, 0.2)"/>
            <path d="M10 13.5C10 12 11 10 12 8.5" stroke="#e0f2fe" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-water imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3.5C12 3.5 6.5 11 6.5 15.2C6.5 18.2 9 20.5 12 20.5C15 20.5 17.5 18.2 17.5 15.2C17.5 11 12 3.5 12 3.5Z" fill="#0284c7" stroke="#fbbf24" stroke-width="1.6"/>
            <path d="M10 13.5C10 12 11 10 12 8.5" stroke="#fef08a" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'crafts':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-crafts antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="crafts-pot-${s}" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ea580c"/>
                <stop offset="50%" stop-color="#c2410c"/>
                <stop offset="100%" stop-color="#7c2d12"/>
              </linearGradient>
            </defs>
            <!-- Classical Attic Pottery Amphora -->
            <path d="M9 3H15M10 3V6C7.5 7 5.5 9.5 5.5 13C5.5 17 8.5 20 10 21.5H14C15.5 20 18.5 17 18.5 13C18.5 9.5 16.5 7 14 6V3" stroke="#fed7aa" stroke-width="1.3" fill="url(#crafts-pot-${s})"/>
            <!-- Twin Handles -->
            <path d="M5.5 9C3.5 9 3.5 14 5.5 14M18.5 9C20.5 9 20.5 14 18.5 14" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>
            <!-- Greek Key meander band -->
            <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="#fef3c7" stroke-width="1.2" stroke-dasharray="1.5 1"/>
            <circle cx="12" cy="15.5" r="1.5" fill="#fde047"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-crafts minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3.5H15M10 3.5V6C7.5 7 6 9.5 6 13C6 17 8.5 20.5 10.5 21H13.5C15.5 20.5 18 17 18 13C18 9.5 16.5 7 14 6V3.5" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.15)"/>
            <path d="M6 9C4 9 4 14 6 14M18 9C20 9 20 14 18 14" stroke="#e0f2fe" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-crafts imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3H15M10 3V6C7 7 5.5 9.5 5.5 13C5.5 17 8.5 20.5 10 21.5H14C15.5 20.5 18.5 17 18.5 13C18.5 9.5 17 7 14 6V3" stroke="#fef08a" stroke-width="1.5" fill="#b45309"/>
            <path d="M5.5 9C3 9 3 14 5.5 14M18.5 9C21 9 21 14 18.5 14" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        `;
      }

    case 'produce':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-produce antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Grape Vine Stem & Leaf -->
            <path d="M12 2C12 4.5 13 6 14.5 6.5" stroke="#84cc16" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12 4C9.5 3 8 5 9 7.5C10 8 11.5 6.5 12 4Z" fill="#65a30d" stroke="#84cc16" stroke-width="0.8"/>
            <!-- Plump Dionysian Grapes -->
            <circle cx="10" cy="9" r="2.3" fill="#a855f7" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="14" cy="9" r="2.3" fill="#9333ea" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="8" cy="13" r="2.3" fill="#7e22ce" stroke="#581c87" stroke-width="0.8"/>
            <circle cx="12" cy="13" r="2.4" fill="#a855f7" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="16" cy="13" r="2.3" fill="#9333ea" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="10" cy="17" r="2.3" fill="#9333ea" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="14" cy="17" r="2.3" fill="#7e22ce" stroke="#581c87" stroke-width="0.8"/>
            <circle cx="12" cy="20.5" r="2.2" fill="#6b21a8" stroke="#4c1d95" stroke-width="0.8"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-produce minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.5V6" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="10" cy="9" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="14" cy="9" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="8" cy="13" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="12" cy="13" r="2.2" stroke="#e0f2fe" stroke-width="1.4" fill="rgba(56, 189, 248, 0.4)"/>
            <circle cx="16" cy="13" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="10" cy="17" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="14" cy="17" r="2.2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="12" cy="20.5" r="2" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.2)"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-produce imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.5V6" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            <circle cx="10" cy="9" r="2.2" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
            <circle cx="14" cy="9" r="2.2" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
            <circle cx="8" cy="13" r="2.2" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <circle cx="12" cy="13" r="2.2" fill="#fef08a" stroke="#d97706" stroke-width="1"/>
            <circle cx="16" cy="13" r="2.2" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <circle cx="10" cy="17" r="2.2" fill="#d97706" stroke="#92400e" stroke-width="1"/>
            <circle cx="14" cy="17" r="2.2" fill="#d97706" stroke="#92400e" stroke-width="1"/>
            <circle cx="12" cy="20.5" r="2" fill="#b45309" stroke="#78350f" stroke-width="1"/>
          </svg>
        `;
      }

    case 'fish':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-fish antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="fish-grad-${s}" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="70%" stop-color="#0284c7"/>
                <stop offset="100%" stop-color="#0369a1"/>
              </linearGradient>
            </defs>
            <!-- Akrotiri Minoan Sea Bream -->
            <path d="M2.5 12C5.5 8 13.5 7 19.5 12C13.5 17 5.5 16 2.5 12Z" fill="url(#fish-grad-${s})" stroke="#e0f2fe" stroke-width="1.2"/>
            <!-- Tail Fin -->
            <polygon points="19,12 23,8 21.5,12 23,16" fill="#38bdf8" stroke="#0284c7" stroke-width="0.8"/>
            <!-- Dorsal & Pectoral Fins -->
            <path d="M10 8C12 5.5 15 6.5 16 8.5" fill="#38bdf8" stroke="#0284c7" stroke-width="0.8"/>
            <path d="M8 13C10 14 11 15 10 16" stroke="#e0f2fe" stroke-width="1" stroke-linecap="round"/>
            <!-- Eye & Gill -->
            <circle cx="6" cy="11.5" r="1.4" fill="#fef3c7" stroke="#0284c7" stroke-width="0.7"/>
            <circle cx="5.8" cy="11.5" r="0.7" fill="#0f172a"/>
            <path d="M8 10C8.5 11.5 8.5 12.5 8 14" stroke="#bae6fd" stroke-width="1" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-fish minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12C6 8 14 7 19 12C14 17 6 16 3 12Z" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)"/>
            <polygon points="18.5,12 22,8.5 21,12 22,15.5" stroke="#38bdf8" stroke-width="1.4" fill="#38bdf8"/>
            <circle cx="6.5" cy="11.5" r="1" fill="#e0f2fe"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-fish imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12C6 8 14 7 19 12C14 17 6 16 3 12Z" fill="#f59e0b" stroke="#fef08a" stroke-width="1.5"/>
            <polygon points="18.5,12 22.5,8.5 21.5,12 22.5,15.5" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
            <circle cx="6.5" cy="11.5" r="1" fill="#1e1b4b"/>
          </svg>
        `;
      }

    case 'grain':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-grain antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Demeter's Barley Sheaf -->
            <path d="M12 22V7" stroke="#d97706" stroke-width="1.6" stroke-linecap="round"/>
            <ellipse cx="12" cy="5" rx="1.8" ry="3" fill="#fde047" stroke="#b45309" stroke-width="0.8"/>
            <!-- Staggered Wheat Grains -->
            <ellipse cx="9.5" cy="8" rx="1.6" ry="2.6" transform="rotate(-30 9.5 8)" fill="#fbbf24" stroke="#b45309" stroke-width="0.8"/>
            <ellipse cx="14.5" cy="8" rx="1.6" ry="2.6" transform="rotate(30 14.5 8)" fill="#fbbf24" stroke="#b45309" stroke-width="0.8"/>
            <ellipse cx="9" cy="12" rx="1.6" ry="2.6" transform="rotate(-30 9 12)" fill="#f59e0b" stroke="#b45309" stroke-width="0.8"/>
            <ellipse cx="15" cy="12" rx="1.6" ry="2.6" transform="rotate(30 15 12)" fill="#f59e0b" stroke="#b45309" stroke-width="0.8"/>
            <ellipse cx="9.5" cy="16" rx="1.5" ry="2.4" transform="rotate(-30 9.5 16)" fill="#d97706" stroke="#92400e" stroke-width="0.8"/>
            <ellipse cx="14.5" cy="16" rx="1.5" ry="2.4" transform="rotate(30 14.5 16)" fill="#d97706" stroke="#92400e" stroke-width="0.8"/>
            <!-- Ribbon knot -->
            <path d="M10 18.5C12 19.5 12 19.5 14 18.5" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-grain minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="12" y1="21" x2="12" y2="4" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 5C10 7 10 9 12 11C14 9 14 7 12 5Z" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.25)"/>
            <path d="M12 10C9.5 12 9.5 14 12 16C14.5 14 14.5 12 12 10Z" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.25)"/>
            <path d="M12 15C10 16.8 10 18.2 12 19.5C14 18.2 14 16.8 12 15Z" stroke="#e0f2fe" stroke-width="1.2"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-grain imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="12" y1="21" x2="12" y2="4" stroke="#fbbf24" stroke-width="2"/>
            <ellipse cx="12" cy="5" rx="2" ry="3" fill="#fde047" stroke="#b45309" stroke-width="1"/>
            <ellipse cx="9" cy="9" rx="1.8" ry="2.6" transform="rotate(-30 9 9)" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <ellipse cx="15" cy="9" rx="1.8" ry="2.6" transform="rotate(30 15 9)" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <ellipse cx="9" cy="14" rx="1.8" ry="2.6" transform="rotate(-30 9 14)" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <ellipse cx="15" cy="14" rx="1.8" ry="2.6" transform="rotate(30 15 14)" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
          </svg>
        `;
      }

    case 'cheese':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-cheese antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Cycladic Feta / Aged Graviera Wedge -->
            <polygon points="3,17 19,17 21,11 12,5" fill="#fef08a" stroke="#d97706" stroke-width="1.3" stroke-linejoin="round"/>
            <polygon points="3,17 12,5 5,9" fill="#fde047" stroke="#d97706" stroke-width="1.1" stroke-linejoin="round"/>
            <!-- Cheese Eyes / Pores -->
            <circle cx="12" cy="13.5" r="1.4" fill="#ca8a04"/>
            <circle cx="16" cy="14.5" r="1.1" fill="#ca8a04"/>
            <circle cx="14" cy="9.5" r="1" fill="#ca8a04"/>
            <circle cx="8" cy="13" r="0.9" fill="#ca8a04"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-cheese minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="4,18 20,18 21,11 12,6" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)" stroke-linejoin="round"/>
            <line x1="4" y1="18" x2="12" y2="6" stroke="#e0f2fe" stroke-width="1.4"/>
            <circle cx="13" cy="13.5" r="1.3" fill="#38bdf8"/>
            <circle cx="17" cy="14.5" r="1" fill="#38bdf8"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-cheese imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="3,17 19,17 21,11 12,5" fill="#facc15" stroke="#b45309" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="12" cy="13.5" r="1.4" fill="#92400e"/>
            <circle cx="16" cy="14.5" r="1.1" fill="#92400e"/>
          </svg>
        `;
      }

    case 'olive':
    case 'olive_oil':
    case 'olives':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-olive-oil antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Olive Branch -->
            <path d="M4 18C8 16 14 11 19 6" stroke="#65a30d" stroke-width="1.5" stroke-linecap="round"/>
            <!-- Olive Leaves -->
            <ellipse cx="8" cy="13" rx="2.5" ry="1.2" transform="rotate(-40 8 13)" fill="#a3e635" stroke="#4d7c0f" stroke-width="0.7"/>
            <ellipse cx="14" cy="9" rx="2.5" ry="1.2" transform="rotate(-30 14 9)" fill="#84cc16" stroke="#4d7c0f" stroke-width="0.7"/>
            <!-- Ripe Green & Kalamata Olives -->
            <ellipse cx="11" cy="16" rx="2.8" ry="3.5" transform="rotate(15 11 16)" fill="#65a30d" stroke="#365314" stroke-width="1"/>
            <ellipse cx="17" cy="12" rx="2.6" ry="3.3" transform="rotate(-15 17 12)" fill="#3f3f46" stroke="#18181b" stroke-width="1"/>
            <!-- Golden Oil Cruet Drop -->
            <circle cx="11.5" cy="14.5" r="0.8" fill="#fef08a"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-olive-oil minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 18C9 15 14 11 19 6" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
            <ellipse cx="11" cy="16" rx="2.8" ry="3.5" stroke="#38bdf8" stroke-width="1.4" fill="rgba(56, 189, 248, 0.25)"/>
            <ellipse cx="16.5" cy="12" rx="2.5" ry="3.2" stroke="#e0f2fe" stroke-width="1.4"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-olive-oil imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 18C9 15 14 11 19 6" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
            <ellipse cx="11" cy="16" rx="2.8" ry="3.5" fill="#f59e0b" stroke="#b45309" stroke-width="1.2"/>
            <ellipse cx="16.5" cy="12" rx="2.5" ry="3.2" fill="#fbbf24" stroke="#d97706" stroke-width="1.2"/>
          </svg>
        `;
      }

    case 'honey':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-honey antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Ancient Clay Honey Jar with Wooden Dipper -->
            <path d="M8 4H16M9 4V7C6.5 8 5 10.5 5 14C5 18 8 21 12 21C16 21 19 18 19 14C19 10.5 17.5 8 15 7V4" stroke="#b45309" stroke-width="1.6" fill="#f59e0b"/>
            <!-- Dripping Golden Wild Thyme Honey -->
            <path d="M9 10C9 12 11 13 12 13C13 13 15 12 15 10C15 8.5 13.5 7.5 12 7.5C10.5 7.5 9 8.5 9 10Z" fill="#fef08a" stroke="#d97706" stroke-width="0.8"/>
            <circle cx="12" cy="16" r="1.8" fill="#fef08a"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-honey minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,3 19,7 19,15 12,19 5,15 5,7" stroke="#38bdf8" stroke-width="1.5" fill="rgba(56, 189, 248, 0.2)"/>
            <path d="M12 7C10.5 9 9.5 11 9.5 12.5C9.5 14 10.6 15 12 15C13.4 15 14.5 14 14.5 12.5C14.5 11 13.5 9 12 7Z" stroke="#e0f2fe" stroke-width="1.3" fill="rgba(56, 189, 248, 0.5)"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-honey imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2.5 20,7 20,16 12,20.5 4,16 4,7" stroke="#fbbf24" stroke-width="1.8" fill="rgba(245, 158, 11, 0.35)"/>
            <path d="M12 6.5C10 9 8.5 11.5 8.5 13.5C8.5 15.5 10 17 12 17C14 17 15.5 15.5 15.5 13.5C15.5 11.5 14 9 12 6.5Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.2"/>
          </svg>
        `;
      }

    case 'marble':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-marble antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Classical Pentelic Marble Column Capital (Ionic/Doric) -->
            <rect x="4" y="4" width="16" height="3" rx="0.8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
            <ellipse cx="6" cy="7.5" rx="2" ry="1.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
            <ellipse cx="18" cy="7.5" rx="2" ry="1.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
            <!-- Fluted Shaft -->
            <path d="M6 8V18M9 8V18M12 8V18M15 8V18M18 8V18" stroke="#cbd5e1" stroke-width="1.2"/>
            <rect x="5.5" y="8" width="13" height="10" fill="#f1f5f9" fill-opacity="0.3"/>
            <!-- Base Plinth -->
            <rect x="4" y="18" width="16" height="3.5" rx="0.8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-marble minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="4" width="14" height="2.5" rx="0.5" stroke="#e0f2fe" stroke-width="1.4"/>
            <line x1="7" y1="6.5" x2="7" y2="17.5" stroke="#38bdf8" stroke-width="1.4"/>
            <line x1="12" y1="6.5" x2="12" y2="17.5" stroke="#38bdf8" stroke-width="1.4"/>
            <line x1="17" y1="6.5" x2="17" y2="17.5" stroke="#38bdf8" stroke-width="1.4"/>
            <rect x="5" y="17.5" width="14" height="2.5" rx="0.5" stroke="#e0f2fe" stroke-width="1.4"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-marble imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="3" fill="#fbbf24" stroke="#d97706" stroke-width="1.2"/>
            <path d="M7 7V17M12 7V17M17 7V17" stroke="#fef08a" stroke-width="1.6"/>
            <rect x="4" y="17" width="16" height="3" fill="#fbbf24" stroke="#d97706" stroke-width="1.2"/>
          </svg>
        `;
      }

    case 'sponges':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-sponges antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Kalymnos Sea Sponge -->
            <path d="M7 6C4 8 3 12 5 16C7 20 12 21 16 19C20 17 21 12 19 8C17 4 11 4 7 6Z" fill="#f59e0b" stroke="#d97706" stroke-width="1.3"/>
            <!-- Porous Honeycomb Texture -->
            <circle cx="9" cy="9" r="1.3" fill="#92400e"/>
            <circle cx="14" cy="8.5" r="1.5" fill="#92400e"/>
            <circle cx="11.5" cy="12.5" r="1.8" fill="#78350f"/>
            <circle cx="7.5" cy="14" r="1.2" fill="#92400e"/>
            <circle cx="15.5" cy="13.5" r="1.4" fill="#92400e"/>
            <circle cx="11" cy="17" r="1.2" fill="#92400e"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-sponges minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 6C4 8 3 12 5 16C7 20 12 21 16 19C20 17 21 12 19 8C17 4 11 4 7 6Z" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)"/>
            <circle cx="9" cy="9" r="1" fill="#e0f2fe"/>
            <circle cx="14" cy="9" r="1.2" fill="#e0f2fe"/>
            <circle cx="11" cy="13" r="1.4" fill="#38bdf8"/>
            <circle cx="15" cy="14" r="1" fill="#e0f2fe"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-sponges imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 6C4 8 3 12 5 16C7 20 12 21 16 19C20 17 21 12 19 8C17 4 11 4 7 6Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/>
            <circle cx="9" cy="9" r="1.2" fill="#78350f"/>
            <circle cx="14" cy="9" r="1.3" fill="#78350f"/>
            <circle cx="11.5" cy="13" r="1.6" fill="#78350f"/>
          </svg>
        `;
      }

    case 'fuel':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-fuel antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Classical Hellenic Bronze Oil Lamp with Flame -->
            <path d="M4 14C4 18 8 20 12 20C17 20 20 17 20 13C20 11 18 10 16 10H8C5.5 10 4 11.5 4 14Z" fill="#d97706" stroke="#92400e" stroke-width="1.2"/>
            <path d="M3 14C2 12 3 9 5 8" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
            <!-- Spout and Flame -->
            <polygon points="17,10 21,7 21,11" fill="#b45309"/>
            <path d="M21 7C22 5.5 21 3 20 2C19 3.5 19 5.5 21 7Z" fill="#f59e0b" stroke="#ef4444" stroke-width="0.8"/>
            <circle cx="20.2" cy="4.5" r="0.8" fill="#fef08a"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-fuel minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14C5 18 8 20 12 20C16 20 19 17 19 13C19 10.5 17 10 15 10H9C6.5 10 5 11.5 5 14Z" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.2)"/>
            <path d="M19 8C20 6 19.5 4 18.5 3C17.5 4.5 17.5 6.5 19 8Z" fill="#38bdf8" stroke="#e0f2fe" stroke-width="0.8"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-fuel imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 14C4 18 8 20 12 20C17 20 20 17 20 13C20 11 18 10 16 10H8C5.5 10 4 11.5 4 14Z" fill="#ea580c" stroke="#f59e0b" stroke-width="1.5"/>
            <path d="M20 7C21 5 20.5 3 19.5 2C18.5 3.5 18.5 5.5 20 7Z" fill="#fbbf24" stroke="#fef08a" stroke-width="1"/>
          </svg>
        `;
      }

    case 'mastic':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-mastic antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Chios Mastic Branch with Tears of Resin -->
            <path d="M4 20C8 17 14 12 20 5" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
            <ellipse cx="9" cy="14" rx="2.5" ry="1.2" transform="rotate(-30 9 14)" fill="#10b981" stroke="#047857" stroke-width="0.8"/>
            <ellipse cx="14" cy="9.5" rx="2.5" ry="1.2" transform="rotate(-40 14 9.5)" fill="#34d399" stroke="#059669" stroke-width="0.8"/>
            <ellipse cx="17" cy="6" rx="2.2" ry="1.1" transform="rotate(-25 17 6)" fill="#6ee7b7" stroke="#059669" stroke-width="0.8"/>
            <!-- Mastic Resin Tears -->
            <path d="M11 18C11 18 9.5 19.5 9.5 20.5C9.5 21.3 10.2 22 11 22C11.8 22 12.5 21.3 12.5 20.5C12.5 19.5 11 18 11 18Z" fill="#fef08a" stroke="#d97706" stroke-width="0.8"/>
            <circle cx="15.5" cy="13.5" r="1.4" fill="#fde68a" stroke="#d97706" stroke-width="0.8"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-mastic minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 20C9 16 14 11 19 5" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
            <ellipse cx="10" cy="14" rx="2.5" ry="1.2" stroke="#38bdf8" stroke-width="1.2" fill="rgba(56, 189, 248, 0.25)"/>
            <circle cx="15" cy="12" r="1.3" fill="#e0f2fe"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-mastic imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 20C9 16 14 11 19 5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
            <ellipse cx="10" cy="14" rx="2.5" ry="1.2" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <circle cx="15" cy="12" r="1.5" fill="#fef08a" stroke="#b45309" stroke-width="1"/>
          </svg>
        `;
      }

    case 'anchor':
      if (style === 'antiquity') {
        return `
          <svg class="aegean-icon icon-anchor antiquity" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Classical Mediterranean Nautical Anchor -->
            <circle cx="12" cy="4.5" r="2.2" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="12" y1="6.8" x2="12" y2="20" stroke="#d97706" stroke-width="1.8"/>
            <line x1="7" y1="9" x2="17" y2="9" stroke="#92400e" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M4 14.5C5.5 19 8.5 21.5 12 21.5C15.5 21.5 18.5 19 20 14.5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
            <polygon points="3,15 5.5,13.5 5,16" fill="#f59e0b"/>
            <polygon points="21,15 18.5,13.5 19,16" fill="#f59e0b"/>
          </svg>
        `;
      } else if (style === 'minimalist') {
        return `
          <svg class="aegean-icon icon-anchor minimalist" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="4.5" r="2" stroke="#38bdf8" stroke-width="1.6"/>
            <line x1="12" y1="6.5" x2="12" y2="20" stroke="#38bdf8" stroke-width="1.8"/>
            <line x1="7.5" y1="9.5" x2="16.5" y2="9.5" stroke="#e0f2fe" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M4.5 14.5C6 19 8.8 21 12 21C15.2 21 18 19 19.5 14.5" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        return `
          <svg class="aegean-icon icon-anchor imperial" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="4.5" r="2.2" stroke="#fef08a" stroke-width="1.8" fill="#b45309"/>
            <line x1="12" y1="6.8" x2="12" y2="20" stroke="#fbbf24" stroke-width="2.2"/>
            <line x1="7" y1="9.5" x2="17" y2="9.5" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            <path d="M4 14.5C5.5 19 8.5 21.5 12 21.5C15.5 21.5 18.5 19 20 14.5" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        `;
      }

    default:
      return getFallbackEmoji(name);
  }
}

/**
 * Fallback to classical Unicode or OS emojis when 'emoji' style is selected
 */
function getFallbackEmoji(name: string): string {
  switch (name) {
    case 'treasury':
    case 'drachma':
    case 'coin':
      return '🪙';
    case 'trade-points':
    case 'tp':
    case 'laurel':
    case 'star':
      return '⭐';
    case 'archipelago':
    case 'islands':
      return '🏝️';
    case 'settings':
    case 'gear':
      return '⚙️';
    case 'pause':
      return '⏸';
    case 'speed-1x':
    case 'play':
      return '1x';
    case 'speed-4x':
    case 'fastForward':
      return '4x';
    case 'speed-16x':
    case 'ultraForward':
      return '16x';
    case 'dem':
    case 'mountain':
      return '🏔️';
    case 'night':
    case 'moon':
      return '🌙';
    case 'day':
    case 'sun':
      return '☀️';
    case 'wake':
    case 'wave':
      return '🌊';
    case 'amphora':
    case 'cargo':
      return '🏺';
    case 'fleet':
    case 'temple':
    case 'parthenon':
      return '🏛️';
    case 'ship':
    case 'boat':
    case 'kaiki':
    case 'fishing_boat':
    case 'vessel':
    case 'tier-1':
      return '⛵';
    case 'caique':
    case 'tier-2':
      return '🚢';
    case 'ferry':
    case 'tier-3':
      return '⛴️';
    case 'freighter':
    case 'cargo_ship':
    case 'cargo-ship':
    case 'tier-4':
      return '🚢';
    case 'yacht':
    case 'charter_yacht':
    case 'luxury_yacht':
    case 'tier-5':
      return '🛥️';
    case 'follow':
    case 'camera':
      return '🎥';
    case 'target':
      return '🎯';
    case 'anchor':
      return '⚓';
    case 'wine':
      return '🍷';
    case 'water':
      return '💧';
    case 'crafts':
      return '🏺';
    case 'produce':
      return '🍇';
    case 'fish':
      return '🐟';
    case 'grain':
      return '🌾';
    case 'cheese':
      return '🧀';
    case 'honey':
      return '🍯';
    case 'olive':
    case 'olive_oil':
    case 'olives':
      return '🫒';
    case 'marble':
      return '🏛️';
    case 'sponges':
      return '🧽';
    case 'fuel':
      return '⛽';
    case 'mastic':
      return '🌿';
    default:
      return '🏛️';
  }
}

/**
 * Returns an icon element for an Aegean commodity good.
 * Supports vector SVGs for antiquity, minimalist, and imperial themes,
 * and high-contrast, scalable fallback for the emoji theme.
 */
export function getGoodIconSvg(goodId: string, style: IconStyle = 'antiquity', size = 26): string {
  if (style === 'emoji') {
    const emoji = getFallbackEmoji(goodId);
    return `<span class="good-emoji-fallback" style="font-size: ${Math.round(size * 0.72)}px; line-height: 1;">${emoji}</span>`;
  }
  return getIconSvg(goodId, style, size);
}

/**
 * Returns an icon element for an Aegean ship tier (1-5).
 * Supports vector SVGs for antiquity, minimalist, and imperial themes,
 * and high-contrast, scalable fallback for the emoji theme.
 */
export function getShipTierIconSvg(tier: number, style: IconStyle = 'antiquity', size = 20): string {
  if (style === 'emoji') {
    const emoji = getFallbackEmoji(`tier-${tier}`);
    return `<span class="ship-emoji-fallback" style="font-size: ${Math.round(size * 0.85)}px; line-height: 1;">${emoji}</span>`;
  }
  const tierNames = ['kaiki', 'caique', 'ferry', 'freighter', 'yacht'];
  const name = tierNames[Math.max(0, Math.min(4, Math.floor(tier) - 1))] || 'kaiki';
  return getIconSvg(name, style, size);
}

/**
 * Global Icon Manager for runtime style changes across the UI
 */
class IconManager {
  private currentStyle: IconStyle = 'antiquity';
  private listeners: Set<(style: IconStyle) => void> = new Set();

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ICON_STYLE) as IconStyle;
      if (saved && ['antiquity', 'minimalist', 'imperial', 'emoji'].includes(saved)) {
        this.currentStyle = saved;
      }
    } catch {
      // Default to antiquity
    }
  }

  public getStyle(): IconStyle {
    return this.currentStyle;
  }

  public setStyle(style: IconStyle): void {
    if (this.currentStyle === style) return;
    this.currentStyle = style;
    try {
      localStorage.setItem(STORAGE_KEY_ICON_STYLE, style);
    } catch {
      // Ignore
    }
    this.updateDomIcons();
    this.listeners.forEach((fn) => fn(style));
  }

  public onStyleChange(fn: (style: IconStyle) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Refreshes all elements with `data-icon` attribute across the DOM
   */
  public updateDomIcons(): void {
    if (typeof document === 'undefined') return;
    const iconElements = document.querySelectorAll<HTMLElement>('[data-icon]');
    iconElements.forEach((el) => {
      const iconName = el.getAttribute('data-icon');
      const iconSize = parseInt(el.getAttribute('data-icon-size') || '22', 10);
      if (iconName) {
        el.innerHTML = getIconSvg(iconName, this.currentStyle, iconSize);
      }
    });

    // Also update any layer button icon if present
    const layerIcon = document.getElementById('layer-cycle-icon');
    if (layerIcon) {
      const currentMode = layerIcon.getAttribute('data-current-mode') || 'dem';
      layerIcon.innerHTML = getIconSvg(currentMode, this.currentStyle, 24);
    }
  }
}

export const icons = new IconManager();
