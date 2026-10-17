/**
 * Aegean Weather & Seasonal Meltemi Wind Simulation.
 *
 * Implements authentic Mediterranean wind dynamics:
 * - Summer Meltemi (Μελτέμι / Etesian): Strong dry northerly winds (N / NNE)
 *   dominating June through August, peaking at 20-35 knots.
 * - Spring Zephyrs & Autumn Sirocco: Gentle variable breezes (8-16 knots).
 * - Heading-based aerodynamic velocity modifiers:
 *   - Tailwind (running with the wind): +15% to +28% speed boost.
 *   - Headwind (beating against the wind): -15% to -28% speed penalty.
 *   - Crosswind (beam reach): +5% sailing efficiency.
 * - Ship class impact: Traditional rigged Kaikis and Caiques are more sensitive
 *   to wind than modern high-powered Freighters and luxury Motor Yachts.
 */

export type Season = 'spring' | 'meltemi' | 'autumn' | 'winter';

export interface WindState {
  /** Direction the wind is blowing TOWARDS, in radians (0 = East, PI/2 = North, PI = West, 3PI/2 = South) */
  directionRad: number;
  /** Direction the wind originates FROM in degrees (e.g. 0° = North, 45° = NE, 90° = East) */
  headingFromDeg: number;
  /** Wind velocity in nautical knots */
  speedKnots: number;
  /** Current prevailing Mediterranean wind system */
  name: string;
  /** Cardinal compass string: N, NNE, NE, ENE, etc. */
  cardinal: string;
  /** Seasonal classification */
  season: Season;
}

export class WeatherSystem {
  private currentWind: WindState = {
    directionRad: (3 * Math.PI) / 2, // Blowing Southward (from the North)
    headingFromDeg: 0, // From North (0°)
    speedKnots: 18,
    name: 'Meltemi Season',
    cardinal: 'N',
    season: 'meltemi',
  };

  constructor() {
    this.updateForGameDay(0);
  }

  /**
   * Updates wind speed, direction, and seasonality based on elapsed game days.
   * Game begins on May 1 (day 0).
   * - Days 0 - 30: Spring (May) - Mild variable NNE breezes (10-18 kt)
   * - Days 30 - 120: Summer (June - August) - Peak Meltemi (18-36 kt from N / NNE)
   * - Days 120 - 180: Autumn (Sept - Oct) - Variable West/South Sirocco (8-15 kt)
   * - Days 180 - 240: Winter (Nov - Dec) - Stormy gusts (15-30 kt)
   */
  public updateForGameDay(gameDay: number): WindState {
    const yearDay = (gameDay % 360);

    let season: Season;
    let baseFromDeg: number;
    let baseSpeed: number;
    let name: string;

    if (yearDay < 30) {
      // Spring: Mild Aegean Zephyr
      season = 'spring';
      baseFromDeg = 15; // NNE
      baseSpeed = 12;
      name = 'Aegean Zephyr';
    } else if (yearDay < 120) {
      // Summer: Peak Meltemi winds
      season = 'meltemi';
      baseFromDeg = 5; // Direct North / slight NNE
      baseSpeed = 24;
      name = 'Summer Meltemi';
    } else if (yearDay < 210) {
      // Autumn: Mild Sirocco / Southern breezes
      season = 'autumn';
      baseFromDeg = 190; // South-Southwest
      baseSpeed = 11;
      name = 'Autumn Sirocco';
    } else {
      // Winter: Variable northerly / westerly gusts
      season = 'winter';
      baseFromDeg = 330; // NNW
      baseSpeed = 20;
      name = 'Winter Boreas';
    }

    // Natural smooth oscillations (weather fronts lasting ~2-4 days)
    const frontOscillation = Math.sin((gameDay * Math.PI * 2) / 3.5);
    const diurnalGust = Math.sin((gameDay * Math.PI * 2) * 1.0) * 0.25; // Afternoon thermal gusts

    // Heading variation: +/- 20 degrees
    const headingFromDeg = Math.round((baseFromDeg + frontOscillation * 18 + 360) % 360);

    // Speed: baseSpeed + front variance + diurnal afternoon breeze
    const speedKnots = Math.max(6, Math.round(baseSpeed + frontOscillation * 6 + diurnalGust * 4));

    // Direction the wind blows TOWARDS in radians (Three.js standard: 0 = +X / East, PI/2 = +Z / South in world coords)
    // Convert meteorological "from" bearing (0 = North) to vector direction "towards":
    // Bearing from North: 0° -> blowing South (towards 180° = PI rad)
    const towardsDeg = (headingFromDeg + 180) % 360;
    // In math radians (0 = East, 90 = North, 180 = West, 270 = South):
    const mathDeg = (90 - towardsDeg + 360) % 360;
    const directionRad = (mathDeg * Math.PI) / 180;

    const cardinal = this.degreesToCardinal(headingFromDeg);

    this.currentWind = {
      directionRad,
      headingFromDeg,
      speedKnots,
      name,
      cardinal,
      season,
    };

    return this.currentWind;
  }

  /**
   * Calculates ship speed multiplier based on the vessel's heading and wind vector.
   *
   * @param shipHeadingRad Angle ship is moving towards (radians)
   * @param shipTier 1 = Kaiki, 2 = Caique, 3 = Ferry, 4 = Freighter, 5 = Yacht
   * @returns Speed multiplier (e.g. 1.22 for strong tailwind, 0.82 for headwind)
   */
  public calculateSpeedModifier(shipHeadingRad: number, shipTier = 1): number {
    // Relative angle between ship heading and wind blow direction:
    // delta = 0 rad means ship is sailing exactly in the same direction the wind is blowing (TAILWIND)
    // delta = PI rad means ship is sailing directly into the wind (HEADWIND)
    let deltaAngle = Math.abs(shipHeadingRad - this.currentWind.directionRad);
    while (deltaAngle > Math.PI) deltaAngle = Math.abs(deltaAngle - 2 * Math.PI);

    // Alignment: +1.0 = Pure Tailwind, 0 = Pure Beam Reach (Crosswind), -1.0 = Pure Headwind
    const alignment = Math.cos(deltaAngle);

    // Wind strength intensity relative to standard 20kt breeze (clamped between 0.3 and 1.5)
    const windIntensity = Math.min(1.5, Math.max(0.3, this.currentWind.speedKnots / 20));

    // Vessel wind sensitivity by tier:
    // Traditional wooden sail/rigged vessels (Tier 1 & 2) feel the wind most heavily (+/- 25%)
    // Steel motorized ferries and container freighters (Tier 3 & 4) feel moderate resistance (+/- 12%)
    // High-performance twin-engine luxury yachts (Tier 5) cut through wind with low variance (+/- 8%)
    let tierSensitivity = 0.22;
    switch (shipTier) {
      case 1: tierSensitivity = 0.25; break; // Kaiki
      case 2: tierSensitivity = 0.20; break; // Caique
      case 3: tierSensitivity = 0.13; break; // Passenger Ferry
      case 4: tierSensitivity = 0.10; break; // Heavy Freighter
      case 5: tierSensitivity = 0.08; break; // Motor Yacht
    }

    // Crosswind beam-reach bonus: Traditional Aegean boats sail very fast with a beam reach
    const crosswindBonus = Math.abs(Math.sin(deltaAngle)) * 0.04 * (shipTier <= 2 ? 1.5 : 0.5);

    // Total multiplier
    const modifier = 1.0 + (alignment * tierSensitivity * windIntensity) + crosswindBonus;

    // Clamp speed modifier to reasonable physics boundaries [0.70, 1.35]
    return Math.max(0.70, Math.min(1.35, modifier));
  }

  public getWind(): WindState {
    return this.currentWind;
  }

  private degreesToCardinal(deg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(deg / 22.5) % 16;
    return directions[idx];
  }
}
