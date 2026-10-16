import * as THREE from 'three';

const seaVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Stable flat sea surface at zero elevation - no vertical bobbing through island topography
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormalVec = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const seaFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;

  uniform sampler2D uHeightmap;
  uniform vec3 uDeepSeaColor;
  uniform vec3 uShallowColor;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  uniform vec3 uCameraPos;
  uniform float uTime;

  // Multi-frequency organic ocean ripples
  vec3 getWaveNormal(vec2 uv, float t) {
    float w1 = sin(uv.x * 45.0 + t * 0.4 + sin(uv.y * 30.0));
    float w2 = cos(uv.y * 55.0 - t * 0.35 + cos(uv.x * 35.0));
    float w3 = sin((uv.x + uv.y) * 70.0 + t * 0.6);

    vec3 n = vec3((w1 + w3) * 0.035, 1.0, (w2 + w3) * 0.035);
    return normalize(n);
  }

  void main() {
    float h = texture2D(uHeightmap, vUv).r;
    float seaLevel = 0.3725;

    // NEVER draw water over island terrain
    if (h >= seaLevel) {
      discard;
    }

    // Bathymetry depth shading: deep Mediterranean navy to shallow shelf teal
    float depth = smoothstep(0.1, seaLevel, h);
    vec3 waterColor = mix(uDeepSeaColor, uShallowColor, depth * 0.5);

    // Dynamic wave ripples
    vec3 localNormal = getWaveNormal(vUv, uTime);
    vec3 waveNormal = normalize(vNormalVec + localNormal.xzy);

    // Fresnel reflection
    vec3 viewDir = normalize(uCameraPos - vWorldPosition);
    float NdotV = max(0.0, dot(viewDir, waveNormal));
    float fresnel = pow(1.0 - NdotV, 3.5);

    // Smooth moon specular reflection
    vec3 halfVec = normalize(uMoonDir + viewDir);
    float NdotH = max(0.0, dot(waveNormal, halfVec));
    float specular = pow(NdotH, 36.0) * 0.9;

    vec3 finalColor = waterColor + uMoonColor * specular;
    finalColor += vec3(0.08, 0.16, 0.28) * fresnel;

    // Subtle coastal surf along land borders
    float foam = smoothstep(seaLevel - 0.008, seaLevel, h) * 0.22;
    finalColor += vec3(0.75, 0.9, 1.0) * foam;

    gl_FragColor = vec4(finalColor, 0.96);
  }
`;

export class AegeanSea {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(
    private scene: THREE.Scene,
    width: number,
    height: number,
    heightmapTex: THREE.Texture,
    moonLight: THREE.DirectionalLight
  ) {
    const geometry = new THREE.PlaneGeometry(width, height, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: seaVertexShader,
      fragmentShader: seaFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uHeightmap: { value: heightmapTex },
        uDeepSeaColor: { value: new THREE.Color(0x030816) },
        uShallowColor: { value: new THREE.Color(0x0c304d) },
        uMoonDir: { value: new THREE.Vector3().copy(moonLight.position).normalize() },
        uMoonColor: { value: new THREE.Color(0xa5c4f2) },
        uCameraPos: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = 0.0; // Exact sea level
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);
  }

  public update(time: number, camera: THREE.Camera) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPos.value.copy(camera.position);
  }
}
