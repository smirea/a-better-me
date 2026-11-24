import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type SettingId =
  | "studio-dark"
  | "studio-light"
  | "gym-floor"
  | "turf-arena"
  | "warm-loft"
  | "transparent";

export interface SettingMeta {
  id: SettingId;
  label: string;
  lightUi?: boolean;
}

export const SETTINGS: readonly SettingMeta[] = [
  { id: "studio-dark", label: "Studio Dark" },
  { id: "studio-light", label: "Clean White", lightUi: true },
  { id: "gym-floor", label: "Gym Floor" },
  { id: "turf-arena", label: "Turf Arena" },
  { id: "warm-loft", label: "Warm Loft", lightUi: true },
  { id: "transparent", label: "Transparent" },
] as const;

function makeRubberTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1c1e22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = (i * 73) % 256;
    const y = (i * 151) % 256;
    const bright = i % 11 === 0 ? "#4a5364" : i % 5 === 0 ? "#2a2e36" : "#14161a";
    ctx.fillStyle = bright;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function makeTurfTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1f2e24";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const x = (i * 97) % 256;
    const y = (i * 193) % 256;
    ctx.fillStyle = i % 3 === 0 ? "#293d30" : "#18241c";
    ctx.fillRect(x, y, 2, 3);
  }
  ctx.fillStyle = "rgba(235, 240, 232, 0.25)";
  ctx.fillRect(0, 124, 256, 6);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

function makeWoodTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#b89670";
  ctx.fillRect(0, 0, 256, 256);
  const planks = 6;
  const h = 256 / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#be9c76" : "#af8c66";
    ctx.fillRect(0, i * h, 256, h - 1);
    ctx.fillStyle = "rgba(80,55,30,0.22)";
    ctx.fillRect(0, (i + 1) * h - 1, 256, 1);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

/**
 * Self-contained swappable environment/stage manager.
 * Exercises live purely at local y = 0; switching settings swaps floor, backdrop, walls, fog,
 * and lighting without ever touching or recomputing the exercise animation.
 */
export class StageEnvironment {
  readonly group = new Group();
  private readonly lights = new Group();
  readonly undersideLight: DirectionalLight;
  private currentId: SettingId = "studio-dark";
  private hiddenForUnderside = false;
  private envApplied = false;

  constructor(
    private readonly scene: Scene,
    private readonly renderer: WebGLRenderer,
  ) {
    this.undersideLight = new DirectionalLight("#ffffff", 1.5);
    this.undersideLight.position.set(-2, -4, 1.5);
    this.undersideLight.visible = false;
    this.scene.add(this.group, this.lights, this.undersideLight);
    this.ensureEnvironment();
    this.apply("studio-dark");
  }

  private ensureEnvironment() {
    if (this.envApplied) return;
    this.envApplied = true;
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
  }

  get id(): SettingId {
    return this.currentId;
  }

  setUnderside(enabled: boolean) {
    this.hiddenForUnderside = enabled;
    this.group.visible = !enabled;
    this.undersideLight.visible = enabled;
  }

  apply(id: SettingId) {
    this.currentId = id;
    this.group.clear();
    this.lights.clear();
    this.scene.fog = null;
    this.renderer.setClearAlpha(id === "transparent" ? 0 : 1);

    const addLight = (hemiSky: string, hemiGnd: string, hemiInt: number, keyInt: number, rimColor: string, rimInt: number) => {
      this.lights.add(new HemisphereLight(hemiSky, hemiGnd, hemiInt), new AmbientLight("#ffffff", 0.25));
      const key = new DirectionalLight("#ffffff", keyInt);
      key.position.set(-2.6, 4.4, 3.6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 14;
      const d = 2.6;
      key.shadow.camera.left = -d;
      key.shadow.camera.right = d;
      key.shadow.camera.top = d;
      key.shadow.camera.bottom = -d;
      key.shadow.bias = -0.0005;
      const rim = new DirectionalLight(rimColor, rimInt);
      rim.position.set(3, 2.6, -3.5);
      this.lights.add(key, rim);
    };

    if (id === "studio-dark") {
      this.scene.background = new Color("#151414");
      this.scene.environmentIntensity = 0.4;
      addLight("#ffffff", "#2a2622", 1.4, 2.0, "#9db8ff", 1.15);
      const floor = new Mesh(
        new CircleGeometry(3.4, 64),
        new MeshStandardMaterial({ color: "#1c1b1b", roughness: 0.96, metalness: 0.04 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      const grid = new GridHelper(6, 12, "#2b2929", "#242222");
      grid.position.y = -0.001;
      this.group.add(floor, grid);
    } else if (id === "studio-light") {
      this.scene.background = new Color("#f3f4f6");
      this.scene.fog = new Fog("#f3f4f6", 8, 22);
      this.scene.environmentIntensity = 0.55;
      addLight("#ffffff", "#d8dce2", 1.5, 1.85, "#dbeafe", 0.9);
      const floor = new Mesh(
        new PlaneGeometry(36, 36),
        new MeshStandardMaterial({ color: "#eceef1", roughness: 0.92, metalness: 0.02 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      this.group.add(floor);
    } else if (id === "gym-floor") {
      this.scene.background = new Color("#1c2028");
      this.scene.fog = new Fog("#1c2028", 9, 24);
      this.scene.environmentIntensity = 0.55;
      addLight("#eef4ff", "#252932", 1.25, 2.0, "#7dd3fc", 1.0);
      const floor = new Mesh(
        new PlaneGeometry(26, 26),
        new MeshStandardMaterial({ map: makeRubberTexture(), roughness: 0.88, metalness: 0.06 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      const backWall = new Mesh(
        new PlaneGeometry(26, 7),
        new MeshStandardMaterial({ color: "#252a34", roughness: 0.9, metalness: 0.05 }),
      );
      backWall.position.set(0, 3.5, -5.5);
      const trim = new Mesh(
        new PlaneGeometry(26, 0.14),
        new MeshStandardMaterial({ color: "#14171d", roughness: 0.7 }),
      );
      trim.position.set(0, 0.07, -5.49);
      const lightBar = new Mesh(
        new PlaneGeometry(5.5, 0.14),
        new MeshStandardMaterial({ color: "#ffffff", emissive: "#dbeafe", emissiveIntensity: 1.6 }),
      );
      lightBar.position.set(0, 4.4, -0.5);
      lightBar.rotation.x = Math.PI / 2;
      this.group.add(floor, backWall, trim, lightBar);
    } else if (id === "turf-arena") {
      this.scene.background = new Color("#181e1c");
      this.scene.fog = new Fog("#181e1c", 9, 24);
      this.scene.environmentIntensity = 0.5;
      addLight("#f8fafc", "#1d2c22", 1.3, 2.0, "#a7f3d0", 0.95);
      const floor = new Mesh(
        new PlaneGeometry(26, 26),
        new MeshStandardMaterial({ map: makeTurfTexture(), roughness: 0.96, metalness: 0.0 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      this.group.add(floor);
    } else if (id === "warm-loft") {
      this.scene.background = new Color("#ebe5dc");
      this.scene.fog = new Fog("#ebe5dc", 9, 24);
      this.scene.environmentIntensity = 0.6;
      addLight("#fffaf0", "#b89f82", 1.5, 1.9, "#fde68a", 0.85);
      const floor = new Mesh(
        new PlaneGeometry(26, 26),
        new MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.72, metalness: 0.04 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      floor.receiveShadow = true;
      const wall = new Mesh(
        new PlaneGeometry(26, 7),
        new MeshStandardMaterial({ color: "#e3dcd2", roughness: 0.94 }),
      );
      wall.position.set(0, 3.5, -5.5);
      this.group.add(floor, wall);
    } else if (id === "transparent") {
      this.scene.background = null;
      this.scene.environmentIntensity = 0.5;
      addLight("#ffffff", "#30343c", 1.45, 2.0, "#9db8ff", 1.1);
      const shadowPlane = new Mesh(
        new PlaneGeometry(10, 10),
        new ShadowMaterial({ opacity: 0.28 }),
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -0.002;
      shadowPlane.receiveShadow = true;
      this.group.add(shadowPlane);
    }

    this.group.visible = !this.hiddenForUnderside;
  }
}
