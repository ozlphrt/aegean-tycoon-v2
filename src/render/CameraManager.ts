import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CameraTransition {
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPos: THREE.Vector3;
  endTarget: THREE.Vector3;
  startTime: number;
  duration: number;
  onComplete?: () => void;
}

export class CameraManager {
  private isIntroActive = true;
  private introStartTime = 0;
  private introDuration = 1800; // 1.8s gentle initial descent

  // Expansive Cycladic overview starting pose (distance ~38)
  private startPos = new THREE.Vector3(-4.2, 24.0, 46.5);
  private startTarget = new THREE.Vector3(-4.2, 0.4, 15.4);

  // Comfortably framed resting pose over Santorini & the Cyclades sea lanes (distance ~30)
  private endPos = new THREE.Vector3(-4.2, 18.5, 39.5);
  private endTarget = new THREE.Vector3(-4.2, 0.4, 15.4);

  // Active smooth camera transition
  private transition: CameraTransition | null = null;

  // Real-time target tracking (vessel follow mode)
  private followTarget: (() => THREE.Vector3 | null) | null = null;
  private onFollowCancel?: () => void;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls
  ) {
    this.introStartTime = performance.now();
    this.camera.position.copy(this.startPos);
    this.controls.target.copy(this.startTarget);

    // Cancel automated camera movement if user manually interacts with pan
    const onUserInteract = (e: MouseEvent | TouchEvent) => {
      // Allow orbit rotation (right mouse drag) and zooming without breaking follow mode
      if (this.followTarget && e instanceof MouseEvent && (e.button === 2 || e.type === 'wheel')) {
        return;
      }
      this.cancelAnimations();
    };

    window.addEventListener('mousedown', onUserInteract);
    window.addEventListener('wheel', onUserInteract);
    window.addEventListener('touchstart', onUserInteract);
  }

  public cancelAnimations() {
    this.isIntroActive = false;
    this.transition = null;
    if (this.followTarget) {
      this.followTarget = null;
      this.onFollowCancel?.();
      this.onFollowCancel = undefined;
    }
  }

  public follow(getTargetPos: () => THREE.Vector3 | null, distance = 8.5, onCancel?: () => void) {
    this.cancelAnimations();
    this.followTarget = getTargetPos;
    this.onFollowCancel = onCancel;

    const initialPos = getTargetPos();
    if (initialPos) {
      const targetEnd = initialPos.clone();
      const posEnd = new THREE.Vector3(
        initialPos.x,
        initialPos.y + distance * 0.65,
        initialPos.z + distance * 0.85
      );
      this.smoothTransition(targetEnd, posEnd, 1400);
    }
  }

  public unfollow() {
    if (this.followTarget) {
      this.followTarget = null;
      this.onFollowCancel?.();
      this.onFollowCancel = undefined;
    }
  }

  public isFollowing(): boolean {
    return this.followTarget !== null;
  }

  public update() {
    const now = performance.now();

    // 1. Dynamic target tracking (vessel follow mode)
    if (this.followTarget && !this.transition) {
      const targetPos = this.followTarget();
      if (targetPos) {
        const delta = new THREE.Vector3().subVectors(targetPos, this.controls.target);
        this.controls.target.copy(targetPos);
        this.camera.position.add(delta);
      } else {
        this.unfollow();
      }
      return;
    }

    // 2. Initial panoramic descent
    if (this.isIntroActive) {
      const elapsed = now - this.introStartTime;
      const t = Math.min(1.0, elapsed / this.introDuration);
      // Smooth cubic ease out
      const ease = 1.0 - Math.pow(1.0 - t, 3);

      this.camera.position.lerpVectors(this.startPos, this.endPos, ease);
      this.controls.target.lerpVectors(this.startTarget, this.endTarget, ease);

      if (t >= 1.0) {
        this.isIntroActive = false;
      }
      return;
    }

    // 2. Active smooth transition between targets / territory framing
    if (this.transition) {
      const elapsed = now - this.transition.startTime;
      const t = Math.min(1.0, elapsed / this.transition.duration);
      // Smooth cubic ease-in-out
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.transition.startPos, this.transition.endPos, ease);
      this.controls.target.lerpVectors(this.transition.startTarget, this.transition.endTarget, ease);

      if (t >= 1.0) {
        const cb = this.transition.onComplete;
        this.transition = null;
        cb?.();
      }
    }
  }

  /**
   * Instantly or smoothly focus on a 3D target point or single island.
   */
  public focusOn(targetPos: THREE.Vector3, distance = 26, animate = true, durationMs = 1800) {
    const targetEnd = targetPos.clone();
    const posEnd = new THREE.Vector3(targetPos.x, targetPos.y + distance * 0.70, targetPos.z + distance * 0.85);

    if (!animate) {
      this.cancelAnimations();
      this.controls.target.copy(targetEnd);
      this.camera.position.copy(posEnd);
      return;
    }

    this.smoothTransition(targetEnd, posEnd, durationMs);
  }

  /**
   * Dynamically frame a set of 3D world positions (e.g. all active / unlocked islands).
   */
  public fitToPositions(
    positions: THREE.Vector3[],
    minDistance = 26,
    padding = 1.30,
    animate = true,
    durationMs = 2000
  ) {
    if (positions.length === 0) return;

    if (positions.length === 1) {
      this.focusOn(positions[0], minDistance, animate, durationMs);
      return;
    }

    // Calculate 2D/3D bounding box
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let avgY = 0;

    for (const p of positions) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
      avgY += p.y;
    }
    avgY /= positions.length;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanZ);

    // Comfortably clamp distance between minDistance (26) and maxDistance (58)
    const rawDistance = Math.max(minDistance, maxSpan * padding);
    const distance = Math.min(58, rawDistance);

    const targetEnd = new THREE.Vector3(centerX, avgY + 0.3, centerZ);
    const posEnd = new THREE.Vector3(centerX, avgY + distance * 0.62, centerZ + distance * 0.75);

    // If still in initial intro, retarget the intro destination smoothly
    if (this.isIntroActive) {
      this.endPos.copy(posEnd);
      this.endTarget.copy(targetEnd);
      return;
    }

    if (!animate) {
      this.cancelAnimations();
      this.controls.target.copy(targetEnd);
      this.camera.position.copy(posEnd);
      return;
    }

    this.smoothTransition(targetEnd, posEnd, durationMs);
  }

  private smoothTransition(targetEnd: THREE.Vector3, posEnd: THREE.Vector3, durationMs = 2000) {
    this.isIntroActive = false;
    this.transition = {
      startPos: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      endPos: posEnd,
      endTarget: targetEnd,
      startTime: performance.now(),
      duration: durationMs,
    };
  }
}
