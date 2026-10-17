import * as THREE from 'three';

export interface CatapultPayload {
  startLonLat: { lon: number; lat: number };
  endLonLat: { lon: number; lat: number };
  goodIcon: string;
  goodColor: string;
  count?: number;
  label?: string; // e.g. "+25 🍷" or "+🪙 450"
  onComplete?: () => void;
}

interface Projectile {
  sprite: THREE.Sprite;
  trailPoints: THREE.Vector3[];
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  arcHeight: number;
  startTime: number;
  durationMs: number;
  delayMs: number;
  label?: string;
  onLand?: () => void;
}

interface ImpactRing {
  mesh: THREE.Mesh;
  startTime: number;
  durationMs: number;
  maxRadius: number;
}

interface FloatingLabel {
  element: HTMLElement;
  worldPos: THREE.Vector3;
  startTime: number;
  durationMs: number;
}

export class GoodsCatapult {
  public group = new THREE.Group();
  private projectiles: Projectile[] = [];
  private impactRings: ImpactRing[] = [];
  private floatingLabels: FloatingLabel[] = [];

  private textureCache: Map<string, THREE.Texture> = new Map();
  private ringGeometry = new THREE.RingGeometry(0.02, 0.08, 24);
  private ringMaterial: THREE.MeshBasicMaterial;

  private overlayContainer: HTMLElement;
  private tempVec = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.group);

    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    let div = document.getElementById('catapult-labels-container');
    if (!div) {
      div = document.createElement('div');
      div.id = 'catapult-labels-container';
      div.className = 'catapult-labels-layer';
      document.body.appendChild(div);
    }
    this.overlayContainer = div;
  }

  /**
   * Generates a circular glowing canvas icon texture for any good (e.g. 🍷, 💧, 🫒, 🌾, 🪙).
   */
  private getIconTexture(icon: string, color: string): THREE.Texture {
    const key = `${icon}_${color}`;
    let tex = this.textureCache.get(key);
    if (tex) return tex;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Outer glow
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.48);
    grad.addColorStop(0, color);
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Inner glossy circle badge
    ctx.fillStyle = 'rgba(10, 18, 32, 0.88)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Centered emoji icon
    ctx.font = '54px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, size / 2, size / 2 + 4);

    tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    this.textureCache.set(key, tex);
    return tex;
  }

  /**
   * Catapults goods in a high parabolic trajectory between two points.
   * startWorld -> endWorld
   */
  public launch(
    startWorld: THREE.Vector3,
    endWorld: THREE.Vector3,
    payload: {
      goodIcon: string;
      goodColor: string;
      count?: number;
      label?: string;
      isDelivery?: boolean;
    }
  ): void {
    const numProjectiles = Math.min(4, Math.max(2, payload.count ? Math.ceil(payload.count / 10) : 3));
    const tex = this.getIconTexture(payload.goodIcon, payload.goodColor);

    const dist = startWorld.distanceTo(endWorld);
    // Arc height scales with distance (0.6 min to 1.6 max)
    const arcHeight = Math.max(0.65, Math.min(1.8, dist * 0.28));
    const durationMs = Math.max(800, Math.min(1500, dist * 160 + 600));

    for (let i = 0; i < numProjectiles; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        depthTest: true,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.32, 0.32, 0.32);
      sprite.position.copy(startWorld);
      sprite.position.y += 0.15;
      sprite.visible = false;
      this.group.add(sprite);

      const isLast = i === numProjectiles - 1;
      const delayMs = i * 140; // Staggered launch

      this.projectiles.push({
        sprite,
        trailPoints: [],
        startPos: startWorld.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          0.15,
          (Math.random() - 0.5) * 0.15
        )),
        endPos: endWorld.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          0.05,
          (Math.random() - 0.5) * 0.15
        )),
        arcHeight: arcHeight + (Math.random() - 0.5) * 0.15,
        startTime: performance.now(),
        durationMs,
        delayMs,
        label: isLast ? payload.label : undefined,
        onLand: () => {
          this.spawnImpactRing(endWorld, payload.goodColor);
          if (isLast && payload.label) {
            this.spawnFloatingLabel(endWorld, payload.label, payload.goodColor);
          }
        },
      });
    }
  }

  private spawnImpactRing(pos: THREE.Vector3, _color: string): void {
    const ringMesh = new THREE.Mesh(this.ringGeometry, this.ringMaterial.clone());
    ringMesh.rotation.x = -Math.PI / 2; // Flat on water surface
    ringMesh.position.copy(pos);
    ringMesh.position.y += 0.04;
    this.group.add(ringMesh);

    this.impactRings.push({
      mesh: ringMesh,
      startTime: performance.now(),
      durationMs: 450,
      maxRadius: 0.45,
    });
  }

  private spawnFloatingLabel(worldPos: THREE.Vector3, text: string, color: string): void {
    const el = document.createElement('div');
    el.className = 'catapult-floating-label';
    el.innerHTML = `<span class="catapult-label-pill" style="border-color:${color}88; box-shadow:0 0 12px ${color}44;">${text}</span>`;
    this.overlayContainer.appendChild(el);

    this.floatingLabels.push({
      element: el,
      worldPos: worldPos.clone(),
      startTime: performance.now(),
      durationMs: 1800,
    });
  }

  /**
   * Updates flight physics and animations.
   */
  public update(camera: THREE.Camera): void {
    const now = performance.now();

    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const elapsed = now - (p.startTime + p.delayMs);

      if (elapsed < 0) {
        p.sprite.visible = false;
        continue;
      }

      p.sprite.visible = true;
      const t = Math.min(1.0, elapsed / p.durationMs);

      // Parabolic flight trajectory: P(t) = (1-t)A + tB + (0, 4*H*t(1-t), 0)
      const currentX = (1 - t) * p.startPos.x + t * p.endPos.x;
      const currentZ = (1 - t) * p.startPos.z + t * p.endPos.z;
      const linearY = (1 - t) * p.startPos.y + t * p.endPos.y;
      const arcY = 4.0 * p.arcHeight * t * (1.0 - t);
      const currentY = linearY + arcY;

      p.sprite.position.set(currentX, currentY, currentZ);

      // Dynamic scale: pops up at launch, normal in air, squashes slightly at impact
      const scaleBase = 0.34;
      let scale = scaleBase;
      if (t < 0.15) {
        scale = scaleBase * (0.6 + (t / 0.15) * 0.4);
      } else if (t > 0.85) {
        scale = scaleBase * (1.0 - ((t - 0.85) / 0.15) * 0.25);
      }
      p.sprite.scale.set(scale, scale, scale);

      // Rotation / tumble in flight
      p.sprite.material.rotation = (elapsed * 0.006) % (Math.PI * 2);

      if (t >= 1.0) {
        p.onLand?.();
        this.group.remove(p.sprite);
        p.sprite.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Update Impact Rings
    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      const ring = this.impactRings[i];
      const elapsed = now - ring.startTime;
      const progress = elapsed / ring.durationMs;

      if (progress >= 1.0) {
        this.group.remove(ring.mesh);
        (ring.mesh.material as THREE.Material).dispose();
        this.impactRings.splice(i, 1);
        continue;
      }

      const currentScale = 0.3 + progress * 1.8;
      ring.mesh.scale.set(currentScale, currentScale, currentScale);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - progress) * 0.8;
    }

    // 3. Update Floating Labels (Projected to Screen)
    const isModalOpen = typeof document !== 'undefined' && !!document.querySelector('.modal-overlay:not(.closed)');
    if (isModalOpen) {
      if (this.overlayContainer.style.display !== 'none') {
        this.overlayContainer.style.display = 'none';
      }
      return;
    } else if (this.overlayContainer.style.display === 'none') {
      this.overlayContainer.style.display = '';
    }

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    for (let i = this.floatingLabels.length - 1; i >= 0; i--) {
      const fl = this.floatingLabels[i];
      const elapsed = now - fl.startTime;
      const progress = elapsed / fl.durationMs;

      if (progress >= 1.0) {
        fl.element.remove();
        this.floatingLabels.splice(i, 1);
        continue;
      }

      this.tempVec.copy(fl.worldPos);
      this.tempVec.y += 0.45; // float above impact spot
      this.tempVec.project(camera);

      if (this.tempVec.z > 1.0 || this.tempVec.z < -1.0) {
        fl.element.style.display = 'none';
        continue;
      }

      fl.element.style.display = 'block';
      const screenX = this.tempVec.x * halfW + halfW;
      const screenY = -this.tempVec.y * halfH + halfH;
      const driftY = progress * 40; // float up 40px

      const opacity = progress > 0.65 ? (1.0 - progress) / 0.35 : 1.0;
      fl.element.style.transform = `translate3d(${screenX}px, ${screenY - driftY}px, 0) translate(-50%, -50%) scale(${(1.0 + progress * 0.12).toFixed(2)})`;
      fl.element.style.opacity = opacity.toFixed(2);
    }
  }

  public clear(): void {
    for (const p of this.projectiles) {
      this.group.remove(p.sprite);
      p.sprite.material.dispose();
    }
    this.projectiles = [];

    for (const r of this.impactRings) {
      this.group.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.impactRings = [];

    for (const l of this.floatingLabels) {
      l.element.remove();
    }
    this.floatingLabels = [];
  }
}
