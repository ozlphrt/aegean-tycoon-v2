import * as THREE from 'three';
import type { IslandData, IslandEconomyState } from '../data/types';
import { getProsperityRgb } from './prosperityPalette';

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
  uniform vec3 uDEMColCoast;
  uniform vec3 uDEMColValley;
  uniform vec3 uDEMColFoothill;
  uniform vec3 uDEMColSlope;
  uniform vec3 uDEMColRidge;
  uniform vec3 uDEMColSummit;
  uniform float uDEMSunRadiance;
  uniform float uDEMAmbientFill;
  uniform float uDEMSunWarmth;
  uniform float uDEMReliefStrength;
  uniform float uMoonlightIntensity;
  uniform float uNightAmbient;
  uniform float uCityGlow;
  uniform float uMoonGlint;
  uniform float uDaySunIntensity;
  uniform float uDayAmbient;
  uniform float uDayWarmth;
  uniform float uDaySaturation;
  uniform float uDaySeaBrilliance;
  uniform float uIslandLightRadius;
  uniform float uIslandLit[64];
  uniform vec2 uIslandPortUV[64];
  uniform int uWaveIslandId;
  uniform vec2 uWaveCenter;
  uniform float uWaveRadius;
  uniform float uWaveProgress;

  // Prosperity outline: RGB = color, A = alpha / intensity
  uniform vec4 uIslandOutline[64];
  uniform float uDistanceOutlineWeight;

  // Luminous cartographic shoreline outline reflecting island prosperity
  vec3 getIslandOutlineGlow(vec2 uv, float isLandVal, float time) {
    vec4 maskSample = texture2D(uMaskTex, uv);
    int landId = int(clamp(floor(maskSample.r * 255.0 + 0.5), 0.0, 63.0));
    int nearestId = int(clamp(floor(maskSample.g * 255.0 + 0.5), 0.0, 63.0));

    // Seaward component: smooth coastal halo extending into the sea (wider reach ~0.072)
    float seaDist = maskSample.b;
    float seaGlow = 0.0;
    if (seaDist < 0.072 && nearestId > 0) {
      float core = smoothstep(0.062, 0.0, seaDist);
      float halo = exp(-seaDist * 16.0);
      seaGlow = mix(core, halo, 0.45);
    }

    // Landward component: soft luminous contour inside the island perimeter (wider reach ~0.038)
    // STRICT RULE: Only recognized islands/ports (landId > 0) glow; unassigned mainland (Turkey, etc.) is strictly 0.0!
    float inlandDist = maskSample.a;
    float landGlow = 0.0;
    if (landId > 0 && inlandDist > 0.0005 && inlandDist < 0.038) {
      float core = smoothstep(0.036, 0.0, inlandDist);
      float halo = exp(-inlandDist * 22.0);
      landGlow = mix(core, halo, 0.40) * 0.82;
    }

    // Smooth bilateral coastline transition: eliminates harsh 1-pixel step at water's edge
    float shoreBlend = smoothstep(0.30, 0.70, isLandVal);
    float glow = mix(seaGlow, landGlow, shoreBlend);
    if (glow <= 0.001) return vec3(0.0);

    // Identify relevant island for color lookup
    int activeId = (shoreBlend > 0.5 && landId > 0) ? landId : (nearestId > 0 ? nearestId : landId);
    if (activeId <= 0) return vec3(0.0);

    vec4 outlineData = uIslandOutline[activeId];
    if (outlineData.a <= 0.001) return vec3(0.0);

    vec3 outlineColor = outlineData.rgb;
    float outlineAlpha = outlineData.a;

    // Organic living rhythm
    float pulse = 0.94 + 0.06 * sin(time * 2.2 + float(activeId) * 1.3);

    return outlineColor * (glow * outlineAlpha * pulse * uDistanceOutlineWeight);
  }

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
    // Deep Aegean bathymetry gradient: dark slate navy abyss to shelf grey-blue (deep, dark Mediterranean water)
    vec3 oceanCol = mix(vec3(0.007, 0.018, 0.042), vec3(0.022, 0.052, 0.096), depth);

    // Dynamic user-tunable color stops (Coast -> Valley -> Foothill -> Slope -> Ridge -> Summit):
    vec3 cGreenDark   = uDEMColCoast;
    vec3 cGreenRich   = uDEMColValley;
    vec3 cOliveKhaki  = uDEMColFoothill;
    vec3 cOchreTan    = mix(uDEMColFoothill, uDEMColSlope, 0.45);
    vec3 cSienna      = uDEMColSlope;
    vec3 cBrownDeep   = mix(uDEMColSlope, uDEMColRidge, 0.35);
    vec3 cLimestone   = uDEMColRidge;
    vec3 cPaleStone   = mix(uDEMColRidge, uDEMColSummit, 0.45);
    vec3 cAlpineWhite = uDEMColSummit;

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

      // Topographic hillshading with tunable sun radiance, sky ambient, and warmth
      vec3 demSunDir = normalize(vec3(0.65, 0.58, -0.48));
      float NdotL = dot(norm, demSunDir);
      float hillshade = smoothstep(-0.28, 0.88, NdotL);

      // Relief contrast shaping
      float relief = pow(hillshade, mix(0.70, 1.45, uDEMReliefStrength));

      // Sky ambient fill (soft blue-grey atmospheric tint)
      vec3 ambientSky = vec3(0.85, 0.90, 0.96) * uDEMAmbientFill;

      // Direct sun radiance with warm-to-cool sunlight temperature
      vec3 sunWarmTint = mix(vec3(0.92, 0.98, 1.06), vec3(1.18, 0.98, 0.76), uDEMSunWarmth);
      vec3 directSun = vec3(1.05, 1.00, 0.95) * sunWarmTint * (relief * uDEMSunRadiance);

      vec3 litDEM = demCol * (ambientSky + directSun);

      // Luminous prosperity outline along island shorelines
      litDEM += getIslandOutlineGlow(vUv, isLand, uTime);

      gl_FragColor = vec4(litDEM, 1.0);
      return;
    } else if (uViewMode == 3) {
      // 🗺️ Island Territory ID Mask
      float maskVal = floor(texture2D(uMaskTex, vUv).r * 255.0 + 0.5);
      vec3 maskCol = getMaskColor(maskVal);
      gl_FragColor = vec4(maskCol, 1.0);
      return;
    }

    // Effective daylight blend for this pixel:
    // Mode 1: Global Day layer forces 1.0 everywhere
    // Mode 0: Normal Simulation view blends per-island dynamically based on uIslandLit[islandId] and dawn wave
    float effectiveDayBlend = uGlobalDayBlend;
    vec3 frontierGlow = vec3(0.0);

    if (uViewMode == 0) {
      // Sample 4-channel Island Distance Field Texture:
      // Channel R: Discrete land territory maskId (1..63 on land, 0 on sea)
      // Channel G: Nearest island ID (1..63 propagated across land and sea)
      // Channel B: Normalized Euclidean distance from coast into the sea (0.0 at coast -> 1.0 at ~14 km out)
      // Channel A: Normalized distance inland (0.0 at coast -> 1.0 interior)
      vec4 maskSample = texture2D(uMaskTex, vUv);
      int landId = int(clamp(floor(maskSample.r * 255.0 + 0.5), 0.0, 63.0));
      int nearestId = int(clamp(floor(maskSample.g * 255.0 + 0.5), 0.0, 63.0));
      float seaDist = maskSample.b;

      int activeId = (landId > 0) ? landId : nearestId;
      float islandLit = (activeId > 0) ? uIslandLit[activeId] : 0.0;

      // Distance from this island's port / harbor center (Euclidean metric in UV space)
      vec2 portUV = uIslandPortUV[activeId];
      vec2 pNorm = vec2(vUv.x * 0.788, vUv.y);
      vec2 portNorm = vec2(portUV.x * 0.788, portUV.y);
      float distFromPort = distance(pNorm, portNorm);

      // Light reach configured by user tuner (default reach ~0.029 UV ≈ 21 km, illuminating harbor & surrounding territory)
      float maxReach = max(0.016, uIslandLightRadius * 0.065);
      float innerCore = maxReach * 0.25; // Full daylight core immediately around the harbor quays
      float distNorm = clamp((distFromPort - innerCore) / max(0.001, maxReach - innerCore), 0.0, 1.0);
      // Quintic smootherstep (C2 continuity: 6x^5 - 15x^4 + 10x^3) for seamless, silky photographic fade out
      float smoothPortFade = 1.0 - distNorm * distNorm * distNorm * (distNorm * (distNorm * 6.0 - 15.0) + 10.0);

      // Active radial wave of light when this island is undergoing dawn reveal
      if (activeId > 0 && activeId == uWaveIslandId && uWaveProgress > 0.0) {
        vec2 cNorm = vec2(uWaveCenter.x * 0.788, uWaveCenter.y);
        float d = distance(pNorm, cNorm);

        // Soft, cinematic feathering for daylight expansion up to maxReach
        float currentReach = min(uWaveRadius, maxReach);
        float feather = max(0.016, currentReach * 0.50);
        float edge0 = currentReach + feather * 0.65;
        float edge1 = max(0.0, currentReach - feather * 0.45);
        float waveFront = smoothstep(edge0, edge1, d);
        waveFront = waveFront * waveFront * waveFront * (waveFront * (waveFront * 6.0 - 15.0) + 10.0);
        islandLit = max(islandLit, waveFront);

        // Diffuse golden dawn halo along the advancing light frontier
        float haloWidth = feather * 0.90;
        float ringDist = abs(d - currentReach);
        if (ringDist < haloWidth && uWaveProgress < 0.98) {
          float normHalo = ringDist / haloWidth;
          // Smooth Hann bell curve (zero slope at center and zero slope at boundary)
          float ringIntensity = 0.5 * (1.0 + cos(normHalo * 3.14159265)) * sin(uWaveProgress * 3.14159265);
          frontierGlow = vec3(1.20, 0.92, 0.42) * ringIntensity * 1.5;
        }
      }

      if (islandLit > 0.0001) {
        if (landId > 0) {
          // Solid land territory: light radiates from port and smoothly fades out across the island into the night
          effectiveDayBlend = clamp(islandLit * smoothPortFade, 0.0, 1.0);
        } else {
          // Coastal sea: radiant daylight smoothly attenuates with both harbor distance and coastal distance
          float normDist = clamp(seaDist / max(0.01, uIslandLightRadius), 0.0, 1.0);
          float seaFalloff = smoothstep(1.0, 0.0, normDist);
          // Smootherstep for continuous transition into open water without abrupt cutoff
          float seaSmooth = seaFalloff * seaFalloff * (3.0 - 2.0 * seaFalloff);
          float seaLight = pow(seaSmooth, 1.5);
          effectiveDayBlend = clamp(islandLit * smoothPortFade * seaLight, 0.0, 1.0);
        }
      }
    }

    // Moonlit night enhancement: balanced silver-blue Mediterranean full moon (no blue over-amplification)
    vec3 nightEnhanced = nightColor.rgb * vec3(1.85, 2.05, 2.25);
    // Daylight enhancement: sunny, radiant Mediterranean base
    vec3 dayEnhanced = dayColor.rgb * vec3(1.12, 1.12, 1.10);
    vec3 baseColor = mix(nightEnhanced, dayEnhanced, effectiveDayBlend);

    // Dynamic light direction:
    // Moon at night -> Angled Radiant Mediterranean Morning Sun (~45 deg from Southeast)
    vec3 nightLightDir = uMoonDir;
    vec3 daySunDir = normalize(vec3(0.65, 0.58, -0.48));
    vec3 lightDir = normalize(mix(nightLightDir, daySunDir, effectiveDayBlend));

    // Dynamic topographic gradient hillshading (both Full Moon and Daylight):
    // Full moon casts distinct silver illumination on sunward ridges and soft lunar shade on backslopes
    float NdotL = dot(norm, lightDir);
    float nightShade = smoothstep(-0.20, 0.85, NdotL);
    float nightDiff = mix(max(0.40, NdotL), mix(0.35, 1.45, nightShade), 0.70);

    float dayShade = smoothstep(-0.25, 0.90, NdotL);
    float dayDiff = mix(0.25, 1.35, dayShade);
    float lightDiff = mix(nightDiff, dayDiff, effectiveDayBlend);

    // Dynamic ambient & direct lighting calibrated for luminous full moon and radiant sun
    vec3 nightAmbient = vec3(1.15, 1.38, 1.75) * uNightAmbient;
    vec3 dayAmbient = vec3(0.82, 0.88, 0.94) * uDayAmbient;
    vec3 ambient = mix(nightAmbient, dayAmbient, effectiveDayBlend);

    // Sunlight color temperature / warmth: shifts from cool Aegean crispness to golden hour warmth
    vec3 warmSunTint = mix(vec3(0.92, 0.98, 1.08), vec3(1.16, 0.97, 0.78), uDayWarmth);
    vec3 nightDirect = vec3(2.10, 2.45, 3.10) * uMoonlightIntensity;
    vec3 dayDirect = vec3(1.05, 1.00, 0.92) * warmSunTint * uDaySunIntensity;
    vec3 direct = mix(nightDirect, dayDirect, effectiveDayBlend);

    // Natural Mediterranean terrain color grading with user-tunable landscape saturation:
    float luma = dot(baseColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 naturalLand = mix(vec3(luma), baseColor, uDaySaturation);
    vec3 terrainBase = mix(baseColor, naturalLand, effectiveDayBlend);

    vec3 terrainLit = terrainBase * (ambient + direct * lightDiff);

    // Highlight ceiling safety limiter: ensures mountain slopes never exceed comfortable viewing luminance
    float litLuma = dot(terrainLit, vec3(0.299, 0.587, 0.114));
    float maxLitLuma = mix(0.42, 0.88, effectiveDayBlend);
    if (litLuma > maxLitLuma) {
      float compLitLuma = maxLitLuma + (1.0 - exp(-(litLuma - maxLitLuma) * 3.0)) * 0.08;
      terrainLit *= (compLitLuma / litLuma);
    }

    // Gentle, soft amber harbor and city lights (dim, delicate nocturnal embers)
    float cityAlpha = lightsColor.a;
    float nightLightMult = (1.0 - effectiveDayBlend * 0.96);
    float glowLevel = (cityAlpha * 0.45 + pow(cityAlpha, 2.2) * 0.25) * nightLightMult * uCityGlow;
    vec3 cityGlow = lightsColor.rgb * glowLevel;
    vec3 landResult = terrainLit + cityGlow + frontierGlow;

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
      // Nocturnal sapphire abyss -> Daylight azure with coastal shelf teal (deep, rich dark sea)
      vec3 deepSeaNight = vec3(0.008, 0.022, 0.060);
      vec3 deepSeaDay = vec3(0.010, 0.062, 0.155);
      vec3 shelfSeaDay = vec3(0.020, 0.135, 0.240) * mix(vec3(1.0), vec3(0.85, 1.15, 1.25), (uDaySeaBrilliance - 1.0) * 0.4) * uDaySeaBrilliance;

      vec3 deepSea = mix(deepSeaNight, deepSeaDay, effectiveDayBlend);
      vec3 shelfSea = mix(vec3(0.014, 0.040, 0.095), shelfSeaDay, effectiveDayBlend);
      vec3 seaWaterCol = mix(shelfSea, deepSea, clamp(seaDepth * 1.25, 0.0, 1.0));

      // Atmospheric sky reflection for natural water sheen and horizon blend
      vec3 skyReflectNight = vec3(0.04, 0.08, 0.16);
      vec3 skyReflectDay = vec3(0.22, 0.38, 0.58);
      vec3 skyReflect = mix(skyReflectNight, skyReflectDay, effectiveDayBlend);

      // Shimmering full moon & sun specular glint path across waves
      float specPower = mix(32.0, 110.0, effectiveDayBlend);
      float spec = pow(max(0.0, dot(waveNorm, halfVec)), specPower);
      vec3 waterGlint = direct * spec * mix(1.45 * uMoonGlint, 0.85 * uDaySeaBrilliance, effectiveDayBlend);

      // Full ocean result combining deep liquid body, sky reflection, and sun/moon glint
      vec3 seaResult = mix(seaWaterCol, skyReflect, fresnel * 0.60) + waterGlint;

      // Blend gracefully into land at coastlines
      landResult = mix(landResult, seaResult, oceanFactor * 0.94);
    }

    // Luminous prosperity outline along island shorelines
    landResult += getIslandOutlineGlow(vUv, isLand, uTime);

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

  public islandLitArray: Float32Array = new Float32Array(64);
  private waveAnim: {
    islandId: number;
    center: THREE.Vector2;
    startTime: number;
    duration: number;
    maxRadius: number;
    onComplete?: () => void;
  } | null = null;
  private fadeAnims: Map<number, {
    startVal: number;
    targetVal: number;
    startTime: number;
    duration: number;
    onComplete?: () => void;
  }> = new Map();

  private islandPortUV: THREE.Vector2[] = Array.from({ length: 64 }, () => new THREE.Vector2(0.5, 0.5));
  private islandOutline: THREE.Vector4[] = Array.from({ length: 64 }, () => new THREE.Vector4(0.38, 0.32, 0.22, 0.28));
  private islandsList: IslandData[] = [];
  private selectedIslandId: string | null = null;
  private lastEconomies: Record<string, IslandEconomyState> | Map<string, IslandEconomyState> | null = null;

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

    // Santorini starts in daylight; Naxos awakens upon first maritime delivery
    this.islandLitArray[1] = 1.0;
    this.islandLitArray[2] = 0.0;

    // Pre-initialize starting trade hub ports
    // Santorini port: lat 36.386, lon 25.431 -> UV (0.49014, 0.26943)
    this.islandPortUV[1].set(0.49014, 0.26943);
    // Naxos port: lat 37.105, lon 25.373 -> UV (0.48186, 0.37214)
    this.islandPortUV[2].set(0.48186, 0.37214);

    // Asynchronously preload all island port UV coordinates from islands.json
    fetch('/data/islands.json')
      .then((res) => res.json())
      .then((islands: IslandData[]) => {
        this.setPortLocations(islands);
      })
      .catch((err) => console.warn('Could not preload island port UVs:', err));

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
        uViewMode: { value: 2 }, // Default view mode: 2 = DEM Topography
        uDisplacementScale: { value: 0.85 }, // User configured natural 3D mountain relief
        uGlobalDayBlend: { value: 0.0 },
        uMoonDir: { value: new THREE.Vector3().copy(moonLight.position).normalize() },
        uMoonColor: { value: new THREE.Color(0xb5d5fc) },
        uAmbientColor: { value: new THREE.Color(0x3e527a) },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0.0 },
        uDEMGreenLimit: { value: 0.015 },
        uDEMBrownStart: { value: 0.075 },
        uDEMBrownPeak:  { value: 0.500 },
        uDEMWhiteStart: { value: 0.700 },
        uDEMColCoast:    { value: new THREE.Color(0x1e433d) },
        uDEMColValley:   { value: new THREE.Color(0x35512f) },
        uDEMColFoothill: { value: new THREE.Color(0x535a30) },
        uDEMColSlope:    { value: new THREE.Color(0x8a7d6a) },
        uDEMColRidge:    { value: new THREE.Color(0xb7874e) },
        uDEMColSummit:   { value: new THREE.Color(0xefeff5) },
        uDEMSunRadiance:   { value: 2.05 },
        uDEMAmbientFill:   { value: 0.60 },
        uDEMSunWarmth:     { value: 0.00 },
        uDEMReliefStrength:{ value: 1.50 },
        uMoonlightIntensity: { value: 0.55 },
        uNightAmbient: { value: 0.40 },
        uCityGlow: { value: 0.20 },
        uMoonGlint: { value: 0.40 },
        uDaySunIntensity: { value: 0.20 },
        uDayAmbient: { value: 1.80 },
        uDayWarmth: { value: 0.36 },
        uDaySaturation: { value: 0.50 },
        uDaySeaBrilliance: { value: 0.60 },
        uIslandLightRadius: { value: 0.45 },
        uIslandLit: { value: this.islandLitArray },
        uIslandPortUV: { value: this.islandPortUV },
        uIslandOutline: { value: this.islandOutline },
        uDistanceOutlineWeight: { value: 1.0 },
        uWaveIslandId: { value: 0 },
        uWaveCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uWaveRadius: { value: 0.0 },
        uWaveProgress: { value: 0.0 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  public update(time: number, camera: THREE.Camera) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPos.value.copy(camera.position);

    // Distance-based outline weight:
    // Boost outline radiance at distant overview (camY >= 35) to pop out vividly,
    // settling gracefully when zoomed close to an island (camY <= 15).
    const camY = camera.position.y;
    const distWeight = THREE.MathUtils.lerp(0.75, 1.30, THREE.MathUtils.clamp((camY - 14) / 20, 0, 1));
    this.material.uniforms.uDistanceOutlineWeight.value = distWeight;

    const now = performance.now();

    // 1. Advance active radial dawn wave animation
    if (this.waveAnim) {
      const elapsed = now - this.waveAnim.startTime;
      const progress = Math.min(1.0, elapsed / this.waveAnim.duration);
      // Smooth cubic ease-out
      const ease = 1.0 - Math.pow(1.0 - progress, 3.0);

      this.material.uniforms.uWaveProgress.value = progress;
      this.material.uniforms.uWaveRadius.value = ease * this.waveAnim.maxRadius;

      if (progress >= 1.0) {
        this.islandLitArray[this.waveAnim.islandId] = 1.0;
        this.material.uniforms.uWaveIslandId.value = 0;
        this.material.uniforms.uWaveProgress.value = 0.0;
        this.material.uniforms.uWaveRadius.value = 0.0;
        const cb = this.waveAnim.onComplete;
        this.waveAnim = null;
        this.recomputeOutlines();
        cb?.();
      }
    }

    // 2. Advance active sleep fade animations
    if (this.fadeAnims.size > 0) {
      for (const [id, anim] of this.fadeAnims.entries()) {
        const elapsed = now - anim.startTime;
        const p = Math.min(1.0, elapsed / anim.duration);
        const val = THREE.MathUtils.lerp(anim.startVal, anim.targetVal, p);
        this.islandLitArray[id] = val;
        if (p >= 1.0) {
          this.islandLitArray[id] = anim.targetVal;
          this.fadeAnims.delete(id);
          this.recomputeOutlines();
          anim.onComplete?.();
        }
      }
    }
  }

  public setSelectedIsland(islandId: string | null): void {
    this.selectedIslandId = islandId;
    this.recomputeOutlines();
  }

  public updateIslandEconomies(
    economies: Record<string, IslandEconomyState> | Map<string, IslandEconomyState>,
    islands?: IslandData[],
    selectedIslandId?: string | null
  ): void {
    this.lastEconomies = economies;
    if (islands && islands.length > 0) {
      this.islandsList = islands;
    }
    if (selectedIslandId !== undefined) {
      this.selectedIslandId = selectedIslandId;
    }
    this.recomputeOutlines();
  }

  /**
   * Recomputes per-island coastline outline color and alpha reflecting prosperity and selection.
   */
  public recomputeOutlines(): void {
    if (!this.islandsList || this.islandsList.length === 0) return;

    for (const isl of this.islandsList) {
      const maskId = isl.maskId;
      if (!maskId || maskId <= 0 || maskId >= 64) continue;

      const isSelected = this.selectedIslandId === isl.id;
      const isLit = this.islandLitArray[maskId] > 0.5;

      if (!isLit) {
        // Subtle warm bronze for sleeping/unconnected islands
        this.islandOutline[maskId].set(0.38, 0.32, 0.22, isSelected ? 0.45 : 0.28);
      } else {
        // Lit connected island: Continuous Prosperity Color Palette (0% #D32F2F -> 100% #249B56)
        const eco = this.lastEconomies instanceof Map
          ? this.lastEconomies.get(isl.id)
          : (this.lastEconomies as any)?.[isl.id];

        if (eco) {
          const p = Math.max(0, Math.min(1, eco.prosperity));
          const col = getProsperityRgb(p);
          this.islandOutline[maskId].set(col.r, col.g, col.b, isSelected ? 1.0 : 0.95);
        } else {
          // Default connected: neutral mid-prosperity (50% #FFD23F)
          const midCol = getProsperityRgb(0.5);
          this.islandOutline[maskId].set(midCol.r, midCol.g, midCol.b, isSelected ? 1.0 : 0.95);
        }
      }
    }
  }

  public lonLatToUV(lon: number, lat: number): { u: number; v: number } {
    const u = Math.max(0, Math.min(1, (lon - this.minLon) / (this.maxLon - this.minLon)));
    const v = Math.max(0, Math.min(1, (lat - this.minLat) / (this.maxLat - this.minLat)));
    return { u, v };
  }

  public setPortLocations(
    islands: Array<{ maskId: number; port?: { lon: number; lat: number }; lon: number; lat: number } & Partial<IslandData>>
  ) {
    this.islandsList = islands as IslandData[];
    for (const isl of islands) {
      if (isl.maskId >= 1 && isl.maskId <= 63) {
        const pLon = isl.port?.lon ?? isl.lon;
        const pLat = isl.port?.lat ?? isl.lat;
        const uv = this.lonLatToUV(pLon, pLat);
        this.islandPortUV[isl.maskId].set(uv.u, uv.v);
      }
    }
    this.recomputeOutlines();
  }

  public awakenIsland(
    islandId: number,
    portLon?: number,
    portLat?: number,
    durationMs: number = 2800,
    onComplete?: () => void
  ) {
    if (islandId < 1 || islandId > 63) return;

    this.fadeAnims.delete(islandId);

    let centerUV: { u: number; v: number };
    if (portLon !== undefined && portLat !== undefined) {
      centerUV = this.lonLatToUV(portLon, portLat);
    } else {
      centerUV = { u: this.islandPortUV[islandId].x, v: this.islandPortUV[islandId].y };
    }

    // Dynamic wave radius blooming smoothly up to harbor daylight reach
    let maxRadius = 0.055;
    if (islandId === 7) {
      maxRadius = 0.085; // Crete spans entire southern border
    } else if (islandId === 8 || islandId === 9 || islandId === 10) {
      maxRadius = 0.065; // Rhodes, Lesbos, Chios
    } else if (islandId >= 11 && islandId <= 15) {
      maxRadius = 0.060; // Samos, Lemnos, Corfu, etc.
    }

    this.material.uniforms.uWaveIslandId.value = islandId;
    this.material.uniforms.uWaveCenter.value.set(centerUV.u, centerUV.v);
    this.material.uniforms.uWaveRadius.value = 0.0;
    this.material.uniforms.uWaveProgress.value = 0.001;

    this.waveAnim = {
      islandId,
      center: new THREE.Vector2(centerUV.u, centerUV.v),
      startTime: performance.now(),
      duration: durationMs,
      maxRadius,
      onComplete,
    };
  }

  public sleepIsland(islandId: number, durationMs: number = 1400, onComplete?: () => void) {
    if (islandId < 1 || islandId > 63) return;

    if (this.waveAnim && this.waveAnim.islandId === islandId) {
      this.waveAnim = null;
      this.material.uniforms.uWaveIslandId.value = 0;
      this.material.uniforms.uWaveProgress.value = 0.0;
      this.material.uniforms.uWaveRadius.value = 0.0;
    }

    const currentVal = this.islandLitArray[islandId];
    if (currentVal <= 0.001) {
      this.islandLitArray[islandId] = 0.0;
      onComplete?.();
      return;
    }

    this.fadeAnims.set(islandId, {
      startVal: currentVal,
      targetVal: 0.0,
      startTime: performance.now(),
      duration: durationMs,
      onComplete,
    });
  }

  public getIslandLit(islandId: number): number {
    if (islandId < 1 || islandId > 63) return 0.0;
    return this.islandLitArray[islandId] || 0.0;
  }

  public setIslandLit(islandId: number, lit: number) {
    if (islandId < 1 || islandId > 63) return;
    this.islandLitArray[islandId] = Math.max(0, Math.min(1, lit));
    this.recomputeOutlines();
  }

  public toggleIslandLit(
    islandId: number,
    portLon?: number,
    portLat?: number,
    onComplete?: (isLit: boolean) => void
  ) {
    if (this.getIslandLit(islandId) > 0.5) {
      this.sleepIsland(islandId, 1400, () => onComplete?.(false));
    } else {
      this.awakenIsland(islandId, portLon, portLat, 2800, () => onComplete?.(true));
    }
  }

  public displacementScale = 0.85;

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

  public getDEMColors() {
    return {
      coast: '#' + (this.material.uniforms.uDEMColCoast.value as THREE.Color).getHexString(),
      valley: '#' + (this.material.uniforms.uDEMColValley.value as THREE.Color).getHexString(),
      foothill: '#' + (this.material.uniforms.uDEMColFoothill.value as THREE.Color).getHexString(),
      slope: '#' + (this.material.uniforms.uDEMColSlope.value as THREE.Color).getHexString(),
      ridge: '#' + (this.material.uniforms.uDEMColRidge.value as THREE.Color).getHexString(),
      summit: '#' + (this.material.uniforms.uDEMColSummit.value as THREE.Color).getHexString(),
    };
  }

  public setDEMLightParams(sunRadiance: number, ambientFill: number, warmth: number, reliefStrength: number) {
    this.material.uniforms.uDEMSunRadiance.value = sunRadiance;
    this.material.uniforms.uDEMAmbientFill.value = ambientFill;
    this.material.uniforms.uDEMSunWarmth.value = warmth;
    this.material.uniforms.uDEMReliefStrength.value = reliefStrength;
  }

  public getDEMLightParams() {
    return {
      sunRadiance: this.material.uniforms.uDEMSunRadiance.value as number,
      ambientFill: this.material.uniforms.uDEMAmbientFill.value as number,
      sunWarmth: this.material.uniforms.uDEMSunWarmth.value as number,
      reliefStrength: this.material.uniforms.uDEMReliefStrength.value as number,
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

  public setIslandLightRadius(radius: number) {
    this.material.uniforms.uIslandLightRadius.value = Math.max(0.05, Math.min(2.0, radius));
  }

  public getIslandLightRadius(): number {
    return this.material.uniforms.uIslandLightRadius.value as number;
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
