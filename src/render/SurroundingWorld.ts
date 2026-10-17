import * as THREE from 'three';

export class SurroundingWorld {
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;

  public worldWidth = 160.0;
  public worldHeight = 179.8;

  constructor(
    private scene: THREE.Scene,
    textures: {
      worldDay: THREE.Texture;
      worldNight: THREE.Texture;
      worldHeightmap: THREE.Texture;
    },
    moonLight: THREE.DirectionalLight
  ) {
    // 480x540 vertex plane covering wider Mediterranean with crisp 3D mountain relief (Mount Olympus, Pindus, Taurus)
    const geometry = new THREE.PlaneGeometry(this.worldWidth, this.worldHeight, 480, 540);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        uniform sampler2D uWorldHeightmap;
        uniform vec4 uCoreBounds; // xMin, zMin, xMax, zMax
        uniform float uDisplacementScale;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vIsLand;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);

          // Sample heightmap (R = elevation, G = isLand, B = bathymetry)
          vec4 hm = texture2D(uWorldHeightmap, uv);
          float isLand = step(0.45, hm.g);
          vIsLand = isLand;
          vElevation = hm.r;

          // Check if this vertex is inside the Aegean playable core
          bool inCore = (worldPos.x >= uCoreBounds.x && worldPos.x <= uCoreBounds.z &&
                         worldPos.z >= uCoreBounds.y && worldPos.z <= uCoreBounds.w);

          // Displace surrounding mountain relief (Pindus, Taygetus, Olympus, Taurus)
          if (!inCore && isLand > 0.5) {
            worldPos.y += hm.r * uDisplacementScale * 3.5;
          } else {
            worldPos.y -= 0.015; // Sit flush beneath the Aegean core
          }

          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uWorldDay;
        uniform sampler2D uWorldNight;
        uniform sampler2D uWorldHeightmap;
        uniform int uViewMode; // 0: Night, 1: Day, 2: DEM
        uniform float uGlobalDayBlend;
        uniform vec4 uCoreBounds;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uTime;
        uniform float uDisplacementScale;

        // Authoritative DEM Hypsometric Ramps
        uniform vec3 uDEMColCoast;
        uniform vec3 uDEMColValley;
        uniform vec3 uDEMColFoothill;
        uniform vec3 uDEMColSlope;
        uniform vec3 uDEMColRidge;
        uniform vec3 uDEMColSummit;

        // Elevation stops
        uniform float uDEMGreenLimit;
        uniform float uDEMBrownStart;
        uniform float uDEMBrownPeak;
        uniform float uDEMWhiteStart;

        // DEM Lighting
        uniform float uDEMSunRadiance;
        uniform float uDEMAmbientFill;
        uniform float uDEMSunWarmth;
        uniform float uDEMReliefStrength;

        // Night & Day Lighting matching core
        uniform float uMoonlightIntensity;
        uniform float uNightAmbient;
        uniform float uDaySunIntensity;
        uniform float uDayAmbient;
        uniform float uDayWarmth;
        uniform float uDaySaturation;

        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vIsLand;
        varying float vElevation;

        // High-fidelity DEM color ramp for surrounding mainland mountains matching Aegean core
        vec3 getSurroundingDEMColor(float h, float isLand) {
          if (isLand < 0.5) {
            // Deep Mediterranean oceanic abyss (rich, dark navy)
            return vec3(0.006, 0.016, 0.038);
          }
          if (h < uDEMGreenLimit) {
            float f = h / max(0.0001, uDEMGreenLimit);
            return mix(uDEMColCoast, uDEMColValley, smoothstep(0.0, 1.0, f));
          } else if (h < uDEMBrownStart) {
            float f = (h - uDEMGreenLimit) / max(0.0001, uDEMBrownStart - uDEMGreenLimit);
            return mix(uDEMColValley, uDEMColFoothill, smoothstep(0.0, 1.0, f));
          } else if (h < uDEMBrownPeak) {
            float f = (h - uDEMBrownStart) / max(0.0001, uDEMBrownPeak - uDEMBrownStart);
            return mix(uDEMColFoothill, uDEMColSlope, smoothstep(0.0, 1.0, f));
          } else if (h < uDEMWhiteStart) {
            float f = (h - uDEMBrownPeak) / max(0.0001, uDEMWhiteStart - uDEMBrownPeak);
            return mix(uDEMColSlope, uDEMColRidge, smoothstep(0.0, 1.0, f));
          } else {
            float f = clamp((h - uDEMWhiteStart) / 0.18, 0.0, 1.0);
            return mix(uDEMColRidge, uDEMColSummit, smoothstep(0.0, 1.0, f));
          }
        }

        void main() {
          // 1. Soft cutout discard for the inner Aegean core box to avoid z-fighting
          float innerXMin = uCoreBounds.x + 0.35;
          float innerXMax = uCoreBounds.z - 0.35;
          float innerZMin = uCoreBounds.y + 0.35;
          float innerZMax = uCoreBounds.w - 0.35;

          if (vWorldPos.x > innerXMin && vWorldPos.x < innerXMax &&
              vWorldPos.z > innerZMin && vWorldPos.z < innerZMax) {
            discard;
          }

          // 2. Analytical Sobel filter on 1024x1152 heightmap for crisp topographic normal relief
          float dU = 1.0 / 1024.0;
          float dV = 1.0 / 1152.0;
          float hL = texture2D(uWorldHeightmap, vUv - vec2(dU, 0.0)).r;
          float hR = texture2D(uWorldHeightmap, vUv + vec2(dU, 0.0)).r;
          float hD = texture2D(uWorldHeightmap, vUv - vec2(0.0, dV)).r;
          float hU = texture2D(uWorldHeightmap, vUv + vec2(0.0, dV)).r;
          vec3 norm = normalize(vec3((hL - hR) * uDisplacementScale * 32.0, 1.0, (hD - hU) * uDisplacementScale * 32.0));

          // 3. Directional sun and moon vectors
          vec3 sunDir = normalize(vec3(0.65, 0.58, -0.48));
          vec3 moonDir = uMoonDir;

          // 4. View mode blending
          vec3 finalCol;
          if (uViewMode == 2) {
            // 🏔️ Real-time DEM Topography with analytical hillshading
            vec3 demCol = getSurroundingDEMColor(vElevation, vIsLand);
            
            float NdotL = dot(norm, sunDir);
            float relief = pow(clamp(NdotL * 0.5 + 0.5, 0.0, 1.0), uDEMReliefStrength);

            // Sky ambient fill: cool diffuse tropospheric skylight
            vec3 ambientSky = vec3(0.38, 0.44, 0.52) * uDEMAmbientFill;

            // Sunlight color temperature / warmth
            vec3 sunWarmTint = mix(vec3(0.92, 0.98, 1.06), vec3(1.18, 0.98, 0.76), uDEMSunWarmth);
            vec3 directSun = vec3(1.05, 1.00, 0.95) * sunWarmTint * (relief * uDEMSunRadiance);

            finalCol = demCol * (ambientSky + directSun);
          } else {
            // 🌙 Night (0) vs ☀️ Day (1) with dynamic hillshading
            float dayBlend = (uViewMode == 1) ? 1.0 : uGlobalDayBlend;
            vec4 dayCol = texture2D(uWorldDay, vUv);
            vec4 nightCol = texture2D(uWorldNight, vUv);

            vec3 dayEnhanced = dayCol.rgb * vec3(1.12, 1.12, 1.10);
            vec3 nightEnhanced = nightCol.rgb * vec3(1.85, 2.05, 2.25);
            vec3 baseColor = mix(nightEnhanced, dayEnhanced, dayBlend);

            vec3 lightDir = normalize(mix(moonDir, sunDir, dayBlend));
            float NdotL = dot(norm, lightDir);

            float nightShade = smoothstep(-0.20, 0.85, NdotL);
            float nightDiff = mix(max(0.40, NdotL), mix(0.35, 1.45, nightShade), 0.70);
            float dayShade = smoothstep(-0.25, 0.90, NdotL);
            float dayDiff = mix(0.25, 1.35, dayShade);
            float lightDiff = mix(nightDiff, dayDiff, dayBlend);

            vec3 nightAmbient = vec3(1.15, 1.38, 1.75) * uNightAmbient;
            vec3 dayAmbient = vec3(0.82, 0.88, 0.94) * uDayAmbient;
            vec3 ambient = mix(nightAmbient, dayAmbient, dayBlend);

            vec3 warmSunTint = mix(vec3(0.92, 0.98, 1.08), vec3(1.16, 0.97, 0.78), uDayWarmth);
            vec3 nightDirect = vec3(2.10, 2.45, 3.10) * uMoonlightIntensity;
            vec3 dayDirect = vec3(1.05, 1.00, 0.92) * warmSunTint * uDaySunIntensity;
            vec3 direct = mix(nightDirect, dayDirect, dayBlend);

            float luma = dot(baseColor, vec3(0.2126, 0.7152, 0.0722));
            vec3 naturalLand = mix(vec3(luma), baseColor, uDaySaturation);
            vec3 terrainBase = mix(baseColor, naturalLand, dayBlend);

            finalCol = terrainBase * (ambient + direct * lightDiff);

            // Water shimmer for surrounding ocean
            if (vIsLand < 0.5) {
              float shimmer = sin(vWorldPos.x * 2.5 + uTime * 1.5) * cos(vWorldPos.z * 2.5 + uTime * 1.2) * 0.03;
              finalCol += vec3(0.005, 0.012, 0.024) * (shimmer + 0.03);
            }
          }

          // 5. Atmospheric Horizon Edge Falloff
          // Seamlessly fade outer 6% of the border to deep Mediterranean atmospheric space
          float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          float edgeY = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
          float edgeFactor = edgeX * edgeY;

          vec3 horizonDeep = vec3(0.002, 0.007, 0.018);
          finalCol = mix(horizonDeep, finalCol, edgeFactor);

          gl_FragColor = vec4(finalCol, edgeFactor);
        }
      `,
      uniforms: {
        uWorldDay: { value: textures.worldDay },
        uWorldNight: { value: textures.worldNight },
        uWorldHeightmap: { value: textures.worldHeightmap },
        uViewMode: { value: 2 }, // Default view mode: 2 = DEM Topography
        uGlobalDayBlend: { value: 0.0 },
        uDisplacementScale: { value: 0.85 },
        // Aegean core bounding box in world units
        uCoreBounds: { value: new THREE.Vector4(-35.0, -39.325, 35.0, 39.325) },
        uSunDir: { value: new THREE.Vector3(0.65, 0.58, -0.48).normalize() },
        uMoonDir: { value: new THREE.Vector3().copy(moonLight.position).normalize() },
        uTime: { value: 0.0 },
        // DEM Authoritative stops
        uDEMGreenLimit: { value: 0.015 },
        uDEMBrownStart: { value: 0.075 },
        uDEMBrownPeak:  { value: 0.500 },
        uDEMWhiteStart: { value: 0.700 },
        // DEM Authoritative colors
        uDEMColCoast:    { value: new THREE.Color(0x1e433d) },
        uDEMColValley:   { value: new THREE.Color(0x35512f) },
        uDEMColFoothill: { value: new THREE.Color(0x535a30) },
        uDEMColSlope:    { value: new THREE.Color(0x8a7d6a) },
        uDEMColRidge:    { value: new THREE.Color(0xb7874e) },
        uDEMColSummit:   { value: new THREE.Color(0xefeff5) },
        // DEM Authoritative light params
        uDEMSunRadiance:   { value: 2.05 },
        uDEMAmbientFill:   { value: 0.60 },
        uDEMSunWarmth:     { value: 0.00 },
        uDEMReliefStrength:{ value: 1.50 },
        // Night & Day light params matching core
        uMoonlightIntensity: { value: 0.55 },
        uNightAmbient: { value: 0.40 },
        uDaySunIntensity: { value: 0.20 },
        uDayAmbient: { value: 1.80 },
        uDayWarmth: { value: 0.36 },
        uDaySaturation: { value: 0.50 },
      },
      transparent: true,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(0, -0.015, 0);
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    this.scene.add(this.mesh);
  }

  public setViewMode(mode: number) {
    this.material.uniforms.uViewMode.value = mode;
  }

  public setDayBlend(blend: number) {
    this.material.uniforms.uGlobalDayBlend.value = blend;
  }

  public setDisplacementScale(scale: number) {
    this.material.uniforms.uDisplacementScale.value = scale;
  }

  public setDEMParams(greenStart: number, yellowStart: number, brownStart: number, whiteStart: number) {
    this.material.uniforms.uDEMGreenLimit.value = greenStart;
    this.material.uniforms.uDEMBrownStart.value = yellowStart;
    this.material.uniforms.uDEMBrownPeak.value = brownStart;
    this.material.uniforms.uDEMWhiteStart.value = whiteStart;
  }

  public setDEMColors(colors: {
    coast?: string;
    valley?: string;
    foothill?: string;
    slope?: string;
    ridge?: string;
    summit?: string;
  }) {
    if (colors.coast) (this.material.uniforms.uDEMColCoast.value as THREE.Color).set(colors.coast);
    if (colors.valley) (this.material.uniforms.uDEMColValley.value as THREE.Color).set(colors.valley);
    if (colors.foothill) (this.material.uniforms.uDEMColFoothill.value as THREE.Color).set(colors.foothill);
    if (colors.slope) (this.material.uniforms.uDEMColSlope.value as THREE.Color).set(colors.slope);
    if (colors.ridge) (this.material.uniforms.uDEMColRidge.value as THREE.Color).set(colors.ridge);
    if (colors.summit) (this.material.uniforms.uDEMColSummit.value as THREE.Color).set(colors.summit);
  }

  public setDEMLightParams(sunRadiance: number, ambientFill: number, warmth: number, reliefStrength: number) {
    this.material.uniforms.uDEMSunRadiance.value = sunRadiance;
    this.material.uniforms.uDEMAmbientFill.value = ambientFill;
    this.material.uniforms.uDEMSunWarmth.value = warmth;
    this.material.uniforms.uDEMReliefStrength.value = reliefStrength;
  }

  public setDayLightParams(sunIntensity: number, ambient: number, warmth: number, saturation: number) {
    this.material.uniforms.uDaySunIntensity.value = sunIntensity;
    this.material.uniforms.uDayAmbient.value = ambient;
    this.material.uniforms.uDayWarmth.value = warmth;
    this.material.uniforms.uDaySaturation.value = saturation;
  }

  public setNightLightingParams(moonlight: number, ambient: number) {
    this.material.uniforms.uMoonlightIntensity.value = moonlight;
    this.material.uniforms.uNightAmbient.value = ambient;
  }

  public update(time: number) {
    this.material.uniforms.uTime.value = time;
  }
}
