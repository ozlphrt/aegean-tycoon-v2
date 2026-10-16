import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraManager {
  private isIntroActive = true;
  private introStartTime = 0;
  private introDuration = 4500; // 4.5 seconds

  // Panoramic starting pose
  private startPos = new THREE.Vector3(10, 95, 115);
  private startTarget = new THREE.Vector3(0, 0, 0);

  // Close focus pose over Santorini & Naxos (Cyclades heart)
  private endPos = new THREE.Vector3(0, 24, 28);
  private endTarget = new THREE.Vector3(0, 0.5, 2.5);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls
  ) {
    this.introStartTime = performance.now();
    this.camera.position.copy(this.startPos);
    this.controls.target.copy(this.startTarget);

    // Cancel intro if user starts dragging
    const onUserInteract = () => {
      if (this.isIntroActive) {
        this.isIntroActive = false;
      }
    };

    window.addEventListener('mousedown', onUserInteract, { once: true });
    window.addEventListener('wheel', onUserInteract, { once: true });
    window.addEventListener('touchstart', onUserInteract, { once: true });
  }

  public update() {
    if (!this.isIntroActive) return;

    const now = performance.now();
    const elapsed = now - this.introStartTime;
    const t = Math.min(1.0, elapsed / this.introDuration);

    // Smooth cubic ease out
    const ease = 1.0 - Math.pow(1.0 - t, 3);

    this.camera.position.lerpVectors(this.startPos, this.endPos, ease);
    this.controls.target.lerpVectors(this.startTarget, this.endTarget, ease);

    if (t >= 1.0) {
      this.isIntroActive = false;
    }
  }

  public focusOn(targetPos: THREE.Vector3, distance = 20) {
    this.isIntroActive = false;
    this.controls.target.copy(targetPos);
    this.camera.position.set(targetPos.x, targetPos.y + distance * 0.75, targetPos.z + distance * 0.85);
  }
}
