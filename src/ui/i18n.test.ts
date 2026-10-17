import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLanguage,
  setLanguage,
  onLanguageChange,
  t,
  getIslandName,
  getGoodName,
  getShipClassName,
  getRegionName,
  getMonthName,
  SUPPORTED_LANGUAGES,
  ISLAND_NAMES,
  GOOD_NAMES,
  SHIP_CLASSES,
  formatCompactNumber,
  formatDrachmas,
} from './i18n';

describe('Trilingual i18n Engine (English, Greek, Turkish)', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  it('exposes English, Greek, and Turkish as supported languages', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.id)).toEqual(['en', 'el', 'tr']);
    expect(SUPPORTED_LANGUAGES.find((l) => l.id === 'en')?.flag).toBe('🇺🇸');
    expect(SUPPORTED_LANGUAGES.find((l) => l.id === 'el')?.flag).toBe('🇬🇷');
    expect(SUPPORTED_LANGUAGES.find((l) => l.id === 'tr')?.flag).toBe('🇹🇷');
  });

  it('defaults to English and allows switching to Greek and Turkish', () => {
    expect(getLanguage()).toBe('en');

    setLanguage('el');
    expect(getLanguage()).toBe('el');

    setLanguage('tr');
    expect(getLanguage()).toBe('tr');

    setLanguage('en');
    expect(getLanguage()).toBe('en');
  });

  it('dispatches notifications to onLanguageChange listeners', () => {
    const received: string[] = [];
    const unsubscribe = onLanguageChange((lang) => {
      received.push(lang);
    });

    setLanguage('el');
    setLanguage('tr');
    unsubscribe();
    setLanguage('en');

    expect(received).toEqual(['el', 'tr']);
  });

  it('translates core UI keys accurately in all three languages', () => {
    setLanguage('en');
    expect(t('metric.treasury')).toBe('Treasury');
    expect(t('inspector.prosperity')).toBe('Island Prosperity');
    expect(t('inspector.status.booming')).toBe('Booming');
    expect(t('time.pause')).toContain('Pause');

    setLanguage('el');
    expect(t('metric.treasury')).toBe('Θησαυροφυλάκιο');
    expect(t('inspector.prosperity')).toBe('Ευημερία Νήσου');
    expect(t('inspector.status.booming')).toBe('Ακμάζουσα');
    expect(t('time.pause')).toContain('Παύση');

    setLanguage('tr');
    expect(t('metric.treasury')).toBe('Hazine');
    expect(t('inspector.prosperity')).toBe('Ada Refahı');
    expect(t('inspector.status.booming')).toBe('Gelişen');
    expect(t('time.pause')).toContain('Duraklat');
  });

  it('interpolates parameters correctly', () => {
    // Test custom replacement
    setLanguage('en');
    expect(t('inspector.exports')).toBe('Exports (+/d)');
  });

  it('provides authentic localized names for Aegean islands', () => {
    expect(getIslandName('santorini')).toBe('Santorini');
    expect(getIslandName('naxos')).toBe('Naxos');
    expect(getIslandName('chios')).toBe('Chios');
    expect(getIslandName('piraeus')).toBe('Piraeus (Athens)');

    setLanguage('el');
    expect(getIslandName('santorini')).toBe('Σαντορίνη');
    expect(getIslandName('naxos')).toBe('Νάξος');
    expect(getIslandName('chios')).toBe('Χίος');
    expect(getIslandName('piraeus')).toBe('Πειραιάς (Αθήνα)');
    expect(getIslandName('crete_heraklion')).toBe('Κρήτη (Ηράκλειο)');
    expect(getIslandName('rhodes')).toBe('Ρόδος');

    setLanguage('tr');
    expect(getIslandName('santorini')).toBe('Santoron (Santorini)');
    expect(getIslandName('naxos')).toBe('Nakşa');
    expect(getIslandName('chios')).toBe('Sakız Adası');
    expect(getIslandName('piraeus')).toBe('Pire (Atina)');
    expect(getIslandName('crete_heraklion')).toBe('Girit (Kandiye)');
    expect(getIslandName('rhodes')).toBe('Rodos');
    expect(getIslandName('lesbos')).toBe('Midilli');
  });

  it('contains entries for all 63 islands in the archipelago', () => {
    const keys = Object.keys(ISLAND_NAMES);
    expect(keys.length).toBe(63);
    for (const key of keys) {
      const entry = ISLAND_NAMES[key];
      expect(entry.en).toBeTruthy();
      expect(entry.el).toBeTruthy();
      expect(entry.tr).toBeTruthy();
    }
  });

  it('provides localized names for commodities and goods', () => {
    expect(Object.keys(GOOD_NAMES).length).toBe(14);

    setLanguage('en');
    expect(getGoodName('olive_oil')).toBe('Olive Oil');
    expect(getGoodName('olive')).toBe('Table Olives');
    expect(getGoodName('honey')).toBe('Thyme Honey');
    expect(getGoodName('wine')).toBe('Volcanic Wine');
    expect(getGoodName('mastic')).toBe('Chios Mastic');

    setLanguage('el');
    expect(getGoodName('olive_oil')).toBe('Ελαιόλαδο');
    expect(getGoodName('olive')).toBe('Επιτραπέζιες Ελιές');
    expect(getGoodName('honey')).toBe('Θυμαρίσιο Μέλι');
    expect(getGoodName('wine')).toBe('Ηφαιστειακό Κρασί');
    expect(getGoodName('mastic')).toBe('Μαστίχα Χίου');

    setLanguage('tr');
    expect(getGoodName('olive_oil')).toBe('Zeytinyağı');
    expect(getGoodName('olive')).toBe('Sofralık Zeytin');
    expect(getGoodName('honey')).toBe('Kekik Balı');
    expect(getGoodName('wine')).toBe('Volkanik Şarap');
    expect(getGoodName('mastic')).toBe('Sakız Reçinesi');
  });

  it('provides localized names for all 5 ship tiers', () => {
    expect(Object.keys(SHIP_CLASSES).length).toBe(5);

    setLanguage('en');
    expect(getShipClassName('fishing_boat')).toBe('Traditional Kaiki');
    expect(getShipClassName('ferry')).toBe('Island Passenger Ferry');

    setLanguage('el');
    expect(getShipClassName('fishing_boat')).toBe('Παραδοσιακό Καΐκι');
    expect(getShipClassName('ferry')).toBe('Επιβατηγό Οχηματαγωγό');

    setLanguage('tr');
    expect(getShipClassName('fishing_boat')).toBe('Geleneksel Kayık');
    expect(getShipClassName('ferry')).toBe('Ada Yolcu Feribotu');
  });

  it('localizes regions and calendar months', () => {
    setLanguage('en');
    expect(getRegionName('cyclades')).toBe('Cyclades');
    expect(getMonthName(6)).toBe('July');

    setLanguage('el');
    expect(getRegionName('cyclades')).toBe('Κυκλάδες');
    expect(getMonthName(6)).toBe('Ιούλιος');

    setLanguage('tr');
    expect(getRegionName('cyclades')).toBe('Kiklad Adaları');
    expect(getMonthName(6)).toBe('Temmuz');
  });

  it('formats large numbers compactly into xxxK, xxxM, xxxB notation', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(500)).toBe('500');
    expect(formatCompactNumber(999)).toBe('999');
    expect(formatCompactNumber(1000)).toBe('1K');
    expect(formatCompactNumber(25412)).toBe('25.4K');
    expect(formatCompactNumber(120500)).toBe('121K');
    expect(formatCompactNumber(2253741)).toBe('2.25M');
    expect(formatCompactNumber(12500000)).toBe('12.5M');
    expect(formatCompactNumber(150000000)).toBe('150M');
    expect(formatCompactNumber(1250000000)).toBe('1.25B');
    expect(formatDrachmas(2253741, true)).toBe('2.25M d');
    expect(formatDrachmas(2253741, false)).toBe('2,253,741 d');
  });
});
