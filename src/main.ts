import { AegeanScene } from './render/Scene';
import type { IslandData } from './data/types';

const GOOD_EMOJIS: Record<string, string> = {
  grain: '🌾',
  cheese: '🧀',
  water: '💧',
  wine: '🍷',
  olive_oil: '🫒',
  fish: '🐟',
  crafts: '🏺',
  marble: '🏛️',
  sponges: '🧽',
  fuel: '⛽',
  produce: '🍋',
  mastic: '🌿',
};

function formatGoodName(id: string): string {
  return id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function updateInspector(island: IslandData) {
  const panel = document.getElementById('inspector-panel');
  if (panel) {
    panel.classList.remove('closed');
  }

  const titleEl = document.getElementById('inspector-title');
  const subtitleEl = document.getElementById('inspector-subtitle');
  const badgeEl = document.getElementById('inspector-status-badge');
  const producesEl = document.getElementById('inspector-produces');
  const consumesEl = document.getElementById('inspector-consumes');

  if (titleEl) titleEl.textContent = `${island.name} Port`;
  if (subtitleEl) {
    subtitleEl.textContent = `${island.type === 'mainland_port' ? 'Mainland' : 'Island'} • Pop: ${island.population.toLocaleString()}`;
  }

  if (badgeEl) {
    if (island.unlock?.isStart) {
      badgeEl.className = 'badge-connected';
      badgeEl.textContent = 'Daylight • Connected';
    } else {
      badgeEl.className = 'badge-connected';
      badgeEl.style.background = 'rgba(242, 193, 78, 0.15)';
      badgeEl.style.borderColor = 'rgba(242, 193, 78, 0.35)';
      badgeEl.style.color = '#f2c14e';
      badgeEl.textContent = 'Awaiting Connection';
    }
  }

  // Cast island with production/consumption profiles
  const islFull = island as unknown as {
    produces?: Record<string, number>;
    consumes?: Record<string, number>;
  };

  if (producesEl && islFull.produces) {
    producesEl.innerHTML = Object.entries(islFull.produces)
      .map(([good, rate]) => {
        const emoji = GOOD_EMOJIS[good] || '📦';
        return `<span class="good-pill producer" title="Exports ${formatGoodName(good)}">${emoji} ${formatGoodName(good)} <strong class="good-rate">+${rate}/d</strong></span>`;
      })
      .join('');
  }

  if (consumesEl && islFull.consumes) {
    consumesEl.innerHTML = Object.entries(islFull.consumes)
      .map(([good, rate]) => {
        const emoji = GOOD_EMOJIS[good] || '📦';
        return `<span class="good-pill consumer" title="Needs ${formatGoodName(good)}">${emoji} ${formatGoodName(good)} <strong class="good-rate">-${rate}/d</strong></span>`;
      })
      .join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Failed to find #three-canvas element');
    return;
  }

  // Initialize Three.js renderer with island selection callback
  const scene = new AegeanScene(canvas, (island) => {
    updateInspector(island);
  });
  console.log('Aegean 3D Scene initialized successfully.');

  // Setup speed button listeners
  const speedButtons = [
    { id: 'btn-speed-pause', speed: 0 },
    { id: 'btn-speed-1x', speed: 1 },
    { id: 'btn-speed-4x', speed: 4 },
    { id: 'btn-speed-16x', speed: 16 },
  ];

  speedButtons.forEach(({ id }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => {
        document.getElementById(b.id)?.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // Setup layer switcher listeners (Night / Day / DEM / Mask)
  const layerButtons = [
    { id: 'btn-layer-night', mode: 0 },
    { id: 'btn-layer-day', mode: 1 },
    { id: 'btn-layer-heightmap', mode: 2 },
    { id: 'btn-layer-mask', mode: 3 },
  ];

  const switchLayer = (btnId: string, mode: number) => {
    scene.setViewMode(mode);
    layerButtons.forEach((b) => {
      const el = document.getElementById(b.id);
      if (b.id === btnId) el?.classList.add('active');
      else el?.classList.remove('active');
    });
  };

  layerButtons.forEach(({ id, mode }) => {
    document.getElementById(id)?.addEventListener('click', () => switchLayer(id, mode));
  });

  // Listen for layer changes from tuner tab clicks
  window.addEventListener('aegean:layer-change', (e: Event) => {
    const mode = (e as CustomEvent).detail?.mode;
    const targetBtn = layerButtons.find((b) => b.mode === mode);
    if (targetBtn) {
      layerButtons.forEach((b) => {
        const el = document.getElementById(b.id);
        if (b.id === targetBtn.id) el?.classList.add('active');
        else el?.classList.remove('active');
      });
    }
  });

  // Setup Settings Panel toggles (Top bar & Bottom bar)
  const openSettingsBtn = document.getElementById('btn-open-settings');
  const topSettingsBtn = document.getElementById('btn-top-settings');

  const toggleSettings = (tab?: 'dem' | 'night' | 'day') => {
    scene.settingsPanel?.toggle(tab);
  };

  openSettingsBtn?.addEventListener('click', () => toggleSettings());
  topSettingsBtn?.addEventListener('click', () => toggleSettings());

  // Setup panel close & toggle buttons
  const inspectorPanel = document.getElementById('inspector-panel');
  const feedPanel = document.getElementById('feed-panel');
  const toggleFeedBtn = document.getElementById('btn-toggle-feed');

  document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
    inspectorPanel?.classList.add('closed');
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

  // Setup quick toggle listeners
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

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
      inspectorPanel?.classList.add('closed');
      feedPanel?.classList.add('closed');
      toggleFeedBtn?.classList.remove('active');
      scene.settingsPanel?.hide();
    } else if (e.code === 'Space') {
      document.getElementById('btn-speed-pause')?.click();
    } else if (key === '1') {
      document.getElementById('btn-speed-1x')?.click();
    } else if (key === '2') {
      document.getElementById('btn-speed-4x')?.click();
    } else if (key === '3') {
      document.getElementById('btn-speed-16x')?.click();
    } else if (key === 'n') {
      switchLayer('btn-layer-night', 0);
    } else if (key === 'd') {
      switchLayer('btn-layer-day', 1);
    } else if (key === 'h') {
      switchLayer('btn-layer-heightmap', 2);
    } else if (key === 's') {
      toggleSettings();
    } else if (key === 't') {
      if (scene.terrain?.material.uniforms.uViewMode.value !== 2) {
        switchLayer('btn-layer-heightmap', 2);
      }
      scene.settingsPanel?.show('dem');
    } else if (key === 'm') {
      switchLayer('btn-layer-mask', 3);
    } else if (key === 'l') {
      toggleLabelsBtn?.click();
    } else if (key === 'f') {
      toggleFlowBtn?.click();
    }
  });

  // Expose scene for debugging
  (window as unknown as { __aegeanScene: AegeanScene }).__aegeanScene = scene;
});
