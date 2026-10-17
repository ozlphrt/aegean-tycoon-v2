/**
 * i18n.ts — Trilingual Internationalization Engine for Aegean Tycoon
 * 
 * Supports:
 *  - English (en) — Default
 *  - Greek (el / Ελληνικά)
 *  - Turkish (tr / Türkçe)
 * 
 * Features:
 *  - Reactive language state with localStorage persistence ('aegean_language')
 *  - Comprehensive UI translation dictionary (HUD, Inspector, Panels, Modals, Feed, Settings)
 *  - Complete authentic trilingual dictionary for all 63 islands, 12 commodities, 5 ship classes, and regions
 *  - DOM auto-translator for elements with [data-i18n], [data-i18n-title], [data-i18n-placeholder]
 *  - Event dispatching for seamless runtime re-rendering without reloading
 */

export type SupportedLanguage = 'en' | 'el' | 'tr';

export const FLAG_SVGS = {
  en: `<svg class="flag-icon" viewBox="0 0 190 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="190" height="130" fill="#b22234"/><path stroke="#ffffff" stroke-width="10" d="M0,15h190 M0,35h190 M0,55h190 M0,75h190 M0,95h190 M0,115h190"/><rect width="76" height="70" fill="#3c3b6e"/><g fill="#ffffff"><circle cx="12" cy="10" r="3"/><circle cx="27" cy="10" r="3"/><circle cx="42" cy="10" r="3"/><circle cx="57" cy="10" r="3"/><circle cx="68" cy="10" r="3"/><circle cx="20" cy="22" r="3"/><circle cx="35" cy="22" r="3"/><circle cx="50" cy="22" r="3"/><circle cx="63" cy="22" r="3"/><circle cx="12" cy="35" r="3"/><circle cx="27" cy="35" r="3"/><circle cx="42" cy="35" r="3"/><circle cx="57" cy="35" r="3"/><circle cx="68" cy="35" r="3"/><circle cx="20" cy="48" r="3"/><circle cx="35" cy="48" r="3"/><circle cx="50" cy="48" r="3"/><circle cx="63" cy="48" r="3"/><circle cx="12" cy="60" r="3"/><circle cx="27" cy="60" r="3"/><circle cx="42" cy="60" r="3"/><circle cx="57" cy="60" r="3"/><circle cx="68" cy="60" r="3"/></g></svg>`,
  el: `<svg class="flag-icon" viewBox="0 0 190 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="190" height="130" fill="#0d5eaf"/><path stroke="#ffffff" stroke-width="14.44" d="M0,21.67h190 M0,50.56h190 M0,79.44h190 M0,108.33h190"/><rect width="72.22" height="72.22" fill="#0d5eaf"/><path fill="#ffffff" d="M28.89,0h14.44v72.22h-14.44z M0,28.89h72.22v14.44h-72.22z"/></svg>`,
  tr: `<svg class="flag-icon" viewBox="0 0 190 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="190" height="130" fill="#e30a17"/><circle cx="76" cy="65" r="39" fill="#ffffff"/><circle cx="86" cy="65" r="31.2" fill="#e30a17"/><polygon points="106,65 125,71.5 113.5,55.5 113.5,74.5 125,58.5" fill="#ffffff"/></svg>`,
} as const;

export interface LanguageMeta {
  id: SupportedLanguage;
  name: string;
  code: string;
  flag: string;
  flagSvg: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageMeta[] = [
  { id: 'en', name: 'English', code: 'EN', flag: '🇺🇸', flagSvg: FLAG_SVGS.en },
  { id: 'el', name: 'Ελληνικά', code: 'ΕΛ', flag: '🇬🇷', flagSvg: FLAG_SVGS.el },
  { id: 'tr', name: 'Türkçe', code: 'TR', flag: '🇹🇷', flagSvg: FLAG_SVGS.tr },
] as const;

const STORAGE_KEY = 'aegean_language';

// Internal active language state
let currentLanguage: SupportedLanguage = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (saved && (saved === 'en' || saved === 'el' || saved === 'tr')) {
      return saved;
    }
  } catch {
    // localStorage not accessible
  }
  return 'en';
})();

const listeners: Set<(lang: SupportedLanguage) => void> = new Set();

/**
 * Returns current active language ('en', 'el', or 'tr').
 */
export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * Changes active language, saves to localStorage, updates document lang attribute,
 * and notifies all subscribers.
 */
export function setLanguage(lang: SupportedLanguage): void {
  if (lang !== 'en' && lang !== 'el' && lang !== 'tr') return;
  if (currentLanguage === lang) return;

  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
    updateDomTranslations();
  }

  listeners.forEach((fn) => {
    try {
      fn(lang);
    } catch (err) {
      console.error('[i18n] Listener error:', err);
    }
  });
}

/**
 * Subscribe to language change events. Returns an unsubscribe function.
 */
export function onLanguageChange(fn: (lang: SupportedLanguage) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// -------------------------------------------------------------
// ISLAND NAMES (63 ISLANDS & PORTS IN EN, EL, TR)
// -------------------------------------------------------------
export const ISLAND_NAMES: Record<string, { en: string; el: string; tr: string }> = {
  santorini: { en: 'Santorini', el: 'Σαντορίνη', tr: 'Santoron (Santorini)' },
  naxos: { en: 'Naxos', el: 'Νάξος', tr: 'Nakşa' },
  paros: { en: 'Paros', el: 'Πάρος', tr: 'Para' },
  mykonos: { en: 'Mykonos', el: 'Μύκονος', tr: 'Mikonos' },
  syros: { en: 'Syros', el: 'Σύρος', tr: 'Şira (Syros)' },
  milos: { en: 'Milos', el: 'Μήλος', tr: 'Değirmenlik (Milos)' },
  crete_heraklion: { en: 'Crete (Heraklion)', el: 'Κρήτη (Ηράκλειο)', tr: 'Girit (Kandiye)' },
  rhodes: { en: 'Rhodes', el: 'Ρόδος', tr: 'Rodos' },
  kos: { en: 'Kos', el: 'Κως', tr: 'İstanköy' },
  samos: { en: 'Samos', el: 'Σάμος', tr: 'Sisam' },
  chios: { en: 'Chios', el: 'Χίος', tr: 'Sakız Adası' },
  lesbos: { en: 'Lesbos (Mytilene)', el: 'Λέσβος (Μυτιλήνη)', tr: 'Midilli' },
  lemnos: { en: 'Lemnos', el: 'Λήμνος', tr: 'Limni' },
  hydra: { en: 'Hydra', el: 'Ύδρα', tr: 'Çamlıca (İdra)' },
  piraeus: { en: 'Piraeus (Athens)', el: 'Πειραιάς (Αθήνα)', tr: 'Pire (Atina)' },
  izmir: { en: 'Izmir (Smyrna)', el: 'Σμύρνη', tr: 'İzmir' },
  tinos: { en: 'Tinos', el: 'Τήνος', tr: 'İstendil' },
  andros: { en: 'Andros', el: 'Άνδρος', tr: 'Andra' },
  sifnos: { en: 'Sifnos', el: 'Σίφνος', tr: 'Yavuzca (Sifnos)' },
  serifos: { en: 'Serifos', el: 'Σέριφος', tr: 'Koyunluca (Serifos)' },
  kythnos: { en: 'Kythnos', el: 'Κύθνος', tr: 'Termiye (Kitnos)' },
  kea: { en: 'Kea', el: 'Κέα (Τζια)', tr: 'Mürted (Kea)' },
  ios: { en: 'Ios', el: 'Ίος', tr: 'Nio (İos)' },
  amorgos: { en: 'Amorgos', el: 'Αμοργός', tr: 'Yamurgi (Amorgos)' },
  karpathos: { en: 'Karpathos', el: 'Κάρπαθος', tr: 'Kerpe' },
  kalymnos: { en: 'Kalymnos', el: 'Κάλυμνος', tr: 'Kilimli (Kelmez)' },
  patmos: { en: 'Patmos', el: 'Πάτμος', tr: 'Batnaz' },
  ikaria: { en: 'Ikaria', el: 'Ικαρία', tr: 'Ahikerya' },
  thasos: { en: 'Thasos', el: 'Θάσος', tr: 'Taşoz' },
  samothrace: { en: 'Samothrace', el: 'Σαμοθράκη', tr: 'Semadirek' },
  skiathos: { en: 'Skiathos', el: 'Σκιάθος', tr: 'İskiyatos' },
  skopelos: { en: 'Skopelos', el: 'Σκόπελος', tr: 'İskepelos' },
  skyros: { en: 'Skyros', el: 'Σκύρος', tr: 'İskiri' },
  spetses: { en: 'Spetses', el: 'Σπέτσες', tr: 'Suluca (İspeçe)' },
  gokceada: { en: 'Gökçeada (Imbros)', el: 'Ίμβρος', tr: 'Gökçeada (İmroz)' },
  bozcaada: { en: 'Bozcaada (Tenedos)', el: 'Τένεδος', tr: 'Bozcaada (Tenedos)' },
  delos: { en: 'Delos', el: 'Δήλος', tr: 'Delos' },
  rinia: { en: 'Rinia', el: 'Ρήνεια', tr: 'Rinya' },
  antiparos: { en: 'Antiparos', el: 'Αντίπαρος', tr: 'Andipara' },
  kimolos: { en: 'Kimolos', el: 'Κίμωλος', tr: 'Gümüş Ada (Kimolos)' },
  folegandros: { en: 'Folegandros', el: 'Φολέγανδρος', tr: 'Bolu (Folegandros)' },
  sikinos: { en: 'Sikinos', el: 'Σίκινος', tr: 'Ekenik (Sikinos)' },
  anafi: { en: 'Anafi', el: 'Ανάφη', tr: 'Anafi' },
  koufonisia: { en: 'Koufonisia', el: 'Κουφονήσια', tr: 'Kufonisi' },
  schinoussa: { en: 'Schinoussa', el: 'Σχοινούσα', tr: 'Eskinoz' },
  iraklia: { en: 'Iraklia', el: 'Ηράκλεια', tr: 'Arakliya' },
  donoussa: { en: 'Donoussa', el: 'Δονούσα', tr: 'Donyusa' },
  gyaros: { en: 'Gyaros', el: 'Γυάρος', tr: 'Şura (Gyaros)' },
  leros: { en: 'Leros', el: 'Λέρος', tr: 'İleryoz' },
  lipsi: { en: 'Lipsi', el: 'Λειψοί', tr: 'İlipsi' },
  astypalea: { en: 'Astypalea', el: 'Αστυπάλαια', tr: 'İstanbulya' },
  symi: { en: 'Symi', el: 'Σύμη', tr: 'Sömbeki' },
  tilos: { en: 'Tilos', el: 'Τήλος', tr: 'İlyaki' },
  nisyros: { en: 'Nisyros', el: 'Νίσυρος', tr: 'İncirli' },
  chalki: { en: 'Chalki', el: 'Χάλκη', tr: 'Herke' },
  kasos: { en: 'Kasos', el: 'Κάσος', tr: 'Kaşot' },
  fourni: { en: 'Fourni', el: 'Φούρνοι', tr: 'Fırnuz' },
  psara: { en: 'Psara', el: 'Ψαρά', tr: 'İpsara' },
  agios_efstratios: { en: 'Agios Efstratios', el: 'Άγιος Ευστράτιος', tr: 'Bozbaba' },
  alonnisos: { en: 'Alonnisos', el: 'Αλόννησος', tr: 'Kırlangıç (İliştire)' },
  poros: { en: 'Poros', el: 'Πόρος', tr: 'Damala (Poro)' },
  aegina: { en: 'Aegina', el: 'Αίγινα', tr: 'Ekine (Egina)' },
  kastellorizo: { en: 'Kastellorizo', el: 'Καστελλόριζο (Μεγίστη)', tr: 'Meis (Kızılhisar)' },
};

// -------------------------------------------------------------
// COMMODITIES / GOODS (14 COMMODITIES IN EN, EL, TR)
// -------------------------------------------------------------
export const GOOD_NAMES: Record<string, { en: string; el: string; tr: string }> = {
  fish: { en: 'Fresh Fish', el: 'Φρέσκο Ψάρι', tr: 'Taze Balık' },
  olive: { en: 'Table Olives', el: 'Επιτραπέζιες Ελιές', tr: 'Sofralık Zeytin' },
  olive_oil: { en: 'Olive Oil', el: 'Ελαιόλαδο', tr: 'Zeytinyağı' },
  wine: { en: 'Volcanic Wine', el: 'Ηφαιστειακό Κρασί', tr: 'Volkanik Şarap' },
  honey: { en: 'Thyme Honey', el: 'Θυμαρίσιο Μέλι', tr: 'Kekik Balı' },
  grain: { en: 'Wheat & Grain', el: 'Σιτάρι & Δημητριακά', tr: 'Buğday & Tahıl' },
  cheese: { en: 'Graviera Cheese', el: 'Γραβιέρα', tr: 'Gravyer Peyniri' },
  mastic: { en: 'Chios Mastic', el: 'Μαστίχα Χίου', tr: 'Sakız Reçinesi' },
  marble: { en: 'Parian Marble', el: 'Παριανό Μάρμαρο', tr: 'Paros Mermeri' },
  sponges: { en: 'Natural Sponges', el: 'Φυσικά Σφουγγάρια', tr: 'Doğal Sünger' },
  water: { en: 'Fresh Water', el: 'Πόσιμο Νερό', tr: 'Tatlı Su' },
  fuel: { en: 'Marine Fuel', el: 'Ναυτιλιακό Καύσιμο', tr: 'Gemi Yakıtı' },
  produce: { en: 'Volcanic Produce', el: 'Ηφαιστειακά Προϊόντα', tr: 'Volkanik Mahsuller' },
  crafts: { en: 'Artisan Crafts', el: 'Χειροτεχνήματα', tr: 'Zanaat Eserleri' },
};

// -------------------------------------------------------------
// SHIP CLASSES (5 TIERS IN EN, EL, TR)
// -------------------------------------------------------------
export const SHIP_CLASSES: Record<string, { en: string; el: string; tr: string }> = {
  fishing_boat: { en: 'Traditional Kaiki', el: 'Παραδοσιακό Καΐκι', tr: 'Geleneksel Kayık' },
  caique: { en: 'Aegean Schooner', el: 'Αιγαιοπελαγίτικη Σκούνα', tr: 'Ege Çektirmesi' },
  ferry: { en: 'Island Passenger Ferry', el: 'Επιβατηγό Οχηματαγωγό', tr: 'Ada Yolcu Feribotu' },
  cargo_ship: { en: 'Merchant Container Coaster', el: 'Εμπορικό Φορτηγό', tr: 'Ticari Yük Gemisi' },
  charter_yacht: { en: 'Luxury Motor Yacht', el: 'Πολυτελές Μηχανοκίνητο Γιοτ', tr: 'Lüks Motoryat' },
};

// -------------------------------------------------------------
// REGIONS (EN, EL, TR)
// -------------------------------------------------------------
export const REGION_NAMES: Record<string, { en: string; el: string; tr: string }> = {
  cyclades: { en: 'Cyclades', el: 'Κυκλάδες', tr: 'Kiklad Adaları' },
  dodecanese: { en: 'Dodecanese', el: 'Δωδεκάνησα', tr: 'On İki Ada' },
  north_aegean: { en: 'North Aegean', el: 'Βόρειο Αιγαίο', tr: 'Kuzey Ege' },
  saronic: { en: 'Saronic & Argolic', el: 'Σαρωνικός & Αργολικός', tr: 'Saronic & Argolik' },
  sporades: { en: 'Sporades', el: 'Σποράδες', tr: 'Sporadlar' },
  crete: { en: 'Crete', el: 'Κρήτη', tr: 'Girit' },
  mainland: { en: 'Mainland Gateways', el: 'Ηπειρωτικές Πύλες', tr: 'Anakara Limanları' },
};

// -------------------------------------------------------------
// CALENDAR MONTHS (EN, EL, TR)
// -------------------------------------------------------------
export const MONTH_NAMES: Record<number, { en: string; el: string; tr: string }> = {
  0: { en: 'January', el: 'Ιανουάριος', tr: 'Ocak' },
  1: { en: 'February', el: 'Φεβρουάριος', tr: 'Şubat' },
  2: { en: 'March', el: 'Μάρτιος', tr: 'Mart' },
  3: { en: 'April', el: 'Απρίλιος', tr: 'Nisan' },
  4: { en: 'May', el: 'Μάιος', tr: 'Mayıs' },
  5: { en: 'June', el: 'Ιούνιος', tr: 'Haziran' },
  6: { en: 'July', el: 'Ιούλιος', tr: 'Temmuz' },
  7: { en: 'August', el: 'Αύγουστος', tr: 'Ağustos' },
  8: { en: 'September', el: 'Σεπτέμβριος', tr: 'Eylül' },
  9: { en: 'October', el: 'Οκτώβριος', tr: 'Ekim' },
  10: { en: 'November', el: 'Νοέμβριος', tr: 'Kasım' },
  11: { en: 'December', el: 'Δεκέμβριος', tr: 'Aralık' },
};

// -------------------------------------------------------------
// COMPREHENSIVE UI TRANSLATIONS DICTIONARY
// -------------------------------------------------------------
export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Brand & Header
    'brand.title': 'Tycoon',
    'brand.subtitle': 'Rebirth of the Archipelago',
    'brand.version': 'v2.0 Pre-Alpha',
    'metric.treasury': 'Treasury',
    'metric.tradePoints': 'Trade Pts',
    'metric.archipelago': 'Archipelago',
    'search.placeholder': 'Search island, good or vessel... (Press /)',
    'search.all': 'All',
    'search.islands': '🏝️ Islands',
    'search.vessels': '⛵ Vessels',
    'search.goods': '📦 Goods',
    'time.pause': 'Pause (Space)',
    'time.1x': 'Normal 1x (1)',
    'time.4x': 'Fast 4x (2)',
    'time.16x': 'Ultra 16x (3)',
    'nav.fleet': 'Fleet & Roster (V)',
    'nav.guide': "Navigator's Guide (H)",
    'nav.settings': 'Settings (S)',
    'nav.language': 'Language',

    // Inspector
    'inspector.close': 'Close Panel (Esc)',
    'inspector.port': 'Port',
    'inspector.population': 'Population',
    'inspector.status.connected': 'Daylight • Connected',
    'inspector.status.awaiting': 'Awaiting Connection',
    'inspector.status.sleeping': 'Moonlit • Sleeping',
    'inspector.prosperity': 'Island Prosperity',
    'inspector.report': 'Report',
    'inspector.report.title': 'View Economic Recommendations & Strategy Report',
    'inspector.status.booming': 'Booming',
    'inspector.status.stable': 'Stable',
    'inspector.status.struggling': 'Struggling',
    'inspector.status.distressed': 'Distressed',
    'inspector.exports': 'Exports (+/d)',
    'inspector.imports': 'Imports (-/d)',
    'inspector.harborFleet': 'Harbor Fleet',
    'inspector.shipyard': 'Harbor Shipyard',
    'inspector.berths': 'Harbor Berths',
    'inspector.commission': 'Commission Vessel',
    'inspector.awaken': 'Awaken Island',
    'inspector.awaken.connected': 'Connected in Daylight',
    'inspector.awaken.need': 'Need',
    'inspector.market': 'Market & Trade',
    'inspector.stock': 'Stock',
    'inspector.target': 'Target',
    'inspector.price': 'Price',
    'inspector.capacity': 'Capacity',
    'inspector.speed': 'Speed',
    'inspector.upkeep': 'Upkeep',
    'inspector.cost': 'Cost',

    // Vessel Inspector
    'vessel.inspector.title': 'Vessel Manifest',
    'vessel.homePort': 'Home Port',
    'vessel.destination': 'Destination',
    'vessel.cargo': 'Cargo',
    'vessel.status': 'Status',
    'vessel.empty': 'Empty hold',
    'vessel.enroute': 'En Route',
    'vessel.loading': 'Docked & Trading',
    'vessel.idle': 'Anchored in Bay',
    'vessel.track': 'Follow Camera',
    'vessel.untrack': 'Stop Following',
    'vessel.speedKnots': 'kt',

    // Bottom Bar & Instruments
    'bottom.layer.dem': 'Elevation (T)',
    'bottom.layer.day': 'Day (D)',
    'bottom.layer.night': 'Night (N)',
    'bottom.layer.mask': 'Mask',
    'bottom.camera.reset': 'Reset View (Z)',
    'bottom.audio.toggle': 'Audio (M)',
    'bottom.legend.title': 'Prosperity Spectrum',
    'bottom.legend.archipelagoAvg': 'Archipelago Avg',
    'chrono.day': 'Day',
    'chrono.year': 'Year',
    'chrono.wind': 'Meltemi',
    'chrono.knots': 'kt',

    // Modals
    'modal.close': 'Close',
    'modal.confirm.title': 'Confirm Action',
    'modal.confirm.cancel': 'Cancel',
    'modal.confirm.ok': 'Confirm',
    'modal.confirm.decommission_title': 'Decommission Vessel',
    'modal.confirm.decommission_action': 'Decommission & Scrap',
    'modal.confirm.reset_title': 'Reset Maritime Empire',
    'modal.confirm.reset_action': 'Reset Game',
    'archipelago.title': 'Aegean Archipelago Directory',
    'archipelago.subtitle': 'Commercial intelligence, populations, and trade readiness across all 63 Aegean islands',
    'archipelago.filter.all': 'All Islands',
    'archipelago.sort.pop': 'Population',
    'archipelago.sort.prosp': 'Prosperity',
    'archipelago.sort.status': 'Status',
    'fleet.title': 'Aegean Fleet Operations',
    'fleet.roster': 'Fleet Roster',
    'fleet.guide': 'Ship Commission Guide',
    'sourcing.title': 'Commodity Sourcing Engine',
    'sourcing.subtitle': 'Direct merchant vessels from Aegean producers to satisfy island shortages',
    'advisory.title': 'Economic Advisory & Trade Strategy',
    'advisory.subtitle': 'Macroeconomic analysis and prioritized shipping directives for',
    'advisory.mandate': 'Prioritize Vessel',
    'advisory.track': 'Track Vessel',
    'advisory.source': 'Find Suppliers',

    // Settings
    'settings.title': 'Aegean Navigator Settings',
    'settings.tab.dem': 'Topography',
    'settings.tab.night': 'Night Lights',
    'settings.tab.day': 'Daylight',
    'settings.tab.wake': 'Vessel Wakes',
    'settings.tab.audio': 'Maritime Audio',
    'settings.tab.game': 'Game Save & Language',
    'settings.tab.credits': 'Credits',
    'settings.lang.title': 'Language / Γλώσσα / Dil',
    'settings.lang.desc': 'Select your preferred game language (English, Greek, or Turkish):',
    'settings.save.btn': 'Save Game Now',
    'settings.load.btn': 'Reload Saved Game',
    'settings.reset.btn': 'Reset Entire Archipelago (New Game)',
    'settings.autoSave': 'Auto-Save Enabled',

    // Common
    'common.tons': 'tons',
    'common.drachmas': 'drachmas',
    'common.days': 'days',
    'common.free': 'Free',
  },

  el: {
    // Brand & Header
    'brand.title': 'Tycoon',
    'brand.subtitle': 'Αναγέννηση του Αρχιπελάγους',
    'brand.version': 'v2.0 Προ-Άλφα',
    'metric.treasury': 'Θησαυροφυλάκιο',
    'metric.tradePoints': 'Εμπορικοί Πόντοι',
    'metric.archipelago': 'Αρχιπέλαγος',
    'search.placeholder': 'Αναζήτηση νησιού, αγαθού ή πλοίου... (Πατήστε /)',
    'search.all': 'Όλα',
    'search.islands': '🏝️ Νησιά',
    'search.vessels': '⛵ Πλοία',
    'search.goods': '📦 Αγαθά',
    'time.pause': 'Παύση (Space)',
    'time.1x': 'Κανονική 1x (1)',
    'time.4x': 'Γρήγορη 4x (2)',
    'time.16x': 'Υπερταχεία 16x (3)',
    'nav.fleet': 'Στόλος & Μητρώο (V)',
    'nav.guide': 'Οδηγός Πλοήγησης (H)',
    'nav.settings': 'Ρυθμίσεις (S)',
    'nav.language': 'Γλώσσα',

    // Inspector
    'inspector.close': 'Κλείσιμο (Esc)',
    'inspector.port': 'Λιμένας',
    'inspector.population': 'Πληθυσμός',
    'inspector.status.connected': 'Στο Φως • Συνδεδεμένη',
    'inspector.status.awaiting': 'Αναμονή Σύνδεσης',
    'inspector.status.sleeping': 'Υπό το Σεληνόφως • Κοιμώμενη',
    'inspector.prosperity': 'Ευημερία Νήσου',
    'inspector.report': 'Έκθεση',
    'inspector.report.title': 'Προβολή Οικονομικής Έκθεσης & Στρατηγικών Συμβουλών',
    'inspector.status.booming': 'Ακμάζουσα',
    'inspector.status.stable': 'Σταθερή',
    'inspector.status.struggling': 'Δοκιμαζόμενη',
    'inspector.status.distressed': 'Σε Κρίση',
    'inspector.exports': 'Εξαγωγές (+/ημ)',
    'inspector.imports': 'Εισαγωγές (-/ημ)',
    'inspector.harborFleet': 'Στόλος Λιμένα',
    'inspector.shipyard': 'Ναυπηγείο Λιμένα',
    'inspector.berths': 'Θέσεις Ελλιμενισμού',
    'inspector.commission': 'Ναυπήγηση Πλοίου',
    'inspector.awaken': 'Αφύπνιση Νήσου',
    'inspector.awaken.connected': 'Συνδεδεμένη στο Φως',
    'inspector.awaken.need': 'Απαιτούνται',
    'inspector.market': 'Αγορά & Εμπόριο',
    'inspector.stock': 'Απόθεμα',
    'inspector.target': 'Στόχος',
    'inspector.price': 'Τιμή',
    'inspector.capacity': 'Χωρητικότητα',
    'inspector.speed': 'Ταχύτητα',
    'inspector.upkeep': 'Συντήρηση',
    'inspector.cost': 'Κόστος',

    // Vessel Inspector
    'vessel.inspector.title': 'Δηλωτικό Πλοίου',
    'vessel.homePort': 'Λιμένας Βάσης',
    'vessel.destination': 'Προορισμός',
    'vessel.cargo': 'Φορτίο',
    'vessel.status': 'Κατάσταση',
    'vessel.empty': 'Κενό κύτος',
    'vessel.enroute': 'Εν πλω',
    'vessel.loading': 'Στο λιμάνι • Συναλλαγές',
    'vessel.idle': 'Αγκυροβολημένο',
    'vessel.track': 'Παρακολούθηση Κάμερας',
    'vessel.untrack': 'Διακοπή Παρακολούθησης',
    'vessel.speedKnots': 'κόμβοι',

    // Bottom Bar & Instruments
    'bottom.layer.dem': 'Ανάγλυφο (T)',
    'bottom.layer.day': 'Ημέρα (D)',
    'bottom.layer.night': 'Νύχτα (N)',
    'bottom.layer.mask': 'Μάσκα',
    'bottom.camera.reset': 'Επαναφορά Κάμερας (Z)',
    'bottom.audio.toggle': 'Ήχος (M)',
    'bottom.legend.title': 'Φάσμα Ευημερίας',
    'bottom.legend.archipelagoAvg': 'Μ.Ο. Αρχιπελάγους',
    'chrono.day': 'Ημέρα',
    'chrono.year': 'Έτος',
    'chrono.wind': 'Μελτέμι',
    'chrono.knots': 'κμβ',

    // Modals
    'modal.close': 'Κλείσιμο',
    'modal.confirm.title': 'Επιβεβαίωση Ενέργειας',
    'modal.confirm.cancel': 'Ακύρωση',
    'modal.confirm.ok': 'Επιβεβαίωση',
    'modal.confirm.decommission_title': 'Απόσυρση Πλοίου',
    'modal.confirm.decommission_action': 'Απόσυρση & Διάλυση',
    'modal.confirm.reset_title': 'Επαναφορά Αυτοκρατορίας',
    'modal.confirm.reset_action': 'Επαναφορά Παιχνιδιού',
    'archipelago.title': 'Ευρετήριο Αιγαιακού Αρχιπελάγους',
    'archipelago.subtitle': 'Εμπορικές πληροφορίες, πληθυσμοί και οικονομική ετοιμότητα και των 63 νησιών',
    'archipelago.filter.all': 'Όλα τα Νησιά',
    'archipelago.sort.pop': 'Πληθυσμός',
    'archipelago.sort.prosp': 'Ευημερία',
    'archipelago.sort.status': 'Κατάσταση',
    'fleet.title': 'Ναυτιλιακές Επιχειρήσεις Αιγαίου',
    'fleet.roster': 'Μητρώο Στόλου',
    'fleet.guide': 'Οδηγός Ναυπήγησης',
    'sourcing.title': 'Μηχανή Αναζήτησης Προμηθειών',
    'sourcing.subtitle': 'Κατεύθυνση εμπορικών πλοίων από παραγωγούς του Αιγαίου για κάλυψη ελλείψεων',
    'advisory.title': 'Οικονομική Έκθεση & Εμπορική Στρατηγική',
    'advisory.subtitle': 'Μακροοικονομική ανάλυση και οδηγίες ναυτιλιακών δρομολογίων για',
    'advisory.mandate': 'Προτεραιότητα Πλοίου',
    'advisory.track': 'Παρακολούθηση Πλοίου',
    'advisory.source': 'Εύρεση Προμηθευτών',

    // Settings
    'settings.title': 'Ρυθμίσεις Πλοηγού Αιγαίου',
    'settings.tab.dem': 'Τοπογραφία',
    'settings.tab.night': 'Φώτα Νύχτας',
    'settings.tab.day': 'Ηλιακό Φως',
    'settings.tab.wake': 'Απόνερα Πλοίων',
    'settings.tab.audio': 'Ναυτιλιακός Ήχος',
    'settings.tab.game': 'Αποθήκευση & Γλώσσα',
    'settings.tab.credits': 'Συντελεστές',
    'settings.lang.title': 'Γλώσσα / Language / Dil',
    'settings.lang.desc': 'Επιλέξτε τη γλώσσα της προτίμησής σας (Αγγλικά, Ελληνικά, ή Τουρκικά):',
    'settings.save.btn': 'Αποθήκευση Παιχνιδιού Τώρα',
    'settings.load.btn': 'Επαναφόρτωση Αποθηκευμένου',
    'settings.reset.btn': 'Επανεκκίνηση Αρχιπελάγους (Νέο Παιχνίδι)',
    'settings.autoSave': 'Αυτόματη Αποθήκευση Ενεργή',

    // Common
    'common.tons': 'τόνοι',
    'common.drachmas': 'δραχμές',
    'common.days': 'ημέρες',
    'common.free': 'Δωρεάν',
  },

  tr: {
    // Brand & Header
    'brand.title': 'Tycoon',
    'brand.subtitle': 'Takımadaların Yeniden Doğuşu',
    'brand.version': 'v2.0 Alfa Öncesi',
    'metric.treasury': 'Hazine',
    'metric.tradePoints': 'Ticaret Puanı',
    'metric.archipelago': 'Takımada',
    'search.placeholder': 'Ada, ürün veya gemi ara... (/ tuşuna basın)',
    'search.all': 'Tümü',
    'search.islands': '🏝️ Adalar',
    'search.vessels': '⛵ Gemiler',
    'search.goods': '📦 Ürünler',
    'time.pause': 'Duraklat (Boşluk)',
    'time.1x': 'Normal 1x (1)',
    'time.4x': 'Hızlı 4x (2)',
    'time.16x': 'Çok Hızlı 16x (3)',
    'nav.fleet': 'Filo & Liste (V)',
    'nav.guide': 'Kılavuz Rehberi (H)',
    'nav.settings': 'Ayarlar (S)',
    'nav.language': 'Dil',

    // Inspector
    'inspector.close': 'Paneli Kapat (Esc)',
    'inspector.port': 'Limanı',
    'inspector.population': 'Nüfus',
    'inspector.status.connected': 'Gündüz • Bağlı',
    'inspector.status.awaiting': 'Bağlantı Bekliyor',
    'inspector.status.sleeping': 'Mehtap Altında • Uyuyan',
    'inspector.prosperity': 'Ada Refahı',
    'inspector.report': 'Rapor',
    'inspector.report.title': 'Ekonomik Tavsiyeler & Strateji Raporunu Görüntüle',
    'inspector.status.booming': 'Gelişen',
    'inspector.status.stable': 'Dengeli',
    'inspector.status.struggling': 'Zorlanan',
    'inspector.status.distressed': 'Krizde',
    'inspector.exports': 'İhracat (+/gün)',
    'inspector.imports': 'İthalat (-/gün)',
    'inspector.harborFleet': 'Liman Filosu',
    'inspector.shipyard': 'Liman Tersanesi',
    'inspector.berths': 'Liman Bağlama Yerleri',
    'inspector.commission': 'Gemi İnşa Et',
    'inspector.awaken': 'Adayı Uyandır',
    'inspector.awaken.connected': 'Gündüz Işığında Bağlı',
    'inspector.awaken.need': 'Gereken',
    'inspector.market': 'Pazar & Ticaret',
    'inspector.stock': 'Stok',
    'inspector.target': 'Hedef',
    'inspector.price': 'Fiyat',
    'inspector.capacity': 'Kapasite',
    'inspector.speed': 'Hız',
    'inspector.upkeep': 'Bakım Masrafı',
    'inspector.cost': 'Maliyet',

    // Vessel Inspector
    'vessel.inspector.title': 'Gemi Manifestosu',
    'vessel.homePort': 'Bağlama Limanı',
    'vessel.destination': 'Hedef Liman',
    'vessel.cargo': 'Kargo',
    'vessel.status': 'Durum',
    'vessel.empty': 'Boş ambar',
    'vessel.enroute': 'Seyir Halinde',
    'vessel.loading': 'Limanda • Ticaret Yapıyor',
    'vessel.idle': 'Demirli',
    'vessel.track': 'Kamerayla Takip Et',
    'vessel.untrack': 'Takibi Bırak',
    'vessel.speedKnots': 'knot',

    // Bottom Bar & Instruments
    'bottom.layer.dem': 'Yükselti (T)',
    'bottom.layer.day': 'Gündüz (D)',
    'bottom.layer.night': 'Gece (N)',
    'bottom.layer.mask': 'Maske',
    'bottom.camera.reset': 'Görünümü Sıfırla (Z)',
    'bottom.audio.toggle': 'Ses (M)',
    'bottom.legend.title': 'Refah Yelpazesi',
    'bottom.legend.archipelagoAvg': 'Takımada Ort.',
    'chrono.day': 'Gün',
    'chrono.year': 'Yıl',
    'chrono.wind': 'Meltem',
    'chrono.knots': 'kt',

    // Modals
    'modal.close': 'Kapat',
    'modal.confirm.title': 'Eylemi Onayla',
    'modal.confirm.cancel': 'İptal',
    'modal.confirm.ok': 'Onayla',
    'modal.confirm.decommission_title': 'Gemiyi Hurdaya Ayır',
    'modal.confirm.decommission_action': 'Hizmetten Çıkar & Parçala',
    'modal.confirm.reset_title': 'Deniz İmparatorluğunu Sıfırla',
    'modal.confirm.reset_action': 'Oyunu Sıfırla',
    'archipelago.title': 'Ege Takımadaları Rehberi',
    'archipelago.subtitle': '63 Ege adasının tamamında ticari istihbarat, nüfuslar ve ekonomik potansiyel',
    'archipelago.filter.all': 'Tüm Adalar',
    'archipelago.sort.pop': 'Nüfus',
    'archipelago.sort.prosp': 'Refah',
    'archipelago.sort.status': 'Durum',
    'fleet.title': 'Ege Deniz Filosu Operasyonları',
    'fleet.roster': 'Gemi Listesi',
    'fleet.guide': 'Gemi İnşa Kılavuzu',
    'sourcing.title': 'Tedarik ve Sevkiyat Motoru',
    'sourcing.subtitle': 'Ada kıtlıklarını karşılamak için Ege üreticilerinden doğrudan ticaret gemisi yönlendirin',
    'advisory.title': 'Ekonomik Tavsiye & Ticaret Stratejisi',
    'advisory.subtitle': 'Makroekonomik analiz ve öncelikli deniz sevkiyatı direktifleri:',
    'advisory.mandate': 'Gemiye Görev Ver',
    'advisory.track': 'Gemiyi Takip Et',
    'advisory.source': 'Tedarikçi Bul',

    // Settings
    'settings.title': 'Ege Kılavuz Ayarları',
    'settings.tab.dem': 'Topografya',
    'settings.tab.night': 'Gece Işıkları',
    'settings.tab.day': 'Gündüz Işığı',
    'settings.tab.wake': 'Gemi Dalgaları',
    'settings.tab.audio': 'Deniz Sesleri',
    'settings.tab.game': 'Kayıt & Dil',
    'settings.tab.credits': 'Emeği Geçenler',
    'settings.lang.title': 'Dil Seçimi / Language / Γλώσσα',
    'settings.lang.desc': 'Tercih ettiğiniz oyun dilini seçin (İngilizce, Yunanca veya Türkçe):',
    'settings.save.btn': 'Oyunu Şimdi Kaydet',
    'settings.load.btn': 'Kayıtlı Oyunu Yükle',
    'settings.reset.btn': 'Tüm Takımadayı Sıfırla (Yeni Oyun)',
    'settings.autoSave': 'Otomatik Kayıt Etkin',

    // Common
    'common.tons': 'ton',
    'common.drachmas': 'drahmi',
    'common.days': 'gün',
    'common.free': 'Ücretsiz',
  },
};

/**
 * Translate a UI key into the currently active language.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

/**
 * Returns localized name for an island. Falls back to provided defaultName or island ID.
 */
export function getIslandName(id: string, defaultName?: string): string {
  const item = ISLAND_NAMES[id.toLowerCase()];
  if (item) {
    return item[currentLanguage] || item.en || defaultName || id;
  }
  return defaultName || id;
}

/**
 * Returns localized name for a good/commodity.
 */
export function getGoodName(goodId: string, defaultName?: string): string {
  const item = GOOD_NAMES[goodId.toLowerCase()];
  if (item) {
    return item[currentLanguage] || item.en || defaultName || goodId;
  }
  return defaultName || goodId;
}

/**
 * Returns localized name for a ship class.
 */
export function getShipClassName(shipId: string, defaultName?: string): string {
  const item = SHIP_CLASSES[shipId.toLowerCase()];
  if (item) {
    return item[currentLanguage] || item.en || defaultName || shipId;
  }
  return defaultName || shipId;
}

/**
 * Returns localized name for an archipelago region.
 */
export function getRegionName(regionId: string, defaultName?: string): string {
  const item = REGION_NAMES[regionId.toLowerCase()];
  if (item) {
    return item[currentLanguage] || item.en || defaultName || regionId;
  }
  return defaultName || regionId;
}

/**
 * Returns localized month name (0-11).
 */
export function getMonthName(monthIndex: number): string {
  const m = ((monthIndex % 12) + 12) % 12;
  const item = MONTH_NAMES[m];
  return item ? item[currentLanguage] || item.en : `Month ${m + 1}`;
}

/**
 * Automatically scans and translates all DOM elements with:
 *  - [data-i18n]: Replaces innerText
 *  - [data-i18n-html]: Replaces innerHTML
 *  - [data-i18n-title]: Updates title attribute
 *  - [data-i18n-placeholder]: Updates placeholder attribute
 */
export function updateDomTranslations(): void {
  if (typeof document === 'undefined') return;

  // Update inner text
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Update inner HTML
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (key) {
      el.innerHTML = t(key);
    }
  });

  // Update titles
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });

  // Update placeholders
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });

  // Update top language switcher button UI
  const activeFlag = document.getElementById('lang-active-flag');
  const activeCode = document.getElementById('lang-active-code');
  const currentMeta = SUPPORTED_LANGUAGES.find((l) => l.id === currentLanguage) || SUPPORTED_LANGUAGES[0];

  if (activeFlag) activeFlag.innerHTML = currentMeta.flagSvg || currentMeta.flag;
  if (activeCode) activeCode.textContent = currentMeta.code;

  // Update active state in dropdown
  document.querySelectorAll<HTMLElement>('.lang-option').forEach((opt) => {
    const lang = opt.getAttribute('data-lang');
    opt.classList.toggle('active', lang === currentLanguage);
  });
}

/**
 * Formats large amounts compactly into human-readable notation (e.g. 500, 25.4K, 2.25M, 150M, 1.2B)
 */
export function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs < 999.5) {
    return `${sign}${Math.floor(abs).toLocaleString()}`;
  }
  if (abs < 999_500) {
    const val = abs / 1000;
    const formatted = val < 99.95
      ? val.toFixed(1).replace(/\.0$/, '')
      : Math.round(val).toString();
    return `${sign}${formatted}K`;
  }
  if (abs < 999_500_000) {
    const val = abs / 1_000_000;
    const formatted = val < 9.995
      ? val.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')
      : val < 99.95
        ? val.toFixed(1).replace(/\.0$/, '')
        : Math.round(val).toString();
    return `${sign}${formatted}M`;
  }
  const val = abs / 1_000_000_000;
  const formatted = val < 9.995
    ? val.toFixed(2).replace(/\.00$/, '')
    : val.toFixed(1).replace(/\.0$/, '');
  return `${sign}${formatted}B`;
}

/**
 * Formats currency (drachmas), optionally in compact notation (e.g. "2.25M d" or "2,253,741 d").
 */
export function formatDrachmas(amount: number, compact = true): string {
  if (compact) {
    return `${formatCompactNumber(amount)} d`;
  }
  return `${Math.floor(amount).toLocaleString()} d`;
}
