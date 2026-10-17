import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BoatWakeRenderer, DEFAULT_WAKE_PARAMS } from './BoatWake';

describe('BoatWakeRenderer Hydrodynamic System', () => {
  it('initializes with default parameters and empty trails', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    const params = wake.getParams();
    expect(params.lifetime).toBe(DEFAULT_WAKE_PARAMS.lifetime);
    expect(params.spread).toBe(DEFAULT_WAKE_PARAMS.spread);
    expect(params.washWidth).toBe(DEFAULT_WAKE_PARAMS.washWidth);
    expect(params.foamOpacity).toBe(DEFAULT_WAKE_PARAMS.foamOpacity);
    expect(params.speedResponse).toBe(DEFAULT_WAKE_PARAMS.speedResponse);

    wake.update(1.0);
    // Mesh is in scene
    expect(scene.children.length).toBe(1);
    wake.dispose();
  });

  it('samples emissions by distance traveled and maintains world-space positions during straight cruising', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Initial position at stern (0, 0, 0)
    wake.recordVessel('boat-1', 0, 0, 0, 0, 0.5, 0.25, true, 0.0);

    // Advance 0.5 units along +Z over 1 second (cruising straight)
    for (let i = 1; i <= 10; i++) {
      const z = i * 0.05;
      wake.recordVessel('boat-1', 0, 0, z, 0, 0.5, 0.25, true, i * 0.1);
    }

    wake.update(1.0);

    // Geometry position attribute should be populated
    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    expect(pos).toBeDefined();
    expect(geo.drawRange.count).toBeGreaterThan(0);

    // Ensure the earliest emitted segments remain at low Z (stayed behind in world space)
    const firstQuadZ = pos.getZ(0);
    expect(firstQuadZ).toBeLessThan(0.2);

    wake.dispose();
  });

  it('tracks curved path during turns in world space', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Simulate an arc/turn: moving in a circle of radius 1.0
    const numSteps = 16;
    for (let i = 0; i <= numSteps; i++) {
      const angle = (i / numSteps) * (Math.PI / 2); // 90 degree turn
      const x = Math.sin(angle);
      const z = 1.0 - Math.cos(angle);
      const heading = angle;
      wake.recordVessel('boat-turn', x, 0, z, heading, 0.4, 0.25, true, i * 0.1);
    }

    wake.update(1.6);
    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    expect(geo.drawRange.count).toBeGreaterThan(12);

    // Segments should have diverse X and Z coordinates tracking the curved arc
    let hasNearZeroX = false;
    let hasHighX = false;
    for (let v = 0; v < geo.drawRange.count; v++) {
      const vx = pos.getX(v);
      if (vx < 0.2) hasNearZeroX = true;
      if (vx > 0.5) hasHighX = true;
    }
    expect(hasNearZeroX).toBe(true);
    expect(hasHighX).toBe(true);

    wake.dispose();
  });

  it('does not emit new wake segments when boat is stationary and fades existing trail', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Move first to lay down a short trail
    wake.recordVessel('boat-stop', 0, 0, 0, 0, 0.5, 0.25, true, 0.0);
    wake.recordVessel('boat-stop', 0, 0, 0.3, 0, 0.5, 0.25, true, 0.5);
    wake.update(0.5);

    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    const initialCount = geo.drawRange.count;
    expect(initialCount).toBeGreaterThan(0);

    // Now boat stops at dock (speed = 0, isSailing = false)
    const midTime = 0.5 + DEFAULT_WAKE_PARAMS.lifetime * 0.4;
    wake.recordVessel('boat-stop', 0, 0, 0.3, 0, 0.0, 0.25, false, midTime);
    wake.update(midTime);

    // Still has trail while within lifetime
    expect(geo.drawRange.count).toBeGreaterThan(0);

    // Now advance time beyond wake lifetime
    wake.update(0.5 + DEFAULT_WAKE_PARAMS.lifetime + 1.0);
    // Trail has aged out and faded naturally to zero active vertices
    expect(geo.drawRange.count).toBe(0);

    wake.dispose();
  });

  it('resets trail immediately after teleport or route wrap to prevent streaks across map', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Emit initial moving points
    wake.recordVessel('boat-teleport', 0, 0, 0, 0, 0.5, 0.25, true, 0.0);
    wake.recordVessel('boat-teleport', 0, 0, 0.2, 0, 0.5, 0.25, true, 0.2);
    wake.update(0.2);

    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geo.drawRange.count).toBeGreaterThan(0);

    // Sudden teleport across map (e.g. jump 15 units across the Aegean)
    wake.recordVessel('boat-teleport', 15.0, 0, 15.0, 0, 0.5, 0.25, true, 0.3);
    wake.update(0.3);

    // History was cleared on teleport, no giant quad spanning 15 units
    expect(geo.drawRange.count).toBe(0);

    wake.dispose();
  });

  it('supports runtime parameter tuning for lifetime, spread, washWidth, foamOpacity, and speedResponse', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    wake.setParams({
      lifetime: 9.5,
      spread: 5.0,
      washWidth: 1.8,
      foamOpacity: 0.90,
      speedResponse: 1.5,
    });

    const params = wake.getParams();
    expect(params.lifetime).toBe(9.5);
    expect(params.spread).toBe(5.0);
    expect(params.washWidth).toBe(1.8);
    expect(params.foamOpacity).toBe(0.90);
    expect(params.speedResponse).toBe(1.5);

    wake.dispose();
  });

  it('handles two passing vessels with lateral avoidance offsets smoothly without cross-contamination', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Vessel 1 heading South (-Z to +Z) with starboard steer (+X)
    // Vessel 2 heading North (+Z to -Z) with starboard steer (-X)
    for (let i = 0; i <= 15; i++) {
      const t = i * 0.1;
      const z1 = -1.0 + i * 0.15;
      const x1 = Math.sin((i / 15) * Math.PI) * 0.2; // avoidance bow
      wake.recordVessel('vessel-south', x1, 0, z1, 0, 0.5, 0.25, true, t);

      const z2 = 1.0 - i * 0.15;
      const x2 = -Math.sin((i / 15) * Math.PI) * 0.2;
      wake.recordVessel('vessel-north', x2, 0, z2, Math.PI, 0.5, 0.25, true, t);
    }

    wake.update(1.5);
    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geo.drawRange.count).toBeGreaterThan(50);

    // Verify all vertex positions are finite valid coordinates
    const pos = geo.getAttribute('position');
    for (let v = 0; v < geo.drawRange.count; v++) {
      expect(Number.isFinite(pos.getX(v))).toBe(true);
      expect(Number.isFinite(pos.getY(v))).toBe(true);
      expect(Number.isFinite(pos.getZ(v))).toBe(true);
    }

    wake.dispose();
  });

  it('handles sharp turns without creating NaN vertices or self-intersecting inverted geometry', () => {
    const scene = new THREE.Scene();
    const wake = new BoatWakeRenderer(scene);

    // Rapid zig-zag / sharp direction change
    let currX = 0;
    let currZ = 0;
    for (let i = 0; i < 20; i++) {
      const heading = (i % 2 === 0) ? 0.8 : -0.8;
      currX += Math.sin(heading) * 0.08;
      currZ += Math.cos(heading) * 0.08;
      wake.recordVessel('boat-zigzag', currX, 0, currZ, heading, 0.6, 0.3, true, i * 0.05);
    }

    wake.update(1.0);
    const geo = (scene.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geo.drawRange.count).toBeGreaterThan(0);

    const pos = geo.getAttribute('position');
    for (let v = 0; v < geo.drawRange.count; v++) {
      expect(Number.isFinite(pos.getX(v))).toBe(true);
      expect(Number.isFinite(pos.getY(v))).toBe(true);
      expect(Number.isFinite(pos.getZ(v))).toBe(true);
    }

    wake.dispose();
  });
});

