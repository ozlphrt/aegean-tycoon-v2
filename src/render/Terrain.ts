import * as THREE from 'three';

const terrainVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;

  uniform sampler2D uHeightmap;
  uniform float uDisplacementScale;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Heightmap: R = Land elevation (0 on sea, >0 on land)
    vec3 hm = texture2D(uHeightmap, uv).rgb;
    float landElevation = hm.r;

    // Displace land vertically in 3D relief; sea stays flat at y = 0
    pos.y = landElevation * uDisplacementScale;

    // Normal calculation from 4K heightmap neighboring samples
    float delta = 1.0 / 4096.0;
    float hR = texture2D(uHeightmap, uv + vec2(delta, 0.0)).r;
    float hL = texture2D(uHeightmap, uv - vec2(delta, 0.0)).r;
    float hU = texture2D(uHeightmap, uv + vec2(0.0, delta)).r;
    float hD = texture2D(uHeightmap, uv - vec2(0.0, delta)).r;

    vec3 normalDisplaced = normalize(vec3(
      (hL - hR) * uDisplacementScale * 25.0,
      1.0,
      (hD - hU) * uDisplacementScale * 25.0
    ));

    vNormalVec = normalize((modelMatrix * vec4(normalDisplaced, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const terrainFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;

  uniform sampler2D uNightTex;
  uniform sampler2D uDayTex;
  uniform sampler2D uLightsTex;
  uniform sampler2D uMaskTex;
  uniform sampler2D uHeightmap;
  uniform sampler2D uNormalTex;

  uniform int uViewMode; // 0: Night, 1: Day, 2: DEM Heightmap, 3: Island Mask
  uniform float uDisplacementScale;
  uniform float uGlobalDayBlend; // 0 = full night, 1 = full day
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uDEMGreenLimit;
  uniform float uDEMBrownStart;
  uniform float uDEMBrownPeak;
  uniform float uDEMWhiteStart;
  uniform float uMoonlightIntensity;
  uniform float uNightAmbient;
  uniform float uCityGlow;
  uniform float uMoonGlint;
  uniform float uDaySunIntensity;
  uniform float uDayAmbient;
  uniform float uDayWarmth;
  uniform float uDaySaturation;
  uniform float uDaySeaBrilliance;

  // Organic, multi-directional Mediterranean sea wave simulation
  // Non-orthogonal wave trains + domain warping (zero geometric grid or fabric weave artifacts)
  vec3 getWaterNormal(vec2 uv, float t) {
    // Spatial coordinates scaled for natural Mediterranean swell (wavelengths ~80m to 500m)
    vec2 p = uv * 380.0;

    // Meltemi wind swell: wave train 1 (direction ~33 deg)
    vec2 d1 = vec2(0.839, 0.545);
    float ph1 = dot(p, d1) + t * 1.4;

    // Secondary crossed sea: wave train 2 (direction ~128 deg)
    vec2 d2 = vec2(-0.616, 0.788);
    float ph2 = dot(p * 1.5, d2) - t * 1.8;

    // Wave train 3: gentle transverse ripple (direction ~-25 deg)
    vec2 d3 = vec2(0.906, -0.423);
    float ph3 = dot(p * 3.2, d3) + t * 2.6;

    // Wave train 4: capillary chop (direction ~-112 deg)
    vec2 d4 = vec2(-0.375, -0.927);
    float ph4 = dot(p * 6.5, d4) - t * 3.4;

    // Organic domain warp to disrupt linear crest repetition
    float warp = sin(ph1 * 0.6 + ph2 * 0.4) * 0.45;

    // Sum wave profiles with natural crest sharpening
    float c1 = cos(ph1 + warp);
    float c2 = cos(ph2 - warp);
    float c3 = cos(ph3 + warp * 0.5);
    float c4 = cos(ph4);

    // Compute surface slope gradients analytically
    float gx = (d1.x * c1 * 0.40 + d2.x * c2 * 0.30 + d3.x * c3 * 0.20 + d4.x * c4 * 0.10) * 0.055;
    float gz = (d1.y * c1 * 0.40 + d2.y * c2 * 0.30 + d3.y * c3 * 0.20 + d4.y * c4 * 0.10) * 0.055;

    return normalize(vec3(-gx, 1.0, -gz));
  }

  // Distinct color palette for island mask IDs (1..16)
  vec3 getMaskColor(float id) {
    if (id < 0.5) return vec3(0.04, 0.08, 0.16); // Ocean water
    float hue = fract(id * 0.618033988749895); // Golden ratio hue distribution
    vec3 c = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return mix(vec3(1.0), c, 0.8) * 0.95;
  }

  // Topographic elevation color ramp for DEM mode (Dynamic Parametric Mediterranean Palette)
  // Real-time tunable via interactive sliders: Green limit -> Brown start -> Brown peak -> White start
  vec3 getDEMColor(float elev, float isLand, float depth) {
    // Deep Aegean bathymetry gradient: dark slate navy abyss to shelf grey-blue
    vec3 oceanCol = mix(vec3(0.015, 0.035, 0.075), vec3(0.045, 0.095, 0.15), depth);

    // Exact user reference color stops:
    vec3 cGreenDark   = vec3(0.020, 0.220, 0.114); // Shoreline fringe: deep dark forest green
    vec3 cGreenRich   = vec3(0.125, 0.325, 0.080); // Lowlands: rich green
    vec3 cOliveKhaki  = vec3(0.355, 0.405, 0.135); // Foothills: warm olive / khaki
    vec3 cOchreTan    = vec3(0.535, 0.450, 0.208); // Lower slopes: warm golden ochre tan
    vec3 cSienna      = vec3(0.665, 0.490, 0.285); // Mid slopes: warm sienna / terracotta
    vec3 cBrownDeep   = vec3(0.575, 0.380, 0.220); // Upper slopes: rich deep mountain brown
    vec3 cLimestone   = vec3(0.760, 0.655, 0.520); // High ridges: warm limestone / buff
    vec3 cPaleStone   = vec3(0.840, 0.800, 0.750); // Sub-peaks: pale stone
    vec3 cAlpineWhite = vec3(0.930, 0.930, 0.960); // Highest peaks: alpine white

    vec3 landCol;
    float gLim = max(0.005, uDEMGreenLimit);
    float bStart = max(gLim + 0.008, uDEMBrownStart);
    float bPeak = max(bStart + 0.015, uDEMBrownPeak);
    float wStart = max(bPeak + 0.015, uDEMWhiteStart);

    if (elev < gLim) {
      float t = elev / gLim;
      landCol = mix(cGreenDark, cGreenRich, t);
    } else if (elev < bStart) {
      float t = (elev - gLim) / (bStart - gLim);
      if (t < 0.5) {
        landCol = mix(cGreenRich, cOliveKhaki, t * 2.0);
      } else {
        landCol = mix(cOliveKhaki, cOchreTan, (t - 0.5) * 2.0);
      }
    } else if (elev < bPeak) {
      float t = (elev - bStart) / (bPeak - bStart);
      if (t < 0.5) {
        landCol = mix(cOchreTan, cSienna, t * 2.0);
      } else {
        landCol = mix(cSienna, cBrownDeep, (t - 0.5) * 2.0);
      }
    } else if (elev < wStart) {
      float t = (elev - bPeak) / (wStart - bPeak);
      if (t < 0.5) {
        landCol = mix(cBrownDeep, cLimestone, t * 2.0);
      } else {
        landCol = mix(cLimestone, cPaleStone, (t - 0.5) * 2.0);
      }
    } else {
      float t = clamp((elev - wStart) / max(0.01, 1.0 - wStart), 0.0, 1.0);
      landCol = mix(cPaleStone, cAlpineWhite, t);
    }

    // Smooth anti-aliased coastline blending: removes jagged 1px raster pixelation along coasts
    float landFactor = smoothstep(0.30, 0.70, isLand);
    return mix(oceanCol, landCol, landFactor);
  }

  void main() {
    // Heightmap: R = Land elevation, G = Sea depth, B = Land mask (1 on land, 0 on sea)
    vec3 hm = texture2D(uHeightmap, vUv).rgb;
    float isLand = hm.b;
    float seaDepth = hm.g;

    // Authentic satellite base texture (real islands, beaches and water)
    vec4 nightColor = texture2D(uNightTex, vUv);
    vec4 dayColor = texture2D(uDayTex, vUv);
    vec4 lightsColor = texture2D(uLightsTex, vUv);

    // --- Dim super bright inland water bodies (reservoirs, dams, lakes, rivers) ---
    // In raw satellite imagery, inland water bodies reflect glaring turquoise/cyan.
    // Detect water spectral signature on land: green and blue channels strongly exceed red.
    float isWaterHue = clamp((dayColor.b - dayColor.r * 1.15) * 4.0, 0.0, 1.0)
                     * clamp((dayColor.g - dayColor.r * 0.95) * 3.5, 0.0, 1.0);
    float inlandWaterFactor = isWaterHue * smoothstep(0.10, 0.32, dayColor.b);

    // Deep, natural inland water palettes (replacing glaring electric cyan):
    vec3 inlandLakeNight = vec3(0.010, 0.020, 0.040); // Deep dark midnight water mirror
    vec3 inlandLakeDay = vec3(0.032, 0.070, 0.130);   // Deep Mediterranean lake blue

    // Dim inland water bodies into calm natural water in both views
    dayColor.rgb = mix(dayColor.rgb, inlandLakeDay, inlandWaterFactor * 0.82);
    nightColor.rgb = mix(nightColor.rgb, inlandLakeNight, inlandWaterFactor * 0.90);

    // --- Dim super bright highlights on terrain in both views (Soft-Knee Dynamic Range Compression) ---
    // Day view highlight compression: prevents stark white limestone, salt flats, snow, or specular glare blowout
    float dayLuma = dot(dayColor.rgb, vec3(0.299, 0.587, 0.114));
    if (dayLuma > 0.26) {
      float compDayLuma = 0.26 + (1.0 - exp(-(dayLuma - 0.26) * 3.0)) * 0.12;
      dayColor.rgb *= (compDayLuma / dayLuma);
    }

    // Night view highlight compression: prevents glaring neon hotspots on dark midnight terrain
    float nightLuma = dot(nightColor.rgb, vec3(0.299, 0.587, 0.114));
    if (nightLuma > 0.08) {
      float compNightLuma = 0.08 + (1.0 - exp(-(nightLuma - 0.08) * 4.0)) * 0.04;
      nightColor.rgb *= (compNightLuma / nightLuma);
    }

    // High-resolution topographic normal from baked 4K Sobel DEM
    vec3 bakedNorm = texture2D(uNormalTex, vUv).rgb * 2.0 - 1.0;
    // Mellow, natural topographic gradient slopes for realistic Mediterranean mountain relief
    vec3 highReliefNorm = normalize(vec3(bakedNorm.x * 1.6, bakedNorm.y, bakedNorm.z * 1.6));
    vec3 norm = normalize(mix(vNormalVec, highReliefNorm, smoothstep(0.08, 0.55, isLand)));

    // --- Specialized Debug / Layer Switcher Modes ---
    if (uViewMode == 2) {
      // 🏔️ DEM Digital Elevation Model (National Geographic / Swiss Hillshade Cartography)
      vec3 demCol = getDEMColor(hm.r, isLand, seaDepth);
      float NdotL = dot(norm, normalize(vec3(0.65, 0.58, -0.48)));
      float hillshade = smoothstep(-0.25, 0.85, NdotL);
      float shadeFactor = mix(0.40, 1.08, hillshade);
      gl_FragColor = vec4(demCol * shadeFactor, 1.0);
      return;
    } else if (uViewMode == 3) {
      // 🗺️ Island Territory ID Mask
      float maskVal = floor(texture2D(uMaskTex, vUv).r * 255.0 + 0.5);
      vec3 maskCol = getMaskColor(maskVal);
      gl_FragColor = vec4(maskCol, 1.0);
      return;
    }

    // Moonlit night enhancement: balanced silver-blue Mediterranean full moon (no blue over-amplification)
    vec3 nightEnhanced = nightColor.rgb * vec3(1.85, 2.05, 2.25);
    // Daylight enhancement: sunny, radiant Mediterranean base
    vec3 dayEnhanced = dayColor.rgb * vec3(1.12, 1.12, 1.10);
    vec3 baseColor = mix(nightEnhanced, dayEnhanced, uGlobalDayBlend);

    // Dynamic light direction:
    // Moon at night -> Angled Radiant Mediterranean Morning Sun (~45 deg from Southeast)
    vec3 nightLightDir = uMoonDir;
    vec3 daySunDir = normalize(vec3(0.65, 0.58, -0.48));
    vec3 lightDir = normalize(mix(nightLightDir, daySunDir, uGlobalDayBlend));

    // Dynamic topographic gradient hillshading (both Full Moon and Daylight):
    // Full moon casts distinct silver illumination on sunward ridges and soft lunar shade on backslopes
    float NdotL = dot(norm, lightDir);
    float nightShade = smoothstep(-0.20, 0.85, NdotL);
    float nightDiff = mix(max(0.40, NdotL), mix(0.35, 1.45, nightShade), 0.70);

    float dayShade = smoothstep(-0.25, 0.90, NdotL);
    float dayDiff = mix(0.25, 1.35, dayShade);
    float lightDiff = mix(nightDiff, dayDiff, uGlobalDayBlend);

    // Dynamic ambient & direct lighting calibrated for luminous full moon and radiant sun
    vec3 nightAmbient = vec3(1.15, 1.38, 1.75) * uNightAmbient;
    vec3 dayAmbient = vec3(0.82, 0.88, 0.94) * uDayAmbient;
    vec3 ambient = mix(nightAmbient, dayAmbient, uGlobalDayBlend);

    // Sunlight color temperature / warmth: shifts from cool Aegean crispness to golden hour warmth
    vec3 warmSunTint = mix(vec3(0.92, 0.98, 1.08), vec3(1.16, 0.97, 0.78), uDayWarmth);
    vec3 nightDirect = vec3(2.10, 2.45, 3.10) * uMoonlightIntensity;
    vec3 dayDirect = vec3(1.05, 1.00, 0.92) * warmSunTint * uDaySunIntensity;
    vec3 direct = mix(nightDirect, dayDirect, uGlobalDayBlend);

    // Natural Mediterranean terrain color grading with user-tunable landscape saturation:
    float luma = dot(baseColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 naturalLand = mix(vec3(luma), baseColor, uDaySaturation);
    vec3 terrainBase = mix(baseColor, naturalLand, uGlobalDayBlend);

    vec3 terrainLit = terrainBase * (ambient + direct * lightDiff);

    // Highlight ceiling safety limiter: ensures mountain slopes never exceed comfortable viewing luminance
    float litLuma = dot(terrainLit, vec3(0.299, 0.587, 0.114));
    float maxLitLuma = mix(0.42, 0.88, uGlobalDayBlend);
    if (litLuma > maxLitLuma) {
      float compLitLuma = maxLitLuma + (1.0 - exp(-(litLuma - maxLitLuma) * 3.0)) * 0.08;
      terrainLit *= (compLitLuma / litLuma);
    }

    // Gentle, soft amber harbor and city lights (dim, delicate nocturnal embers)
    float cityAlpha = lightsColor.a;
    float nightLightMult = (1.0 - uGlobalDayBlend * 0.96);
    float glowLevel = (cityAlpha * 0.45 + pow(cityAlpha, 2.2) * 0.25) * nightLightMult * uCityGlow;
    vec3 cityGlow = lightsColor.rgb * glowLevel;
    vec3 landResult = terrainLit + cityGlow;

    // Smooth anti-aliased ocean transition: 1.0 = deep sea, 0.0 = solid land
    float oceanFactor = 1.0 - smoothstep(0.15, 0.85, isLand);

    if (oceanFactor > 0.01) {
      vec3 waveNorm = getWaterNormal(vUv, uTime);
      vec3 viewDir = normalize(uCameraPos - vWorldPosition);
      vec3 halfVec = normalize(lightDir + viewDir);

      // Physical Fresnel reflection: grazing angles mirror atmospheric sky light
      float NdotV = clamp(dot(waveNorm, viewDir), 0.0, 1.0);
      float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 4.0);

      // Authentic Mediterranean sea color palette:
      // Nocturnal sapphire abyss -> Daylight azure with coastal shelf teal
      vec3 deepSeaNight = vec3(0.018, 0.045, 0.115);
      vec3 deepSeaDay = vec3(0.018, 0.11, 0.25);
      vec3 shelfSeaDay = vec3(0.035, 0.22, 0.38) * mix(vec3(1.0), vec3(0.85, 1.15, 1.25), (uDaySeaBrilliance - 1.0) * 0.4) * uDaySeaBrilliance;

      vec3 deepSea = mix(deepSeaNight, deepSeaDay, uGlobalDayBlend);
      vec3 shelfSea = mix(vec3(0.028, 0.075, 0.17), shelfSeaDay, uGlobalDayBlend);
      vec3 seaWaterCol = mix(shelfSea, deepSea, clamp(seaDepth * 1.25, 0.0, 1.0));

      // Atmospheric sky reflection for natural water sheen and horizon blend
      vec3 skyReflectNight = vec3(0.08, 0.14, 0.28);
      vec3 skyReflectDay = vec3(0.38, 0.58, 0.82);
      vec3 skyReflect = mix(skyReflectNight, skyReflectDay, uGlobalDayBlend);

      // Shimmering full moon & sun specular glint path across waves
      float specPower = mix(32.0, 110.0, uGlobalDayBlend);
      float spec = pow(max(0.0, dot(waveNorm, halfVec)), specPower);
      vec3 waterGlint = direct * spec * mix(1.45 * uMoonGlint, 0.85 * uDaySeaBrilliance, uGlobalDayBlend);

      // Full ocean result combining deep liquid body, sky reflection, and sun/moon glint
      vec3 seaResult = mix(seaWaterCol, skyReflect, fresnel * 0.60) + waterGlint;

      // Blend gracefully into land at coastlines
      landResult = mix(landResult, seaResult, oceanFactor * 0.94);
    }

    gl_FragColor = vec4(landResult, 1.0);
  }
`;

export class AegeanTerrain {
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;
  public planeWidth = 70;
  public planeHeight = 78.65;

  private minLon = 22.5;
  private maxLon = 29.5;
  private minLat = 34.8;
  private maxLat = 41.0;

  private heightData: Uint8ClampedArray | null = null;
  private heightmapWidth = 0;
  private heightmapHeight = 0;

  constructor(
    private scene: THREE.Scene,
    textures: {
      night: THREE.Texture;
      day: THREE.Texture;
      lights: THREE.Texture;
      heightmap: THREE.Texture;
      normals: THREE.Texture;
      mask: THREE.Texture;
    },
    moonLight: THREE.DirectionalLight
  ) {
    const geometry = new THREE.PlaneGeometry(this.planeWidth, this.planeHeight, 896, 896);
    geometry.rotateX(-Math.PI / 2);

    // Cache heightmap elevation data in memory to precisely ground 3D port pins on terrain
    if (textures.heightmap && textures.heightmap.image) {
      const img = textures.heightmap.image as HTMLImageElement;
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width || 1024;
        const h = img.naturalHeight || img.height || 1024;
        canvas.width = Math.min(1024, w);
        canvas.height = Math.min(1024, h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          this.heightData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          this.heightmapWidth = canvas.width;
          this.heightmapHeight = canvas.height;
        }
      } catch (e) {
        console.warn('Could not extract heightmap elevation data:', e);
      }
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uHeightmap: { value: textures.heightmap },
        uNormalTex: { value: textures.normals },
        uNightTex: { value: textures.night },
        uDayTex: { value: textures.day },
        uLightsTex: { value: textures.lights },
        uMaskTex: { value: textures.mask },
        uViewMode: { value: 0 },
        uDisplacementScale: { value: 1.00 }, // User configured natural 3D mountain relief
        uGlobalDayBlend: { value: 0.0 },
        uMoonDir: { value: new THREE.Vector3().copy(moonLight.position).normalize() },
        uMoonColor: { value: new THREE.Color(0xb5d5fc) },
        uAmbientColor: { value: new THREE.Color(0x3e527a) },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0.0 },
        uDEMGreenLimit: { value: 0.020 },
        uDEMBrownStart: { value: 0.065 },
        uDEMBrownPeak:  { value: 0.380 },
        uDEMWhiteStart: { value: 0.780 },
        uMoonlightIntensity: { value: 0.55 },
        uNightAmbient: { value: 0.40 },
        uCityGlow: { value: 0.20 },
        uMoonGlint: { value: 0.40 },
        uDaySunIntensity: { value: 0.20 },
        uDayAmbient: { value: 1.80 },
        uDayWarmth: { value: 0.36 },
        uDaySaturation: { value: 0.50 },
        uDaySeaBrilliance: { value: 0.60 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  public update(time: number, camera: THREE.Camera) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPos.value.copy(camera.position);
  }

  public displacementScale = 1.00;

  public setDisplacementScale(scale: number) {
    this.displacementScale = scale;
    this.material.uniforms.uDisplacementScale.value = scale;
  }

  public setDEMParams(greenLimit: number, brownStart: number, brownPeak: number, whiteStart: number) {
    this.material.uniforms.uDEMGreenLimit.value = greenLimit;
    this.material.uniforms.uDEMBrownStart.value = brownStart;
    this.material.uniforms.uDEMBrownPeak.value = brownPeak;
    this.material.uniforms.uDEMWhiteStart.value = whiteStart;
  }

  public getDEMParams() {
    return {
      greenLimit: this.material.uniforms.uDEMGreenLimit.value as number,
      brownStart: this.material.uniforms.uDEMBrownStart.value as number,
      brownPeak: this.material.uniforms.uDEMBrownPeak.value as number,
      whiteStart: this.material.uniforms.uDEMWhiteStart.value as number,
      displacementScale: this.material.uniforms.uDisplacementScale.value as number,
    };
  }

  public setNightLightingParams(moonlight: number, ambient: number, cityGlow: number, moonGlint: number) {
    this.material.uniforms.uMoonlightIntensity.value = moonlight;
    this.material.uniforms.uNightAmbient.value = ambient;
    this.material.uniforms.uCityGlow.value = cityGlow;
    this.material.uniforms.uMoonGlint.value = moonGlint;
  }

  public getNightLightingParams() {
    return {
      moonlight: this.material.uniforms.uMoonlightIntensity.value as number,
      ambient: this.material.uniforms.uNightAmbient.value as number,
      cityGlow: this.material.uniforms.uCityGlow.value as number,
      moonGlint: this.material.uniforms.uMoonGlint.value as number,
    };
  }

  public setDayLightParams(sunIntensity: number, ambient: number, warmth: number, saturation: number, seaBrilliance: number) {
    this.material.uniforms.uDaySunIntensity.value = sunIntensity;
    this.material.uniforms.uDayAmbient.value = ambient;
    this.material.uniforms.uDayWarmth.value = warmth;
    this.material.uniforms.uDaySaturation.value = saturation;
    this.material.uniforms.uDaySeaBrilliance.value = seaBrilliance;
  }

  public getDayLightParams() {
    return {
      sunIntensity: this.material.uniforms.uDaySunIntensity.value as number,
      ambient: this.material.uniforms.uDayAmbient.value as number,
      warmth: this.material.uniforms.uDayWarmth.value as number,
      saturation: this.material.uniforms.uDaySaturation.value as number,
      seaBrilliance: this.material.uniforms.uDaySeaBrilliance.value as number,
    };
  }

  public setDayBlend(blend: number) {
    this.material.uniforms.uGlobalDayBlend.value = Math.max(0, Math.min(1, blend));
  }

  public setViewMode(mode: number) {
    this.material.uniforms.uViewMode.value = mode;
    if (mode === 1) {
      this.material.uniforms.uGlobalDayBlend.value = 1.0;
    } else if (mode === 0) {
      this.material.uniforms.uGlobalDayBlend.value = 0.0;
    }
  }

  public getElevationAt(lon: number, lat: number): number {
    if (!this.heightData || this.heightmapWidth === 0) return 0.01;
    const normX = Math.max(0, Math.min(1, (lon - this.minLon) / (this.maxLon - this.minLon)));
    const normY = Math.max(0, Math.min(1, (lat - this.minLat) / (this.maxLat - this.minLat)));
    const px = Math.floor(normX * (this.heightmapWidth - 1));
    const py = Math.floor((1.0 - normY) * (this.heightmapHeight - 1));
    const idx = (py * this.heightmapWidth + px) * 4;
    const r = this.heightData[idx]; // Land elevation [0..255]
    if (r === 0) return 0.01; // Water surface level
    const landElevation = r / 255.0;
    return landElevation * this.displacementScale;
  }

  public lonLatToWorld(lon: number, lat: number): THREE.Vector3 {
    const normX = (lon - this.minLon) / (this.maxLon - this.minLon);
    const normY = (lat - this.minLat) / (this.maxLat - this.minLat);
    const worldX = (normX - 0.5) * this.planeWidth;
    const worldZ = -(normY - 0.5) * this.planeHeight;
    const worldY = this.getElevationAt(lon, lat);
    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  public getPeakWorld(lon: number, lat: number, searchRadiusDeg: number = 0.045): THREE.Vector3 {
    if (!this.heightData || this.heightmapWidth === 0) {
      return this.lonLatToWorld(lon, lat);
    }
    let maxElev = -1;
    let bestLon = lon;
    let bestLat = lat;

    const step = 0.006;
    for (let dLon = -searchRadiusDeg; dLon <= searchRadiusDeg; dLon += step) {
      for (let dLat = -searchRadiusDeg; dLat <= searchRadiusDeg; dLat += step) {
        const curLon = lon + dLon;
        const curLat = lat + dLat;
        const elev = this.getElevationAt(curLon, curLat);
        if (elev > maxElev) {
          maxElev = elev;
          bestLon = curLon;
          bestLat = curLat;
        }
      }
    }

    return this.lonLatToWorld(bestLon, bestLat);
  }
}
