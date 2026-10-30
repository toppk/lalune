import * as THREE from 'three';
import { calculateMoon, MOON_RADIUS_KM, surfaceDirection, type MoonOptions, type MoonState, type Vec3 } from './core.js';
import { calculateSky } from './sky.js';

export interface MoonViewOptions extends MoonOptions {
  /** Self-hosted, zero-longitude-centered equirectangular color map. */
  textureUrl: string;
  /** Optional linear 8-bit LOLA uint height map; see ASSETS.md. */
  heightUrl?: string;
  /** Dark-side fill for visibility, 0–0.2. Artistic, not modeled earthshine. */
  darkSide?: number;
  /** Optional Sun-driven sky and approximate airlight; defaults to transparent. */
  sky?: boolean;
  /** Display-space RGB multiplier, #RRGGBB. Default white preserves the map. */
  tint?: string;
  /** Display-space brightness multiplier, finite and >= 0. Default 1. */
  brightness?: number;
  pixelRatio?: number;
}

// Three's SphereGeometry has north=+Y and east=-Z when map center u=.5
// represents longitude zero. This proper rotation preserves handedness.
const three = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);

/** A demand-rendered WebGL Moon, transparent by default. No global styles or overlays. */
export class MoonView {
  readonly canvas: HTMLCanvasElement;
  /** Rejects on asset load failure; callers should surface the error. */
  readonly ready: Promise<void>;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(1, 1, 0.1, 1000);
  private geometry = new THREE.SphereGeometry(1, 192, 96);
  private material: THREE.ShaderMaterial;
  private resizeObserver: ResizeObserver;
  private textures: THREE.Texture[] = [];
  private options: MoonViewOptions;
  private current: MoonState;
  private disposed = false;

  constructor(private container: HTMLElement, options: MoonViewOptions) {
    this.current = calculateMoon(options);
    this.options = { ...options };
    // Validate styling before allocating WebGL resources or changing the DOM.
    const fill = this.darkSide(options.darkSide ?? 0.015);
    const appearance = this.appearance(options.tint ?? '#ffffff', options.brightness ?? 1);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(options.pixelRatio ?? window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%';
    this.canvas.setAttribute('role', 'img');
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: null }, heightMap: { value: null },
        hasHeight: { value: false }, sun: { value: new THREE.Vector3() },
        darkSide: { value: fill },
        tint: { value: appearance.tint }, brightness: { value: appearance.brightness },
        styled: { value: appearance.styled },
        skyRadiance: { value: new THREE.Color(0) }, transmission: { value: 1 },
      },
      vertexShader: `varying vec2 texUv;
        varying vec3 localPosition;
        void main() { texUv = uv; localPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D colorMap;
        uniform sampler2D heightMap;
        uniform bool hasHeight;
        uniform vec3 sun;
        uniform float darkSide;
        uniform vec3 skyRadiance;
        uniform float transmission;
        uniform vec3 tint;
        uniform float brightness;
        uniform bool styled;
        varying vec2 texUv;
        varying vec3 localPosition;
        void main() {
          vec3 n = normalize(localPosition);
          if (hasHeight) {
            // NASA LOLA uint: h = pixel * 32767.5 - 10000 meters.
            // The constant offset vanishes in the gradient. The height map is
            // linear data, not sRGB. Meter/radian slope is divided by radius.
            vec2 stepUv = 1.0 / vec2(textureSize(heightMap, 0));
            float dx = texture2D(heightMap, texUv + vec2(stepUv.x, 0.)).r
                     - texture2D(heightMap, texUv - vec2(stepUv.x, 0.)).r;
            float dy = texture2D(heightMap, texUv + vec2(0., stepUv.y)).r
                     - texture2D(heightMap, texUv - vec2(0., stepUv.y)).r;
            vec3 east = normalize(vec3(n.z, 0., -n.x));
            vec3 north = normalize(cross(n, east));
            float cosLat = max(length(n.xz), 0.025);
            float eastSlope = dx * 32767.5 / (2. * stepUv.x * 6.283185307 * 1737400. * cosLat);
            float northSlope = dy * 32767.5 / (2. * stepUv.y * 3.141592654 * 1737400.);
            n = normalize(n - east * eastSlope - north * northSlope);
          }
          // Lambert diffuse is a display approximation, not a Hapke BRDF.
          // Scientific model reference: USGS ISIS photomet Lambert model,
          // linked in docs/SCIENCE.md reference 5. n·sun = cos(incidence).
          // No specular highlights: a polished material misrepresents regolith.
          float incidence = max(dot(n, sun), 0.);
          // Prevent relief normals lighting the back side of the global sphere.
          incidence *= smoothstep(-0.005, 0.005, dot(normalize(localPosition), sun));
          vec3 albedo = texture2D(colorMap, texUv).rgb;
          vec3 lunarRadiance = albedo * (incidence * (1. - darkSide) + darkSide);
          if (styled) {
            // Styling is a display-space multiplier (like CSS brightness),
            // not a change to the physical illumination. Apply only to the
            // Moon, then decode back to linear for foreground sky composition.
            // Three's IEC sRGB transfer functions are injected by WebGLProgram.
            vec3 displayMoon = sRGBTransferOETF(vec4(clamp(lunarRadiance, 0., 1.), 1.)).rgb;
            lunarRadiance = sRGBTransferEOTF(vec4(displayMoon * tint * brightness, 1.)).rgb;
          }
          // Approximate foreground airlight: the same sky radiance is added
          // in front of the disk, including its night side. A background alone
          // would leave an implausible dark cutout in a bright daytime sky.
          // This is an aesthetic composite, not a radiative-transfer solution.
          gl_FragColor = vec4(lunarRadiance * transmission + skyRadiance, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    container.append(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(container);
    const loader = new THREE.TextureLoader();
    const load = async (url: string, color: boolean) => {
      const texture = await loader.loadAsync(url);
      if (this.disposed) { texture.dispose(); return null; }
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.textures.push(texture);
      return texture;
    };
    this.ready = Promise.all([load(options.textureUrl, true), options.heightUrl ? load(options.heightUrl, false) : null])
      .then(([color, height]) => {
        if (this.disposed) return;
        this.material.uniforms.colorMap.value = color;
        this.material.uniforms.heightMap.value = height;
        this.material.uniforms.hasHeight.value = !!height;
        this.render();
      });
    this.render();
  }

  get state(): MoonState { return structuredClone(this.current); }

  /** Asset URLs are fixed per instance; date/location/orientation can be updated. */
  update(options: Partial<MoonOptions> & Pick<MoonViewOptions, 'darkSide' | 'sky' | 'tint' | 'brightness'>): MoonState {
    if (this.disposed) throw new Error('MoonView has been disposed');
    const next = { ...this.options, ...options };
    const state = calculateMoon(next);
    const fill = this.darkSide(next.darkSide ?? 0.015);
    const appearance = this.appearance(next.tint ?? '#ffffff', next.brightness ?? 1);
    this.options = next;
    this.current = state;
    this.material.uniforms.darkSide.value = fill;
    this.material.uniforms.tint.value.copy(appearance.tint);
    this.material.uniforms.brightness.value = appearance.brightness;
    this.material.uniforms.styled.value = appearance.styled;
    this.render();
    return this.state;
  }

  /** Surface annotation in CSS pixels. Hidden behind the limb or at night. */
  project(latitude: number, longitude: number): { x: number; y: number; visible: boolean; illuminated: boolean } {
    const p = three(surfaceDirection(latitude, longitude));
    const visible = p.dot(three(this.current.viewDirection)) > MOON_RADIUS_KM / this.current.distanceKm;
    const illuminated = p.dot(three(this.current.sunDirection)) > 0;
    p.project(this.camera);
    return { x: (p.x+1)*this.container.clientWidth/2, y: (1-p.y)*this.container.clientHeight/2, visible, illuminated };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.textures.forEach(t => t.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }

  private darkSide(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 0.2) throw new RangeError('darkSide must be between 0 and 0.2');
    return value;
  }

  private appearance(tint: string, brightness: number) {
    if (typeof tint !== 'string' || !/^#[0-9a-f]{6}$/i.test(tint)) throw new RangeError('Tint must be a #RRGGBB hex color');
    if (!Number.isFinite(brightness) || brightness < 0) throw new RangeError('Brightness must be finite and nonnegative');
    const color = parseInt(tint.slice(1), 16);
    return {
      tint: new THREE.Vector3((color >> 16)/255, ((color >> 8) & 255)/255, (color & 255)/255),
      brightness,
      styled: color !== 0xffffff || brightness !== 1,
    };
  }

  private render(): void {
    if (this.disposed) return;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const sky = calculateSky(this.current.sunAltitudeDeg);
    const skyColor = this.material.uniforms.skyRadiance.value as THREE.Color;
    if (this.options.sky) {
      skyColor.set(sky.color); // THREE.Color decodes the sRGB palette to linear.
      this.renderer.setClearColor(skyColor, 1);
      // Display choice: up to 45% attenuation. See docs/SCIENCE.md.
      this.material.uniforms.transmission.value = 1 - 0.45*sky.daylight;
    } else {
      skyColor.set(0);
      this.renderer.setClearColor(0, 0);
      this.material.uniforms.transmission.value = 1;
    }
    const distance = this.current.distanceKm / MOON_RADIUS_KM;
    this.camera.position.copy(three(this.current.viewDirection).multiplyScalar(distance));
    this.camera.up.copy(three(this.current.upDirection));
    this.camera.aspect = width/height;
    // Fit a Moon-sized object to 82% of the narrower dimension. The camera is
    // still at the real distance/radius ratio, preserving perspective/parallax.
    this.camera.fov = this.current.angularDiameterDeg / (0.82 * Math.min(1, width/height));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.material.uniforms.sun.value.copy(three(this.current.sunDirection));
    this.canvas.setAttribute('aria-label', `${this.current.phaseName}, ${(100*this.current.illuminatedFraction).toFixed(1)}% illuminated`);
    this.renderer.render(this.scene, this.camera);
  }
}
