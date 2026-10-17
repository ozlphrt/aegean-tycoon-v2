import * as THREE from 'three';

export interface WakeParams {
  lifetime: number;       // In seconds (e.g. 6.0s)
  spread: number;         // Multiplier for lateral expansion at tail (e.g. 3.2x)
  washWidth: number;      // Multiplier on vessel beam (e.g. 1.25x)
  foamOpacity: number;    // Maximum foam opacity (e.g. 0.75)
  speedResponse: number;  // Multiplier on speed effect (e.g. 1.2)
}

export const DEFAULT_WAKE_PARAMS: WakeParams = {
  lifetime: 1.4,
  spread: 3.6,
  washWidth: 1.15,
  foamOpacity: 0.38,
  speedResponse: 1.0,
};

export interface WakePoint {
  x: number;
  y: number;
  z: number;
  time: number;
  speed: number;
  beam: number;
  heading: number;
}

interface ShipWakeTrail {
  shipId: string;
  points: WakePoint[];
  lastEmitPos: THREE.Vector3;
  lastEmitTime: number;
  wasSailing: boolean;
}

const MAX_BOATS = 250;
const MAX_POINTS_PER_BOAT = 40;
// Each segment (pair of adjacent points) produces 2 triangles = 6 vertices
const MAX_SEGMENTS = MAX_BOATS * (MAX_POINTS_PER_BOAT - 1);
const MAX_VERTICES = MAX_SEGMENTS * 6;

/**
 * Procedural Boat Wake Material & Dynamic Ribbon Renderer.
 * Generates continuous world-space boat wakes adhering to:
 * - Two complementary layers: turbulent center propeller wash + diverging Kelvin wave shoulders.
 * - Distance-sampled emission with sub-step interpolation for continuous trails regardless of frame-rate.
 * - Smooth Frenet spine curvature tracking in world-space during turns.
 * - Seamless fade-to-zero opacity at boundaries (never cut off abruptly).
 * - Instant streak suppression on teleport/route resets.
 */
export class BoatWakeRenderer {
  private trails: Map<string, ShipWakeTrail> = new Map();
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private params: WakeParams = { ...DEFAULT_WAKE_PARAMS };

  // Pre-allocated typed arrays to prevent per-frame GC allocations
  private positions: Float32Array;
  private uvs: Float32Array;
  private ages: Float32Array;
  private lives: Float32Array;
  private speeds: Float32Array;

  private posAttr: THREE.BufferAttribute;
  private uvAttr: THREE.BufferAttribute;
  private ageAttr: THREE.BufferAttribute;
  private lifeAttr: THREE.BufferAttribute;
  private speedAttr: THREE.BufferAttribute;

  // Scratch arrays for smooth spine tangent calculation (zero per-frame GC)
  private spineTanX: Float32Array = new Float32Array(MAX_POINTS_PER_BOAT);
  private spineTanZ: Float32Array = new Float32Array(MAX_POINTS_PER_BOAT);
  private smoothTanX: Float32Array = new Float32Array(MAX_POINTS_PER_BOAT);
  private smoothTanZ: Float32Array = new Float32Array(MAX_POINTS_PER_BOAT);

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_VERTICES * 3);
    this.uvs = new Float32Array(MAX_VERTICES * 2);
    this.ages = new Float32Array(MAX_VERTICES);
    this.lives = new Float32Array(MAX_VERTICES);
    this.speeds = new Float32Array(MAX_VERTICES);

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.uvAttr = new THREE.BufferAttribute(this.uvs, 2);
    this.ageAttr = new THREE.BufferAttribute(this.ages, 1);
    this.lifeAttr = new THREE.BufferAttribute(this.lives, 1);
    this.speedAttr = new THREE.BufferAttribute(this.speeds, 1);

    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.uvAttr.setUsage(THREE.DynamicDrawUsage);
    this.ageAttr.setUsage(THREE.DynamicDrawUsage);
    this.lifeAttr.setUsage(THREE.DynamicDrawUsage);
    this.speedAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('uv', this.uvAttr);
    this.geometry.setAttribute('aAge', this.ageAttr);
    this.geometry.setAttribute('aLife', this.lifeAttr);
    this.geometry.setAttribute('aSpeed', this.speedAttr);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uFoamOpacity: { value: this.params.foamOpacity },
        uSpeedResponse: { value: this.params.speedResponse },
      },
      vertexShader: `
        attribute float aAge;
        attribute float aLife;
        attribute float aSpeed;

        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vLife;
        varying float vSpeed;

        void main() {
          vUv = uv;
          vLife = aLife;
          vSpeed = aSpeed;
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform float uFoamOpacity;
        uniform float uSpeedResponse;

        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vLife;
        varying float vSpeed;

        // Lightweight procedural noise for organic water turbulence
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Normalized cross-section distance (0.0 at center spine, 1.0 at outer ribbon edge)
          float distCenter = abs(vUv.x - 0.5) * 2.0;
          // Normalized trail life (0.0 at boat stern, 1.0 at oldest tail)
          float t = clamp(vLife, 0.0, 1.0);

          // Vessel speed response
          float speedFactor = clamp(vSpeed * uSpeedResponse * 2.0, 0.0, 1.2);
          if (speedFactor < 0.01) discard;

          // -------------------------------------------------------------
          // SOFT MULTI-SCALE AMBIENT WATER TURBULENCE
          // Gentle, low-frequency billowy swirls with zero harsh pixel grains
          // -------------------------------------------------------------
          vec2 uvTurb = vec2(vWorldPos.x * 10.0, vWorldPos.z * 7.5);
          float n1 = noise(uvTurb + vec2(uTime * 0.12, -uTime * 0.08));
          float n2 = noise(uvTurb * 2.0 - vec2(uTime * 0.20, uTime * 0.14));
          float frothNoise = n1 * 0.65 + n2 * 0.35;
          // Smooth, soft billowy wash variation (no sharp threshold cutoff)
          float washTurbulence = smoothstep(0.10, 0.90, frothNoise) * 0.40 + 0.60;

          // -------------------------------------------------------------
          // LAYER 1: Propeller Wash (Broad Gaussian Diffusion Blur)
          // Starts soft at stern, diffuses wider and mistier as it ages
          // -------------------------------------------------------------
          float washSpread = 1.0 + t * 2.0;
          // Core Gaussian blur: wide smooth bell curve
          float washCenter = exp(-distCenter * distCenter * (3.5 / washSpread));
          // Broad outer ambient mist haze
          float washHaze = exp(-distCenter * distCenter * 1.3) * 0.50;
          float washProfile = washCenter + washHaze;
          
          // Smooth progressive dissipation
          float progressiveFade = pow(max(0.0, 1.0 - t), 2.0);
          float washAlpha = washProfile * washTurbulence * progressiveFade * 0.62;

          // -------------------------------------------------------------
          // LAYER 2: Kelvin Diverging Shoulders (Soft Misty Arms)
          // Wide, blurry Gaussian ridges with feathered crests
          // -------------------------------------------------------------
          float shoulderProfile = exp(-pow((distCenter - 0.45) * 2.2, 2.0)) * 0.42;
          float shoulderFade = progressiveFade * smoothstep(0.01, 0.10, t);
          float shoulderAlpha = shoulderProfile * washTurbulence * shoulderFade * 0.30;

          // -------------------------------------------------------------
          // BOUNDARY FEATHERING: Ultra-Soft Gaussian/Quadratic Falloff
          // -------------------------------------------------------------
          // 1. Silky lateral edge falloff: zero harsh silhouettes
          float edgeFeather = smoothstep(1.0, 0.02, distCenter);
          edgeFeather = edgeFeather * edgeFeather;

          // 2. Bow/stern lead-in: smoothly connects at vessel stern
          float bowFeather = smoothstep(0.0, 0.02, t);

          // 3. Tail dissipation: mist slowly vanishes into the sea
          float tailFeather = smoothstep(1.0, 0.45, t);

          float totalFeather = edgeFeather * bowFeather * tailFeather;
          float combinedAlpha = (washAlpha + shoulderAlpha) * speedFactor * totalFeather;

          // -------------------------------------------------------------
          // COLOR PALETTE & TRANSLUCENCY: Misty Seafoam over Azure
          // -------------------------------------------------------------
          vec3 colWash = vec3(0.92, 0.97, 1.0);       // Soft cloudy white-cyan seafoam
          vec3 colShoulder = vec3(0.36, 0.70, 0.85);   // Translucent Aegean cyan/turquoise swell
          
          float washRatio = washAlpha / max(0.001, washAlpha + shoulderAlpha);
          vec3 finalColor = mix(colShoulder, colWash, clamp(washRatio * 1.15, 0.0, 1.0));

          // Ethereal translucent mist: sea water glimmers through softly
          float finalAlpha = clamp(combinedAlpha * uFoamOpacity, 0.0, 0.38);
          if (finalAlpha < 0.002) discard;

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  public setParams(params: Partial<WakeParams>): void {
    Object.assign(this.params, params);
    if (this.material.uniforms.uFoamOpacity) {
      this.material.uniforms.uFoamOpacity.value = this.params.foamOpacity;
    }
    if (this.material.uniforms.uSpeedResponse) {
      this.material.uniforms.uSpeedResponse.value = this.params.speedResponse;
    }
  }

  public getParams(): WakeParams {
    return { ...this.params };
  }

  /**
   * Clears trail for a specific vessel (e.g. upon teleport or route reset)
   */
  public resetVessel(shipId: string): void {
    const trail = this.trails.get(shipId);
    if (trail) {
      trail.points.length = 0;
    }
  }

  /**
   * Updates wake simulation for a boat at current frame
   */
  public recordVessel(
    shipId: string,
    sternX: number,
    seaLevelY: number,
    sternZ: number,
    heading: number, // yaw angle in radians
    speed: number,   // units / sec
    beam: number,    // scaled beam
    isSailing: boolean,
    currentTime: number
  ): void {
    let trail = this.trails.get(shipId);
    // World space elevation just above water to prevent Z-fighting
    const emitY = seaLevelY + 0.008;
    const currentPos = new THREE.Vector3(sternX, emitY, sternZ);

    if (!trail) {
      trail = {
        shipId,
        points: [],
        lastEmitPos: currentPos.clone(),
        lastEmitTime: currentTime,
        wasSailing: isSailing,
      };
      this.trails.set(shipId, trail);
      return;
    }

    const distMoved = currentPos.distanceTo(trail.lastEmitPos);

    // TELEPORT OR ROUTE WRAP DETECTION:
    // If boat jumped more than 2.0 units in a single frame, clear history to prevent long streaks
    if (distMoved > 2.0) {
      trail.points.length = 0;
      trail.lastEmitPos.copy(currentPos);
      trail.lastEmitTime = currentTime;
      trail.wasSailing = isSailing;
      return;
    }

    // Do NOT emit new wake points for stationary or docked boats
    const isMoving = isSailing && speed > 0.02;

    if (isMoving) {
      // Distance-based sampling: continuous trail regardless of framerate
      const minSampleDist = Math.max(0.04, 0.08 * beam);

      if (distMoved >= minSampleDist) {
        const numSubSteps = Math.min(6, Math.max(1, Math.floor(distMoved / minSampleDist)));

        for (let s = 1; s <= numSubSteps; s++) {
          const frac = s / numSubSteps;
          const px = THREE.MathUtils.lerp(trail.lastEmitPos.x, currentPos.x, frac);
          const py = emitY;
          const pz = THREE.MathUtils.lerp(trail.lastEmitPos.z, currentPos.z, frac);
          const pTime = THREE.MathUtils.lerp(trail.lastEmitTime, currentTime, frac);

          trail.points.push({
            x: px,
            y: py,
            z: pz,
            time: pTime,
            speed,
            beam,
            heading,
          });

          // Keep trail bounded
          if (trail.points.length > MAX_POINTS_PER_BOAT) {
            trail.points.shift();
          }
        }

        trail.lastEmitPos.copy(currentPos);
        trail.lastEmitTime = currentTime;
      }
    } else {
      // Stationary boat: update last emit pos without generating new points
      trail.lastEmitPos.copy(currentPos);
      trail.lastEmitTime = currentTime;
    }

    trail.wasSailing = isSailing;
  }

  /**
   * Rebuilds dynamic vertex buffer from all active vessel trails and ages existing points
   */
  public update(currentTime: number): void {
    this.material.uniforms.uTime.value = currentTime;

    let vIdx = 0;
    const lifetime = this.params.lifetime;
    const spread = this.params.spread;
    const washWidth = this.params.washWidth;

    // Iterate through all ship trails
    for (const trail of this.trails.values()) {
      const pts = trail.points;
      if (pts.length < 2) continue;

      // Prune expired points from head of trail (oldest points)
      while (pts.length > 0 && currentTime - pts[0].time > lifetime) {
        pts.shift();
      }

      const N = pts.length;
      if (N < 2) continue;

      // 1. Compute continuous Frenet tangents along the curved spine
      for (let i = 0; i < N; i++) {
        let dx = 0;
        let dz = 0;
        if (i === 0) {
          dx = pts[1].x - pts[0].x;
          dz = pts[1].z - pts[0].z;
        } else if (i === N - 1) {
          dx = pts[N - 1].x - pts[N - 2].x;
          dz = pts[N - 1].z - pts[N - 2].z;
        } else {
          dx = pts[i + 1].x - pts[i - 1].x;
          dz = pts[i + 1].z - pts[i - 1].z;
        }

        const len = Math.hypot(dx, dz);
        if (len > 0.0001) {
          this.spineTanX[i] = dx / len;
          this.spineTanZ[i] = dz / len;
        } else {
          this.spineTanX[i] = -Math.sin(pts[i].heading);
          this.spineTanZ[i] = -Math.cos(pts[i].heading);
        }
      }

      // 2. Smooth tangents with a 3-tap Gaussian filter along the spine to eliminate sharp angular kinks
      for (let i = 0; i < N; i++) {
        const prev = Math.max(0, i - 1);
        const next = Math.min(N - 1, i + 1);
        const tx = this.spineTanX[prev] * 0.25 + this.spineTanX[i] * 0.5 + this.spineTanX[next] * 0.25;
        const tz = this.spineTanZ[prev] * 0.25 + this.spineTanZ[i] * 0.5 + this.spineTanZ[next] * 0.25;
        const tLen = Math.hypot(tx, tz);
        if (tLen > 0.0001) {
          this.smoothTanX[i] = tx / tLen;
          this.smoothTanZ[i] = tz / tLen;
        } else {
          this.smoothTanX[i] = this.spineTanX[i];
          this.smoothTanZ[i] = this.spineTanZ[i];
        }
      }

      // 3. Build continuous ribbon quads between consecutive points
      for (let i = 0; i < N - 1; i++) {
        if (vIdx + 6 > MAX_VERTICES) break;

        const pA = pts[i];
        const pB = pts[i + 1];

        const ageA = Math.max(0, currentTime - pA.time);
        const ageB = Math.max(0, currentTime - pB.time);

        const lifeA = Math.min(1.0, ageA / lifetime);
        const lifeB = Math.min(1.0, ageB / lifetime);

        // Starts at boat width (1.0x beam), widens smoothly into V-wake envelope
        const getWidth = (beam: number, life: number) => {
          const fastFlare = 1.0 - Math.exp(-life * 6.5);
          const wf = 1.0 + fastFlare * (spread - 1.0);
          return beam * washWidth * Math.max(1.0, wf);
        };

        const halfWA = getWidth(pA.beam, lifeA) * 0.5;
        const halfWB = getWidth(pB.beam, lifeB) * 0.5;

        // Normals perpendicular to smoothed spine tangents
        const normAx = -this.smoothTanZ[i];
        const normAz = this.smoothTanX[i];
        const normBx = -this.smoothTanZ[i + 1];
        const normBz = this.smoothTanX[i + 1];

        // Segment chord vector from A to B
        const segDx = pB.x - pA.x;
        const segDz = pB.z - pA.z;
        const segLen = Math.hypot(segDx, segDz);

        // Turn curvature safety clamping:
        // Prevent inner ribbon edge from crossing over itself (self-intersection) during tight turns
        let halfWA_L = halfWA;
        let halfWA_R = halfWA;
        let halfWB_L = halfWB;
        let halfWB_R = halfWB;

        if (segLen > 0.0001) {
          const dirX = segDx / segLen;
          const dirZ = segDz / segLen;

          const projNormDiffL = (normAx - normBx) * dirX + (normAz - normBz) * dirZ;
          const projNormDiffR = (normBx - normAx) * dirX + (normBz - normAz) * dirZ;

          // If turning left (projNormDiffL < 0), clamp the inner left edge to avoid inverted folding
          if (projNormDiffL < -0.05) {
            const maxSafeHalfW = Math.max(pA.beam * 0.4, (segLen * 0.85) / Math.abs(projNormDiffL));
            if (halfWA_L > maxSafeHalfW) halfWA_L = maxSafeHalfW;
            if (halfWB_L > maxSafeHalfW) halfWB_L = maxSafeHalfW;
          }
          // If turning right (projNormDiffR < 0), clamp the inner right edge to avoid inverted folding
          if (projNormDiffR < -0.05) {
            const maxSafeHalfW = Math.max(pA.beam * 0.4, (segLen * 0.85) / Math.abs(projNormDiffR));
            if (halfWA_R > maxSafeHalfW) halfWA_R = maxSafeHalfW;
            if (halfWB_R > maxSafeHalfW) halfWB_R = maxSafeHalfW;
          }
        }

        // Segment A vertices (Left and Right)
        const pA_Lx = pA.x - normAx * halfWA_L;
        const pA_Lz = pA.z - normAz * halfWA_L;
        const pA_Rx = pA.x + normAx * halfWA_R;
        const pA_Rz = pA.z + normAz * halfWA_R;

        // Segment B vertices (Left and Right)
        const pB_Lx = pB.x - normBx * halfWB_L;
        const pB_Lz = pB.z - normBz * halfWB_L;
        const pB_Rx = pB.x + normBx * halfWB_R;
        const pB_Rz = pB.z + normBz * halfWB_R;

        // Triangle 1: pA_L, pA_R, pB_L
        this.writeVertex(vIdx++, pA_Lx, pA.y, pA_Lz, 0.0, lifeA, ageA, lifeA, pA.speed);
        this.writeVertex(vIdx++, pA_Rx, pA.y, pA_Rz, 1.0, lifeA, ageA, lifeA, pA.speed);
        this.writeVertex(vIdx++, pB_Lx, pB.y, pB_Lz, 0.0, lifeB, ageB, lifeB, pB.speed);

        // Triangle 2: pA_R, pB_R, pB_L
        this.writeVertex(vIdx++, pA_Rx, pA.y, pA_Rz, 1.0, lifeA, ageA, lifeA, pA.speed);
        this.writeVertex(vIdx++, pB_Rx, pB.y, pB_Rz, 1.0, lifeB, ageB, lifeB, pB.speed);
        this.writeVertex(vIdx++, pB_Lx, pB.y, pB_Lz, 0.0, lifeB, ageB, lifeB, pB.speed);
      }
    }

    this.geometry.setDrawRange(0, vIdx);
    if (vIdx > 0) {
      this.posAttr.needsUpdate = true;
      this.uvAttr.needsUpdate = true;
      this.ageAttr.needsUpdate = true;
      this.lifeAttr.needsUpdate = true;
      this.speedAttr.needsUpdate = true;
    }
  }

  private writeVertex(
    idx: number,
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
    age: number,
    life: number,
    speed: number
  ): void {
    const i3 = idx * 3;
    const i2 = idx * 2;

    this.positions[i3 + 0] = x;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = z;

    this.uvs[i2 + 0] = u;
    this.uvs[i2 + 1] = v;

    this.ages[idx] = age;
    this.lives[idx] = life;
    this.speeds[idx] = speed;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}

