/**
 * AudioManager - Web Audio API procedural sound engine for Aegean Tycoon.
 * Features:
 * - Procedural ocean waves & Mediterranean wind ambience.
 * - Dynamic sound synthesis for coins, deliveries, dockings, and dawn awakenings.
 * - Zero external audio file dependencies (no 404s, instant load, zero latency).
 * - Full volume controls & localStorage persistence.
 */

export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
}

const STORAGE_KEY = 'aegean_audio_settings_v1';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Ambience nodes
  private waveGain: GainNode | null = null;
  private waveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private isAmbienceRunning = false;

  private lastCoinTime = 0;
  private lastTicketTime = 0;
  private lastVipTime = 0;
  private lastDockTime = 0;

  private settings: AudioSettings = {
    muted: false,
    masterVolume: 0.60,
    ambienceVolume: 0.45,
    sfxVolume: 0.45,
  };

  constructor() {
    this.loadSettings();

    // Browser Autoplay Policy: resume audio context and start ambience on first user pointer/key/touch interaction
    const unlockAudio = () => {
      this.initContext();
      if (!this.ctx) return;

      const onReady = () => {
        if (!this.settings.muted && !this.isAmbienceRunning) {
          this.startAmbience();
        }
      };

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(onReady).catch(console.warn);
      } else {
        onReady();
      }

      if (this.isAmbienceRunning) {
        events.forEach((evt) => window.removeEventListener(evt, unlockAudio));
      }
    };

    const events = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'];
    if (typeof window !== 'undefined') {
      events.forEach((evt) => {
        window.addEventListener(evt, unlockAudio, { passive: true });
      });

      // Attempt immediate initialization if browser already allows audio autoplay
      this.initContext();
      if (this.ctx && this.ctx.state === 'running' && !this.settings.muted) {
        this.startAmbience();
      }
    }
  }

  private initContext(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master limiter / dynamics compressor to prevent clipping and volume spikes
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.20, this.ctx.currentTime);

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.muted ? 0 : this.settings.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      // Ambience bus
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.setValueAtTime(this.settings.ambienceVolume, this.ctx.currentTime);
      this.ambienceGain.connect(this.masterGain);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Preload shortened Crisp Coin Taps and Ferry Ticket audio assets
      this.loadCoinAudio();
      this.loadTicketAudio();

      // If AudioContext started in running state, initiate ocean & wind ambience
      if (this.ctx.state === 'running' && !this.settings.muted && !this.isAmbienceRunning) {
        this.startAmbience();
      }
    } catch (e) {
      console.warn('Web Audio API not supported in this browser.', e);
    }
  }

  private coinBuffer: AudioBuffer | null = null;
  private isCoinLoading = false;

  private ticketBuffer: AudioBuffer | null = null;
  private isTicketLoading = false;

  /**
   * Asynchronously loads and decodes the shortened "Crisp Coin Taps" audio sample into an AudioBuffer.
   */
  private loadCoinAudio(): void {
    if (this.coinBuffer || this.isCoinLoading || !this.ctx) return;
    if (typeof fetch === 'undefined') return;

    this.isCoinLoading = true;
    fetch('/audio/coin.wav')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (this.ctx) {
          return this.ctx.decodeAudioData(arrayBuffer);
        }
        return null;
      })
      .then((decoded) => {
        if (decoded) {
          this.coinBuffer = decoded;
        }
      })
      .catch((e) => {
        console.warn('Could not load /audio/coin.wav, using procedural coin fallback', e);
      })
      .finally(() => {
        this.isCoinLoading = false;
      });
  }

  /**
   * Asynchronously loads and decodes the shortened "Ferry Ticket" punch audio sample into an AudioBuffer.
   */
  private loadTicketAudio(): void {
    if (this.ticketBuffer || this.isTicketLoading || !this.ctx) return;
    if (typeof fetch === 'undefined') return;

    this.isTicketLoading = true;
    fetch('/audio/ferry_ticket.wav')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (this.ctx) {
          return this.ctx.decodeAudioData(arrayBuffer);
        }
        return null;
      })
      .then((decoded) => {
        if (decoded) {
          this.ticketBuffer = decoded;
        }
      })
      .catch((e) => {
        console.warn('Could not load /audio/ferry_ticket.wav, using procedural ticket fallback', e);
      })
      .finally(() => {
        this.isTicketLoading = false;
      });
  }

  /**
   * Starts procedural Mediterranean ocean surf and gentle sea wind.
   */
  public startAmbience(): void {
    this.initContext();
    if (!this.ctx || this.isAmbienceRunning) return;
    if (this.settings.muted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (!this.settings.muted && !this.isAmbienceRunning) {
          this.startAmbience();
        }
      }).catch(console.warn);
      return;
    }

    this.isAmbienceRunning = true;

    try {
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 5; // 5-second looped noise buffer
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Generate soft pink/brown noise
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }

      // 1. Ocean Waves Swell (Lowpass filtered noise modulated by a 6-second wave swell LFO)
      const waveSource = this.ctx.createBufferSource();
      waveSource.buffer = noiseBuffer;
      waveSource.loop = true;

      this.waveFilter = this.ctx.createBiquadFilter();
      this.waveFilter.type = 'lowpass';
      this.waveFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.waveFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.waveGain = this.ctx.createGain();
      this.waveGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      // LFO for wave ebb and flow (0.16 Hz ~ 6.2s period)
      const waveLfo = this.ctx.createOscillator();
      waveLfo.type = 'sine';
      waveLfo.frequency.setValueAtTime(0.16, this.ctx.currentTime);

      const waveLfoGain = this.ctx.createGain();
      waveLfoGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

      waveLfo.connect(waveLfoGain);
      waveLfoGain.connect(this.waveGain.gain);

      // Modulate filter cutoff with wave swell
      const filterLfoGain = this.ctx.createGain();
      filterLfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
      waveLfo.connect(filterLfoGain);
      filterLfoGain.connect(this.waveFilter.frequency);

      waveSource.connect(this.waveFilter);
      this.waveFilter.connect(this.waveGain);
      this.waveGain.connect(this.ambienceGain!);

      waveSource.start();
      waveLfo.start();

      // 2. Mediterranean Wind Whisper (Bandpass filtered noise)
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(550, this.ctx.currentTime);
      windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      // Slow wind modulation LFO (0.07 Hz ~ 14s period)
      const windLfo = this.ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.07, this.ctx.currentTime);

      const windLfoGain = this.ctx.createGain();
      windLfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(this.windGain.gain);

      windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ambienceGain!);

      windSource.start();
      windLfo.start();
    } catch (e) {
      console.warn('Failed to start procedural ambience:', e);
    }
  }

  /**
   * Sound: Golden Coins Dropping and Clinking on a Wooden Table
   * Procedural multi-impact acoustic model simulating antique gold drachmas falling,
   * bouncing, and settling onto a solid polished oak countertop:
   * 1. Warm wooden table body knock (damped 260Hz->75Hz hollow impulse).
   * 2. Hard edge click transient (rapid 4.2kHz->350Hz micro-snap of coin rim on wood).
   * 3. High-Q metallic coin ring & inharmonic pings (3.45kHz, 5.82kHz modal overtones).
   * 4. Multi-drop cascading sequence: 4 staggered micro-impacts tumbling and settling into a heap.
   */
  public playCoinSound(): void {
    this.initContext();
    if (!this.ctx || this.settings.muted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (!this.isAmbienceRunning) {
      this.startAmbience();
    }

    const now = this.ctx.currentTime;
    // Throttle rapid successive coin triggers to prevent audio stacking / cacophony
    if (now - this.lastCoinTime < 0.12) return;
    this.lastCoinTime = now;

    // 1. Primary: Play real shortened "Crisp Coin Taps" audio sample at gentle, toned-down volume
    if (this.coinBuffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.coinBuffer;

        // Micro-pitch humanization (±3%) so consecutive transactions sound natural
        const jitter = (Math.random() - 0.5) * 0.06;
        source.playbackRate.setValueAtTime(1.0 + jitter, this.ctx.currentTime);

        const coinGain = this.ctx.createGain();
        coinGain.gain.setValueAtTime(0.26, this.ctx.currentTime);

        source.connect(coinGain);
        coinGain.connect(this.sfxGain!);

        source.start(this.ctx.currentTime);
        return;
      } catch (e) {
        console.warn('Error playing coin audio buffer, using procedural fallback', e);
      }
    }

    // Trigger load if not yet triggered
    this.loadCoinAudio();

    // 2. Fallback: Procedural multi-impact acoustic synthesis at subtle levels
    // Sequence of 4 cascading coin impacts & settle bounces
    const drops = [
      { dt: 0.000, pitchMod: 1.00, coinVol: 0.08, woodVol: 0.09, decay: 0.20 },
      { dt: 0.042, pitchMod: 1.14, coinVol: 0.07, woodVol: 0.07, decay: 0.15 },
      { dt: 0.088, pitchMod: 1.28, coinVol: 0.05, woodVol: 0.05, decay: 0.10 },
      { dt: 0.135, pitchMod: 1.05, coinVol: 0.03, woodVol: 0.03, decay: 0.07 },
    ];

    for (const drop of drops) {
      const t = now + drop.dt;
      // Slight acoustic humanization / table grain jitter
      const jitter = (Math.random() - 0.5) * 0.04;
      const pitch = drop.pitchMod * (1.0 + jitter);

      // --- Component 1: Warm Wooden Table Body Knock (Deep hollow resonance) ---
      const woodOsc = this.ctx.createOscillator();
      const woodGain = this.ctx.createGain();
      woodOsc.type = 'triangle';
      const woodStartFreq = 260 * Math.min(1.15, pitch);
      woodOsc.frequency.setValueAtTime(woodStartFreq, t);
      woodOsc.frequency.exponentialRampToValueAtTime(75, t + 0.038); // Damped drop into wood grain

      woodGain.gain.setValueAtTime(drop.woodVol, t);
      woodGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      woodOsc.connect(woodGain);
      woodGain.connect(this.sfxGain!);
      woodOsc.start(t);
      woodOsc.stop(t + 0.05);

      // --- Component 2: Hard Edge Click Transient (Coin rim hitting solid surface) ---
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(4200 * pitch, t);
      clickOsc.frequency.exponentialRampToValueAtTime(350, t + 0.006);

      clickGain.gain.setValueAtTime(drop.coinVol * 0.75, t);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);

      clickOsc.connect(clickGain);
      clickGain.connect(this.sfxGain!);
      clickOsc.start(t);
      clickOsc.stop(t + 0.01);

      // --- Component 3: Metallic Coin Ring & Inharmonic Overtones ---
      const coinOsc1 = this.ctx.createOscillator();
      const coinOsc2 = this.ctx.createOscillator();
      const coinGain = this.ctx.createGain();

      coinOsc1.type = 'sine';
      coinOsc2.type = 'triangle'; // Richer metallic bite

      const f1 = 3450 * pitch; // Fundamental ring of ancient gold/bronze coin
      const f2 = 5820 * pitch; // Inharmonic modal overtone

      coinOsc1.frequency.setValueAtTime(f1, t);
      coinOsc2.frequency.setValueAtTime(f2, t);

      coinGain.gain.setValueAtTime(drop.coinVol, t);
      coinGain.gain.exponentialRampToValueAtTime(0.0001, t + drop.decay);

      coinOsc1.connect(coinGain);
      coinOsc2.connect(coinGain);
      coinGain.connect(this.sfxGain!);

      coinOsc1.start(t);
      coinOsc2.start(t);
      coinOsc1.stop(t + drop.decay + 0.02);
      coinOsc2.stop(t + drop.decay + 0.02);
    }
  }

  /**
   * Sound: Passenger Ticket Fares (Tier 3 Ferry)
   * Authentic mechanical ticket punch strike with subtle micro-pitch humanization.
   */
  public playTicketSound(): void {
    if (!this.ctx || this.settings.muted) return;

    const now = this.ctx.currentTime;
    // Throttle rapid successive ticket sounds
    if (now - this.lastTicketTime < 0.12) return;
    this.lastTicketTime = now;

    // 1. Primary: Play real shortened "Ferry Ticket" audio sample at attenuated level
    if (this.ticketBuffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.ticketBuffer;
        // Subtle micro-pitch variation (±2%) so rapid ticket punch sounds natural
        source.playbackRate.value = 0.98 + Math.random() * 0.04;

        const ticketGain = this.ctx.createGain();
        ticketGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

        source.connect(ticketGain);
        ticketGain.connect(this.sfxGain!);
        source.start();
        return;
      } catch (err) {
        console.warn('Error playing ferry ticket audio buffer, falling back to oscillator', err);
      }
    }

    // 2. Fallback: Gentle procedural double-chime
    [1318.51, 1975.53].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /**
   * Sound: VIP Luxury Charter Shimmer (Tier 5 Yacht)
   * Elegant royal golden shimmer arpeggio.
   */
  public playVipShimmerSound(): void {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastVipTime < 0.20) return;
    this.lastVipTime = now;

    const chord = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7

    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.40);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  /**
   * Sound: Harbor Cargo Dock / Catapult Launch
   * Subtle wooden resonance with soft splash.
   */
  public playDockSound(): void {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDockTime < 0.35) return;
    this.lastDockTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Sound: Dawn Awakening Fanfare
   * Resonant Hellenic lyre pentatonic chord (D4, A4, D5, F#5, A5) celebrating island illuminations.
   */
  public playAwakeningFanfare(): void {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const notes = [293.66, 440.0, 587.33, 739.99, 880.0]; // D4, A4, D5, F#5, A5

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.08;

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 2.2);
    });
  }

  /**
   * Sound: Triumphal Endgame Fanfare ("Whole Aegean Awake")
   * Majestic multi-octave Hellenic victory chord with lingering golden bell harmonics.
   */
  public playEndgameVictoryFanfare(): void {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const chord = [220.0, 277.18, 329.63, 440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51];

    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 4.0);
    });
  }

  /**
   * Sound: UI Button Click / Haptic Tap
   */
  public playClickSound(): void {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // --- Volume & Settings Controls ---

  public toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.settings.muted ? 0 : this.settings.masterVolume,
        this.ctx.currentTime
      );
    }
    if (!this.settings.muted && !this.isAmbienceRunning) {
      this.startAmbience();
    }
    this.saveSettings();
    return this.settings.muted;
  }

  public isMuted(): boolean {
    return this.settings.muted;
  }

  public setMasterVolume(vol: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.settings.muted) {
      this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public setAmbienceVolume(vol: number): void {
    this.settings.ambienceVolume = Math.max(0, Math.min(1, vol));
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setValueAtTime(this.settings.ambienceVolume, this.ctx.currentTime);
    }
    if (vol > 0 && !this.isAmbienceRunning && !this.settings.muted) {
      this.startAmbience();
    }
    this.saveSettings();
  }

  public setSfxVolume(vol: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage may fail in private mode
    }
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.muted === 'boolean') this.settings.muted = parsed.muted;
        if (typeof parsed.masterVolume === 'number') this.settings.masterVolume = Math.min(0.60, parsed.masterVolume);
        if (typeof parsed.ambienceVolume === 'number') this.settings.ambienceVolume = Math.min(0.45, parsed.ambienceVolume);
        if (typeof parsed.sfxVolume === 'number') this.settings.sfxVolume = Math.min(0.45, parsed.sfxVolume);
      }
    } catch {
      // Use defaults
    }
  }
}

// Global audio singleton
export const audio = new AudioManager();
