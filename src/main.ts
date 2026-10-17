import { AegeanScene } from './render/Scene';
import type { IslandData, GoodDefinition, BalanceConfig, ShipDefinition } from './data/types';
import type { SeaLanesData } from './sim/nav';
import { SimulationCore } from './sim/simulation';
import { icons, getIconSvg, getGoodIconSvg, getShipTierIconSvg, ICON_THEMES } from './render/Icons';
import { audio } from './audio/AudioManager';
import {
  saveToStorage,
  loadFromStorage,
  clearSaveFromStorage,
  hasSaveInStorage,
  deserializeSimulation,
  DEFAULT_SAVE_KEY,
} from './sim/saveLoad';
import {
  isFirstTimeUser,
  isPreviewCompleted,
} from './sim/previewManager';
import { PreviewModal } from './render/PreviewModal';
import { FleetPanel } from './render/FleetPanel';
import { SourcingModal } from './render/SourcingModal';
import { ArchipelagoModal } from './render/ArchipelagoModal';
import { VesselAdvisoryModal } from './render/VesselAdvisoryModal';
import { confirmModal } from './render/ConfirmModal';
import { GameTooltip } from './render/GameTooltip';
import { TopSearch } from './render/TopSearch';
import { generateIslandEconomicReport } from './sim/advisory';
import { analyzeVesselVoyageOptions } from './sim/sourcing';
import { evaluateShipUtilization } from './sim/shipSim';
import {
  isNotificationAudioEnabled,
  toggleNotificationAudio,
  normalizeBadgeType,
} from './render/notificationAudio';
import { getProsperityHex, formatProsperityExact } from './render/prosperityPalette';
import {
  setLanguage,
  onLanguageChange,
  t,
  getIslandName,
  getGoodName,
  getRegionName,
  updateDomTranslations,
  formatCompactNumber,
  type SupportedLanguage,
} from './ui/i18n';
import { assetUrl } from './utils/assets';

const GOOD_EMOJIS: Record<string, string> = {
  grain: '🌾',
  cheese: '🧀',
  water: '💧',
  wine: '🍷',
  olive: '🫒',
  olive_oil: '🫗',
  honey: '🍯',
  fish: '🐟',
  crafts: '🏺',
  marble: '🏛️',
  sponges: '🧽',
  fuel: '⛽',
  produce: '🍅',
  mastic: '🌿',
};

const GOOD_COLORS: Record<string, string> = {
  grain: '#fde047',
  cheese: '#facc15',
  water: '#60a5fa',
  wine: '#f43f5e',
  olive: '#65a30d',
  olive_oil: '#a3e635',
  honey: '#f59e0b',
  fish: '#38bdf8',
  crafts: '#c084fc',
  marble: '#e2e8f0',
  sponges: '#fb923c',
  fuel: '#f97316',
  produce: '#ef4444',
  mastic: '#34d399',
};

function formatGoodName(id: string): string {
  return getGoodName(id, id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

let selectedIsland: IslandData | null = null;
let scene!: AegeanScene;
let sim: SimulationCore | null = null;
let fleetPanel: FleetPanel | null = null;
let sourcingModal: SourcingModal | null = null;
let archipelagoModal: ArchipelagoModal | null = null;
let vesselAdvisoryModal: VesselAdvisoryModal | null = null;
let topSearch: TopSearch | null = null;
export let gameTooltip: GameTooltip | null = null;
let inspectorVesselFilter: 'all' | 'active' | 'idle' = 'all';
let inspectorVesselViewMode: 'list' | 'grouped' = 'list';

function selectAndFocusIsland(islandId: string) {
  if (!sim) return;
  const isl = sim.islandsData.get(islandId);
  if (!isl) return;

  selectedShipId = null;
  scene?.unfollowShip();
  selectedIsland = isl;
  scene.setSelectedIsland(isl.id);
  updateInspector(isl, scene.isIslandLit(isl));

  const pLon = isl.peak?.lon ?? isl.lon;
  const pLat = isl.peak?.lat ?? isl.lat;
  const worldPos = scene.terrain?.getPeakWorld(pLon, pLat);
  if (worldPos) {
    scene.cameraManager.focusOn(worldPos, 18);
  }
  audio.playClickSound();
}

function selectAndFocusShip(shipId: string) {
  if (!sim?.shipManager || !scene) return;
  const ship = sim.shipManager.ships.get(shipId);
  if (!ship) return;

  selectedIsland = null;
  selectedShipId = shipId;
  updateVesselInspector(shipId);
  scene.followShip(shipId, () => {
    if (selectedShipId) updateVesselInspector(selectedShipId);
  });
  audio.playClickSound();
}

function addNotification(badge: string, text: string, highlight = false, isNegative?: boolean) {
  const feedList = document.getElementById('event-feed-list');
  if (!feedList) return;

  // Auto-detect negative/warning dispatches if not explicitly set
  const negativePattern = /(cannot|locked|shortage|starv|distress|warning|deficit|loss|penalty|storm|insufficient|failed|error|blocked|unable|bankrupt)/i;
  const isNeg = isNegative !== undefined ? isNegative : (negativePattern.test(badge) || negativePattern.test(text));

  // If text mentions island connection requirements without buttons, automatically convert island IDs/names into interactive links
  let formattedText = text;
  if (sim && !formattedText.includes('feed-island-link')) {
    const connectMatch = formattedText.match(/Must connect to (.*?) first/i);
    if (connectMatch) {
      const targetsStr = connectMatch[1];
      const targetItems = targetsStr.split(/\s+or\s+/i);
      const replacedItems = targetItems.map((itemStr) => {
        const cleanName = itemStr.trim();
        const matchIsland = Array.from(sim!.islandsData.values()).find(
          (i) => i.id.toLowerCase() === cleanName.toLowerCase() || i.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (matchIsland) {
          return `<button class="feed-island-link" data-island-id="${matchIsland.id}" title="Focus on ${matchIsland.name}">📍 ${matchIsland.name}</button>`;
        }
        return cleanName;
      });
      formattedText = formattedText.replace(connectMatch[0], `Must connect to ${replacedItems.join(' or ')} first`);
    }
  }

  const badgeType = normalizeBadgeType(badge);

  const item = document.createElement('div');
  const highlightClass = highlight ? 'event-highlight' : '';
  const negativeClass = isNeg ? 'negative' : '';

  item.className = `feed-item feed-item-arriving ${highlightClass} ${negativeClass}`.trim();
  item.dataset.badgeType = badgeType;
  item.innerHTML = `
    <span class="feed-badge">${isNeg && !badge.includes('⚠️') ? '⚠️ ' + badge : badge}</span>
    <p class="feed-text">${formattedText}</p>
    <div class="feed-footer">
      <span class="feed-time">Just now</span>
    </div>
  `;

  // Brief attention-grabbing animation: remove arrival pulse class after 2.8s
  setTimeout(() => {
    item.classList.remove('feed-item-arriving');
  }, 2800);

  feedList.prepend(item);

  // Keep feed list capped to recent 40 items to avoid DOM bloat
  while (feedList.children.length > 40) {
    feedList.removeChild(feedList.lastChild!);
  }

  if (highlight || isNeg) {
    const feedPanel = document.getElementById('feed-panel');
    feedPanel?.classList.remove('closed');
    document.getElementById('btn-toggle-feed')?.classList.add('active');
  }
}

function updateTopBarMetrics() {
  if (!sim) return;

  const valTreasury = document.getElementById('val-treasury');
  const valTP = document.getElementById('val-tp');
  const valIslands = document.getElementById('val-islands');

  if (valTreasury) {
    valTreasury.textContent = `${formatCompactNumber(sim.treasury)} d`;
    const metricTreasury = document.getElementById('metric-treasury');
    if (metricTreasury) {
      metricTreasury.setAttribute('data-game-tooltip', `Company Treasury: 🪙 ${Math.floor(sim.treasury).toLocaleString()} drachmas`);
    }
  }
  if (valTP) {
    valTP.textContent = `${formatCompactNumber(sim.tradePoints)} TP`;
    const metricTP = document.getElementById('metric-trade-points');
    if (metricTP) {
      metricTP.setAttribute('data-game-tooltip', `Trade Points: ⭐ ${sim.tradePoints.toLocaleString()} TP earned`);
    }
  }
  if (valIslands) valIslands.textContent = `${sim.unlockedIslands.size} / ${sim.islands.size}`;
  const formattedDate = sim.getFormattedDate();

  if (!selectedIsland) {
    updateProsperityLegendSelection(null);
  }

  const bottomGameDate = document.getElementById('bottom-game-date');
  if (bottomGameDate) bottomGameDate.textContent = formattedDate;

  // Mechanical Date Aperture Stamp
  const bottomStampMonth = document.getElementById('bottom-stamp-month');
  const bottomStampDay = document.getElementById('bottom-stamp-day');
  if (bottomStampMonth || bottomStampDay) {
    const parts = formattedDate.split(' ');
    if (parts.length >= 2) {
      if (bottomStampDay) bottomStampDay.textContent = parts[0];
      if (bottomStampMonth) bottomStampMonth.textContent = parts[1].toUpperCase();
    }
  }

  const dayFrac = sim.gameDay % 1.0;
  const hour = Math.floor(dayFrac * 24);
  const minute = Math.floor((dayFrac * 24 - hour) * 60);
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  const bottomGameTime = document.getElementById('bottom-game-time');
  if (bottomGameTime) bottomGameTime.textContent = timeStr;

  const bottomTimeIcon = document.getElementById('bottom-time-icon');
  if (bottomTimeIcon) {
    bottomTimeIcon.textContent = (hour >= 20 || hour < 6) ? '🌙' : '☀️';
  }

  // Celestial Solar/Lunar Transit Astrolabe Pointer rotation
  // 12:00 noon is zenith (0°), 18:00 is sunset (+90°), 00:00 is nadir/midnight (180°), 06:00 is sunrise (-90°/270°)
  const solarTransitPointer = document.getElementById('solar-transit-pointer');
  if (solarTransitPointer) {
    const solarAngle = ((hour + minute / 60) - 12) * 15;
    solarTransitPointer.style.transform = `rotate(${solarAngle}deg)`;
  }

  if (sim.weather) {
    const wind = sim.weather.getWind();

    // Bottom-Right Wind Rose updates
    const windRoseNeedle = document.getElementById('wind-rose-needle');
    const bottomWindSpeed = document.getElementById('bottom-wind-speed');
    const bottomWindBearing = document.getElementById('bottom-wind-bearing');
    const bottomWindName = document.getElementById('bottom-wind-name');
    const bottomSeasonTag = document.getElementById('bottom-season-tag');
    const bottomSeasonIcon = document.getElementById('bottom-season-icon');

    if (windRoseNeedle) {
      // Rotate needle arrowhead towards the direction the wind is blowing
      const towardsDeg = (wind.headingFromDeg + 180) % 360;
      windRoseNeedle.style.transform = `rotate(${towardsDeg}deg)`;
    }
    if (bottomWindSpeed) bottomWindSpeed.textContent = `${wind.speedKnots} kt`;
    if (bottomWindBearing) bottomWindBearing.textContent = wind.cardinal;
    if (bottomWindName) bottomWindName.textContent = wind.name;
    if (bottomSeasonTag) {
      const seasonCapitalized = wind.season.charAt(0).toUpperCase() + wind.season.slice(1);
      bottomSeasonTag.textContent = seasonCapitalized;
    }
    if (bottomSeasonIcon) {
      const sLower = wind.season.toLowerCase();
      if (sLower === 'summer') bottomSeasonIcon.textContent = '☀️';
      else if (sLower === 'winter') bottomSeasonIcon.textContent = '❄️';
      else if (sLower === 'autumn') bottomSeasonIcon.textContent = '🍂';
      else bottomSeasonIcon.textContent = '🌸';
    }

    // 5-segment graphic Beaufort Force Bar illumination
    const forceSegments = document.querySelectorAll<HTMLElement>('#wind-force-meter .force-seg');
    if (forceSegments.length > 0) {
      let activeBars = 1;
      if (wind.speedKnots >= 30) activeBars = 5;
      else if (wind.speedKnots >= 23) activeBars = 4;
      else if (wind.speedKnots >= 16) activeBars = 3;
      else if (wind.speedKnots >= 8) activeBars = 2;

      forceSegments.forEach((seg, idx) => {
        if (idx < activeBars) {
          seg.classList.add('active');
        } else {
          seg.classList.remove('active');
        }
      });
    }
  }
}

function updateProsperityLegendSelection(prosperity: number | null, islandName?: string) {
  const marker = document.getElementById('prosperity-legend-marker');
  const valEl = document.getElementById('prosperity-legend-sel-val');
  if (!marker || !valEl) return;

  if (prosperity !== null && !isNaN(prosperity)) {
    const pct = Math.max(0, Math.min(100, prosperity * 100));
    const exactStr = formatProsperityExact(prosperity);
    const pHex = getProsperityHex(prosperity);
    marker.style.display = 'block';
    marker.style.left = `${pct}%`;
    marker.style.background = '#ffffff';
    marker.style.boxShadow = `0 0 8px ${pHex}, 0 0 14px #ffffff`;

    valEl.textContent = `${islandName ? `${islandName}: ` : ''}${exactStr}`;
    valEl.style.color = pHex;
    valEl.style.textShadow = `0 0 8px ${pHex}88`;
  } else {
    // Show archipelago average if available or reset
    let avgP = 0.5;
    if (sim && sim.islands.size > 0) {
      let sum = 0;
      let count = 0;
      for (const eco of sim.islands.values()) {
        sum += eco.prosperity;
        count++;
      }
      if (count > 0) avgP = sum / count;
    }
    const avgPct = Math.max(0, Math.min(100, avgP * 100));
    const avgHex = getProsperityHex(avgP);
    marker.style.display = 'block';
    marker.style.left = `${avgPct}%`;
    marker.style.background = avgHex;
    marker.style.boxShadow = `0 0 6px ${avgHex}`;

    valEl.textContent = `Avg: ${formatProsperityExact(avgP)}`;
    valEl.style.color = avgHex;
    valEl.style.textShadow = `0 0 6px ${avgHex}88`;
  }
}

let selectedShipId: string | null = null;
let selectedShipTier: string = 'fishing_boat';

function getShipShortName(typeId: string): string {
  switch (typeId) {
    case 'fishing_boat': return 'Boat';
    case 'caique': return 'Coaster';
    case 'ferry': return 'Ferry';
    case 'cargo_ship': return 'Freighter';
    case 'charter_yacht': return 'Yacht';
    default: return 'Vessel';
  }
}

function getShipTierIcon(tier: number, size = 18): string {
  const style = icons.getStyle();
  if (style === 'emoji') {
    switch (tier) {
      case 1: return '⛵';
      case 2: return '🚢';
      case 3: return '⛴️';
      case 4: return '🚢';
      case 5: return '🛥️';
      default: return '⛵';
    }
  }
  return `<span class="vessel-tier-icon tier-${tier}">${getShipTierIconSvg(tier, style, size)}</span>`;
}

function updateVesselInspector(shipId: string) {
  if (!sim?.shipManager) return;
  const ship = sim.shipManager.ships.get(shipId);
  if (!ship) return;
  selectedShipId = shipId;

  const panel = document.getElementById('inspector-panel');
  if (panel) panel.classList.remove('closed');

  // Toggle visible sections: Hide island blocks, show ship block
  const pBlock = document.getElementById('inspector-prosperity-block');
  const mBlock = document.getElementById('inspector-market-block');
  const vBlock = document.getElementById('inspector-vessels-block');
  const yBlock = document.getElementById('inspector-shipyard-block');
  const aBlock = document.getElementById('inspector-actions-block');
  const sBlock = document.getElementById('inspector-ship-block');

  if (pBlock) pBlock.style.display = 'none';
  if (mBlock) mBlock.style.display = 'none';
  if (vBlock) vBlock.style.display = 'none';
  if (yBlock) yBlock.style.display = 'none';
  if (aBlock) aBlock.style.display = 'none';
  if (sBlock) sBlock.style.display = 'flex';

  const titleEl = document.getElementById('inspector-title');
  const subtitleEl = document.getElementById('inspector-subtitle');
  const badgeEl = document.getElementById('inspector-status-badge');

  const homeName = sim.islandsData.get(ship.homeIslandId)?.name || 'Aegean Port';
  const targetName = ship.targetIslandId ? (sim.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId) : null;
  const currentName = ship.currentIslandId ? (sim.islandsData.get(ship.currentIslandId)?.name || ship.currentIslandId) : null;

  const def = sim.shipDefs.get(ship.typeId);
  const shipTypeName = def?.name || `Tier ${ship.tier} Vessel`;
  const tierIcon = getShipTierIcon(ship.tier, 22);

  if (titleEl) titleEl.innerHTML = `${tierIcon} <span>${ship.name}</span>`;
  if (subtitleEl) subtitleEl.textContent = `${shipTypeName} (Tier ${ship.tier}) • Home: ${homeName} Port`;

  // Voyage status & badge
  let statusText = 'Docked';
  let badgeClass = 'docked';
  if (ship.state === 'sailing') {
    statusText = `Sailing to ${targetName}`;
    badgeClass = 'sailing';
  } else if (ship.state === 'loading') {
    statusText = `Loading at ${currentName || homeName}`;
    badgeClass = 'loading';
  } else if (ship.state === 'unloading') {
    statusText = `Unloading at ${currentName || targetName}`;
    badgeClass = 'unloading';
  }

  if (badgeEl) {
    badgeEl.className = `badge-connected voyage-status-badge ${badgeClass}`;
    badgeEl.textContent = statusText;
    badgeEl.style.background = '';
    badgeEl.style.borderColor = '';
    badgeEl.style.color = '';
  }

  // Voyage banner & progress
  const voyageTitleEl = document.getElementById('vessel-voyage-title');
  const voyageTagEl = document.getElementById('vessel-status-tag');
  const progressFill = document.getElementById('vessel-progress-fill');
  const distTxt = document.getElementById('vessel-distance-txt');
  const speedTxt = document.getElementById('vessel-speed-txt');

  if (voyageTitleEl) {
    voyageTitleEl.textContent = ship.state === 'sailing' ? `➔ Sailing to ${targetName}` : `⚓ ${statusText}`;
  }
  if (voyageTagEl) {
    voyageTagEl.className = `voyage-status-badge ${badgeClass}`;
    voyageTagEl.textContent = ship.state;
  }

  const totalDist = ship.path?.totalDistanceKm || 0;
  const traveled = Math.min(totalDist, ship.distanceTraveledKm);
  const pct = totalDist > 0 ? Math.round((traveled / totalDist) * 100) : (ship.state === 'sailing' ? 100 : 0);

  if (progressFill) progressFill.style.width = `${pct}%`;
  if (distTxt) distTxt.textContent = `${traveled.toFixed(1)} / ${totalDist.toFixed(1)} km (${pct}%)`;
  if (speedTxt) {
    const curSpeedKm = ship.effectiveSpeedKmPerDay || ship.speedKmPerDay;
    const knots = (curSpeedKm / 44.45).toFixed(1);
    if (ship.state === 'sailing') {
      const windMod = ship.windSpeedModifier || 1.0;
      const cargoMod = ship.cargoSpeedModifier || 1.0;
      const notes: string[] = [];
      if (windMod >= 1.05) notes.push(`💨 Tailwind +${Math.round((windMod - 1) * 100)}%`);
      else if (windMod <= 0.95) notes.push(`⚠️ Headwind -${Math.round((1 - windMod) * 100)}%`);

      if (cargoMod >= 1.06) notes.push(`🪶 Ballast +${Math.round((cargoMod - 1) * 100)}%`);
      else if (cargoMod <= 0.90) notes.push(`📦 Laden -${Math.round((1 - cargoMod) * 100)}%`);

      const noteSuffix = notes.length > 0 ? ` (${notes.join(', ')})` : '';
      speedTxt.textContent = `${knots} kt${noteSuffix}`;
    } else {
      speedTxt.textContent = '0 kt (Docked)';
    }
  }

  // Cargo hold payload
  const cargoCap = document.getElementById('vessel-cargo-cap');
  const cargoDetail = document.getElementById('vessel-cargo-detail');
  if (cargoCap) {
    cargoCap.textContent = `${ship.cargo ? ship.cargo.quantity : 0} / ${ship.capacity} Cap`;
  }
  if (cargoDetail) {
    if (ship.cargo) {
      const goodName = formatGoodName(ship.cargo.goodId);
      const iconStyle = icons.getStyle();
      const goodIcon = getGoodIconSvg(ship.cargo.goodId, iconStyle, 24);
      const targetMarket = ship.targetIslandId ? sim.islands.get(ship.targetIslandId)?.markets[ship.cargo.goodId] : null;
      const curVal = targetMarket ? Math.floor(ship.cargo.quantity * targetMarket.sellPrice) : Math.floor(ship.cargo.quantity * ship.cargo.buyPrice);
      cargoDetail.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
          <span style="display:inline-flex; align-items:center; gap:6px;"><span class="good-icon-wrapper" style="width:24px; height:24px; min-width:24px; min-height:24px;">${goodIcon}</span> <strong>${ship.cargo.quantity} ${goodName}</strong></span>
          <span style="color:var(--accent-gold); font-weight:700;">Est. <span class="coin-icon">${getIconSvg('coin', iconStyle, 15)}</span> ${curVal.toLocaleString()}</span>
        </div>
      `;
    } else {
      const priorityGood = ship.cargoPriority && ship.cargoPriority !== 'auto' ? ship.cargoPriority : null;
      if (priorityGood) {
        const pGoodName = formatGoodName(priorityGood);
        const curEco = sim.islands.get(ship.currentIslandId || ship.homeIslandId);
        const producesLocally = (sim.islandsData.get(ship.currentIslandId || ship.homeIslandId)?.produces?.[priorityGood] || 0) > 0;
        if (!producesLocally) {
          cargoDetail.innerHTML = `<span style="color:#fbbf24; font-size:0.72rem;">⚠️ Hold empty. Mandated for <strong>${pGoodName}</strong> (${currentName || homeName} does not produce it). Travel to a supplier port below.</span>`;
        } else {
          const curStock = Math.floor(curEco?.markets[priorityGood]?.stock || 0);
          cargoDetail.innerHTML = `<span style="color:var(--text-secondary); font-size:0.72rem;">Hold empty. Mandated for <strong>${pGoodName}</strong> (Local stock: ${curStock}). Awaiting supply accumulation.</span>`;
        }
      } else {
        cargoDetail.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; font-size:0.72rem;">Hold empty. Seeking trade opportunity.</span>`;
      }
    }
  }

  // Stats Grid
  const tripsVal = document.getElementById('vessel-trips-val');
  const deliveredVal = document.getElementById('vessel-delivered-val');
  const profitVal = document.getElementById('vessel-profit-val');
  const upkeepVal = document.getElementById('vessel-upkeep-val');
  const coinIcon = getIconSvg('coin', icons.getStyle(), 15);

  if (tripsVal) tripsVal.textContent = ship.tripsCompleted.toString();
  if (deliveredVal) deliveredVal.innerHTML = `<span class="coin-icon">${coinIcon}</span> ${Math.floor(ship.totalDeliveredValue).toLocaleString()}`;
  if (profitVal) profitVal.innerHTML = `+<span class="coin-icon">${coinIcon}</span> ${Math.floor(ship.totalProfit).toLocaleString()}`;
  if (upkeepVal) upkeepVal.innerHTML = `<span class="coin-icon">${coinIcon}</span> ${ship.upkeepPerDay}/d`;

  // Home port tag & Cargo Priority
  const homeTag = document.getElementById('vessel-home-tag');
  if (homeTag) {
    homeTag.textContent = `Home: ${homeName}`;
  }

  const prioritySelect = document.getElementById('vessel-cargo-priority') as HTMLSelectElement | null;
  if (prioritySelect) {
    prioritySelect.value = ship.cargoPriority || 'auto';
  }

  // Strategic Voyage & Port Travel Recommendation
  const travelAnalysis = sim ? analyzeVesselVoyageOptions(sim, shipId) : null;
  const travelBadge = document.getElementById('vessel-travel-badge');
  const travelExpl = document.getElementById('vessel-travel-explanation');
  const travelRecs = document.getElementById('vessel-travel-recs');
  const travelSelect = document.getElementById('vessel-travel-select') as HTMLSelectElement | null;
  const travelGoBtn = document.getElementById('btn-vessel-travel-go') as HTMLButtonElement | null;

  if (travelBadge) {
    if (ship.state === 'sailing') {
      travelBadge.className = 'vessel-dest-badge sailing';
      travelBadge.textContent = 'En Route';
    } else if (ship.state === 'idle') {
      travelBadge.className = 'vessel-dest-badge docked';
      travelBadge.textContent = 'Awaiting Orders';
    } else {
      travelBadge.className = 'vessel-dest-badge';
      travelBadge.textContent = ship.state;
    }
  }

  if (travelExpl && travelAnalysis) {
    travelExpl.textContent = travelAnalysis.explanation;
  }

  if (travelRecs && travelAnalysis) {
    if (ship.state === 'sailing') {
      travelRecs.innerHTML = `
        <div class="vessel-travel-card">
          <div class="vessel-travel-card-header">
            <span class="vessel-travel-port-title">➔ Sailing to ${targetName || 'Destination Port'}</span>
            <span class="vessel-travel-tag">EN ROUTE</span>
          </div>
          <div class="vessel-travel-metrics">
            <span class="vessel-travel-distance">${totalDist.toFixed(1)} km route (${pct}%)</span>
            <span style="color:#94a3b8;">${distTxt?.textContent || ''}</span>
          </div>
          <div class="vessel-travel-reason">
            ${ship.cargo ? `Hauling ${ship.cargo.quantity} ${formatGoodName(ship.cargo.goodId)}` : `En route in ballast to load cargo at destination.`}
          </div>
        </div>
      `;
    } else {
      const top = travelAnalysis.topRecommendation;
      if (top) {
        let cardHtml = `
          <div class="vessel-travel-card ${!top.isAwake ? 'locked' : ''}">
            <div class="vessel-travel-card-header">
              <span class="vessel-travel-port-title">📍 ${top.portName} Port</span>
              <span class="vessel-travel-tag ${!top.isAwake ? 'locked' : (top.badgeText.includes('DEFICIT') ? 'deficit' : '')}">
                ${top.badgeText}
              </span>
            </div>
            <div class="vessel-travel-metrics">
              <span class="vessel-travel-distance">${top.distanceKm} km away</span>
              <span style="color:#94a3b8;">~${top.voyageDays} days voyage</span>
            </div>
            <div class="vessel-travel-reason">${top.reason}</div>
            ${top.isAwake
              ? `<button class="btn-vessel-travel-port" data-target-port-id="${top.portId}" title="Order ${ship.name} to sail to ${top.portName}">
                  🧭 Travel to ${top.portName} Port
                 </button>`
              : `<div style="font-size:0.68rem; color:#f87171; display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
                  <span>Requires Awakening (🪙 ${top.unlockCost})</span>
                  <button class="btn-vessel-alt-travel btn-awaken-view" data-target-port-id="${top.portId}">View in Directory</button>
                 </div>`
            }
          </div>
        `;

        if (travelAnalysis.alternativeRecommendations.length > 0) {
          cardHtml += `
            <div class="vessel-travel-alts">
              <span class="vessel-travel-alts-label">Alternative Ports:</span>
              ${travelAnalysis.alternativeRecommendations.map(alt => `
                <div class="vessel-travel-alt-row">
                  <span><strong>${alt.portName}</strong> (${alt.distanceKm} km)</span>
                  ${alt.isAwake
                    ? `<button class="btn-vessel-alt-travel btn-vessel-travel-port" data-target-port-id="${alt.portId}" title="Sail to ${alt.portName}">🧭 Travel</button>`
                    : `<span style="color:#f87171; font-size:0.62rem;">Locked</span>`
                  }
                </div>
              `).join('')}
            </div>
          `;
        }

        travelRecs.innerHTML = cardHtml;
      } else {
        travelRecs.innerHTML = `<span style="color:#94a3b8; font-size:0.70rem; font-style:italic;">No connected destination recommendations available.</span>`;
      }
    }
  }

  // Populate manual destination selector
  if (travelSelect && travelAnalysis) {
    const curVal = travelSelect.value;
    travelSelect.innerHTML = `<option value="">Choose Port to Travel...</option>` +
      travelAnalysis.allAvailablePorts.map(p => `
        <option value="${p.islandId}" ${!p.isAwake ? 'disabled style="color:#64748b;"' : ''}>
          ${p.name} (${p.distanceKm} km${!p.isAwake ? ' - 🔒 Locked' : ''}${p.tag})
        </option>
      `).join('');
    if (curVal && travelAnalysis.allAvailablePorts.some(p => p.islandId === curVal && p.isAwake)) {
      travelSelect.value = curVal;
      if (travelGoBtn) {
        travelGoBtn.disabled = false;
        const pName = sim.islandsData.get(curVal)?.name || 'Port';
        travelGoBtn.textContent = `🧭 Sail to ${pName}`;
      }
    } else {
      if (travelGoBtn) {
        travelGoBtn.disabled = true;
        travelGoBtn.textContent = `⛵ Set Sail`;
      }
    }
  }

  // Follow button state
  const followBtn = document.getElementById('btn-vessel-follow');
  if (followBtn) {
    const isFollowing = scene?.isFollowingShip() && selectedShipId === shipId;
    followBtn.className = `btn-follow ${isFollowing ? 'active' : ''}`;
    followBtn.textContent = isFollowing ? '⏹ Exit Follow' : '🎥 Follow Vessel';
  }

  // Decommission button state
  const decommBtn = document.getElementById('btn-vessel-decommission');
  if (decommBtn) {
    const refund = sim ? sim.getShipDecommissionRefund(shipId) : 0;
    decommBtn.innerHTML = `🔨 Decommission (+<span class="coin-icon">🪙</span> ${refund.toLocaleString()})`;
    decommBtn.title = `Decommission and scrap ${ship.name} to free 1 harbor berth at ${homeName} and recover 🪙 ${refund.toLocaleString()} drachmas`;
  }
}

// Active cargo transfer tracking for live load & unload animations in Left Inspector
interface ActiveGoodTransfer {
  islandId: string;
  goodId: string;
  type: 'load' | 'unload';
  quantity: number;
  shipName: string;
  expireAt: number;
}

const activeGoodTransfers = new Map<string, ActiveGoodTransfer>();

function recordCargoTransfer(
  islandId: string,
  goodId: string,
  type: 'load' | 'unload',
  quantity: number,
  shipName: string
) {
  const key = `${islandId}_${goodId}_${type}`;
  activeGoodTransfers.set(key, {
    islandId,
    goodId,
    type,
    quantity,
    shipName,
    expireAt: Date.now() + 3200,
  });

  if (selectedIsland?.id === islandId) {
    updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
  }
}

function updateInspector(island: IslandData, isLit?: boolean) {
  selectedShipId = null;
  selectedIsland = island;
  scene?.setSelectedIsland(island.id);
  const panel = document.getElementById('inspector-panel');
  if (panel) {
    panel.classList.remove('closed');
  }

  // Restore island blocks, hide ship block
  const pBlock = document.getElementById('inspector-prosperity-block');
  const mBlock = document.getElementById('inspector-market-block');
  const vBlock = document.getElementById('inspector-vessels-block');
  const yBlock = document.getElementById('inspector-shipyard-block');
  const aBlock = document.getElementById('inspector-actions-block');
  const sBlock = document.getElementById('inspector-ship-block');

  if (pBlock) pBlock.style.display = '';
  if (mBlock) mBlock.style.display = '';
  if (vBlock) vBlock.style.display = '';
  if (yBlock) yBlock.style.display = '';
  if (aBlock) aBlock.style.display = '';
  if (sBlock) sBlock.style.display = 'none';

  const titleEl = document.getElementById('inspector-title');
  const subtitleEl = document.getElementById('inspector-subtitle');
  const badgeEl = document.getElementById('inspector-status-badge');
  const producesEl = document.getElementById('inspector-produces');
  const consumesEl = document.getElementById('inspector-consumes');
  const routeBtn = document.getElementById('btn-new-route');

  const prosperityVal = document.getElementById('inspector-prosperity-val');
  const prosperityBar = document.getElementById('inspector-prosperity-bar');

  if (titleEl) titleEl.textContent = `${getIslandName(island.id, island.name)} ${t('inspector.port')}`;
  if (subtitleEl) {
    const regionName = island.region ? getRegionName(island.region) : (island.type === 'mainland_port' ? 'Mainland' : 'Island');
    subtitleEl.textContent = `${regionName} • ${t('inspector.population')}: ${island.population.toLocaleString()}`;
  }

  const economy = sim?.islands.get(island.id);
  const isUnlocked = sim ? sim.unlockedIslands.has(island.id) : (isLit !== undefined ? isLit : !!island.unlock?.isStart);
  const lit = isUnlocked;

  // Auto-sync terrain shader if sim is unlocked but terrain wasn't updated yet
  if (scene && isUnlocked && !scene.isIslandLit(island)) {
    scene.setIslandLitImmediate(island, true);
  }

  if (badgeEl) {
    if (lit) {
      badgeEl.className = 'badge-connected';
      badgeEl.style.background = '';
      badgeEl.style.borderColor = '';
      badgeEl.style.color = '';
      badgeEl.textContent = t('inspector.status.connected');
    } else {
      badgeEl.className = 'badge-connected';
      badgeEl.style.background = 'rgba(242, 193, 78, 0.15)';
      badgeEl.style.borderColor = 'rgba(242, 193, 78, 0.35)';
      badgeEl.style.color = '#f2c14e';
      badgeEl.textContent = t('inspector.status.awaiting');
    }
  }

  // Update festival banner if active on this island
  const festivalBanner = document.getElementById('inspector-festival-banner');
  const activeEvent = sim?.eventManager.getActiveEventForIsland(island.id);
  if (festivalBanner) {
    if (activeEvent) {
      const remainingDays = Math.max(0, Math.ceil(activeEvent.durationDays - ((sim?.gameDay || 0) - activeEvent.startDay)));
      festivalBanner.style.display = 'block';
      festivalBanner.style.borderLeftColor = activeEvent.color;
      festivalBanner.innerHTML = `
        <div class="festival-banner-header">
          <span class="festival-badge-pill" style="background: ${activeEvent.color}26; color: ${activeEvent.color}; border: 1px solid ${activeEvent.color}66">${activeEvent.badge}</span>
          <span class="festival-duration-tag">⏳ ~${remainingDays}d remaining</span>
        </div>
        <h4 class="festival-banner-title">${activeEvent.title}</h4>
        <p class="festival-banner-desc">${activeEvent.description}</p>
      `;
    } else {
      festivalBanner.style.display = 'none';
      festivalBanner.innerHTML = '';
    }
  }

  // Update prosperity meter
  if (economy && prosperityVal && prosperityBar) {
    const pVal = Math.max(0, Math.min(1, economy.prosperity));
    const pPct = Math.round(pVal * 100);
    const exactPctStr = formatProsperityExact(pVal);
    const pHex = getProsperityHex(pVal);

    // Calculate live fulfillment & recovery momentum
    let surplusCount = 0;
    let starvingCount = 0;
    let totalActiveMarkets = 0;
    for (const m of Object.values(economy.markets)) {
      if (m.consumeRatePerDay > 0 || m.produceRatePerDay > 0) {
        totalActiveMarkets++;
        if (m.isStarving) starvingCount++;
        if (m.isSurplus || m.stock >= m.targetStock) surplusCount++;
      }
    }
    const fulfillmentRatio = totalActiveMarkets > 0 ? surplusCount / totalActiveMarkets : 1.0;
    const isDistressed = economy.distress > 0.15;
    const isRecovering = fulfillmentRatio >= 0.70 && !isDistressed && pPct < 75;

    let statusKey = 'struggling';
    let baseStatusText = t('inspector.status.struggling');
    if (isDistressed) {
      statusKey = 'distressed';
      baseStatusText = t('inspector.status.distressed');
    } else if (pPct >= 75) {
      statusKey = 'booming';
      baseStatusText = t('inspector.status.booming');
    } else if (pPct >= 40) {
      statusKey = 'stable';
      baseStatusText = t('inspector.status.stable');
    }

    const trendSuffix = isRecovering ? ' ↗' : (isDistressed ? ' ↘' : '');
    prosperityVal.textContent = `${exactPctStr} ${baseStatusText}${trendSuffix}`;
    prosperityVal.className = `prosperity-badge ${statusKey}`;
    prosperityVal.style.color = pHex;
    prosperityVal.style.backgroundColor = `${pHex}22`;
    prosperityVal.style.borderColor = `${pHex}66`;
    prosperityVal.style.boxShadow = `0 0 10px ${pHex}33`;

    // Informative tooltip explaining prosperity state and recovery
    const recoveryTip = isRecovering
      ? `• Recovery Active: All imports satisfied! Prosperity climbing +5%/day towards 75%+.\n`
      : isDistressed
      ? `• Distress Alert: Island starving for vital goods (-7.5%/day decline)!\n`
      : '';
    const tooltipText = `Island Prosperity: ${exactPctStr} (${baseStatusText})\n${recoveryTip}• Import Satisfaction: ${Math.round(fulfillmentRatio * 100)}%\n• Distress Index: ${(economy.distress * 100).toFixed(0)}%`;
    prosperityVal.setAttribute('data-game-tooltip', tooltipText);
    prosperityBar.setAttribute('data-game-tooltip', tooltipText);

    const pctNum = Math.max(2, Math.min(100, pVal * 100));
    prosperityBar.style.setProperty('--prosperity-pct', `${pctNum}%`);
    prosperityBar.style.clipPath = `inset(0 ${100 - pctNum}% 0 0)`;
    prosperityBar.style.background = '';
    prosperityBar.style.boxShadow = `0 0 8px ${pHex}66`;

    updateProsperityLegendSelection(pVal, island.name);
  }

  // Update unlock/route button
  if (routeBtn) {
    if (lit) {
      routeBtn.textContent = t('inspector.awaken.connected');
      routeBtn.classList.remove('btn-primary');
      routeBtn.classList.add('btn-secondary');
      routeBtn.title = `${island.name} is connected to the maritime trade network (Press K to toggle visual mode)`;
    } else {
      const cost = island.unlock?.cost || 0;
      const tp = island.unlock?.tp || 0;
      const required = island.unlock?.requiresConnectedTo;
      const hasConnection = !required || required.length === 0 || required.some((reqId) => sim?.unlockedIslands.has(reqId));
      const canAfford = (sim?.treasury || 0) >= cost && (sim?.tradePoints || 0) >= tp;

      routeBtn.innerHTML = `${t('inspector.awaken')} (<span class="coin-icon">🪙</span> ${cost} • <span class="chip-icon">⚓</span> ${tp} TP)`;
      if (canAfford && hasConnection) {
        routeBtn.classList.remove('btn-secondary');
        routeBtn.classList.add('btn-primary');
        routeBtn.title = `Awaken ${island.name} into the Aegean trade network`;
      } else {
        routeBtn.classList.remove('btn-primary');
        routeBtn.classList.add('btn-secondary');
        routeBtn.title = !hasConnection
          ? `Must connect to ${required?.map((id) => sim?.islandsData.get(id)?.name || id).join(' or ')} first`
          : `Need 🪙 ${cost} drachmas and ⚓ ${tp} TP (have 🪙 ${Math.floor(sim?.treasury || 0)}, ⚓ ${sim?.tradePoints || 0} TP)`;
      }

      const reqBox = document.getElementById('inspector-unlock-req-box');
      if (reqBox) {
        if (!lit && !hasConnection && required && required.length > 0) {
          const links = required.map((reqId) => {
            const reqName = sim?.islandsData.get(reqId)?.name || reqId;
            return `<button class="feed-island-link" data-island-id="${reqId}" title="Select and focus on ${reqName}">📍 ${reqName}</button>`;
          }).join(' or ');
          reqBox.innerHTML = `
            <div class="inspector-unlock-req-header">⚠️ Requires maritime connection:</div>
            <div class="inspector-unlock-req-islands">${links}</div>
          `;
          reqBox.style.display = 'flex';
        } else {
          reqBox.style.display = 'none';
          reqBox.innerHTML = '';
        }
      }
    }
  }

  const now = Date.now();

  // Render Production & Exports with live inventory, prices, graphical stock gauges, and transfer animation
  if (producesEl && island.produces) {
    const iconStyle = icons.getStyle();
    let hasActiveExportTransfer = false;
    let activeExportQty = 0;
    let totalExportRate = 0;
    const lowExportGoods: string[] = [];
    const cappedExportGoods: string[] = [];

    const producesEntries = Object.entries(island.produces);
    const canUpdateInPlace =
      producesEl.getAttribute('data-island-id') === island.id &&
      producesEl.querySelectorAll('.good-pill.producer').length === producesEntries.length &&
      producesEntries.every(([good]) => !!producesEl.querySelector(`.good-pill[data-good-id="${good}"]`));

    const renderedPills = producesEntries.map(([good, rate]) => {
      totalExportRate += rate;
      const transfer = activeGoodTransfers.get(`${island.id}_${good}_load`);
      const isTransferring = !!(transfer && transfer.expireAt > now);
      if (isTransferring) {
        hasActiveExportTransfer = true;
        activeExportQty += transfer.quantity;
      }

      const goodIcon = getGoodIconSvg(good, iconStyle, 18);
      const market = economy?.markets[good];
      const stock = market ? market.stock : 0;
      const maxCapacity = market ? Math.max(1, market.maxCapacity) : 100;
      const fillPct = Math.min(100, Math.round((stock / maxCapacity) * 100));
      const stockStr = `${Math.floor(stock)}/${maxCapacity}`;

      // Identify low or depleted export warehouse reserves
      const isExportLow = fillPct <= 10 || (market ? stock < Math.max(10, market.targetStock * 0.5) : false);
      const isExportCapped = fillPct >= 85;

      if (isExportLow) {
        lowExportGoods.push(good);
      } else if (isExportCapped) {
        cappedExportGoods.push(good);
      }

      let exportStatusClass = 'export-healthy';
      let statusDotClass = 'healthy';
      let statusTag = `${fillPct}%`;
      if (isExportLow) {
        exportStatusClass = 'export-low';
        statusDotClass = 'low';
        statusTag = '⚠️ Low Reserve';
      } else if (isExportCapped) {
        exportStatusClass = 'export-capped';
        statusDotClass = 'capped';
        statusTag = '📦 Packed';
      }

      const isEventGood = !!(activeEvent && activeEvent.affectedGoods.includes(good));
      const eventTag = isEventGood
        ? `<span class="festival-good-tag" style="background: ${activeEvent.color}25; color: ${activeEvent.color}; border: 1px solid ${activeEvent.color}55;" title="${activeEvent.title}">${activeEvent.badge}</span>`
        : '';
      const priceChipClass = isEventGood ? 'good-price-chip festival-price' : 'good-price-chip';
      const priceStr = market ? `<span class="coin-icon">${getIconSvg('coin', iconStyle, 13)}</span> ${market.buyPrice.toFixed(1)}${isEventGood ? ' 🔥' : ''}` : '';

      const transferBanner = isTransferring
        ? `<div class="good-transfer-banner load"><span class="transfer-arrow">▲</span> Loading <strong>${transfer.quantity}t</strong> ➔ ${transfer.shipName}</div>`
        : '';
      const deltaChip = isTransferring
        ? `<span class="transfer-qty-delta load">-${transfer.quantity}t</span>`
        : '';
      const stockChipClass = isTransferring ? 'good-stock-chip stock-load-flash' : 'good-stock-chip';

      const titleStr = isExportLow
        ? `⚠️ LOW EXPORT RESERVE: ${formatGoodName(good)} warehouse is nearly empty (${stockStr}, ${fillPct}%)! Ships cannot buy until local production recovers • Daily Output: +${rate}/d`
        : `Exports ${formatGoodName(good)} • Warehouse: ${stockStr} (${fillPct}% full) • Daily Output: +${rate}/day • Tap to inspect supply chain`;

      if (canUpdateInPlace) {
        const pill = producesEl.querySelector<HTMLElement>(`.good-pill[data-good-id="${good}"]`);
        if (pill) {
          const nextPillClass = `good-pill producer ${isExportLow ? 'depleted' : ''} ${isTransferring ? 'transfer-anim-load' : ''}`;
          if (pill.className !== nextPillClass) pill.className = nextPillClass;
          if (pill.hasAttribute('data-game-tooltip')) {
            if (pill.getAttribute('data-game-tooltip') !== titleStr) {
              pill.setAttribute('data-game-tooltip', titleStr);
            }
          } else if (pill.getAttribute('title') !== titleStr) {
            pill.setAttribute('title', titleStr);
          }

          const fillEl = pill.querySelector<HTMLElement>('.good-stock-gauge-fill');
          if (fillEl) {
            const nextClass = `good-stock-gauge-fill ${exportStatusClass}`;
            if (fillEl.className !== nextClass) fillEl.className = nextClass;
            const nextWidth = `${Math.max(4, fillPct)}%`;
            if (fillEl.style.width !== nextWidth) fillEl.style.width = nextWidth;
          }

          const dotEl = pill.querySelector<HTMLElement>('.stock-status-dot');
          if (dotEl) {
            const nextClass = `stock-status-dot ${statusDotClass}`;
            if (dotEl.className !== nextClass) dotEl.className = nextClass;
          }

          const stockChip = pill.querySelector<HTMLElement>('.good-stock-chip');
          if (stockChip) {
            if (stockChip.className !== stockChipClass) stockChip.className = stockChipClass;
            if (stockChip.textContent !== stockStr) stockChip.textContent = stockStr;
            stockChip.removeAttribute('title');
          }

          const tagEl = pill.querySelector<HTMLElement>('.stock-status-tag');
          if (tagEl) {
            const nextClass = `stock-status-tag ${statusDotClass}`;
            if (tagEl.className !== nextClass) tagEl.className = nextClass;
            if (tagEl.textContent !== statusTag) tagEl.textContent = statusTag;
          }

          const priceEl = pill.querySelector<HTMLElement>('.good-price-chip');
          if (priceEl && market) {
            if (priceEl.className !== priceChipClass) priceEl.className = priceChipClass;
            priceEl.removeAttribute('title');
            if (priceEl.innerHTML !== priceStr) priceEl.innerHTML = priceStr;
          }

          let banner = pill.querySelector<HTMLElement>('.good-transfer-banner');
          if (isTransferring) {
            if (!banner) {
              banner = document.createElement('div');
              pill.appendChild(banner);
            }
            if (banner.className !== 'good-transfer-banner load') banner.className = 'good-transfer-banner load';
            const bannerHtml = `<span class="transfer-arrow">▲</span> Loading <strong>${transfer.quantity}t</strong> ➔ ${transfer.shipName}`;
            if (banner.innerHTML !== bannerHtml) banner.innerHTML = bannerHtml;
          } else if (banner) {
            banner.remove();
          }

          let deltaEl = pill.querySelector<HTMLElement>('.transfer-qty-delta');
          if (isTransferring) {
            if (!deltaEl) {
              deltaEl = document.createElement('span');
              pill.querySelector('.good-pill-name')?.appendChild(deltaEl);
            }
            if (deltaEl.className !== 'transfer-qty-delta load') deltaEl.className = 'transfer-qty-delta load';
            const deltaText = `-${transfer.quantity}t`;
            if (deltaEl.textContent !== deltaText) deltaEl.textContent = deltaText;
          } else if (deltaEl) {
            deltaEl.remove();
          }
        }
      }

      return `
        <div class="good-pill producer ${isExportLow ? 'depleted' : ''} ${isTransferring ? 'transfer-anim-load' : ''}" data-island-id="${island.id}" data-good-id="${good}" title="${titleStr}">
          <div class="good-pill-left">
            <span class="good-pill-name">
              <span class="good-icon-wrapper">${goodIcon}</span>
              <span class="good-name-text">${formatGoodName(good)}</span>
              ${deltaChip}
              ${eventTag}
            </span>
            <div class="good-rate-chip producer ${rate >= 5 ? 'high' : ''}">
              <span class="rate-chevron">▲</span>+${rate}/d
            </div>
          </div>

          <div class="good-stock-gauge-bar">
            <div class="good-stock-gauge-fill ${exportStatusClass}" style="width: ${Math.max(4, fillPct)}%;"></div>
          </div>

          <div class="good-pill-right">
            <div class="stock-status-wrap">
              <span class="stock-status-dot ${statusDotClass}"></span>
              <span class="${stockChipClass}">${stockStr}</span>
              <span class="stock-status-tag ${statusDotClass}">${statusTag}</span>
            </div>
            <span class="${priceChipClass}">${priceStr}</span>
          </div>
          ${transferBanner}
        </div>
      `;
    });

    if (!canUpdateInPlace) {
      producesEl.setAttribute('data-island-id', island.id);
      producesEl.innerHTML = renderedPills.join('');
    }

    // Update Exports Column Header Pill
    const expPill = document.getElementById('transfer-pill-exports');
    if (expPill) {
      if (hasActiveExportTransfer) {
        expPill.className = 'col-transfer-pill active-load';
        expPill.innerHTML = `<span class="transfer-pill-dot load"></span><span>Loading ${activeExportQty}t</span>`;
        expPill.removeAttribute('title');
      } else if (lowExportGoods.length > 0) {
        expPill.className = 'col-summary-chip low-export';
        const primaryLow = formatGoodName(lowExportGoods[0]);
        expPill.textContent = lowExportGoods.length === 1 ? `⚠️ ${primaryLow} Low` : `⚠️ ${lowExportGoods.length} Low`;
        expPill.title = `${lowExportGoods.map((g) => formatGoodName(g)).join(', ')} reserve critically low in warehouse`;
      } else if (cappedExportGoods.length > 0) {
        expPill.className = 'col-summary-chip capped-export';
        const primaryCapped = formatGoodName(cappedExportGoods[0]);
        expPill.textContent = cappedExportGoods.length === 1 ? `📦 ${primaryCapped} Full` : `📦 ${cappedExportGoods.length} Full`;
        expPill.title = `${cappedExportGoods.map((g) => formatGoodName(g)).join(', ')} warehouse capacity full`;
      } else {
        expPill.className = 'col-summary-chip export';
        expPill.textContent = `+${totalExportRate}/d`;
        expPill.title = `Total Island Production: +${totalExportRate}/day`;
      }
    }
  }

  // Render Imports & Demands with live inventory, prices, shortages, graphical stock gauges, and transfer animation
  if (consumesEl && island.consumes) {
    const iconStyle = icons.getStyle();
    let hasActiveImportTransfer = false;
    let activeImportQty = 0;
    let starvingCount = 0;

    const consumesEntries = Object.entries(island.consumes);
    const canUpdateInPlace =
      consumesEl.getAttribute('data-island-id') === island.id &&
      consumesEl.querySelectorAll('.good-pill.consumer').length === consumesEntries.length &&
      consumesEntries.every(([good]) => !!consumesEl.querySelector(`.good-pill[data-good-id="${good}"]`));

    const renderedPills = consumesEntries.map(([good, rate]) => {
      const transfer = activeGoodTransfers.get(`${island.id}_${good}_unload`);
      const isTransferring = !!(transfer && transfer.expireAt > now);
      if (isTransferring) {
        hasActiveImportTransfer = true;
        activeImportQty += transfer.quantity;
      }

      const goodIcon = getGoodIconSvg(good, iconStyle, 18);
      const market = economy?.markets[good];
      const stock = market ? market.stock : 0;
      const targetStock = market ? Math.max(1, market.targetStock) : 15;
      const bufferPct = Math.round((stock / targetStock) * 100);
      const isStarving = !!market?.isStarving || stock <= 0;
      if (isStarving) starvingCount++;
      const stockStr = `${Math.floor(stock)}/${targetStock}b`;

      let importStatusClass = 'import-satisfied';
      let statusDotClass = 'satisfied';
      let statusTag = `${bufferPct}%`;

      if (isStarving) {
        importStatusClass = 'import-starving';
        statusDotClass = 'starving';
        statusTag = '⚠️ STARVING';
      } else if (bufferPct < 40) {
        importStatusClass = 'import-low';
        statusDotClass = 'low';
        statusTag = 'Low';
      } else if (bufferPct >= 200) {
        importStatusClass = 'import-surplus';
        statusDotClass = 'surplus';
        statusTag = 'Abundant';
      }

      const isEventGood = !!(activeEvent && activeEvent.affectedGoods.includes(good));
      const eventTag = isEventGood
        ? `<span class="festival-good-tag" style="background: ${activeEvent.color}25; color: ${activeEvent.color}; border: 1px solid ${activeEvent.color}55;" title="${activeEvent.title}">${activeEvent.badge}</span>`
        : '';
      const priceChipClass = isEventGood ? 'good-price-chip festival-price' : 'good-price-chip';
      const priceStr = market ? `<span class="coin-icon">${getIconSvg('coin', iconStyle, 13)}</span> ${market.buyPrice.toFixed(1)}${isEventGood ? ' 🔥' : ''}` : '';

      const transferBanner = isTransferring
        ? `<div class="good-transfer-banner unload"><span class="transfer-arrow">▼</span> Received <strong>+${transfer.quantity}t</strong> from ${transfer.shipName}</div>`
        : '';
      const deltaChip = isTransferring
        ? `<span class="transfer-qty-delta unload">+${transfer.quantity}t</span>`
        : '';
      const stockChipClass = isTransferring ? 'good-stock-chip stock-unload-flash' : 'good-stock-chip';

      const titleStr = `Needs ${formatGoodName(good)}${isStarving ? ' - STARVING! Urgent supply needed!' : ''} • Reserve: ${stockStr} (${bufferPct}%) • Daily Consumption: -${rate}/day • Tap to inspect supply routes`;

      if (canUpdateInPlace) {
        const pill = consumesEl.querySelector<HTMLElement>(`.good-pill[data-good-id="${good}"]`);
        if (pill) {
          const nextPillClass = `good-pill consumer ${isStarving ? 'starving' : ''} ${isTransferring ? 'transfer-anim-unload' : ''}`;
          if (pill.className !== nextPillClass) pill.className = nextPillClass;
          if (pill.hasAttribute('data-game-tooltip')) {
            if (pill.getAttribute('data-game-tooltip') !== titleStr) {
              pill.setAttribute('data-game-tooltip', titleStr);
            }
          } else if (pill.getAttribute('title') !== titleStr) {
            pill.setAttribute('title', titleStr);
          }

          const fillEl = pill.querySelector<HTMLElement>('.good-stock-gauge-fill');
          if (fillEl) {
            const nextClass = `good-stock-gauge-fill ${importStatusClass}`;
            if (fillEl.className !== nextClass) fillEl.className = nextClass;
            const nextWidth = `${isStarving ? 100 : Math.max(4, Math.min(100, bufferPct))}%`;
            if (fillEl.style.width !== nextWidth) fillEl.style.width = nextWidth;
          }

          const dotEl = pill.querySelector<HTMLElement>('.stock-status-dot');
          if (dotEl) {
            const nextClass = `stock-status-dot ${statusDotClass}`;
            if (dotEl.className !== nextClass) dotEl.className = nextClass;
          }

          const stockChip = pill.querySelector<HTMLElement>('.good-stock-chip');
          if (stockChip) {
            if (stockChip.className !== stockChipClass) stockChip.className = stockChipClass;
            if (stockChip.textContent !== stockStr) stockChip.textContent = stockStr;
            stockChip.removeAttribute('title');
          }

          const tagEl = pill.querySelector<HTMLElement>('.stock-status-tag');
          if (tagEl) {
            const nextClass = `stock-status-tag ${statusDotClass}`;
            if (tagEl.className !== nextClass) tagEl.className = nextClass;
            if (tagEl.textContent !== statusTag) tagEl.textContent = statusTag;
          }

          const priceEl = pill.querySelector<HTMLElement>('.good-price-chip');
          if (priceEl && market) {
            if (priceEl.className !== priceChipClass) priceEl.className = priceChipClass;
            priceEl.removeAttribute('title');
            if (priceEl.innerHTML !== priceStr) priceEl.innerHTML = priceStr;
          }

          let banner = pill.querySelector<HTMLElement>('.good-transfer-banner');
          if (isTransferring) {
            if (!banner) {
              banner = document.createElement('div');
              pill.appendChild(banner);
            }
            if (banner.className !== 'good-transfer-banner unload') banner.className = 'good-transfer-banner unload';
            const bannerHtml = `<span class="transfer-arrow">▼</span> Received <strong>+${transfer.quantity}t</strong> from ${transfer.shipName}`;
            if (banner.innerHTML !== bannerHtml) banner.innerHTML = bannerHtml;
          } else if (banner) {
            banner.remove();
          }

          let deltaEl = pill.querySelector<HTMLElement>('.transfer-qty-delta');
          if (isTransferring) {
            if (!deltaEl) {
              deltaEl = document.createElement('span');
              pill.querySelector('.good-pill-name')?.appendChild(deltaEl);
            }
            if (deltaEl.className !== 'transfer-qty-delta unload') deltaEl.className = 'transfer-qty-delta unload';
            const deltaText = `+${transfer.quantity}t`;
            if (deltaEl.textContent !== deltaText) deltaEl.textContent = deltaText;
          } else if (deltaEl) {
            deltaEl.remove();
          }
        }
      }

      return `
        <div class="good-pill consumer ${isStarving ? 'starving' : ''} ${isTransferring ? 'transfer-anim-unload' : ''}" data-island-id="${island.id}" data-good-id="${good}" title="${titleStr}">
          <div class="good-pill-left">
            <span class="good-pill-name">
              <span class="good-icon-wrapper">${goodIcon}</span>
              <span class="good-name-text">${formatGoodName(good)}</span>
              ${deltaChip}
              ${eventTag}
            </span>
            <div class="good-rate-chip consumer ${rate >= 3 ? 'high' : ''}">
              <span class="rate-chevron">▼</span>-${rate}/d
            </div>
          </div>

          <div class="good-stock-gauge-bar">
            <div class="good-stock-gauge-fill ${importStatusClass}" style="width: ${isStarving ? 100 : Math.max(4, Math.min(100, bufferPct))}%;"></div>
          </div>

          <div class="good-pill-right">
            <div class="stock-status-wrap">
              <span class="stock-status-dot ${statusDotClass}"></span>
              <span class="${stockChipClass}">${stockStr}</span>
              <span class="stock-status-tag ${statusDotClass}">${statusTag}</span>
            </div>
            <span class="${priceChipClass}">${priceStr}</span>
          </div>
          ${transferBanner}
        </div>
      `;
    });

    if (!canUpdateInPlace) {
      consumesEl.setAttribute('data-island-id', island.id);
      consumesEl.innerHTML = renderedPills.join('');
    }

    // Update Imports Column Header Pill
    const impPill = document.getElementById('transfer-pill-imports');
    if (impPill) {
      if (hasActiveImportTransfer) {
        impPill.className = 'col-transfer-pill active-unload';
        impPill.innerHTML = `<span class="transfer-pill-dot unload"></span><span>Delivered +${activeImportQty}t</span>`;
      } else if (starvingCount > 0) {
        impPill.className = 'col-summary-chip starving';
        impPill.textContent = `⚠️ ${starvingCount} Starving`;
      } else {
        impPill.className = 'col-summary-chip ok';
        impPill.textContent = '✓ All Buffered';
      }
    }
  }

  // Render Active Routes & Vessels (Decluttered, Spacious & Grouped / Filterable)
  const routesEl = document.getElementById('inspector-routes');
  const fleetCountEl = document.getElementById('inspector-fleet-count');
  const congestionEl = document.getElementById('inspector-congestion-banner');
  const filterBarEl = document.getElementById('inspector-vessel-filter-bar');

  if (sim?.shipManager) {
    const islandShips = Array.from(sim.shipManager.ships.values()).filter(
      (s) => s.currentIslandId === island.id || s.targetIslandId === island.id || s.homeIslandId === island.id
    );

    const islandUtilization = islandShips.map((s) => ({
      ship: s,
      uInfo: sim ? evaluateShipUtilization(s, sim) : null,
    }));
    const idleItems = islandUtilization.filter((item) => item.uInfo !== null);
    const activeItems = islandUtilization.filter((item) => item.uInfo === null);

    // 1. Update Header Counter
    if (fleetCountEl) {
      fleetCountEl.innerHTML =
        idleItems.length > 0
          ? `${islandShips.length} <span style="color:#f87171; font-weight:700;" title="${idleItems.length} underutilized vessel(s) at harbor">⚠️${idleItems.length}</span>`
          : islandShips.length.toString();
    }

    // 2. Harbor Congestion Notice (when berths are exceeded)
    const berthsUsed = sim ? sim.getHomePortedShipsCount(island.id) : islandShips.length;
    const berthsMax = sim ? sim.getPortFleetCapacity(island.id) : 3;
    if (congestionEl) {
      if (berthsUsed > berthsMax) {
        congestionEl.style.display = 'flex';
        congestionEl.innerHTML = `
          <span class="congestion-icon">⚓</span>
          <div class="congestion-info">
            <span class="congestion-title">Harbor Congested (${berthsUsed}/${berthsMax} Berths)</span>
            <span class="congestion-desc">${berthsUsed - berthsMax} excess vessel(s) sitting idle. Reassign to ports with open berths.</span>
          </div>
        `;
      } else {
        congestionEl.style.display = 'none';
      }
    }

    // 3. Filter Bar (rendered when island has more than 2 vessels)
    if (filterBarEl) {
      if (islandShips.length > 2) {
        filterBarEl.style.display = 'flex';
        filterBarEl.innerHTML = `
          <div class="vessel-filter-pills">
            <button class="vessel-filter-btn ${inspectorVesselFilter === 'all' ? 'active' : ''}" data-filter="all">All (${islandShips.length})</button>
            ${activeItems.length > 0 ? `<button class="vessel-filter-btn ${inspectorVesselFilter === 'active' ? 'active' : ''}" data-filter="active">Active (${activeItems.length})</button>` : ''}
            ${idleItems.length > 0 ? `<button class="vessel-filter-btn alert ${inspectorVesselFilter === 'idle' ? 'active' : ''}" data-filter="idle">⚠️ Idle (${idleItems.length})</button>` : ''}
          </div>
          <button class="vessel-view-toggle-btn" id="btn-toggle-vessel-view" title="${inspectorVesselViewMode === 'grouped' ? 'Switch to Individual Vessel List' : 'Switch to Grouped Class Summary'}">
            ${inspectorVesselViewMode === 'grouped' ? '☰ List' : '⊞ Group'}
          </button>
        `;
      } else {
        filterBarEl.style.display = 'none';
      }
    }

    // 4. Filter vessels based on active filter tab
    let displayedItems = islandUtilization;
    if (inspectorVesselFilter === 'active') {
      displayedItems = activeItems;
    } else if (inspectorVesselFilter === 'idle') {
      displayedItems = idleItems;
    }

    if (routesEl) {
      if (displayedItems.length > 0) {
        const iconStyle = icons.getStyle();
        const coinIcon = getIconSvg('coin', iconStyle, 14);

        if (inspectorVesselViewMode === 'grouped') {
          // Grouped summary view by ship type/tier
          const groups = new Map<string, { ships: typeof islandShips; idleCount: number; totalProfit: number; tier: number; totalCap: number }>();
          for (const item of displayedItems) {
            const s = item.ship;
            if (!groups.has(s.typeId)) {
              groups.set(s.typeId, { ships: [], idleCount: 0, totalProfit: 0, tier: s.tier, totalCap: 0 });
            }
            const g = groups.get(s.typeId)!;
            g.ships.push(s);
            if (item.uInfo) g.idleCount++;
            g.totalProfit += s.totalProfit;
            g.totalCap += s.capacity;
          }

          routesEl.setAttribute('data-island-id', island.id);
          routesEl.setAttribute('data-filter', inspectorVesselFilter);
          routesEl.setAttribute('data-view', 'grouped');

          routesEl.innerHTML = Array.from(groups.entries())
            .map(([typeId, g]) => {
              const typeName = typeId.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              let profitStr = Math.floor(g.totalProfit).toString();
              if (g.totalProfit >= 1000) profitStr = `${(g.totalProfit / 1000).toFixed(1)}k`;

              const statusBadge = g.idleCount > 0
                ? `<span class="vessel-underutilized-chip ${g.idleCount === g.ships.length ? 'high' : 'medium'}">⚠️ ${g.idleCount} Idle</span>`
                : `<span class="vessel-dest-chip sailing">✓ All Active</span>`;

              return `
                <div class="vessel-group-card">
                  <div class="group-card-header">
                    <div class="group-card-title">
                      <span class="shipyard-tier-badge tier-${g.tier}">T${g.tier}</span>
                      <strong>${g.ships.length}x ${typeName}</strong>
                    </div>
                    <div class="group-card-tags">
                      ${statusBadge}
                      <span class="vessel-profit-chip">+<span class="coin-icon">${coinIcon}</span> ${profitStr}</span>
                    </div>
                  </div>
                  <div class="group-card-sub">
                    Hold: ${g.totalCap}t • ${g.ships.length - g.idleCount} sailing, ${g.idleCount} docked at harbor
                  </div>
                  <div class="group-card-actions">
                    <button class="btn-inspector-manage-fleet btn-reassign-fleet-group" data-island-id="${island.id}">
                      ⚓ Manage & Reassign Fleet
                    </button>
                    ${g.idleCount > 0 ? `
                      <button class="btn-inspector-manage-fleet btn-scrap-group" data-type-id="${typeId}" data-island-id="${island.id}" title="Decommission 1 idle ${typeName} to immediately free 1 harbor berth (+🪙 ${sim ? Math.floor((sim.shipDefs.get(typeId)?.cost || 100) * 0.5) : 0})">
                        🔨 Scrap 1x (+🪙 ${sim ? Math.floor((sim.shipDefs.get(typeId)?.cost || 100) * 0.5) : 0})
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            })
            .join('');
        } else {
          // Streamlined Individual Vessel Rows: Zero Redundant Chips & Full Ship Name
          const canUpdateRoutesInPlace =
            routesEl.getAttribute('data-island-id') === island.id &&
            routesEl.getAttribute('data-filter') === inspectorVesselFilter &&
            routesEl.getAttribute('data-view') === 'list' &&
            routesEl.querySelectorAll('.vessel-row').length === displayedItems.length &&
            displayedItems.every(({ ship: s }) => !!document.getElementById(`route-${s.id}`));

          if (canUpdateRoutesInPlace) {
            for (const { ship: s, uInfo } of displayedItems) {
              const row = document.getElementById(`route-${s.id}`);
              if (!row) continue;
              const goodName = s.cargo ? formatGoodName(s.cargo.goodId) : 'Empty';
              const targetName = s.targetIslandId ? (sim?.islandsData.get(s.targetIslandId)?.name || s.targetIslandId) : 'Docked';

              let dotClass = 'dot-docked';
              let stateStr = `Docked at ${sim?.islandsData.get(s.currentIslandId || s.homeIslandId)?.name || 'Harbor'}`;

              if (s.state === 'sailing') {
                dotClass = 'dot-sailing';
                stateStr = `Sailing to ${targetName}`;
              } else if (s.state === 'loading') {
                dotClass = 'dot-loading';
                stateStr = `Loading ${goodName}`;
              } else if (s.state === 'unloading') {
                dotClass = 'dot-unloading';
                stateStr = `Unloading ${goodName}`;
              }

              let profitStr = Math.floor(s.totalProfit).toString();
              if (s.totalProfit >= 1000) {
                profitStr = `${(s.totalProfit / 1000).toFixed(1)}k`;
              }

              // Status badges on the right side:
              let rightBadgesHtml = '';
              if (uInfo) {
                rightBadgesHtml = `
                  <span class="vessel-underutilized-chip ${uInfo.severity}" data-ship-id="${s.id}" data-tooltip-type="vessel-alert" data-tooltip-title="Logistics Alert • ${s.name}" data-tooltip-body="${uInfo.details}" data-tooltip-rec="${uInfo.recommendation}" data-tooltip-badge="${uInfo.label}" data-tooltip-severity="${uInfo.severity}" data-tooltip-hint="Click to inspect in Vessel Logistics Modal">⚠️ ${uInfo.label}</span>
                `;
              } else if (s.state === 'sailing') {
                const goodIcon = s.cargo ? getGoodIconSvg(s.cargo.goodId, iconStyle, 14) : '';
                const cargoStr = s.cargo ? `<span class="chip-icon">${goodIcon}</span> ${s.cargo.quantity}` : '0t';
                rightBadgesHtml = `
                  <span class="vessel-cargo-chip" title="Carrying ${s.cargo?.quantity || 0}t ${goodName}">${cargoStr}</span>
                  <span class="vessel-dest-chip sailing" title="${stateStr}">➔ ${targetName}</span>
                `;
              } else {
                rightBadgesHtml = `
                  <span class="vessel-dest-chip ${s.state}" title="${stateStr}">⏳ ${s.state === 'loading' ? 'Load' : 'Unload'}</span>
                `;
              }

              row.className = `vessel-row ${uInfo ? 'row-underutilized' : ''}`;
              const titleStr = `${s.name} • ${stateStr} • Cargo: ${s.cargo ? `${s.cargo.quantity} ${goodName}` : 'None'} • Profit: 🪙 ${Math.floor(s.totalProfit)}${uInfo ? ` • ⚠️ ${uInfo.details}` : ''}`;
              if (row.hasAttribute('data-game-tooltip')) {
                row.setAttribute('data-game-tooltip', titleStr);
              } else {
                row.setAttribute('title', titleStr);
              }

              const dot = row.querySelector<HTMLElement>('.vessel-dot');
              if (dot) {
                dot.className = `vessel-dot ${dotClass}`;
                dot.title = s.state;
              }

              const rightEl = row.querySelector<HTMLElement>('.vessel-right');
              if (rightEl) {
                rightEl.innerHTML = `
                  ${rightBadgesHtml}
                  <span class="vessel-profit-chip" title="Total Profit: 🪙 ${Math.floor(s.totalProfit)} drachmas">+<span class="coin-icon">${coinIcon}</span> ${profitStr}</span>
                  <button class="btn-row-decommission" data-ship-id="${s.id}" title="Decommission & scrap ${s.name} (+🪙 ${sim ? sim.getShipDecommissionRefund(s.id).toLocaleString() : 0} salvage, frees 1 berth at harbor)">🔨</button>
                `;
              }
            }
          } else {
            routesEl.setAttribute('data-island-id', island.id);
            routesEl.setAttribute('data-filter', inspectorVesselFilter);
            routesEl.setAttribute('data-view', 'list');

            routesEl.innerHTML = displayedItems
              .map(({ ship: s, uInfo }) => {
                const goodName = s.cargo ? formatGoodName(s.cargo.goodId) : 'Empty';
                const targetName = s.targetIslandId ? (sim?.islandsData.get(s.targetIslandId)?.name || s.targetIslandId) : 'Docked';

                let dotClass = 'dot-docked';
                let stateStr = `Docked at ${sim?.islandsData.get(s.currentIslandId || s.homeIslandId)?.name || 'Harbor'}`;

                if (s.state === 'sailing') {
                  dotClass = 'dot-sailing';
                  stateStr = `Sailing to ${targetName}`;
                } else if (s.state === 'loading') {
                  dotClass = 'dot-loading';
                  stateStr = `Loading ${goodName}`;
                } else if (s.state === 'unloading') {
                  dotClass = 'dot-unloading';
                  stateStr = `Unloading ${goodName}`;
                }

                let profitStr = Math.floor(s.totalProfit).toString();
                if (s.totalProfit >= 1000) {
                  profitStr = `${(s.totalProfit / 1000).toFixed(1)}k`;
                }

                // Status badges on the right side:
                let rightBadgesHtml = '';
                if (uInfo) {
                  // When underutilized (e.g. Idle or Ballast): show crisp status pill with no redundant harbor chips!
                  rightBadgesHtml = `
                    <span class="vessel-underutilized-chip ${uInfo.severity}" data-ship-id="${s.id}" data-tooltip-type="vessel-alert" data-tooltip-title="Logistics Alert • ${s.name}" data-tooltip-body="${uInfo.details}" data-tooltip-rec="${uInfo.recommendation}" data-tooltip-badge="${uInfo.label}" data-tooltip-severity="${uInfo.severity}" data-tooltip-hint="Click to inspect in Vessel Logistics Modal">⚠️ ${uInfo.label}</span>
                  `;
                } else if (s.state === 'sailing') {
                  const goodIcon = s.cargo ? getGoodIconSvg(s.cargo.goodId, iconStyle, 14) : '';
                  const cargoStr = s.cargo ? `<span class="chip-icon">${goodIcon}</span> ${s.cargo.quantity}` : '0t';
                  rightBadgesHtml = `
                    <span class="vessel-cargo-chip" title="Carrying ${s.cargo?.quantity || 0}t ${goodName}">${cargoStr}</span>
                    <span class="vessel-dest-chip sailing" title="${stateStr}">➔ ${targetName}</span>
                  `;
                } else {
                  rightBadgesHtml = `
                    <span class="vessel-dest-chip ${s.state}" title="${stateStr}">⏳ ${s.state === 'loading' ? 'Load' : 'Unload'}</span>
                  `;
                }

                return `
                  <div class="vessel-row ${uInfo ? 'row-underutilized' : ''}" id="route-${s.id}" data-ship-id="${s.id}" title="${s.name} • ${stateStr} • Cargo: ${s.cargo ? `${s.cargo.quantity} ${goodName}` : 'None'} • Profit: 🪙 ${Math.floor(s.totalProfit)}${uInfo ? ` • ⚠️ ${uInfo.details}` : ''}">
                    <div class="vessel-left">
                      <span class="vessel-dot ${dotClass}" title="${s.state}"></span>
                      <span class="shipyard-tier-badge tier-${s.tier}">T${s.tier}</span>
                      <span class="vessel-name">${s.name}</span>
                    </div>
                    <div class="vessel-right">
                      ${rightBadgesHtml}
                      <span class="vessel-profit-chip" title="Total Profit: 🪙 ${Math.floor(s.totalProfit)} drachmas">+<span class="coin-icon">${coinIcon}</span> ${profitStr}</span>
                      <button class="btn-row-decommission" data-ship-id="${s.id}" title="Decommission & scrap ${s.name} (+🪙 ${sim ? sim.getShipDecommissionRefund(s.id).toLocaleString() : 0} salvage, frees 1 berth at harbor)">🔨</button>
                    </div>
                  </div>
                `;
              })
              .join('');
          }
        }
      } else {
        const filterMsg = inspectorVesselFilter === 'active'
          ? 'No sailing or active vessels currently.'
          : inspectorVesselFilter === 'idle'
          ? 'No underutilized vessels. All ships are operating efficiently!'
          : 'No vessels stationed or docked at this harbor.';
        routesEl.innerHTML = `<p class="subtle-text" style="font-size:0.75rem; margin:6px 0; text-align:center;">${filterMsg}</p>`;
      }
    }

    // Render Harbor Shipyard block
    const shipyardBlock = document.getElementById('inspector-shipyard-block');
    const shipyardTag = document.getElementById('shipyard-island-tag');
    const shipyardChips = document.getElementById('shipyard-tier-chips');
    const buyBtn = document.getElementById('btn-buy-ship');
    const unlockedCount = sim ? sim.unlockedIslands.size : 2;
    const currentBerths = sim ? sim.getHomePortedShipsCount(island.id) : 0;
    const maxBerths = sim ? sim.getPortFleetCapacity(island.id) : 2;
    const isBerthFull = currentBerths >= maxBerths;

    if (shipyardTag) {
      shipyardTag.innerHTML = `⚓ Berths: <span style="font-weight: 700; color: ${isBerthFull ? '#f87171' : '#4ade80'};">${currentBerths}/${maxBerths}</span>`;
      shipyardTag.title = `Harbor fleet berths: ${currentBerths} of ${maxBerths} occupied. Capacity scales with population, trade volume, and prosperity.`;
    }

    if (shipyardBlock) {
      shipyardBlock.style.display = lit ? 'block' : 'none';
    }

    if (lit && shipyardChips && sim) {
      const shipDefs = Array.from(sim.shipDefs.values());
      shipyardChips.innerHTML = shipDefs
        .map((def) => {
          const isLocked = unlockedCount < (def.unlock.islandsConnected || 1);
          const isSelected = selectedShipTier === def.id;
          const chipClass = `shipyard-chip tier-${def.tier} ${isSelected ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
          const shortName = getShipShortName(def.id);
          const title = isLocked
            ? `Requires ${def.unlock.islandsConnected} connected islands across the archipelago`
            : `${def.name} (Tier ${def.tier}): Cap ${def.capacity} tons, ${def.speed} knots. Upkeep: 🪙 ${def.upkeepPerDay}/d`;
          return `
            <div class="${chipClass}" data-tier-id="${def.id}" title="${title}">
              <div class="shipyard-chip-header">
                <span class="shipyard-tier-badge tier-${def.tier}">T${def.tier}</span>
                <span class="shipyard-chip-name">${shortName}</span>
              </div>
              <span class="shipyard-chip-cost"><span class="coin-icon">🪙</span> ${def.cost}</span>
              <span class="shipyard-chip-cap">${isLocked ? `🔒 ${def.unlock.islandsConnected} Isl` : `Cap ${def.capacity}`}</span>
            </div>
          `;
        })
        .join('');
    }

    if (buyBtn) {
      if (!lit) {
        buyBtn.style.display = 'none';
      } else {
        buyBtn.style.display = 'flex';
        const def = sim?.shipDefs.get(selectedShipTier);
        if (def) {
          const canAfford = (sim?.treasury || 0) >= def.cost;
          const meetsReq = unlockedCount >= (def.unlock.islandsConnected || 1);
          const shortName = getShipShortName(def.id);
          const tierIcon = getShipTierIcon(def.tier);
          if (isBerthFull) {
            buyBtn.innerHTML = `⚓ Harbor Berths Full (${currentBerths}/${maxBerths})`;
            buyBtn.className = 'btn-secondary';
            (buyBtn as HTMLButtonElement).disabled = true;
            buyBtn.title = `Harbor berths full (${currentBerths}/${maxBerths} vessels). Grow island population or prosperity to expand harbor berths, or reroute existing vessels.`;
          } else {
            (buyBtn as HTMLButtonElement).disabled = !canAfford || !meetsReq;
            buyBtn.innerHTML = `${tierIcon} Commission ${shortName} (<span class="coin-icon">🪙</span> ${def.cost})`;
            buyBtn.className = canAfford && meetsReq ? 'btn-primary' : 'btn-secondary';
            buyBtn.title = !meetsReq
              ? `Requires ${def.unlock.islandsConnected} connected islands`
              : !canAfford
              ? `Need 🪙 ${def.cost} drachmas (have ${Math.floor(sim?.treasury || 0)})`
              : `Commission ${def.name} at ${island.name} harbor (${currentBerths}/${maxBerths} berths)`;
          }
        }
      }
    }
  } else {
    if (fleetCountEl) fleetCountEl.textContent = '0';
    if (routesEl) {
      routesEl.innerHTML = `<p class="subtle-text" style="font-size:0.75rem; margin:4px 0;">Maritime fleet initializing...</p>`;
    }
  }
}

function showEconomicReportModal(islandId: string) {
  if (!sim) return;
  const report = generateIslandEconomicReport(islandId, sim);
  if (!report) return;

  const modal = document.getElementById('advisory-modal');
  const titleEl = document.getElementById('advisory-modal-title');
  const subtitleEl = document.getElementById('advisory-modal-subtitle');
  const contentEl = document.getElementById('advisory-content');
  if (!modal || !contentEl) return;

  const islandData = sim.islandsData.get(islandId);
  const iconStyle = icons.getStyle();
  const coinIcon = getIconSvg('coin', iconStyle, 13);

  if (titleEl) {
    titleEl.textContent = `Economic Report — ${report.islandName} Port`;
  }
  if (subtitleEl) {
    const pop = islandData?.population ? `${islandData.population.toLocaleString()} pop` : '';
    const region = islandData?.region ? islandData.region.toUpperCase() : '';
    subtitleEl.textContent = `${region} • ${pop} • ${report.isUnlocked ? 'Daylight Port' : 'Awaiting Awakening'}`;
  }

  // 1. Hero Card: Status & What Needs to be Done
  const statusLabels: Record<string, string> = {
    booming: 'Booming Prosperity',
    stable: 'Stable Commercial Flows',
    struggling: report.isRecovering ? 'Economic Recovery ↗' : 'Struggling Reserves',
    distressed: 'Critical Distress',
  };
  const statusLabel = statusLabels[report.status] || report.status.toUpperCase();

  const actionItemsHtml = report.actionItems
    .map(
      (item) => `
      <div class="advisory-checklist-item">
        <span class="advisory-check-bullet">▶</span>
        <span>${item}</span>
      </div>`
    )
    .join('');

  // 2. Import Advice Cards
  let importsHtml = '';
  if (report.importAdvice.length === 0) {
    importsHtml = `<div class="advisory-empty-msg">No local consumption requirements.</div>`;
  } else {
    importsHtml = `
      <div class="advisory-grid">
        ${report.importAdvice
          .map((imp) => {
            const goodIcon = getGoodIconSvg(imp.goodId, iconStyle, 20);
            const urgencyClass = imp.urgency === 'critical' ? 'critical' : imp.urgency === 'warning' ? 'warning' : 'stable';
            const urgencyBadge = imp.urgency === 'critical'
              ? `<button class="advisory-status-badge distressed btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Click to source and resolve ${imp.goodName} shortage (inspect exporters, vessels & routes)">Critical Shortage ➔</button>`
              : imp.urgency === 'warning'
              ? `<button class="advisory-status-badge struggling btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Click to inspect supply routes and buffer for ${imp.goodName}">Low Buffer (${imp.bufferPct}%) ➔</button>`
              : imp.statusLabel === 'Abundant'
              ? `<button class="advisory-status-badge booming btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Stock is abundant (${imp.bufferPct}% of safe operating buffer)">Abundant (${imp.bufferPct}%) ✓</button>`
              : `<button class="advisory-status-badge stable btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Stock is well-supplied (${imp.bufferPct}% of safe operating buffer)">Supplied (${imp.bufferPct}%) ✓</button>`;

            const partnerHtml = imp.bestSupplier
              ? `
              <div class="advisory-partner-box">
                <span class="advisory-partner-title">Recommended Supplier: ${imp.bestSupplier.islandName} (${imp.bestSupplier.distanceKm} km)</span>
                <div class="advisory-partner-details">
                  <span>Wholesale: <span class="coin-icon">${coinIcon}</span> ${imp.bestSupplier.buyPrice} ➔ Sell: <span class="coin-icon">${coinIcon}</span> ${imp.bestSupplier.sellPriceHere}</span>
                  <span class="advisory-profit-tag">+<span class="coin-icon">${coinIcon}</span> ${imp.bestSupplier.profitPerUnit}/u profit</span>
                </div>
              </div>`
              : `
              <div class="advisory-partner-box" style="border-style: solid; border-color: rgba(231, 76, 60, 0.25);">
                <span style="color: #f87171; font-size: 0.72rem;">⚠️ No unlocked producer has stock. Awaken nearby islands to secure supply.</span>
              </div>`;

            return `
              <div class="advisory-item-card ${urgencyClass}">
                <div class="advisory-item-top">
                  <div class="advisory-good-badge btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Click to source ${imp.goodName}">
                    <span class="good-icon-wrapper" style="width:20px;height:20px;">${goodIcon}</span>
                    <span>${imp.goodName}</span>
                  </div>
                  ${urgencyBadge}
                </div>
                <div class="advisory-metric-row">
                  <span>Stock / Target Buffer:</span>
                  <span class="advisory-metric-val">${imp.stock} / ${imp.bufferTarget}b units (${imp.bufferPct}%)</span>
                </div>
                <div class="advisory-metric-row">
                  <span>Consumption / Runway:</span>
                  <span class="advisory-metric-val" style="color:${imp.daysRemaining < 1 ? '#f87171' : imp.daysRemaining < 3 ? '#facc15' : '#34d399'}; font-weight:700;">
                    -${imp.consumeRate}/d • ~${imp.daysRemaining} days left
                  </span>
                </div>
                ${partnerHtml}
                <button class="btn-open-sourcing-item" data-island-id="${islandId}" data-good-id="${imp.goodId}" title="Inspect suppliers, sea lanes, and fleet suitability for ${imp.goodName}">
                  🔍 Supply Route & Sourcing Analysis
                </button>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  // 3. Export Advice Cards
  let exportsHtml = '';
  if (report.exportAdvice.length === 0) {
    exportsHtml = `<div class="advisory-empty-msg">No local export production.</div>`;
  } else {
    exportsHtml = `
      <div class="advisory-grid">
        ${report.exportAdvice
          .map((exp) => {
            const goodIcon = getGoodIconSvg(exp.goodId, iconStyle, 20);
            const cardClass = exp.isCapped ? 'capped' : exp.isLow ? 'low-export' : '';
            const cappedBadge = exp.isCapped
              ? `<button class="advisory-status-badge distressed btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${exp.goodId}" style="animation:none;" title="Inspect export trade routes for ${exp.goodName}">Capped Warehouse ➔</button>`
              : exp.isLow
              ? `<button class="advisory-status-badge struggling btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${exp.goodId}" title="Inspect export warehouse reserves for ${exp.goodName}">⚠️ Low Reserve (${exp.fillPct}%)</button>`
              : `<button class="advisory-status-badge stable btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${exp.goodId}" title="Inspect export trade routes for ${exp.goodName}">Producing (+${exp.produceRate}/d) ➔</button>`;

            const customerHtml = exp.bestCustomer
              ? `
              <div class="advisory-partner-box">
                <span class="advisory-partner-title">Top Paying Buyer: ${exp.bestCustomer.islandName} (${exp.bestCustomer.distanceKm} km)</span>
                <div class="advisory-partner-details">
                  <span>Base Cost: <span class="coin-icon">${coinIcon}</span> ${exp.localCost} ➔ Buyer Pays: <span class="coin-icon">${coinIcon}</span> ${exp.bestCustomer.sellPriceThere}</span>
                  <span class="advisory-profit-tag">+<span class="coin-icon">${coinIcon}</span> ${exp.bestCustomer.profitPerUnit}/u profit</span>
                </div>
              </div>`
              : `
              <div class="advisory-partner-box">
                <span style="color: var(--text-secondary); font-size: 0.72rem;">All unlocked ports currently have full inventories of this good.</span>
              </div>`;

            return `
              <div class="advisory-item-card ${cardClass}">
                <div class="advisory-item-top">
                  <div class="advisory-good-badge btn-badge-sourcing" data-island-id="${islandId}" data-good-id="${exp.goodId}" title="Click to inspect export markets for ${exp.goodName}">
                    <span class="good-icon-wrapper" style="width:20px;height:20px;">${goodIcon}</span>
                    <span>${exp.goodName}</span>
                  </div>
                  ${cappedBadge}
                </div>
                <div class="advisory-metric-row">
                  <span>Warehouse Storage:</span>
                  <span class="advisory-metric-val" style="${exp.isLow ? 'color:#f59e0b; font-weight:700;' : ''}">${exp.stock} / ${exp.capacity} units (${exp.fillPct}%${exp.isLow ? ' - Low' : exp.isCapped ? ' - Full' : ''})</span>
                </div>
                <div class="advisory-metric-row">
                  <span>Production Velocity:</span>
                  <span class="advisory-metric-val" style="color: #38ef7d; font-weight: 700;">+${exp.produceRate}/d</span>
                </div>
                ${customerHtml}
                <button class="btn-open-sourcing-item" data-island-id="${islandId}" data-good-id="${exp.goodId}" title="Inspect export buyers, sea lanes, and fleet suitability for ${exp.goodName}">
                  🔍 Export Route & Logistics Analysis
                </button>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  // 4. Logistics & Fleet HTML
  let underutilizedHtml = '';
  if (report.fleetAdvice.underutilizedShips && report.fleetAdvice.underutilizedShips.length > 0) {
    const rows = report.fleetAdvice.underutilizedShips
      .map((u) => {
        const tierIcon = getShipTierIcon(u.tier);
        const criticalGood = report.importAdvice.find((a) => a.urgency === 'critical');
        const actionBtn = criticalGood
          ? `<button class="btn-primary btn-u-prioritize" data-ship-id="${u.shipId}" data-good-id="${criticalGood.goodId}" data-island-id="${islandId}" title="Direct ${u.shipName} to prioritize hauling ${criticalGood.goodName}">🔄 Prioritize ${criticalGood.goodName}</button>`
          : `<button class="btn-secondary btn-u-track" data-ship-id="${u.shipId}" title="Track & follow vessel on map">🎥 Track</button>`;

        return `
          <div class="advisory-u-card">
            <div class="advisory-u-card-header">
              <div class="advisory-u-card-title">
                <span class="shipyard-tier-badge tier-${u.tier}">T${u.tier}</span>
                <span class="advisory-u-icon">${tierIcon}</span>
                <strong style="color:#f1f5f9;">${u.shipName}</strong>
              </div>
              <span class="advisory-u-badge ${u.severity}">⚠️ ${u.label}</span>
            </div>
            <p class="advisory-u-desc">${u.details}</p>
            <div class="advisory-u-footer">
              <span class="advisory-u-tip">💡 ${u.recommendation}</span>
              ${actionBtn}
            </div>
          </div>
        `;
      })
      .join('');

    underutilizedHtml = `
      <div class="advisory-underutilized-box">
        <h5 class="advisory-u-box-title">
          <span>⚠️ Underutilized Vessels Detected (${report.fleetAdvice.underutilizedShips.length})</span>
          <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:normal;">Sub-optimal cargo runs or idle at dock</span>
        </h5>
        <div class="advisory-u-grid">
          ${rows}
        </div>
      </div>
    `;
  }

  const fleetHtml = `
    <div class="advisory-section-card">
      <div class="advisory-section-header">
        <h4 class="advisory-section-title">⛵ Fleet Logistics & Trade Routes</h4>
        <span style="font-size:0.76rem; color:var(--text-secondary); font-weight:600;">${report.fleetAdvice.activeShipCount} assigned vessel(s)</span>
      </div>
      <p style="font-size:0.80rem; line-height:1.5; color:#cbd5e1; margin:0 0 10px 0;">
        ${report.fleetAdvice.recommendation}
      </p>
      ${underutilizedHtml}
    </div>`;

  // 5. Awakening Advice (if locked)
  let unlockHtml = '';
  if (!report.isUnlocked && report.unlockAdvice) {
    const u = report.unlockAdvice;
    const canAwaken = u.canAfford;
    unlockHtml = `
      <div class="advisory-section-card" style="border-color: rgba(242, 193, 78, 0.35); background: rgba(242, 193, 78, 0.04);">
        <div class="advisory-section-header">
          <h4 class="advisory-section-title" style="color:var(--accent-gold);">🏛️ Network Integration & Awakening</h4>
          <span class="advisory-status-badge ${canAwaken ? 'booming' : 'struggling'}">${canAwaken ? 'Ready to Awaken' : 'Prerequisites Incomplete'}</span>
        </div>
        <p style="font-size:0.80rem; line-height:1.45; color:#cbd5e1; margin:0;">
          Connecting ${report.islandName} requires <span class="coin-icon">${coinIcon}</span> <strong>${u.cost} Drachmas</strong> (Treasury: ${u.haveCost} d) and <strong>⚓ ${u.tp} Trade Points</strong> (Balance: ${u.haveTp} TP).
          ${canAwaken ? 'You meet all requirements! Click the "Awaken Island" button in the inspector to bring daylight to this port.' : 'Expand your commercial network and treasury to establish this sea lane.'}
        </p>
      </div>`;
  }

  contentEl.innerHTML = `
    <div class="advisory-hero-card">
      <div class="advisory-hero-top">
        <div>
          <span style="font-size:0.70rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); font-weight:700;">Economic Health Diagnosis</span>
          <div style="font-size:1.15rem; font-family:var(--font-heading); font-weight:700; color:#fff; margin-top:2px;">
            ${report.prosperityPct}% Prosperity • ${statusLabel}
          </div>
        </div>
        <span class="advisory-status-badge ${report.isRecovering ? 'booming' : report.status}">${report.isRecovering ? 'Recovering ↗' : report.status}</span>
      </div>
      <p class="advisory-hero-summary">${report.statusSummary}</p>
      <div class="advisory-actions-checklist">
        <span class="advisory-checklist-title">📋 Executive Action Checklist: What Needs to Be Done</span>
        ${actionItemsHtml}
      </div>
    </div>

    ${unlockHtml}

    <div class="advisory-section-card">
      <div class="advisory-section-header">
        <h4 class="advisory-section-title">🚨 Lifeline Imports & Critical Demands</h4>
        <span style="font-size:0.74rem; color:var(--text-secondary);">${report.importAdvice.length} imported good(s)</span>
      </div>
      ${importsHtml}
    </div>

    <div class="advisory-section-card">
      <div class="advisory-section-header">
        <h4 class="advisory-section-title">📦 Surplus Production & Export Arbitrage</h4>
        <span style="font-size:0.74rem; color:var(--text-secondary);">${report.exportAdvice.length} produced good(s)</span>
      </div>
      ${exportsHtml}
    </div>

    ${fleetHtml}
  `;

  audio.playClickSound();
  modal.classList.remove('closed');
}

function hideEconomicReportModal() {
  const modal = document.getElementById('advisory-modal');
  if (modal && !modal.classList.contains('closed')) {
    modal.classList.add('closed');
    audio.playClickSound();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Failed to find #three-canvas element');
    return;
  }

  let zoomToActiveTerritory = (_durationMs = 2200) => {};
  let handleShipDecommissioned = (_shipId: string) => {};

  // 1. Initialize Three.js 3D Scene
  scene = new AegeanScene(canvas, (island) => {
    updateInspector(island, scene?.isIslandLit(island));
  });
  console.log('Aegean 3D Scene initialized successfully.');

  // 2. Load Simulation Data and Initialize Sim Core
  try {
    const [islandsRes, goodsRes, balanceRes, seaLanesRes, shipsRes] = await Promise.all([
      fetch(assetUrl('data/islands.json')),
      fetch(assetUrl('data/goods.json')),
      fetch(assetUrl('data/balance.json')),
      fetch(assetUrl('data/sea_lanes.json')),
      fetch(assetUrl('data/ships.json')),
    ]);

    const islandsData: IslandData[] = await islandsRes.json();
    const goodsData: GoodDefinition[] = await goodsRes.json();
    const balanceConfig: BalanceConfig = await balanceRes.json();
    const seaLanesData: SeaLanesData = await seaLanesRes.json();
    const shipsData: ShipDefinition[] = await shipsRes.json();

    sim = new SimulationCore(islandsData, goodsData, balanceConfig, seaLanesData, shipsData);
    console.log(`Simulation core initialized with ${islandsData.length} islands, ${goodsData.length} commodities, and autonomous shipping fleet.`);

    // Connect ship manager to 3D scene
    if (sim.shipManager) {
      scene.shipManager = sim.shipManager;
    }

    // Feed port coordinates to terrain shader for smooth port-centered island illumination
    scene.terrain?.setPortLocations(islandsData);

    // Check for saved game state in browser localStorage or launch 5-minute Executive Preview
    let hasLoadedSave = false;
    let previewModal: PreviewModal | null = null;

    if (hasSaveInStorage()) {
      hasLoadedSave = loadFromStorage(sim);
      if (hasLoadedSave) {
        console.log(`Restored game state from localStorage: ${sim.unlockedIslands.size} unlocked islands, ${sim.shipManager?.ships.size} ships, 🪙 ${Math.floor(sim.treasury)} drachmas.`);
        for (const islId of sim.unlockedIslands) {
          const isl = sim.islandsData.get(islId);
          if (isl) {
            scene.setIslandLitImmediate(isl, true);
          }
        }
        scene.updateIslandEconomies(sim.islands);
        addNotification(
          'AUTOSAVE RESTORED',
          `Restored your maritime empire from saved state (${sim.unlockedIslands.size} islands connected, 🪙 ${Math.floor(sim.treasury).toLocaleString()} drachmas).`,
          false
        );
      }
    } else if (isFirstTimeUser()) {
      // First-time user experience: Load the 5-Minute Executive Preview Snapshot (15 ports, 8 ships, 🪙 25,400 drachmas)
      try {
        const previewRes = await fetch(assetUrl('data/preview_snapshot.json'));
        if (previewRes.ok) {
          const snapshot = await previewRes.json();
          const ok = deserializeSimulation(sim, snapshot);
          if (ok) {
            hasLoadedSave = true;
            console.log(`Loaded 5-minute Executive Preview: ${sim.unlockedIslands.size} ports awakened, ${sim.shipManager?.ships.size} vessels sailing.`);
            for (const islId of sim.unlockedIslands) {
              const isl = sim.islandsData.get(islId);
              if (isl) {
                scene.setIslandLitImmediate(isl, true);
              }
            }
            scene.updateIslandEconomies(sim.islands);

            previewModal = new PreviewModal(sim, {
              onResetComplete: () => {
                if (!sim) return;
                // Extinguish preview islands; light only the clean slate virgin islands (Santorini & Naxos)
                for (const isl of sim.islandsData.values()) {
                  scene.setIslandLitImmediate(isl, sim.unlockedIslands.has(isl.id));
                }
                scene.updateIslandEconomies(sim.islands);
                updateTopBarMetrics();

                const santorini = sim.islandsData.get('santorini') || islandsData[0];
                if (santorini) {
                  selectedIsland = santorini;
                  scene.setSelectedIsland(santorini.id);
                  updateInspector(santorini, true);
                  if (scene.terrain) {
                    scene.cameraManager.focusOn(scene.terrain.getPeakWorld(santorini.lon, santorini.lat), 26);
                  }
                }
                zoomToActiveTerritory?.(2500);
              },
              onNotification: (badge, text, hl) => addNotification(badge, text, hl)
            });
            previewModal.initSession();
          }
        }
      } catch (err) {
        console.warn('Failed to load executive preview snapshot; falling back to virgin clean slate:', err);
      }
    }

    if (!hasLoadedSave) {
      // Clean slate Day 1: Only default starter islands are unlocked in daylight
      for (const islId of sim.unlockedIslands) {
        const isl = sim.islandsData.get(islId);
        if (isl) {
          scene.setIslandLitImmediate(isl, true);
        }
      }
      scene.updateIslandEconomies(sim.islands);
    }

    // Dynamic framing for active islands
    const getActiveIslands = () => {
      const activeIds = sim ? Array.from(sim.unlockedIslands) : ['santorini', 'naxos'];
      return activeIds
        .map((id) => islandsData.find((isl) => isl.id === id))
        .filter((isl): isl is IslandData => !!isl);
    };

    zoomToActiveTerritory = (durationMs = 2200) => {
      const active = getActiveIslands();
      if (active.length > 0) {
        scene.zoomToActiveIslands(active, durationMs);
      }
    };

    // Auto-zoom camera to frame starter islands closely upon world load
    const initialActive = getActiveIslands();
    if (initialActive.length > 0) {
      if (initialActive.length <= 2) {
        scene.zoomToActiveIslands(initialActive, 1800);
      } else {
        // When numerous islands are active (preview snapshot or loaded dynasty),
        // comfortably frame the starting hub Santorini and surrounding waters (distance ~28)
        const santorini = islandsData.find((isl) => isl.id === 'santorini');
        if (santorini && scene.terrain) {
          const peak = scene.terrain.getPeakWorld(santorini.lon, santorini.lat);
          scene.cameraManager.focusOn(peak, 28, true, 1800);
        }
      }
    }

    // Initialize starting island (Santorini) and keep island inspector panel on by default
    const initialIsland = islandsData.find((isl) => isl.id === 'santorini') || islandsData[0];
    if (initialIsland) {
      updateInspector(initialIsland, scene.isIslandLit(initialIsland));
      scene.setSelectedIsland(initialIsland.id);
    }

    // Connect Game Save/Load callbacks to Settings Panel
    scene.settingsPanel?.setGameSaveCallbacks({
      onSave: () => {
        if (!sim) return false;
        return saveToStorage(sim);
      },
      onLoad: () => {
        if (!sim) return false;
        const ok = loadFromStorage(sim);
        if (ok) {
          for (const islId of sim.unlockedIslands) {
            scene.islandMarkers?.setIslandLit(islId, true);
          }
          scene.updateIslandEconomies(sim.islands);
          updateTopBarMetrics();
          if (selectedIsland) {
            updateInspector(selectedIsland, scene.isIslandLit(selectedIsland));
          }
          zoomToActiveTerritory(2000);
        }
        return ok;
      },
      onReset: () => {
        clearSaveFromStorage();
        window.location.reload();
      },
      getSaveTimestamp: () => {
        try {
          const raw = localStorage.getItem(DEFAULT_SAVE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed.timestamp || null;
        } catch {
          return null;
        }
      },
    });

    // Shared vessel decommissioning handler to update UI and camera
    handleShipDecommissioned = (shipId: string) => {
      if (selectedShipId === shipId) {
        selectedShipId = null;
        scene?.unfollowShip();
        if (selectedIsland) {
          updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
        } else {
          const start = sim?.islandsData.get('santorini') || sim?.islandsData.values().next().value;
          if (start) updateInspector(start, scene?.isIslandLit(start));
        }
      } else if (selectedIsland) {
        updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
      }
      updateTopBarMetrics();
      fleetPanel?.render();
      topSearch?.performSearch();
    };

    // Initialize Fleet Management Panel
    fleetPanel = new FleetPanel(sim, {
      onSelectShip: (shipId) => {
        updateVesselInspector(shipId);
      },
      onFollowShip: (shipId) => {
        scene.followShip(shipId, () => {
          if (selectedShipId) updateVesselInspector(selectedShipId);
        });
        const ship = sim?.shipManager?.ships.get(shipId);
        addNotification('CAMERA FOLLOW', `Tracking ${ship?.name || 'vessel'} through the Cyclades.`, true);
      },
      onNotification: (badge, text) => {
        addNotification(badge, text, false);
      },
      onDecommissionShip: (shipId) => {
        handleShipDecommissioned(shipId);
      },
    });

    // Initialize Commodity Supply Chain & Sourcing Modal
    sourcingModal = new SourcingModal(sim, {
      onFocusIsland: (islandId) => {
        selectAndFocusIsland(islandId);
      },
      onNotification: (badge, text) => {
        addNotification(badge, text, false);
      },
    });

    // Initialize Aegean Archipelago Intelligence & Directory Modal
    archipelagoModal = new ArchipelagoModal(sim, {
      onFocusIsland: (islandId) => {
        selectAndFocusIsland(islandId);
      },
      onAwakenIsland: (islandId) => {
        awakenIslandById(islandId);
      },
      onOpenReport: (islandId) => {
        showEconomicReportModal(islandId);
      },
      onOpenSourcing: (islandId, goodId) => {
        sourcingModal?.show(islandId, goodId);
      },
      onOpenFleet: () => {
        fleetPanel?.show();
      },
    });

    // Initialize Vessel Logistics & Fleet Utilization Modal
    vesselAdvisoryModal = new VesselAdvisoryModal(sim, {
      onFollowShip: (shipId) => {
        selectedShipId = shipId;
        scene?.followShip(shipId, () => {
          if (selectedShipId) updateVesselInspector(selectedShipId);
        });
        updateVesselInspector(shipId);
        addNotification('CAMERA FOLLOW', `Tracking vessel through the Aegean.`, true);
      },
      onOpenSourcing: (islandId, goodId) => {
        sourcingModal?.show(islandId, goodId);
      },
      onOpenFleet: () => {
        fleetPanel?.show();
      },
      onDecommissionShip: (shipId) => {
        handleShipDecommissioned(shipId);
      },
      onPriorityChanged: (shipId, goodId) => {
        const ship = sim?.shipManager?.ships.get(shipId);
        addNotification('CARGO PRIORITY', `${ship?.name || 'Vessel'} priority set to ${goodId ? formatGoodName(goodId) : 'Automatic Arbitrage'}.`, true);
        fleetPanel?.render();
        if (selectedIsland) {
          updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
        }
      },
      onHomeChanged: (shipId, islandId) => {
        const ship = sim?.shipManager?.ships.get(shipId);
        const island = sim?.islandsData.get(islandId);
        addNotification('HOME PORT REASSIGNED', `${ship?.name || 'Vessel'} stationed at ${island?.name || islandId}.`, true);
        fleetPanel?.render();
        if (selectedIsland) {
          updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
        }
      },
    });

    // Initialize In-Game Themed Tooltip System
    gameTooltip = GameTooltip.init();

    // Initialize Top Navigation Omnisearch System
    topSearch = new TopSearch(sim, {
      onSelectIsland: (islandId) => {
        selectAndFocusIsland(islandId);
        const isl = sim?.islandsData.get(islandId);
        addNotification('CAMERA FOCUS', `Centered on <strong>${isl?.name || islandId}</strong> (${isl?.region || 'Aegean'}).`, false);
      },
      onSelectShip: (shipId) => {
        selectAndFocusShip(shipId);
        const s = sim?.shipManager?.ships.get(shipId);
        addNotification('VESSEL TRACKING', `3D camera tracking <strong>${s?.name || 'vessel'}</strong> across Aegean trade lanes.`, true);
      },
    });

    // Milestone 9: Endgame 'Whole Aegean Awake' Celebration Handler
    let endgameCelebrated = false;
    const triggerEndgameCelebration = () => {
      if (!sim || endgameCelebrated) return;
      endgameCelebrated = true;

      audio.playEndgameVictoryFanfare();

      const modal = document.getElementById('endgame-modal');
      const valTreasury = document.getElementById('endgame-val-treasury');
      const valTp = document.getElementById('endgame-val-tp');
      const valFleet = document.getElementById('endgame-val-fleet');
      const valDays = document.getElementById('endgame-val-days');

      if (valTreasury) valTreasury.textContent = `🪙 ${Math.floor(sim.treasury).toLocaleString()}`;
      if (valTp) valTp.textContent = `⭐ ${sim.tradePoints.toLocaleString()} TP`;
      if (valFleet) valFleet.textContent = `${sim.shipManager?.ships.size || 0} Vessels`;
      if (valDays) valDays.textContent = `${Math.floor(sim.gameDay)} Days`;

      if (modal) modal.classList.remove('closed');

      addNotification(
        'TRIUMPH OF THE AEGEAN',
        `🌟 <strong>The Whole Aegean is Awake!</strong> All ${sim.islandsData.size} island ports are interconnected and illuminated in radiant Mediterranean daylight!`,
        true
      );

      // Grand panoramic orbit camera sweep encompassing the entire awakened Aegean Sea
      const allIslands = Array.from(sim.islandsData.values());
      scene.zoomToActiveIslands(allIslands, 6000);
    };

    // Handle ship deliveries & inaugural island awakenings
    sim.onShipDelivery((event) => {
      // Register cargo unload / delivery animation on destination island
      recordCargoTransfer(event.toIslandId, event.goodId, 'unload', event.quantity, event.shipName);

      const targetIsland = sim?.islandsData.get(event.toIslandId);
      const goodDef = sim?.goodsData.get(event.goodId);
      const goodName = goodDef ? formatGoodName(goodDef.id) : event.goodId;
      const goodIcon = GOOD_EMOJIS[event.goodId] || '📦';
      const goodColor = GOOD_COLORS[event.goodId] || '#f59e0b';
      const ship = sim?.shipManager?.ships.get(event.shipId);

      // 1. Goods Catapulted Animation from boat -> island port / town!
      if (ship && targetIsland) {
        const destLon = targetIsland.port?.lon ?? targetIsland.lon;
        const destLat = targetIsland.port?.lat ?? targetIsland.lat;
        let catapultLabel = `+🪙 ${Math.floor(event.profit)}`;
        if (event.passengerFares && event.passengerFares > 0) {
          catapultLabel += ` 🎟️`;
        } else if (event.tourismPrestigeBonus && event.tourismPrestigeBonus > 0) {
          catapultLabel += ` 👑`;
        }

        scene.catapultGoods(ship.position.lon, ship.position.lat, destLon, destLat, {
          goodIcon,
          goodColor,
          count: event.quantity,
          label: catapultLabel,
          isDelivery: true,
        });
      }

      if (event.isFirstDeliveryToIsland && targetIsland) {
        if (isNotificationAudioEnabled('DAWN AWAKENING')) {
          audio.playAwakeningFanfare();
        }

        addNotification(
          'DAWN AWAKENING',
          `⚓ <strong>${event.shipName}</strong> completed the inaugural delivery of ${event.quantity} ${goodName} to ${targetIsland.name} (+🪙 ${Math.floor(event.profit)} profit)! The island awakens into radiant Mediterranean daylight!`,
          true
        );

        // Simple, non-overlapping celebration pill
        scene.showShipPopup(event.shipId, {
          icon: '🌟',
          text: `Inaugural Delivery to ${targetIsland.name}!`,
          type: 'inaugural',
          durationMs: 3200,
        });

        if (!scene.isIslandLit(targetIsland)) {
          scene.awakenIsland(targetIsland, () => {
            if (selectedIsland?.id === targetIsland.id) {
              updateInspector(targetIsland, true);
            }
          });
          // Smoothly re-frame camera to encompass newly awakened territory
          zoomToActiveTerritory(2400);
        }
        updateTopBarMetrics();

        // Check for Whole Aegean Awake endgame trigger
        if (sim && sim.unlockedIslands.size >= sim.islandsData.size) {
          triggerEndgameCelebration();
        }
      } else {
        // Play appropriate procedural delivery audio
        if (isNotificationAudioEnabled('TRADE RUN')) {
          if (event.passengerFares && event.passengerFares > 0) {
            audio.playTicketSound();
          } else if (event.tourismPrestigeBonus && event.tourismPrestigeBonus > 0) {
            audio.playVipShimmerSound();
          } else {
            audio.playCoinSound();
          }
        }

        const bonusTxt = event.passengerFares && event.passengerFares > 0
          ? ` (incl. 🪙 ${event.passengerFares} passenger fares 🎟️)`
          : event.tourismPrestigeBonus && event.tourismPrestigeBonus > 0
          ? ` (incl. 🪙 ${event.tourismPrestigeBonus} VIP prestige bonus 👑)`
          : '';
        const tierIcon = getShipTierIcon(event.shipTier || 1);
        addNotification(
          'TRADE RUN',
          `${tierIcon} ${event.shipName}: delivered ${event.quantity} ${goodName} to ${targetIsland?.name || event.toIslandId} (+🪙 ${Math.floor(event.profit)}${bonusTxt})`,
          false
        );
      }
    });

    // Handle ship status changes (loading cargo, setting sail)
    sim.onShipStatus((event) => {
      if (event.type === 'loading' && event.goodId) {
        // Register cargo load animation on origin island
        recordCargoTransfer(event.islandId, event.goodId, 'load', event.quantity || 10, event.shipName);

        if (isNotificationAudioEnabled('TRADE RUN')) {
          audio.playDockSound();
        }
        const island = sim?.islandsData.get(event.islandId);
        const ship = sim?.shipManager?.ships.get(event.shipId);
        const goodIcon = GOOD_EMOJIS[event.goodId] || '📦';
        const goodColor = GOOD_COLORS[event.goodId] || '#38bdf8';

        // 2. Goods Catapulted Animation from island dock -> into the boat!
        if (island && ship) {
          const islLon = island.port?.lon ?? island.lon;
          const islLat = island.port?.lat ?? island.lat;
          scene.catapultGoods(islLon, islLat, ship.position.lon, ship.position.lat, {
            goodIcon,
            goodColor,
            count: event.quantity,
            label: `+${event.quantity} ${goodIcon}`,
          });
        }
      } else if (event.type === 'unloading' && event.goodId) {
        // Register cargo unload animation on destination island
        recordCargoTransfer(event.islandId, event.goodId, 'unload', event.quantity || 10, event.shipName);
      } else if (event.type === 'departing' && event.targetIslandId) {
        const destName = sim?.islandsData.get(event.targetIslandId)?.name || event.targetIslandId;
        const ship = sim?.shipManager?.ships.get(event.shipId);
        const tierIcon = getShipTierIcon(ship?.tier || 1, 16);
        // Simple, compact non-overlapping micro-pill
        scene.showShipPopup(event.shipId, {
          icon: tierIcon,
          text: `En route to ${destName}`,
          type: 'vessel',
          durationMs: 2200,
        });
      }
    });

    // Milestone 3: Dynamic Island Festivals & Market Booms Handler
    sim.onEventStart((evt) => {
      if (isNotificationAudioEnabled(evt.badge || 'FESTIVAL')) {
        audio.playAwakeningFanfare();
      }
      addNotification(
        evt.badge.toUpperCase(),
        `🎪 <strong>${evt.title}</strong> has begun! ${evt.description} (~${Math.round(evt.durationDays)} days)`,
        true
      );
      if (selectedIsland) {
        updateInspector(selectedIsland, scene.isIslandLit(selectedIsland));
      }
    });

    sim.onEventEnd((evt) => {
      addNotification(
        'FESTIVAL CONCLUDED',
        `The ${evt.title} on ${evt.islandName} has concluded. Markets have stabilized back to regular trade terms.`,
        false
      );
      if (selectedIsland) {
        updateInspector(selectedIsland, scene.isIslandLit(selectedIsland));
      }
    });

    // Ship raycasting / selection handler
    scene.onShipSelect = (ship) => {
      updateVesselInspector(ship.id);

      const home = sim?.islandsData.get(ship.homeIslandId)?.name || ship.homeIslandId;
      const dest = ship.targetIslandId
        ? (sim?.islandsData.get(ship.targetIslandId)?.name || ship.targetIslandId)
        : 'In Port';
      const good = ship.cargo
        ? `${ship.cargo.quantity} units of ${formatGoodName(ship.cargo.goodId)}`
        : 'Empty';

      const tierIcon = getShipTierIcon(ship.tier, 18);
      const def = sim?.shipDefs.get(ship.typeId);
      const shipTypeName = def?.name || `Tier ${ship.tier} Vessel`;

      addNotification(
        'VESSEL LOG',
        `${tierIcon} <strong>${ship.name}</strong> (${shipTypeName})<br>Origin: ${home} ➔ Destination: ${dest}<br>Cargo: ${good} • Status: ${ship.state.toUpperCase()} • Profit: 🪙 ${Math.floor(ship.totalProfit)}`,
        true
      );

      // Sleek non-overlapping selection pill
      scene.showShipPopup(ship.id, {
        icon: getShipTierIcon(ship.tier, 16),
        text: ship.cargo ? `${ship.cargo.quantity} ${formatGoodName(ship.cargo.goodId)} ➔ ${dest}` : `Docked at ${home}`,
        type: 'vessel',
        durationMs: 3000,
      });
    };

    // Deselect handler when tapping/clicking outside on empty sea or space
    scene.onDeselect = () => {
      if (selectedIsland || selectedShipId) {
        selectedIsland = null;
        selectedShipId = null;
        scene.setSelectedIsland(null);
        scene.unfollowShip();
        inspectorPanel?.classList.add('closed');
        updateProsperityLegendSelection(null);
      }
    };

    updateTopBarMetrics();

    // Hook simulation update to scene animation loop
    let lastMetricUpdate = performance.now();
    let lastAutoSaveDay = Math.floor(sim.gameDay);

    window.addEventListener('beforeunload', () => {
      if (sim && isPreviewCompleted()) saveToStorage(sim);
    });

    scene.onTick = (deltaSec: number) => {
      if (!sim) return;
      sim.update(deltaSec);

      // Auto-save progress once every in-game day (only for user's own organic dynasty)
      if (Math.floor(sim.gameDay) > lastAutoSaveDay) {
        lastAutoSaveDay = Math.floor(sim.gameDay);
        if (isPreviewCompleted()) {
          saveToStorage(sim);
          scene.settingsPanel?.updateSaveStatusDisplay();
        }
      }

      const now = performance.now();
      fleetPanel?.update(now);

      if (now - lastMetricUpdate > 250) {
        lastMetricUpdate = now;
        updateTopBarMetrics();
        scene.updateIslandEconomies(sim.islands);
        if (selectedShipId) {
          updateVesselInspector(selectedShipId);
        } else if (selectedIsland) {
          updateInspector(selectedIsland, scene.isIslandLit(selectedIsland));
        }
      }
    };
  } catch (err) {
    console.error('Failed loading simulation core assets:', err);
  }

  // 3. Setup speed button listeners
  const speedButtons = [
    { id: 'btn-speed-pause', speed: 0 },
    { id: 'btn-speed-1x', speed: 1 },
    { id: 'btn-speed-4x', speed: 4 },
    { id: 'btn-speed-16x', speed: 16 },
  ];

  const setGameSpeed = (speed: number) => {
    sim?.setSpeed(speed);
    speedButtons.forEach((b) => {
      const el = document.getElementById(b.id);
      if (b.speed === speed) el?.classList.add('active');
      else el?.classList.remove('active');
    });
  };

  speedButtons.forEach(({ id, speed }) => {
    document.getElementById(id)?.addEventListener('click', () => setGameSpeed(speed));
  });

  // 4. Setup single cycling layer button (DEM ➔ Night ➔ Day)
  const layerCycleModes = [
    { mode: 2, id: 'dem', label: 'DEM', name: 'DEM Elevation Map' },
    { mode: 0, id: 'night', label: 'Night', name: 'Night Satellite View' },
    { mode: 1, id: 'day', label: 'Day', name: 'Day Satellite View' },
  ];

  let currentLayerIndex = 0; // Starts at DEM (mode 2)

  const updateLayerCycleButton = (mode: number) => {
    const idx = layerCycleModes.findIndex((m) => m.mode === mode);
    if (idx !== -1) {
      currentLayerIndex = idx;
    }
    const current = layerCycleModes[currentLayerIndex];
    const iconEl = document.getElementById('layer-cycle-icon');
    const labelEl = document.getElementById('layer-cycle-label');
    const btnEl = document.getElementById('btn-layer-cycle');

    if (iconEl) {
      iconEl.setAttribute('data-current-mode', current.id);
      iconEl.innerHTML = getIconSvg(current.id, icons.getStyle(), 18);
    }
    if (labelEl) labelEl.textContent = current.label;
    if (btnEl) {
      btnEl.title = `Map Layer: ${current.name} (Tap to cycle, or N / D / H)`;
    }
  };

  const setLayerMode = (mode: number, notify = false) => {
    scene.setViewMode(mode);
    updateLayerCycleButton(mode);
    if (notify) {
      const current = layerCycleModes[currentLayerIndex];
      addNotification('MAP LAYER', `Switched to <strong>${current.name}</strong>.`);
    }
  };

  const cycleLayer = () => {
    currentLayerIndex = (currentLayerIndex + 1) % layerCycleModes.length;
    const next = layerCycleModes[currentLayerIndex];
    setLayerMode(next.mode, true);
  };

  document.getElementById('btn-layer-cycle')?.addEventListener('click', cycleLayer);

  // Initialize button state to match default DEM mode (mode 2)
  updateLayerCycleButton(2);

  // Listen for layer changes from tuner tab clicks
  window.addEventListener('aegean:layer-change', (e: Event) => {
    const mode = (e as CustomEvent).detail?.mode;
    if (typeof mode === 'number') {
      updateLayerCycleButton(mode);
    }
  });

  // 5. Initialize & Wire Icon Themes System
  icons.updateDomIcons();

  icons.onStyleChange((style) => {
    const currentMode = layerCycleModes[currentLayerIndex].mode;
    updateLayerCycleButton(currentMode);
    const themeDef = ICON_THEMES.find((t) => t.id === style);
    addNotification('ICON THEME', `Applied <strong>${themeDef?.name || style}</strong> icon style.`);
    if (selectedIsland) {
      updateInspector(selectedIsland, scene.isIslandLit(selectedIsland));
    }
    if (selectedShipId) {
      updateVesselInspector(selectedShipId);
    }
  });

  // 6. Setup Settings Panel toggle (Top bar & Hotkey 'S')
  const topSettingsBtn = document.getElementById('btn-top-settings');

  const toggleSettings = (tab?: 'dem' | 'night' | 'day' | 'wake') => {
    scene.settingsPanel?.toggle(tab);
  };

  topSettingsBtn?.addEventListener('click', () => toggleSettings());

  // Fleet Management Panel toggle
  document.getElementById('btn-top-fleet')?.addEventListener('click', () => {
    fleetPanel?.toggle();
  });

  // 6. Setup panel close & toggle buttons
  const inspectorPanel = document.getElementById('inspector-panel');
  const feedPanel = document.getElementById('feed-panel');
  const toggleFeedBtn = document.getElementById('btn-toggle-feed');

  document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
    inspectorPanel?.classList.add('closed');
    selectedIsland = null;
    selectedShipId = null;
    scene?.setSelectedIsland(null);
    scene?.unfollowShip();
    updateProsperityLegendSelection(null);
  });

  // Inspector Fleet Management header button: opens Fleet Panel filtered to selected island
  document.getElementById('btn-inspector-fleet-modal')?.addEventListener('click', () => {
    if (selectedIsland) {
      fleetPanel?.showForPort(selectedIsland.id);
    } else {
      fleetPanel?.show();
    }
  });

  // Filter bar clicks (filter tabs and group view toggle)
  document.getElementById('inspector-vessel-filter-bar')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const filterBtn = target.closest('.vessel-filter-btn') as HTMLElement | null;
    if (filterBtn) {
      const f = filterBtn.getAttribute('data-filter') as 'all' | 'active' | 'idle';
      if (f) {
        inspectorVesselFilter = f;
        if (selectedIsland) {
          updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
        }
      }
      return;
    }

    const toggleBtn = target.closest('#btn-toggle-vessel-view');
    if (toggleBtn) {
      inspectorVesselViewMode = inspectorVesselViewMode === 'list' ? 'grouped' : 'list';
      if (selectedIsland) {
        updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
      }
      return;
    }
  });

  // Congestion banner click opens Fleet Panel for reassigning vessels
  document.getElementById('inspector-congestion-banner')?.addEventListener('click', () => {
    if (selectedIsland) {
      fleetPanel?.showForPort(selectedIsland.id);
    }
  });

  // Fleet list row click delegation: clicking any ship row opens its Vessel Dossier, or clicking underutilized chip opens advisory modal
  document.getElementById('inspector-routes')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Group card manage button
    if (target.closest('.btn-reassign-fleet-group')) {
      e.stopPropagation();
      if (selectedIsland) {
        fleetPanel?.showForPort(selectedIsland.id);
      }
      return;
    }

    // Scrap 1x idle vessel from group card
    const scrapGroupBtn = target.closest('.btn-scrap-group') as HTMLElement | null;
    if (scrapGroupBtn && sim?.shipManager) {
      e.stopPropagation();
      const typeId = scrapGroupBtn.getAttribute('data-type-id');
      const islId = scrapGroupBtn.getAttribute('data-island-id');
      if (typeId && islId) {
        const candidate = Array.from(sim.shipManager.ships.values()).find(
          (s) => s.typeId === typeId && (s.homeIslandId === islId || s.currentIslandId === islId) && evaluateShipUtilization(s, sim!) !== null
        ) || Array.from(sim.shipManager.ships.values()).find(
          (s) => s.typeId === typeId && s.homeIslandId === islId
        );
        if (candidate) {
          const refund = sim.getShipDecommissionRefund(candidate.id);
          const homeName = sim.islandsData.get(candidate.homeIslandId)?.name || 'Harbor';
          confirmModal.confirmDecommissionShip(candidate.name, homeName, refund).then((confirmed) => {
            if (confirmed && sim) {
              const res = sim.decommissionShip(candidate.id);
              if (res.success) {
                audio.playCoinSound();
                addNotification(
                  'VESSEL SCRAPPED',
                  `<strong>${res.shipName}</strong> decommissioned at ${homeName}. Reclaimed 1 harbor berth (+🪙 ${res.refund.toLocaleString()} drachmas salvage).`,
                  true
                );
                handleShipDecommissioned(candidate.id);
              }
            }
          });
        }
      }
      return;
    }

    // Scrap individual vessel from row button
    const rowScrapBtn = target.closest('.btn-row-decommission') as HTMLElement | null;
    if (rowScrapBtn && sim?.shipManager) {
      e.stopPropagation();
      const sId = rowScrapBtn.getAttribute('data-ship-id');
      if (sId) {
        const ship = sim.shipManager.ships.get(sId);
        if (ship) {
          const refund = sim.getShipDecommissionRefund(sId);
          const homeName = sim.islandsData.get(ship.homeIslandId)?.name || 'Harbor';
          confirmModal.confirmDecommissionShip(ship.name, homeName, refund).then((confirmed) => {
            if (confirmed && sim) {
              const res = sim.decommissionShip(sId);
              if (res.success) {
                audio.playCoinSound();
                addNotification(
                  'VESSEL SCRAPPED',
                  `<strong>${res.shipName}</strong> decommissioned at ${homeName}. Reclaimed 1 harbor berth (+🪙 ${res.refund.toLocaleString()} drachmas salvage).`,
                  true
                );
                handleShipDecommissioned(sId);
              }
            }
          });
        }
      }
      return;
    }

    const chip = target.closest('.vessel-underutilized-chip');
    if (chip) {
      e.stopPropagation();
      const shipId = chip.getAttribute('data-ship-id');
      if (shipId) {
        vesselAdvisoryModal?.show(shipId);
        return;
      }
    }

    const row = target.closest('.vessel-row');
    const shipId = row?.getAttribute('data-ship-id');
    if (shipId) {
      updateVesselInspector(shipId);
    }
  });

  // Global delegation for underutilized status chips across all panels and modals
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const fleetPill = target.closest('.fleet-underutilized-pill') as HTMLElement | null;
    if (fleetPill) {
      e.stopPropagation();
      const shipId = fleetPill.getAttribute('data-ship-id');
      if (shipId) {
        vesselAdvisoryModal?.show(shipId);
        return;
      }
    }

    const archChip = target.closest('.arch-underutilized-chip') as HTMLElement | null;
    if (archChip) {
      e.stopPropagation();
      archipelagoModal?.hide();
      fleetPanel?.show();
      return;
    }
  });

  // Vessel Dossier Action Buttons (Follow Camera, Decommission & Return to Island Port)
  document.getElementById('btn-vessel-decommission')?.addEventListener('click', async () => {
    if (!selectedShipId || !sim?.shipManager) return;
    const ship = sim.shipManager.ships.get(selectedShipId);
    if (!ship) return;
    const refund = sim.getShipDecommissionRefund(selectedShipId);
    const homeName = sim.islandsData.get(ship.homeIslandId)?.name || 'Harbor';
    const confirmed = await confirmModal.confirmDecommissionShip(ship.name, homeName, refund);
    if (confirmed && sim) {
      const res = sim.decommissionShip(selectedShipId);
      if (res.success) {
        audio.playCoinSound();
        addNotification(
          'VESSEL SCRAPPED',
          `<strong>${res.shipName}</strong> decommissioned at ${homeName}. Reclaimed 1 harbor berth (+🪙 ${res.refund.toLocaleString()} drachmas salvage).`,
          true
        );
        handleShipDecommissioned(selectedShipId);
      }
    }
  });

  document.getElementById('btn-vessel-follow')?.addEventListener('click', () => {
    if (!selectedShipId || !scene) return;
    if (scene.isFollowingShip()) {
      scene.unfollowShip();
      addNotification('CAMERA', 'Exited vessel follow camera.');
    } else {
      const ship = sim?.shipManager?.ships.get(selectedShipId);
      scene.followShip(selectedShipId, () => {
        if (selectedShipId) updateVesselInspector(selectedShipId);
      });
      addNotification('CAMERA FOLLOW', `Tracking ${ship?.name || 'vessel'} through the Cyclades.`, true);
    }
    updateVesselInspector(selectedShipId);
  });

  document.getElementById('btn-vessel-back')?.addEventListener('click', () => {
    scene?.unfollowShip();
    selectedShipId = null;
    if (selectedIsland) {
      updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
    } else {
      const startIsland = sim?.islandsData.get('santorini') || sim?.islandsData.values().next().value;
      if (startIsland) updateInspector(startIsland, scene?.isIslandLit(startIsland));
    }
  });

  // Vessel Travel Recommendation & Dispatch Listeners
  document.getElementById('inspector-ship-block')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const travelBtn = target.closest('.btn-vessel-travel-port') as HTMLElement | null;
    if (travelBtn && selectedShipId && sim) {
      const targetPortId = travelBtn.dataset.targetPortId;
      if (targetPortId) {
        const ship = sim.shipManager?.ships.get(selectedShipId);
        if (ship) {
          const ok = sim.redirectShip(selectedShipId, targetPortId, ship.cargoPriority);
          if (ok) {
            audio.playClickSound();
            const targetName = sim.islandsData.get(targetPortId)?.name || 'Destination Port';
            const fromName = sim.islandsData.get(ship.currentIslandId || ship.homeIslandId)?.name || 'Harbor';
            addNotification(
              'MARITIME DISPATCH',
              `<strong>${ship.name}</strong> departed ${fromName}, setting sail for <strong>${targetName} Port</strong>!`,
              true
            );
            updateVesselInspector(selectedShipId);
          }
        }
      }
      return;
    }

    const awakenBtn = target.closest('.btn-awaken-view') as HTMLElement | null;
    if (awakenBtn && sim) {
      audio.playClickSound();
      archipelagoModal?.show('sleeping');
      return;
    }
  });

  const travelSelectEl = document.getElementById('vessel-travel-select') as HTMLSelectElement | null;
  const travelGoBtnEl = document.getElementById('btn-vessel-travel-go') as HTMLButtonElement | null;

  travelSelectEl?.addEventListener('change', () => {
    if (!travelSelectEl || !travelGoBtnEl) return;
    const val = travelSelectEl.value;
    if (val && sim) {
      travelGoBtnEl.disabled = false;
      const portName = sim.islandsData.get(val)?.name || 'Port';
      travelGoBtnEl.textContent = `🧭 Sail to ${portName}`;
    } else {
      travelGoBtnEl.disabled = true;
      travelGoBtnEl.textContent = '⛵ Set Sail';
    }
  });

  travelGoBtnEl?.addEventListener('click', () => {
    if (!selectedShipId || !sim || !travelSelectEl) return;
    const targetPortId = travelSelectEl.value;
    if (!targetPortId) return;

    const ship = sim.shipManager?.ships.get(selectedShipId);
    if (ship) {
      const ok = sim.redirectShip(selectedShipId, targetPortId, ship.cargoPriority);
      if (ok) {
        audio.playClickSound();
        const targetName = sim.islandsData.get(targetPortId)?.name || 'Destination Port';
        const fromName = sim.islandsData.get(ship.currentIslandId || ship.homeIslandId)?.name || 'Harbor';
        addNotification(
          'MARITIME DISPATCH',
          `<strong>${ship.name}</strong> departed ${fromName}, setting sail for <strong>${targetName} Port</strong>!`,
          true
        );
        updateVesselInspector(selectedShipId);
      }
    }
  });

  document.getElementById('btn-close-feed')?.addEventListener('click', () => {
    feedPanel?.classList.add('closed');
    toggleFeedBtn?.classList.remove('active');
  });

  toggleFeedBtn?.addEventListener('click', () => {
    if (feedPanel) {
      const isClosed = feedPanel.classList.toggle('closed');
      toggleFeedBtn.classList.toggle('active', !isClosed);
    }
  });

  // 7. Setup quick toggle listeners
  const toggleLabelsBtn = document.getElementById('btn-toggle-labels');
  let labelsVisible = true;
  toggleLabelsBtn?.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    toggleLabelsBtn.classList.toggle('active', labelsVisible);
    scene.islandMarkers?.setLabelsVisible(labelsVisible);
  });

  const toggleFlowBtn = document.getElementById('btn-toggle-flow');
  toggleFlowBtn?.addEventListener('click', () => {
    toggleFlowBtn.classList.toggle('active');
  });

  const autoZoomBtn = document.getElementById('btn-auto-zoom');
  autoZoomBtn?.addEventListener('click', () => {
    zoomToActiveTerritory(1800);
    addNotification('CAMERA FOCUS', 'Auto-zoomed to frame active trade islands.', false);
  });

  function awakenIslandById(islandId: string) {
    if (!sim) return;
    const isl = sim.islandsData.get(islandId);
    if (!isl) return;

    if (!sim.unlockedIslands.has(isl.id)) {
      const unlockRes = sim.unlockIsland(isl.id);
      if (unlockRes.success) {
        if (isNotificationAudioEnabled('AWAKENING')) {
          audio.playAwakeningFanfare();
        }
        addNotification(
          'AWAKENING',
          `${isl.name} awakens! Paid 🪙 ${isl.unlock?.cost || 0} drachmas. A golden dawn wave illuminates its harbor.`,
          true
        );
        scene.awakenIsland(isl, () => {
          if (selectedIsland?.id === isl.id) {
            updateInspector(isl, true);
          }
        });
        if (selectedIsland?.id === isl.id) {
          updateInspector(isl, true);
        }
        updateTopBarMetrics();
        zoomToActiveTerritory(2400);

        // Check for Whole Aegean Awake endgame trigger
        if (sim && sim.unlockedIslands.size >= sim.islandsData.size) {
          const modal = document.getElementById('endgame-modal');
          if (modal && modal.classList.contains('closed')) {
            audio.playEndgameVictoryFanfare();
            const valTreasury = document.getElementById('endgame-val-treasury');
            const valTp = document.getElementById('endgame-val-tp');
            const valFleet = document.getElementById('endgame-val-fleet');
            const valDays = document.getElementById('endgame-val-days');
            if (valTreasury) valTreasury.textContent = `🪙 ${Math.floor(sim.treasury).toLocaleString()}`;
            if (valTp) valTp.textContent = `⭐ ${sim.tradePoints.toLocaleString()} TP`;
            if (valFleet) valFleet.textContent = `${sim.shipManager?.ships.size || 0} Vessels`;
            if (valDays) valDays.textContent = `${Math.floor(sim.gameDay)} Days`;
            modal.classList.remove('closed');
            const allIslands = Array.from(sim.islandsData.values());
            scene.zoomToActiveIslands(allIslands, 6000);
          }
        }
      } else {
        const activeSim = sim;
        const reqIds: string[] | undefined = unlockRes.requiredIslands || isl.unlock?.requiresConnectedTo;
        if (activeSim && reqIds && reqIds.length > 0 && !reqIds.some((r: string) => activeSim.unlockedIslands.has(r))) {
          const links = reqIds
            .map((r: string) => {
              const reqName = activeSim.islandsData.get(r)?.name || r;
              return `<button class="feed-island-link" data-island-id="${r}" title="Click to view and connect ${reqName}">📍 ${reqName}</button>`;
            })
            .join(' or ');
          addNotification('CANNOT UNLOCK', `${isl.name}: Must connect to ${links} first`, true);
        } else {
          addNotification('CANNOT UNLOCK', `${isl.name}: ${unlockRes.reason || 'Prerequisites not met.'}`, true);
        }
      }
    } else {
      addNotification('DISPATCH', `${isl.name} is already connected and basking in Mediterranean daylight.`);
    }
  }

  // 8. Setup action buttons in Left Inspector (Unlock / Route)
  document.getElementById('btn-new-route')?.addEventListener('click', () => {
    if (!selectedIsland) return;
    awakenIslandById(selectedIsland.id);
  });

  // Delegated click handler on Inspector unlock requirement banner to select and focus required island
  document.getElementById('inspector-unlock-req-box')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-island-id]') as HTMLElement | null;
    if (!btn) return;
    const islandId = btn.getAttribute('data-island-id');
    if (islandId) {
      selectAndFocusIsland(islandId);
    }
  });

  // Single Notification Audio Toggle in Maritime Dispatch Header
  const updateFeedAudioButton = (enabled: boolean) => {
    const btn = document.getElementById('btn-feed-audio-toggle');
    if (!btn) return;
    btn.classList.toggle('on', enabled);
    btn.classList.toggle('off', !enabled);
    btn.innerHTML = enabled ? '🔊 ON' : '🔇 OFF';
    btn.title = enabled ? 'Mute notification sounds' : 'Unmute notification sounds';
    btn.setAttribute('aria-label', enabled ? 'Mute notification sounds' : 'Unmute notification sounds');
  };

  document.getElementById('btn-feed-audio-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextState = toggleNotificationAudio();
    updateFeedAudioButton(nextState);
    if (nextState) {
      audio.playClickSound();
    }
  });

  // Delegated click handler on Notification feed list to select and focus any mentioned island
  document.getElementById('event-feed-list')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-island-id]') as HTMLElement | null;
    if (!btn) return;
    const islandId = btn.getAttribute('data-island-id');
    if (islandId) {
      selectAndFocusIsland(islandId);
    }
  });

  // Shipyard tier selection chip click
  document.getElementById('shipyard-tier-chips')?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.shipyard-chip');
    if (!chip) return;
    const tierId = chip.getAttribute('data-tier-id');
    if (!tierId || !sim) return;
    const def = sim.shipDefs.get(tierId);
    if (!def) return;
    if (sim.unlockedIslands.size < (def.unlock.islandsConnected || 1)) {
      addNotification('SHIPYARD LOCKED', `${def.name} requires ${def.unlock.islandsConnected} connected islands across the archipelago.`, true);
      return;
    }
    audio.playClickSound();
    selectedShipTier = tierId;
    if (selectedIsland) {
      updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
    }
  });

  // Commission Vessel button in Left Inspector
  document.getElementById('btn-buy-ship')?.addEventListener('click', () => {
    if (!selectedIsland || !sim) return;
    const isl = selectedIsland;
    const res = sim.buyShip(selectedShipTier, isl.id);
    if (res.success && res.ship) {
      if (isNotificationAudioEnabled('VESSELS')) {
        audio.playDockSound();
      }
      const def = sim.shipDefs.get(selectedShipTier);
      addNotification(
        'VESSEL COMMISSIONED',
        `⚓ Commissioned <strong>${res.ship.name}</strong> (${def?.name || 'Vessel'}) at ${isl.name} harbor for 🪙 ${def?.cost || 120} drachmas! Embarking immediately on commercial routes.`,
        true
      );
      updateInspector(isl, scene.isIslandLit(isl));
      updateTopBarMetrics();
    } else {
      addNotification('SHIPYARD NOTICE', `${res.reason || 'Cannot commission vessel at this time.'}`, true);
    }
  });

  // Vessel Cargo Priority Mandate selection change
  document.getElementById('vessel-cargo-priority')?.addEventListener('change', (e) => {
    if (!selectedShipId || !sim) return;
    const target = e.target as HTMLSelectElement;
    const newPri = target.value;
    const ok = sim.setShipCargoPriority(selectedShipId, newPri);
    const ship = sim.shipManager?.ships.get(selectedShipId);
    if (ok && ship) {
      const goodName = newPri === 'auto' ? 'Maximum Market Profit' : formatGoodName(newPri);
      addNotification(
        'VESSEL MANDATE',
        `<strong>${ship.name}</strong> cargo priority assigned: <strong>${goodName}</strong>.`,
        true
      );
      updateVesselInspector(selectedShipId);
    }
  });

  // Setup dispatch feed clear button
  document.getElementById('btn-clear-feed')?.addEventListener('click', () => {
    audio.playClickSound();
    const list = document.getElementById('event-feed-list');
    if (list) list.innerHTML = '';
  });

  // --- Top-bar Audio Mute Button ---
  const btnTopAudio = document.getElementById('btn-top-audio');
  const updateTopAudioState = () => {
    if (!btnTopAudio) return;
    const isMuted = audio.isMuted();
    btnTopAudio.textContent = isMuted ? '🔇' : '🔊';
    btnTopAudio.classList.toggle('muted', isMuted);
    btnTopAudio.title = isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)';
  };
  updateTopAudioState();

  btnTopAudio?.addEventListener('click', () => {
    audio.toggleMute();
    updateTopAudioState();
  });

  // --- Top-bar Language Switcher Setup ---
  const langToggleBtn = document.getElementById('btn-lang-toggle');
  const langDropdown = document.getElementById('lang-dropdown');
  const langWrap = document.getElementById('top-lang-selector');

  const closeLangDropdown = () => {
    langDropdown?.classList.add('closed');
    langWrap?.classList.remove('open');
    langToggleBtn?.setAttribute('aria-expanded', 'false');
  };

  langToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.playClickSound();
    const isClosed = langDropdown?.classList.contains('closed');
    if (isClosed) {
      langDropdown?.classList.remove('closed');
      langWrap?.classList.add('open');
      langToggleBtn?.setAttribute('aria-expanded', 'true');
    } else {
      closeLangDropdown();
    }
  });

  document.querySelectorAll<HTMLElement>('.lang-option').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = opt.getAttribute('data-lang') as SupportedLanguage | null;
      if (lang) {
        audio.playClickSound();
        setLanguage(lang);
        closeLangDropdown();
        const langNames: Record<SupportedLanguage, string> = {
          en: 'English',
          el: 'Ελληνικά',
          tr: 'Türkçe',
        };
        addNotification('LANGUAGE', `Language switched to <strong>${langNames[lang]}</strong>.`, false);
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (langWrap && !langWrap.contains(e.target as Node)) {
      closeLangDropdown();
    }
  });

  // Re-translate dynamically when language changes
  onLanguageChange((_newLang) => {
    updateDomTranslations();
    if (selectedIsland) {
      updateInspector(selectedIsland, scene?.isIslandLit(selectedIsland));
    }
    if (selectedShipId) {
      updateVesselInspector(selectedShipId);
    }
    topSearch?.performSearch();
    scene?.islandMarkers?.refreshLabels();
  });

  // Run initial DOM translations on start
  updateDomTranslations();

  // --- First-time Skipper Onboarding (Opens Guide inside Fleet Management) ---
  const isTutorialDismissed = localStorage.getItem('aegean_tutorial_hidden_v1') === 'true';
  if (!isTutorialDismissed && fleetPanel) {
    fleetPanel.show('guide');
    localStorage.setItem('aegean_tutorial_hidden_v1', 'true');
  }

  // --- Economic Recommendations Advisory Modal Handlers ---
  document.getElementById('btn-island-advisory')?.addEventListener('click', () => {
    if (selectedIsland) {
      showEconomicReportModal(selectedIsland.id);
    } else {
      const defaultIsland = sim?.islandsData.get('santorini') || sim?.islandsData.values().next().value;
      if (defaultIsland) {
        showEconomicReportModal(defaultIsland.id);
      }
    }
  });

  document.getElementById('btn-close-advisory')?.addEventListener('click', () => {
    hideEconomicReportModal();
  });

  const advisoryModalEl = document.getElementById('advisory-modal');
  advisoryModalEl?.addEventListener('click', (e) => {
    if (e.target === advisoryModalEl) {
      hideEconomicReportModal();
    }
  });

  // --- Commodity Sourcing & Supply Chain Modal Listeners ---
  const handleGoodPillClick = (e: MouseEvent) => {
    const pill = (e.target as HTMLElement).closest('.good-pill') as HTMLElement | null;
    if (!pill) return;
    const islandId = pill.getAttribute('data-island-id');
    const goodId = pill.getAttribute('data-good-id');
    if (islandId && goodId && sourcingModal) {
      audio.playClickSound();
      sourcingModal.show(islandId, goodId);
    }
  };

  document.getElementById('inspector-produces')?.addEventListener('click', handleGoodPillClick);
  document.getElementById('inspector-consumes')?.addEventListener('click', handleGoodPillClick);

  // Delegated click handler on Advisory Report cards, badges & buttons to open Sourcing Modal for that good
  document.getElementById('advisory-content')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const prioritizeBtn = target.closest('.btn-u-prioritize') as HTMLElement | null;
    if (prioritizeBtn) {
      const shipId = prioritizeBtn.getAttribute('data-ship-id');
      const goodId = prioritizeBtn.getAttribute('data-good-id');
      const islId = prioritizeBtn.getAttribute('data-island-id');
      if (shipId && goodId && sim) {
        audio.playClickSound();
        sim.setShipCargoPriority(shipId, goodId);
        const ship = sim.shipManager?.ships.get(shipId);
        addNotification(
          'VESSEL MANDATE',
          `<strong>${ship?.name || 'Vessel'}</strong> directed to prioritize hauling <strong>${formatGoodName(goodId)}</strong>.`,
          true
        );
        if (islId) {
          showEconomicReportModal(islId);
        }
      }
      return;
    }

    const trackBtn = target.closest('.btn-u-track') as HTMLElement | null;
    if (trackBtn) {
      const shipId = trackBtn.getAttribute('data-ship-id');
      if (shipId && scene) {
        audio.playClickSound();
        hideEconomicReportModal();
        updateVesselInspector(shipId);
        scene.followShip(shipId, () => {
          if (selectedShipId) updateVesselInspector(selectedShipId);
        });
        const ship = sim?.shipManager?.ships.get(shipId);
        addNotification('CAMERA FOLLOW', `Tracking ${ship?.name || 'vessel'} across Aegean trade lanes.`, true);
      }
      return;
    }

    const sourcingBtn = target.closest(
      '.btn-open-sourcing-item, .btn-badge-sourcing, .advisory-status-badge, .advisory-good-badge'
    ) as HTMLElement | null;
    if (sourcingBtn) {
      const islandId = sourcingBtn.getAttribute('data-island-id');
      const goodId = sourcingBtn.getAttribute('data-good-id');
      if (islandId && goodId && sourcingModal) {
        audio.playClickSound();
        hideEconomicReportModal();
        sourcingModal.show(islandId, goodId);
      }
    }
  });

  // --- Top-bar Metric Chips Interactive Handlers ---
  document.getElementById('metric-islands')?.addEventListener('click', () => {
    archipelagoModal?.show();
  });

  // --- Endgame Modal Action Handlers ---
  document.getElementById('btn-endgame-continue')?.addEventListener('click', () => {
    audio.playClickSound();
    document.getElementById('endgame-modal')?.classList.add('closed');
  });

  document.getElementById('btn-endgame-credits')?.addEventListener('click', () => {
    audio.playClickSound();
    document.getElementById('endgame-modal')?.classList.add('closed');
    scene.settingsPanel?.show('credits');
  });

  // 9. Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
      hideEconomicReportModal();
      sourcingModal?.hide();
      archipelagoModal?.hide();
      topSearch?.closeDropdown();
      selectedIsland = null;
      selectedShipId = null;
      scene?.setSelectedIsland(null);
      scene?.unfollowShip();
      inspectorPanel?.classList.add('closed');
      feedPanel?.classList.add('closed');
      toggleFeedBtn?.classList.remove('active');
      scene.settingsPanel?.hide();
      fleetPanel?.hide();
      document.getElementById('endgame-modal')?.classList.add('closed');
      updateProsperityLegendSelection(null);
    } else if (key === 'a') {
      archipelagoModal?.toggle();
    } else if (key === 'v') {
      fleetPanel?.toggle('roster');
    } else if (key === 'h') {
      fleetPanel?.toggle('guide');
    } else if (e.code === 'Space') {
      const newSpeed = sim?.gameSpeed === 0 ? 1 : 0;
      setGameSpeed(newSpeed);
    } else if (key === '1') {
      setGameSpeed(1);
    } else if (key === '2') {
      setGameSpeed(4);
    } else if (key === '3') {
      setGameSpeed(16);
    } else if (key === 'n') {
      setLayerMode(0, true);
    } else if (key === 'd') {
      setLayerMode(1, true);
    } else if (key === 'c') {
      cycleLayer();
    } else if (key === 'm') {
      audio.toggleMute();
      updateTopAudioState();
    } else if (key === 'z') {
      zoomToActiveTerritory(1800);
      addNotification('CAMERA FOCUS', 'Auto-zoomed to frame active trade islands (Key Z).', false);
    } else if (key === 's') {
      toggleSettings();
    } else if (key === 't') {
      if (scene.terrain?.material.uniforms.uViewMode.value !== 2) {
        setLayerMode(2);
      }
      scene.settingsPanel?.show('dem');
    } else if (key === 'l') {
      toggleLabelsBtn?.click();
    } else if (key === 'f') {
      toggleFlowBtn?.click();
    } else if (key === 'k') {
      // Debug key 'K' toggles an island's lit state
      let target = selectedIsland;
      if (!target && scene.islandMarkers && scene.islandMarkers.islands.length > 0) {
        target = scene.islandMarkers.islands.find((isl) => !scene.isIslandLit(isl)) || scene.islandMarkers.islands[2];
      }
      if (target) {
        const willLight = !scene.isIslandLit(target);
        selectedIsland = target;
        if (willLight) {
          audio.playAwakeningFanfare();
          addNotification('DAWN REVEAL', `Awakening ${target.name} into daylight (Key K)...`, true);
          const pLon = target.peak?.lon ?? target.lon;
          const pLat = target.peak?.lat ?? target.lat;
          const worldPos = scene.terrain?.getPeakWorld(pLon, pLat);
          if (worldPos) scene.cameraManager.focusOn(worldPos, 18);
        } else {
          addNotification('NIGHTFALL', `${target.name} falls asleep under moonlit night.`, false);
        }
        scene.toggleIslandLit(target, (isLit) => {
          if (selectedIsland?.id === target?.id) {
            updateInspector(target, isLit);
          }
        });
        updateInspector(target, willLight);
      }
    }
  });

  // Sync initial state of the single notification audio toggle button
  const currentNotifAudioEnabled = isNotificationAudioEnabled();
  const feedAudioBtn = document.getElementById('btn-feed-audio-toggle');
  if (feedAudioBtn) {
    feedAudioBtn.classList.toggle('on', currentNotifAudioEnabled);
    feedAudioBtn.classList.toggle('off', !currentNotifAudioEnabled);
    feedAudioBtn.innerHTML = currentNotifAudioEnabled ? '🔊 ON' : '🔇 OFF';
    feedAudioBtn.title = currentNotifAudioEnabled ? 'Mute notification sounds' : 'Unmute notification sounds';
    feedAudioBtn.setAttribute('aria-label', currentNotifAudioEnabled ? 'Mute notification sounds' : 'Unmute notification sounds');
  }

  // Expose global debug objects
  (window as unknown as { __aegeanScene: AegeanScene; __aegeanSim: SimulationCore | null }).__aegeanScene = scene;
  (window as unknown as { __aegeanScene: AegeanScene; __aegeanSim: SimulationCore | null }).__aegeanSim = sim;
});
