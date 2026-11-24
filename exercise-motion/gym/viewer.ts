import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ZoneId } from "./catalog";
import type { GymPlan, PlacedEquipment, ZoneBounds } from "./layout";

declare global {
  interface Window {
    __GYM_READY__?: boolean;
    __GYM_LOADED__?: number;
    __GYM_TOTAL__?: number;
    __GYM_APPLY_HASH__?: (hash: string) => Promise<void>;
  }
}

const plan: GymPlan = JSON.parse(document.getElementById("gym-plan")!.textContent ?? "{}");
const params = new URLSearchParams(location.hash.slice(1));
const clean = params.get("clean") === "1";
document.documentElement.classList.toggle("clean", clean);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");

const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = SRGBColorSpace;

const pmrem = new PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

// Main mega-gym scene
const gymScene = new Scene();
gymScene.background = new Color("#171b22");
gymScene.fog = new Fog("#171b22", 65, 165);
gymScene.environment = envTex;
gymScene.environmentIntensity = 0.72;

// Dedicated studio turntable scene for 360° close-up inspection
const inspectScene = new Scene();
inspectScene.background = new Color("#1b1f27");
inspectScene.environment = envTex;
inspectScene.environmentIntensity = 0.9;

function addLighting(target: Scene, studio = false) {
  target.add(new HemisphereLight("#f2f6ff", "#262b35", studio ? 1.5 : 1.15));
  target.add(new AmbientLight("#ffffff", studio ? 0.35 : 0.25));
  const key = new DirectionalLight("#fff9f0", studio ? 2.1 : 1.8);
  key.position.set(studio ? 5 : 28, studio ? 8 : 34, studio ? 6 : 22);
  const fill = new DirectionalLight("#bfd8ff", studio ? 1.1 : 0.85);
  fill.position.set(studio ? -6 : -26, studio ? 5 : 18, studio ? -5 : -24);
  target.add(key, fill);
}
addLighting(gymScene, false);
addLighting(inspectScene, true);

// Studio turntable pedestal
const pedestal = new Mesh(
  new PlaneGeometry(16, 16),
  new MeshStandardMaterial({ color: "#212630", roughness: 0.92, metalness: 0.05 }),
);
pedestal.rotation.x = -Math.PI / 2;
pedestal.position.y = -0.002;
inspectScene.add(pedestal);
const inspectSlot = new Group();
inspectScene.add(inspectSlot);

// Procedural architectural floor textures (rubber tiles, athletic sprint turf, smoked oak deck)
function makeRubberTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1d2026";
  ctx.fillRect(0, 0, 256, 256);
  // Subtle vulcanized rubber speckles
  for (let i = 0; i < 1800; i++) {
    const v = 32 + ((i * 73) % 28);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect((i * 37) % 256, (i * 91) % 256, 2, 2);
  }
  // Subtle interlocking tile seams
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  ctx.strokeRect(129, 1, 126, 126);
  ctx.strokeRect(1, 129, 126, 126);
  ctx.strokeRect(129, 129, 126, 126);
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeTurfTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1d3128";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const g = 44 + ((i * 53) % 24);
    ctx.fillStyle = `rgb(${Math.round(g * 0.56)},${g},${Math.round(g * 0.72)})`;
    ctx.fillRect((i * 47) % 256, (i * 113) % 256, 2, 2);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeWoodTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const planks = 8;
  const ph = 256 / planks;
  for (let p = 0; p < planks; p++) {
    const shade = 44 + ((p * 17) % 14);
    ctx.fillStyle = `rgb(${shade + 12},${shade + 4},${shade - 6})`;
    ctx.fillRect(0, p * ph, 256, ph - 1);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, (p + 1) * ph - 1, 256, 1);
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeZoneSign(title: string, count: number, accent: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 680;
  c.height = 120;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#161a22";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 12, c.height);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  const label = title.toUpperCase();
  let fontSize = 32;
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  while (ctx.measureText(label).width > c.width - 64 && fontSize > 18) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  }
  ctx.fillStyle = "#f2f5fb";
  ctx.fillText(label, 30, 58);
  ctx.fillStyle = "#95a2b8";
  ctx.font = "500 20px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`${count} PIECES`, 30, 92);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function buildArchitecture() {
  const arch = new Group();
  const W = plan.width;
  const D = plan.depth;
  // Double-height athletic hangar ceiling so roof trusses stay clear above elevated zone views.
  const wallH = 12.8;

  // Base dark rubber warehouse floor
  const rubberTex = makeRubberTexture();
  rubberTex.repeat.set(W / 2, D / 2);
  const baseFloor = new Mesh(
    new PlaneGeometry(W + 4, D + 4),
    new MeshStandardMaterial({ map: rubberTex, roughness: 0.88, metalness: 0.05 }),
  );
  baseFloor.rotation.x = -Math.PI / 2;
  baseFloor.position.y = -0.01;
  arch.add(baseFloor);

  // Per-zone architectural flooring + trim + suspended overhead wayfinding signs
  const turfTex = makeTurfTexture();
  const woodTex = makeWoodTexture();

  for (const z of plan.zones) {
    const zw = z.maxX - z.minX;
    const zd = z.maxZ - z.minZ;
    let mat: MeshStandardMaterial;
    if (z.floor === "turf") {
      const t = turfTex.clone();
      t.needsUpdate = true;
      t.repeat.set(zw / 3, zd / 3);
      mat = new MeshStandardMaterial({ map: t, roughness: 0.96, metalness: 0.0 });
    } else if (z.floor === "wood") {
      const t = woodTex.clone();
      t.needsUpdate = true;
      t.repeat.set(zw / 2.2, zd / 2.2);
      mat = new MeshStandardMaterial({ map: t, roughness: 0.65, metalness: 0.05 });
    } else if (z.floor === "platform") {
      mat = new MeshStandardMaterial({ color: "#232730", roughness: 0.84, metalness: 0.06 });
    } else {
      mat = new MeshStandardMaterial({ color: "#1f232b", roughness: 0.88, metalness: 0.05 });
    }

    const pad = new Mesh(new PlaneGeometry(zw, zd), mat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(z.centerX, 0.002, z.centerZ);
    arch.add(pad);

    // Subtle colored perimeter floor line
    const borderGeo = new EdgesGeometry(new BoxGeometry(zw, 0.01, zd));
    const border = new LineSegments(
      borderGeo,
      new LineBasicMaterial({ color: z.accent, transparent: true, opacity: 0.45 }),
    );
    border.position.set(z.centerX, 0.008, z.centerZ);
    arch.add(border);

    // Suspended overhead architectural zone banner
    const signTex = makeZoneSign(z.name, z.count, z.accent);
    const sign = new Mesh(
      new PlaneGeometry(5.6, 1.0),
      new MeshBasicMaterial({ map: signTex, side: DoubleSide }),
    );
    sign.position.set(z.centerX, 6.4, z.centerZ);
    arch.add(sign);
  }

  // Architectural perimeter walls with tall clerestory windows
  const wallMat = new MeshStandardMaterial({ color: "#222730", roughness: 0.88, metalness: 0.08 });
  const glassMat = new MeshStandardMaterial({
    color: "#9ec4e8",
    emissive: "#5f85ab",
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.1,
  });
  const trussMat = new MeshStandardMaterial({ color: "#2a303b", roughness: 0.6, metalness: 0.5 });
  const ledMat = new MeshBasicMaterial({ color: "#e8f1ff" });

  const wallThickness = 0.35;
  const lowerH = 8.4;
  const winH = 2.6;
  const topH = wallH - lowerH - winH;

  const makePerimeterWall = (len: number, x: number, z: number, rotY: number) => {
    const g = new Group();
    const low = new Mesh(new BoxGeometry(len, lowerH, wallThickness), wallMat);
    low.position.y = lowerH / 2;
    const win = new Mesh(new BoxGeometry(len - 1.2, winH, wallThickness * 0.4), glassMat);
    win.position.y = lowerH + winH / 2;
    const top = new Mesh(new BoxGeometry(len, topH, wallThickness), wallMat);
    top.position.y = lowerH + winH + topH / 2;
    g.add(low, win, top);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    arch.add(g);
  };

  makePerimeterWall(W + 0.7, 0, plan.minZ, 0);
  makePerimeterWall(W + 0.7, 0, plan.maxZ, 0);
  makePerimeterWall(D + 0.7, plan.minX, 0, Math.PI / 2);
  makePerimeterWall(D + 0.7, plan.maxX, 0, Math.PI / 2);

  // Wall mirrors along the north free-weights wall
  const mirror = new Mesh(
    new PlaneGeometry(Math.min(26, W * 0.42), 2.5),
    new MeshStandardMaterial({ color: "#cfd9e6", roughness: 0.08, metalness: 0.92 }),
  );
  mirror.position.set(plan.minX + W * 0.24, 1.45, plan.minZ + 0.2);
  arch.add(mirror);

  // Structural steel columns and overhead roof trusses + linear LED fixtures
  const trussSpacing = 11;
  const numTrusses = Math.max(4, Math.floor(D / trussSpacing));
  for (let i = 0; i <= numTrusses; i++) {
    const z = plan.minZ + (i / numTrusses) * D;
    const beam = new Mesh(new BoxGeometry(W, 0.34, 0.22), trussMat);
    beam.position.set(0, wallH - 0.25, z);
    arch.add(beam);

    // Columns along west and east walls
    for (const x of [plan.minX + 0.25, plan.maxX - 0.25]) {
      const col = new Mesh(new BoxGeometry(0.32, wallH, 0.32), trussMat);
      col.position.set(x, wallH / 2, z);
      arch.add(col);
    }

    // Linear LED light fixtures hanging below each interior truss
    if (i > 0 && i < numTrusses) {
      for (const frac of [-0.33, 0, 0.33]) {
        const led = new Mesh(new BoxGeometry(W * 0.24, 0.08, 0.14), ledMat);
        led.position.set(frac * W, wallH - 0.55, z);
        arch.add(led);
      }
    }
  }

  gymScene.add(arch);
}
buildArchitecture();

// Equipment container & floor selection highlight ring
const equipmentGroup = new Group();
gymScene.add(equipmentGroup);

const selectionRing = new Mesh(
  new RingGeometry(0.92, 1.0, 48),
  new MeshBasicMaterial({ color: "#4d8bf5", side: DoubleSide, transparent: true, opacity: 0.9 }),
);
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = 0.02;
selectionRing.visible = false;
gymScene.add(selectionRing);

// Camera & OrbitControls
const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 350);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 0.8;
controls.maxDistance = 135;

const overviewPos = new Vector3(plan.width * 0.56, Math.max(plan.width, plan.depth) * 0.52, plan.depth * 0.62);
const overviewTarget = new Vector3(0, 0.5, 0);
camera.position.copy(overviewPos);
controls.target.copy(overviewTarget);
controls.update();

// Smooth camera fly-to animation
let fly: {
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  t: number;
  duration: number;
} | null = null;

function flyTo(pos: Vector3, target: Vector3, duration = 0.65) {
  fly = {
    fromPos: camera.position.clone(),
    toPos: pos.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
    t: 0,
    duration,
  };
}

function zoneCamera(z: ZoneBounds): { pos: Vector3; target: Vector3 } {
  const span = Math.max(z.maxX - z.minX, z.maxZ - z.minZ);
  const dist = Math.max(9.5, Math.min(34, span * 0.72));
  return {
    pos: new Vector3(
      z.centerX + dist * 0.44,
      Math.min(10.5, Math.max(5.2, span * 0.32)),
      z.centerZ + dist * 0.68,
    ),
    target: new Vector3(z.centerX, 1.0, z.centerZ),
  };
}

// Equipment state & streaming GLB loader
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const itemById = new Map<string, PlacedEquipment>();
const slotById = new Map<string, Group>();
const loadedCache = new Map<string, Group>();
const pickTargets: Object3D[] = [];

const placeholderMat = new MeshBasicMaterial({
  color: "#384152",
  transparent: true,
  opacity: 0.35,
  side: DoubleSide,
});

for (const item of plan.items) {
  itemById.set(item.meta.id, item);
  const slot = new Group();
  slot.position.set(item.x, 0, item.z);
  slot.rotation.y = item.rotY;
  slot.userData.equipId = item.meta.id;

  const foot = new Mesh(new PlaneGeometry(item.meta.size[0], item.meta.size[2]), placeholderMat);
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = 0.012;
  foot.name = "__placeholder";
  slot.add(foot);

  equipmentGroup.add(slot);
  slotById.set(item.meta.id, slot);
}

// Track app state
let activeZone: ZoneId | "overview" = "overview";
let selectedId: string | null = null;
let inspectId: string | null = null;
let autoSpin = true;
let walkMode = false;
let savedGymCam: { pos: Vector3; target: Vector3 } | null = null;

// UI setup
$("gym-stats").textContent = `${plan.items.length} pieces · ${Math.round(plan.width)}×${Math.round(plan.depth)} m`;

const zoneBar = $("zone-bar");
const filterPills = $("filter-pills");
let filterZone: ZoneId | "all" = "all";

function makeZoneNavButton(id: ZoneId | "overview", label: string, accent?: string, count?: number) {
  const b = document.createElement("button");
  b.className = "zone-btn";
  b.dataset.zone = id;
  b.setAttribute("aria-current", String(id === activeZone));
  b.innerHTML = `${accent ? `<span class="zone-dot" style="background:${accent}"></span>` : ""}${label}${count != null ? ` <span style="opacity:.6">${count}</span>` : ""}`;
  b.addEventListener("click", () => jumpToZone(id));
  return b;
}

zoneBar.append(makeZoneNavButton("overview", "Overview"));
for (const z of plan.zones) {
  zoneBar.append(makeZoneNavButton(z.id, z.shortName, z.accent, z.count));
}

function jumpToZone(id: ZoneId | "overview", instant = false) {
  if (inspectId) exitInspect();
  if (walkMode) setWalkMode(false);
  activeZone = id;
  for (const b of zoneBar.querySelectorAll<HTMLButtonElement>(".zone-btn")) {
    b.setAttribute("aria-current", String(b.dataset.zone === id));
  }
  if (id === "overview") {
    if (instant) {
      camera.position.copy(overviewPos);
      controls.target.copy(overviewTarget);
      controls.update();
    } else {
      flyTo(overviewPos, overviewTarget);
    }
    return;
  }
  const zb = plan.zones.find((z) => z.id === id);
  if (!zb) return;
  const { pos, target } = zoneCamera(zb);
  if (instant) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
  } else {
    flyTo(pos, target);
  }
}

// Sidebar zone filter pills
function addFilterPill(id: ZoneId | "all", label: string) {
  const p = document.createElement("button");
  p.className = "pill";
  p.textContent = label;
  p.dataset.zone = id;
  p.setAttribute("aria-pressed", String(id === filterZone));
  p.addEventListener("click", () => {
    filterZone = id;
    for (const btn of filterPills.querySelectorAll<HTMLButtonElement>(".pill")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.zone === id));
    }
    renderEquipmentList();
  });
  filterPills.append(p);
}

addFilterPill("all", "All");
for (const z of plan.zones) addFilterPill(z.id, z.shortName);

const searchInput = $<HTMLInputElement>("search");
const equipListEl = $("equip-list");
const zoneNameById = new Map(plan.zones.map((z) => [z.id, z.name]));
const zoneAccentById = new Map(plan.zones.map((z) => [z.id, z.accent]));

function formatDims(size: [number, number, number]): string {
  return `${size[0].toFixed(2)} × ${size[2].toFixed(2)} × ${size[1].toFixed(2)} m`;
}

function renderEquipmentList() {
  const q = searchInput.value.trim().toLowerCase();
  const matches = plan.items.filter((it) => {
    if (filterZone !== "all" && it.meta.zone !== filterZone) return false;
    if (!q) return true;
    return (
      it.meta.name.toLowerCase().includes(q) ||
      it.meta.subgroup.toLowerCase().includes(q) ||
      (zoneNameById.get(it.meta.zone) ?? "").toLowerCase().includes(q)
    );
  });

  const byZone = new Map<ZoneId, PlacedEquipment[]>();
  for (const m of matches) {
    const arr = byZone.get(m.meta.zone) ?? [];
    arr.push(m);
    byZone.set(m.meta.zone, arr);
  }

  equipListEl.innerHTML = "";
  for (const [zid, arr] of byZone) {
    const header = document.createElement("div");
    header.className = "group-label";
    header.innerHTML = `<span>${zoneNameById.get(zid) ?? zid}</span><span>${arr.length}</span>`;
    equipListEl.append(header);

    for (const it of arr) {
      const btn = document.createElement("button");
      btn.className = `equip-row${it.meta.id === selectedId ? " selected" : ""}`;
      btn.dataset.id = it.meta.id;
      btn.innerHTML = `<span class="ename">${it.meta.name}</span><span class="emeta">${formatDims(it.meta.size)}</span>`;
      btn.addEventListener("click", () => selectEquipment(it.meta.id, true));
      equipListEl.append(btn);
    }
  }
}

searchInput.addEventListener("input", renderEquipmentList);
renderEquipmentList();

function selectEquipment(id: string | null, focusCamera = false) {
  selectedId = id;
  for (const row of equipListEl.querySelectorAll<HTMLElement>(".equip-row")) {
    row.classList.toggle("selected", row.dataset.id === id);
  }

  const card = $("selection-card");
  if (!id) {
    card.hidden = true;
    selectionRing.visible = false;
    return;
  }

  const item = itemById.get(id);
  if (!item) return;

  const radius = Math.max(item.footW, item.footD) * 0.62;
  selectionRing.scale.set(radius, radius, 1);
  selectionRing.position.set(item.x, 0.025, item.z);
  (selectionRing.material as MeshBasicMaterial).color.set(zoneAccentById.get(item.meta.zone) ?? "#4d8bf5");
  selectionRing.visible = true;

  $("sel-zone").textContent = zoneNameById.get(item.meta.zone) ?? item.meta.zone;
  $("sel-name").textContent = item.meta.name;
  $("sel-dims").textContent = `${formatDims(item.meta.size)} · ${(item.meta.tris / 1000).toFixed(1)}k tris`;
  card.hidden = false;

  if (focusCamera) {
    if (walkMode) setWalkMode(false);
    const span = Math.max(item.meta.size[0], item.meta.size[1], item.meta.size[2], 1.2);
    const target = new Vector3(item.x, item.meta.size[1] * 0.45, item.z);
    const pos = new Vector3(item.x + span * 1.45, Math.max(1.5, span * 0.95), item.z + span * 1.65);
    flyTo(pos, target, 0.55);
  }
}

// 360° Studio Inspector
async function enterInspect(id: string) {
  const item = itemById.get(id);
  if (!item) return;
  if (walkMode) setWalkMode(false);

  if (!inspectId) {
    savedGymCam = { pos: camera.position.clone(), target: controls.target.clone() };
  }
  inspectId = id;
  fly = null;

  $("inspect-name").textContent = item.meta.name;
  $("inspect-dims").textContent = `${zoneNameById.get(item.meta.zone)} · ${formatDims(item.meta.size)} · ${item.meta.tris.toLocaleString()} tris`;
  $("inspect-bar").hidden = false;
  $("selection-card").hidden = true;
  document.querySelector<HTMLElement>(".topbar")!.style.display = "none";
  $("sidebar").classList.add("collapsed");

  inspectSlot.clear();
  const root = await loadModelRoot(id);
  if (inspectId !== id) return;
  const clone = root.clone(true);
  inspectSlot.add(clone);

  const box = new Box3().setFromObject(clone);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.6);

  controls.target.copy(center);
  camera.position.copy(center).add(new Vector3(maxDim * 1.2, maxDim * 0.72, maxDim * 1.4));
  controls.maxDistance = maxDim * 6;
  controls.update();
}

function exitInspect() {
  if (!inspectId) return;
  inspectId = null;
  inspectSlot.clear();
  $("inspect-bar").hidden = true;
  document.querySelector<HTMLElement>(".topbar")!.style.display = "";
  controls.maxDistance = 135;
  if (savedGymCam) {
    camera.position.copy(savedGymCam.pos);
    controls.target.copy(savedGymCam.target);
    controls.update();
  }
  if (selectedId) $("selection-card").hidden = false;
}

$("inspect-btn").addEventListener("click", () => {
  if (selectedId) void enterInspect(selectedId);
});
$("close-sel-btn").addEventListener("click", () => selectEquipment(null));
$("back-gym-btn").addEventListener("click", exitInspect);
$("spin-btn").addEventListener("click", () => {
  autoSpin = !autoSpin;
  $("spin-btn").classList.toggle("active", autoSpin);
});
$("spin-btn").classList.add("active");

// Sidebar toggle (default collapsed on phones)
const sidebar = $("sidebar");
const dirBtn = $("dir-btn");
if (window.innerWidth <= 780) {
  sidebar.classList.add("collapsed");
  dirBtn.setAttribute("aria-expanded", "false");
}
dirBtn.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  dirBtn.setAttribute("aria-expanded", String(!collapsed));
});

// Walk mode (WASD at eye level 1.68 m)
const keys = new Set<string>();
function setWalkMode(enabled: boolean) {
  walkMode = enabled;
  $("mode-btn").classList.toggle("active", enabled);
  $("mode-btn").textContent = enabled ? "Orbit" : "Walk";
  $("walk-hint").hidden = !enabled;
  if (enabled) {
    fly = null;
    const lookDir = controls.target.clone().sub(camera.position);
    lookDir.y = 0;
    if (lookDir.lengthSq() < 1e-4) lookDir.set(0, 0, -1);
    lookDir.normalize();
    camera.position.y = 1.68;
    camera.position.x = Math.max(plan.minX + 1.5, Math.min(plan.maxX - 1.5, camera.position.x));
    camera.position.z = Math.max(plan.minZ + 1.5, Math.min(plan.maxZ - 1.5, camera.position.z));
    controls.target.copy(camera.position).addScaledVector(lookDir, 4);
    controls.minDistance = 0.5;
    controls.maxDistance = 6;
    controls.update();
  } else {
    controls.minDistance = 0.8;
    controls.maxDistance = 135;
  }
}

$("mode-btn").addEventListener("click", () => setWalkMode(!walkMode));
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "Escape") {
    if (inspectId) exitInspect();
    else if (walkMode) setWalkMode(false);
    else selectEquipment(null);
    return;
  }
  keys.add(e.key.toLowerCase());
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// Raycast clicking on equipment in the gym
const raycaster = new Raycaster();
const pointer = new Vector2();
let downPos = { x: 0, y: 0 };

canvas.addEventListener("pointerdown", (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (inspectId) return;
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickTargets, true);
  if (hits.length === 0) return;
  let obj: Object3D | null = hits[0].object;
  while (obj && !obj.userData.equipId) obj = obj.parent;
  if (obj?.userData.equipId) {
    selectEquipment(obj.userData.equipId as string, false);
  }
});

// Streaming loader for all GLBs
async function loadModelRoot(id: string): Promise<Group> {
  const cached = loadedCache.get(id);
  if (cached) return cached;
  const gltf = await loader.loadAsync(`./models/${id}.glb`);
  loadedCache.set(id, gltf.scene);
  return gltf.scene;
}

async function streamAllEquipment() {
  window.__GYM_TOTAL__ = plan.items.length;
  window.__GYM_LOADED__ = 0;
  window.__GYM_READY__ = false;

  // Prioritize items closest to the initial camera target first so the view populates immediately.
  const queue = [...plan.items].sort((a, b) => {
    const da = Math.hypot(a.x - controls.target.x, a.z - controls.target.z);
    const db = Math.hypot(b.x - controls.target.x, b.z - controls.target.z);
    return da - db;
  });

  let cursor = 0;
  let loaded = 0;
  const pill = $("progress-pill");
  const text = $("progress-text");

  const concurrency = 6;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= queue.length) break;
        const item = queue[idx];
        try {
          const root = await loadModelRoot(item.meta.id);
          const slot = slotById.get(item.meta.id);
          if (slot) {
            const ph = slot.getObjectByName("__placeholder");
            if (ph) slot.remove(ph);
            slot.add(root);
            pickTargets.push(slot);
          }
        } catch (err) {
          console.error("Failed to load", item.meta.id, err);
        }
        loaded++;
        window.__GYM_LOADED__ = loaded;
        text.textContent = `Loading equipment ${loaded} / ${plan.items.length}`;
      }
    }),
  );

  text.textContent = `Loaded all ${plan.items.length} equipment models`;
  pill.classList.add("done");
  window.__GYM_READY__ = true;
}

async function applyHash(hashStr: string) {
  const p = new URLSearchParams(hashStr.replace(/^#/, ""));
  document.documentElement.classList.toggle("clean", p.get("clean") === "1");
  const inspect = p.get("inspect");
  const zone = p.get("zone") as ZoneId | "overview" | null;
  const cam = p.get("cam");
  const spinParam = p.get("spin");
  if (spinParam === "0") autoSpin = false;

  if (inspect && itemById.has(inspect)) {
    $("progress-pill").classList.add("done");
    await enterInspect(inspect);
    return;
  }
  if (inspectId) exitInspect();
  if (zone && (zone === "overview" || plan.zones.some((z) => z.id === zone))) {
    jumpToZone(zone, true);
  }
  if (cam) {
    const nums = cam.split(",").map(Number);
    if (nums.length === 6 && nums.every(Number.isFinite)) {
      camera.position.set(nums[0], nums[1], nums[2]);
      controls.target.set(nums[3], nums[4], nums[5]);
      controls.update();
    }
  }
}

window.__GYM_APPLY_HASH__ = applyHash;

const initInspect = params.get("inspect");
if (initInspect && itemById.has(initInspect)) {
  void applyHash(location.hash).then(() => {
    window.__GYM_READY__ = true;
  });
} else {
  void applyHash(location.hash);
  void streamAllEquipment();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastNow = performance.now();
const fwd = new Vector3();
const right = new Vector3();
const up = new Vector3(0, 1, 0);

function animate(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / fly.duration);
    const e = 1 - Math.pow(1 - fly.t, 3);
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
    if (fly.t >= 1) fly = null;
  }

  if (walkMode && !inspectId) {
    const speed = (keys.has("shift") ? 11 : 5.5) * dt;
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-6) fwd.normalize();
    right.crossVectors(fwd, up).normalize();
    const move = new Vector3();
    if (keys.has("w") || keys.has("arrowup")) move.add(fwd);
    if (keys.has("s") || keys.has("arrowdown")) move.sub(fwd);
    if (keys.has("d") || keys.has("arrowright")) move.add(right);
    if (keys.has("a") || keys.has("arrowleft")) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      camera.position.add(move);
      camera.position.y = 1.68;
      camera.position.x = Math.max(plan.minX + 1, Math.min(plan.maxX - 1, camera.position.x));
      camera.position.z = Math.max(plan.minZ + 1, Math.min(plan.maxZ - 1, camera.position.z));
      controls.target.add(move);
    }
  }

  if (inspectId && autoSpin) {
    inspectSlot.rotation.y += dt * 0.45;
  }

  controls.update();
  renderer.render(inspectId ? inspectScene : gymScene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
