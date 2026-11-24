import {
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { analyze, type Analysis } from "../src/biomech";
import { createBody, fk, newFrame, type Body } from "../src/body";
import { propParts, type Material, type Part } from "../src/equipment";
import { kinematics, type CheckResult, type Kinematics, type Sequence } from "../src/exercise";
import { MUSCLE_NAMES, MUSCLES, TENDON_STRAIN_AT_PEAK, TENDONS, type Muscle } from "../src/muscles";
import { validateLoad, validateMotion, type Issue } from "../src/validate";
import { Figure, preloadFigureAssets } from "./figure";
import { SETTINGS, StageEnvironment, type SettingId } from "./settings";

interface FaultData {
  id: string;
  label: string;
  what: string;
  expect: string[];
  caught: string[];
  raised: string[];
  sequence: Sequence;
  checks: CheckResult[];
}

interface AgreementData {
  listedInTop: number;
  listed: number;
  primaryMean: number;
  secondaryMean: number;
  otherMean: number;
  unexpected: Muscle[];
  stretchedFound: number;
  stretched: number;
}

interface ExerciseData {
  sequence: Sequence;
  checks: CheckResult[];
  catalog: { primary: Muscle[]; secondary: Muscle[]; stretched: Muscle[] };
  agreement: AgreementData;
  faults: FaultData[];
  images: string[];
}

interface CatalogSummary {
  id: string;
  catalogId: string;
  name: string;
  alternativeNames?: string[];
  category: string;
  movementPattern?: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipmentLabel?: string;
  issueCount?: number;
  checksPass?: number;
  checksTotal?: number;
}

interface EmbeddedPayload {
  mode?: "embedded" | "library";
  exercises?: ExerciseData[];
}

const rawDataText = document.getElementById("data")?.textContent?.trim() ?? "";
const embedded: EmbeddedPayload =
  rawDataText && rawDataText !== "__DATA__" ? JSON.parse(rawDataText) : { mode: "library" };
const isLibraryMode = embedded.mode === "library" || !embedded.exercises?.length;

let libraryIndex: CatalogSummary[] = [];
const loadedCache = new Map<string, ExerciseData>();
const glbLoader = new GLTFLoader();
glbLoader.setMeshoptDecoder(MeshoptDecoder);

const params = new URLSearchParams(location.hash.slice(1));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ENGAGE = new Color("#276ef1");
const STRETCH = new Color("#f0883a");
const TABS = ["Muscles", "Tendons", "Review"] as const;
const VIEWS = ["Front", "Back", "Side", "Angle", "Top"] as const;
const MODES = ["Engagement", "Stretch"] as const;
const SPEEDS = [0.25, 0.5, 1];
const PHASE_NAMES = { lower: "Lower", bottom: "Bottom", raise: "Lift", top: "Top" };

const clean = params.get("clean") === "1";
const initialSetting = (params.get("setting") as SettingId | null) ?? (clean ? "studio-light" : "studio-dark");

const state = {
  exerciseId: params.get("id") ?? "",
  exerciseIndex: Number(params.get("ex") ?? 0),
  fault: params.has("fault") ? Number(params.get("fault")) : -1,
  frame: Number(params.get("frame") ?? 0),
  playing: params.get("play") !== "0",
  speed: Number(params.get("speed") ?? 1),
  mode: (params.get("mode") ?? "Engagement") as (typeof MODES)[number],
  tab: (params.get("tab") ?? "Muscles") as (typeof TABS)[number],
  view: (params.get("view") ?? "Angle") as (typeof VIEWS)[number],
  setting: SETTINGS.some((s) => s.id === initialSetting) ? initialSetting : ("studio-dark" as SettingId),
  loadKg: 0,
};

let activeExercise: ExerciseData | null = null;
let body: Body;
let sequence: Sequence;
let kin: Kinematics;
let analysis: Analysis;
let engagement = new Float32Array(0);
let hardest = 1;
let issues: Issue[] = [];
let figure: Figure;

const canvas = $<HTMLCanvasElement>("canvas");
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new Scene();
document.documentElement.classList.toggle("clean", clean);

const stageEnv = new StageEnvironment(scene, renderer);
stageEnv.apply(state.setting);

const camera = new PerspectiveCamera(32, 1, 0.1, 60);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 1.0;
controls.maxDistance = 12;

const MATERIALS: Record<Material, MeshStandardMaterial> = {
  steel: new MeshStandardMaterial({ color: "#444850", roughness: 0.52, metalness: 0.55 }),
  chrome: new MeshStandardMaterial({ color: "#c4c8cf", roughness: 0.25, metalness: 0.86 }),
  pad: new MeshStandardMaterial({ color: "#23252a", roughness: 0.88, metalness: 0.04 }),
  plate: new MeshStandardMaterial({ color: "#191a1e", roughness: 0.58, metalness: 0.22 }),
  rubber: new MeshStandardMaterial({ color: "#8b4334", roughness: 0.9 }),
  cable: new MeshStandardMaterial({ color: "#9da6b5", roughness: 0.35, metalness: 0.72 }),
  band: new MeshStandardMaterial({ color: "#e06d53", roughness: 0.75, metalness: 0.02 }),
  wood: new MeshStandardMaterial({ color: "#9e7a52", roughness: 0.78, metalness: 0.04 }),
  accent: new MeshStandardMaterial({ color: "#3b82f6", roughness: 0.48, metalness: 0.3 }),
};

const equipment = new Group();
const glbSlot = new Group();
const props = new Group();
const tethersGroup = new Group();
const figureSlot = new Group();
scene.add(equipment, glbSlot, props, tethersGroup, figureSlot);

const UNIT_CYL = new CylinderGeometry(1, 1, 1, 12);

function partMesh(part: Part) {
  let geometry;
  if (part.shape === "box") {
    geometry = new BoxGeometry(...part.size);
  } else if (part.shape === "sphere") {
    geometry = new SphereGeometry(part.size[0], 24, 18);
  } else if (part.shape === "capsule") {
    geometry = new CapsuleGeometry(part.size[0], part.size[1], 8, 20).rotateZ(Math.PI / 2);
  } else {
    geometry = new CylinderGeometry(part.size[0], part.size[0], part.size[1], 32).rotateZ(Math.PI / 2);
  }
  const mesh = new Mesh(geometry, MATERIALS[part.material] ?? MATERIALS.steel);
  mesh.position.set(...part.pos);
  mesh.quaternion.set(...part.quat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildProps() {
  props.clear();
  for (const prop of sequence.props) {
    const group = new Group();
    for (const part of propParts(prop, state.loadKg)) group.add(partMesh(part));
    props.add(group);
  }
}

interface TetherSegmentPool {
  meshes: Mesh[];
  radius: number;
}
let tetherPools: TetherSegmentPool[] = [];

function buildTethers() {
  tethersGroup.clear();
  tetherPools = [];
  if (!sequence.tethers?.length || !sequence.tetherStates?.length) return;
  const maxSegs = sequence.tetherStates[0].map((st) => Math.max(1, st.points.length - 1));
  sequence.tethers.forEach((def, tIdx) => {
    const mat = def.kind === "band" ? MATERIALS.band : MATERIALS.cable;
    const radius = def.radius ?? (def.kind === "band" ? 0.01 : 0.004);
    const meshes: Mesh[] = [];
    for (let s = 0; s < maxSegs[tIdx]; s++) {
      const m = new Mesh(UNIT_CYL, mat);
      m.castShadow = true;
      tethersGroup.add(m);
      meshes.push(m);
    }
    tetherPools.push({ meshes, radius });
  });
}

const ta = new Vector3();
const tb = new Vector3();
const tDir = new Vector3();
const UP_Y = new Vector3(0, 1, 0);

function updateTethers(i: number, j: number, frac: number) {
  if (!sequence.tetherStates?.length || !tetherPools.length) return;
  const rowA = sequence.tetherStates[i];
  const rowB = sequence.tetherStates[j];
  tetherPools.forEach((pool, tIdx) => {
    const ptsA = rowA[tIdx].points;
    const ptsB = rowB[tIdx].points;
    for (let s = 0; s < pool.meshes.length; s++) {
      const mesh = pool.meshes[s];
      if (s + 1 >= ptsA.length) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      ta.set(
        ptsA[s][0] + (ptsB[s][0] - ptsA[s][0]) * frac,
        ptsA[s][1] + (ptsB[s][1] - ptsA[s][1]) * frac,
        ptsA[s][2] + (ptsB[s][2] - ptsA[s][2]) * frac,
      );
      tb.set(
        ptsA[s + 1][0] + (ptsB[s + 1][0] - ptsA[s + 1][0]) * frac,
        ptsA[s + 1][1] + (ptsB[s + 1][1] - ptsA[s + 1][1]) * frac,
        ptsA[s + 1][2] + (ptsB[s + 1][2] - ptsA[s + 1][2]) * frac,
      );
      tDir.subVectors(tb, ta);
      const len = tDir.length();
      if (len < 1e-4) {
        mesh.visible = false;
        continue;
      }
      mesh.position.addVectors(ta, tb).multiplyScalar(0.5);
      mesh.scale.set(pool.radius, len, pool.radius);
      mesh.quaternion.setFromUnitVectors(UP_Y, tDir.divideScalar(len));
    }
  });
}

async function loadGlbAttachments() {
  glbSlot.clear();
  if (!sequence.glb?.length) return;
  for (const ref of sequence.glb) {
    try {
      const gltf = await glbLoader.loadAsync(`/gym-models/${ref.id}.glb`);
      const obj = gltf.scene;
      obj.position.set(...ref.pos);
      if (ref.quat) obj.quaternion.set(...ref.quat);
      if (ref.scale) obj.scale.setScalar(ref.scale);
      glbSlot.add(obj);
    } catch {
      // Optional GLB enhancement; parametric parts remain rendered.
    }
  }
}

function setView(view: (typeof VIEWS)[number]) {
  state.view = view;
  const lying = sequence.support.kind === "lying";
  const underside = lying && view === "Back";
  controls.maxPolarAngle = underside ? Math.PI - 0.02 : Math.PI / 2 - 0.02;
  stageEnv.setUnderside(underside);
  equipment.visible = !underside;
  glbSlot.visible = !underside;
  const offset = {
    Front: lying ? new Vector3(0, 0.3, 1) : new Vector3(0, 0, 1),
    Back: lying ? new Vector3(0, -1, -0.02) : new Vector3(0, 0, -1),
    Side: new Vector3(-1, 0.06, 0),
    Angle: lying ? new Vector3(-0.7, 0.45, 0.62) : new Vector3(-0.66, 0.22, 0.72),
    Top: new Vector3(0, 1, 0.02),
  }[view];
  controls.target.copy(fit.center);
  camera.position.copy(fit.center).addScaledVector(offset.normalize(), fitDistance());
  controls.update();
  select("views", view);
}

const fit = new Sphere();

function measureFit() {
  figure.pose(kin.frames[0]);
  const lifterBox = figure.bounds();
  const lifter = lifterBox.getBoundingSphere(new Sphere());
  const allBox = lifterBox.clone();
  if (equipment.children.length > 0) allBox.union(new Box3().setFromObject(equipment));
  const everything = allBox.getBoundingSphere(new Sphere());
  fit.center.copy(lifter.center).lerp(everything.center, 0.25);
  if (sequence.cameraHint?.target) fit.center.set(...sequence.cameraHint.target);
  fit.radius = Math.max(lifter.radius * 1.12, everything.radius * 0.62);
}

const fitDistance = () =>
  ((fit.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.04) /
  Math.min(1, camera.aspect * 1.15);

function reanalyze() {
  analysis = analyze(body, sequence, kin, state.loadKg);
  hardest = Math.max(0.3, ...Object.values(analysis.peak).map((peak) => peak.activation));
  engagement = new Float32Array(analysis.activation[0].length);
  const loaded = { ...sequence, loadKg: state.loadKg };
  issues = [...validateMotion(body, loaded, kin), ...validateLoad(loaded, analysis)];
}

function current() {
  const exercise = activeExercise!;
  const fault = state.fault >= 0 ? exercise.faults[state.fault] : undefined;
  return {
    exercise,
    fault,
    issues,
    checks: fault?.checks ?? exercise.checks,
  };
}

function applyLoadedExercise(resetLoad: boolean) {
  const { exercise, fault } = current();
  sequence = fault?.sequence ?? exercise.sequence;
  if (!body || body.height !== sequence.lifter.height) {
    body = createBody(sequence.lifter.height, sequence.lifter.mass);
    figure = new Figure(body);
    figureSlot.clear();
    figureSlot.add(figure.group);
  }
  const grip =
    sequence.grip ?? (sequence.props.some((prop) => prop.kind !== "dumbbell") ? "press" : "hang");
  figure.setGrip(grip);
  kin = kinematics(body, sequence);
  if (resetLoad) state.loadKg = Number(params.get("load") ?? sequence.loadKg);
  state.frame = Math.min(state.frame, sequence.poses.length - 1);
  equipment.clear();
  for (const part of sequence.equipment) equipment.add(partMesh(part));
  buildProps();
  buildTethers();
  void loadGlbAttachments();
  reanalyze();

  const slider = $<HTMLInputElement>("load");
  slider.max = sequence.loadUnit === "perSide" ? "80" : "260";
  slider.value = String(state.loadKg);
  $("load-label").textContent =
    sequence.loadUnit === "perSide" ? "Each side" : sequence.loadKg === 0 ? "Added load" : "Load";
  $<HTMLInputElement>("scrub").max = String(sequence.poses.length - 1);
  const total = sequence.poses.length;
  $("phases").innerHTML = sequence.phases
    .map(
      (phase) =>
        `<span style="flex:${phase.to - phase.from + 1} 1 0">${(phase.to - phase.from + 1) / total > 0.12 ? (phase.label ?? PHASE_NAMES[phase.name]) : ""}</span>`,
    )
    .join("");
  const note = $("variant-note");
  note.hidden = !fault;
  if (fault) note.innerHTML = `<strong>Detector test: ${fault.label}.</strong> ${fault.what}`;
  if (isLibraryMode) {
    $("picker-name").textContent = sequence.name;
    $("picker-count").textContent = `${libraryIndex.length} exercises`;
  }
  measureFit();
  setView(params.get("view") ? state.view : (sequence.cameraHint?.view ?? state.view));
  renderLoad();
  renderPanel();
}

async function fetchExercise(id: string): Promise<ExerciseData> {
  const hit = loadedCache.get(id);
  if (hit) return hit;
  const resp = await fetch(`./sequences/${id}.json`);
  if (!resp.ok) throw new Error(`Could not load exercise "${id}" (${resp.status})`);
  const parsed = (await resp.json()) as ExerciseData;
  loadedCache.set(id, parsed);
  return parsed;
}

async function selectExerciseById(id: string, resetLoad = true, preserveFrame = false) {
  state.exerciseId = id;
  if (!preserveFrame) {
    state.fault = -1;
    state.frame = 0;
  }
  activeExercise = isLibraryMode
    ? await fetchExercise(id)
    : (embedded.exercises!.find((e) => e.sequence.id === id) ?? embedded.exercises![0]);
  if (!isLibraryMode && embedded.exercises) {
    const idx = embedded.exercises.findIndex((e) => e.sequence.id === activeExercise!.sequence.id);
    if (idx >= 0) {
      state.exerciseIndex = idx;
      select("exercises", idx);
    }
  }
  applyLoadedExercise(resetLoad);
  renderDrawerList();
}

function renderLoad() {
  $("load-value").textContent =
    `${state.loadKg} kg${sequence.loadUnit === "perSide" ? " each" : ""}`;
}

function segmented<T extends string | number>(
  id: string,
  options: readonly T[],
  selected: T,
  label: (option: T) => string,
  pick: (option: T) => void,
) {
  const host = $(id);
  host.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.textContent = label(option);
    button.dataset.value = String(option);
    button.setAttribute("aria-selected", String(option === selected));
    button.addEventListener("click", () => {
      select(id, option);
      pick(option);
    });
    host.append(button);
  }
}

function select(id: string, value: string | number) {
  for (const button of $(id).querySelectorAll("button"))
    button.setAttribute("aria-selected", String(button.dataset.value === String(value)));
}

const ICON = {
  pass: `<svg viewBox="0 0 16 16" aria-label="Pass"><circle cx="8" cy="8" r="7" fill="none" stroke="var(--good)" stroke-width="1.5"/><path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="var(--good)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg viewBox="0 0 16 16" aria-label="Error"><circle cx="8" cy="8" r="7" fill="var(--bad)"/><path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#151414" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  warning: `<svg viewBox="0 0 16 16" aria-label="Warning"><path d="M8 1.6l6.8 12.2H1.2z" fill="var(--warn)"/><path d="M8 6.2v3.6M8 11.6v.4" stroke="#151414" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  play: `<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>`,
  pause: `<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>`,
};

const pct = (value: number) => `${Math.round(value * 100)}`;
const both = (row: Float32Array, m: number) => Math.max(row[m * 2], row[m * 2 + 1]);
let refresh: (frame: number) => void = () => {};

function sparkline(values: number[], color: string) {
  const w = 96;
  const h = 24;
  const top = Math.max(1, ...values);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (value: number) => h - 1 - (value / top) * (h - 3);
  const line = values
    .map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`)
    .join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${line}L${w} ${h}L0 ${h}Z" fill="${color}" opacity=".16"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line class="head" y1="0" y2="${h}" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
}

function scrubOn(panel: HTMLElement) {
  for (const spark of panel.querySelectorAll<SVGElement>(".spark")) {
    const seek = (event: PointerEvent) => {
      const box = spark.getBoundingClientRect();
      state.playing = false;
      state.frame = Math.round(
        Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) *
          (sequence.poses.length - 1),
      );
      renderPlay();
    };
    spark.addEventListener("pointerdown", (event) => {
      spark.setPointerCapture(event.pointerId);
      seek(event);
    });
    spark.addEventListener("pointermove", (event) => event.buttons && seek(event));
  }
}

function renderMuscles(panel: HTMLElement) {
  const { exercise } = current();
  const rows = MUSCLES.map((muscle, m) => ({
    muscle,
    m,
    peak: analysis.peak[muscle].activation,
    series: analysis.activation.map((row) => both(row, m)),
  }))
    .filter((row) => row.peak >= 0.02)
    .toSorted((a, b) => b.peak - a.peak);
  const tag = (muscle: Muscle) =>
    exercise.catalog.primary.includes(muscle)
      ? "primary"
      : exercise.catalog.secondary.includes(muscle)
        ? "secondary"
        : "";
  panel.innerHTML = `
		<p class="note">Share of each muscle group's peak torque needed to hold and move ${state.loadKg} kg${sequence.loadUnit === "perSide" ? " in each hand" : ""}, frame by frame. Primary and secondary are the app's own labels for this exercise. Drag a trace to scrub.</p>
		<div class="cols head"><span>Muscle</span><span>Through the rep</span><span>Now</span><span>Peak</span></div>
		${rows.map((row) => `<div class="row cols" data-m="${row.m}"><div class="name"><b>${MUSCLE_NAMES[row.muscle]}</b><small>${tag(row.muscle)}</small></div>${sparkline(row.series, "var(--engage)")}<span class="num now"></span><span class="num dim">${pct(row.peak)}%</span></div>`).join("")}
		<p class="note">${MUSCLES.length - rows.length} other groups stay under 2%.</p>`;
  const cells = rows.map((row) => {
    const element = panel.querySelector<HTMLElement>(`[data-m="${row.m}"]`)!;
    return {
      row,
      now: element.querySelector<HTMLElement>(".now")!,
      head: element.querySelector<SVGLineElement>(".head")!,
    };
  });
  refresh = (frame) => {
    const x = String((frame / Math.max(1, sequence.poses.length - 1)) * 96);
    for (const { row, now, head } of cells) {
      now.textContent = `${pct(row.series[frame])}%`;
      head.setAttribute("x1", x);
      head.setAttribute("x2", x);
    }
  };
  scrubOn(panel);
}

function renderTendons(panel: HTMLElement) {
  const rows = MUSCLES.map((muscle, m) => ({
    muscle,
    m,
    peak: analysis.peak[muscle],
    load: analysis.tendon.map((row) => both(row, m)),
    stretch: analysis.stretch.map((row) => both(row, m)),
  }))
    .filter((row) => row.peak.tendon >= 0.03 || row.peak.stretch >= 0.15)
    .toSorted((a, b) => b.peak.tendon + b.peak.stretch - (a.peak.tendon + a.peak.stretch));
  panel.innerHTML = `
		<p class="note">Load is the pull on the tendon as a share of its muscle's peak force: the contraction plus the passive tension of a stretch. Stretch is how far the muscle-tendon unit is lengthened toward the end of the joint's range.</p>
		<div class="cols head"><span>Tendon</span><span>Load and stretch</span><span>Load</span><span>Stretch</span></div>
		${rows.map((row) => `<div class="row cols" data-m="${row.m}"><div class="name"><b>${TENDONS[row.muscle]}</b></div><div class="pair"><div class="meter"><i class="load" style="background:var(--engage)"></i></div><div class="meter"><i class="stretch" style="background:var(--stretch)"></i></div></div><span class="num now l"></span><span class="num now s"></span><div class="sub">${MUSCLE_NAMES[row.muscle]} · peak load ${pct(row.peak.tendon)}%, about ${(row.peak.tendon * TENDON_STRAIN_AT_PEAK).toFixed(1)}% strain · peak stretch ${pct(row.peak.stretch)}%</div></div>`).join("")}`;
  const cells = rows.map((row) => {
    const element = panel.querySelector<HTMLElement>(`[data-m="${row.m}"]`)!;
    const get = (selector: string) => element.querySelector<HTMLElement>(selector)!;
    return { row, load: get(".load"), stretch: get(".stretch"), l: get(".l"), s: get(".s") };
  });
  refresh = (frame) => {
    for (const { row, load, stretch, l, s } of cells) {
      load.style.width = `${Math.min(100, row.load[frame] * 100)}%`;
      stretch.style.width = `${Math.min(100, row.stretch[frame] * 100)}%`;
      l.textContent = `${pct(row.load[frame])}%`;
      s.textContent = `${pct(row.stretch[frame])}%`;
    }
  };
}

function renderReview(panel: HTMLElement) {
  const { exercise, fault, issues, checks } = current();
  const spans = (issue: Issue) =>
    issue.frames.map(([from, to]) => (from === to ? `${from}` : `${from} to ${to}`)).join(", ");
  const flagged = issues.length
    ? issues
        .map(
          (issue) =>
            `<div class="item">${ICON[issue.severity]}<div><div class="title">${issue.title}</div><div class="detail">${issue.detail}. Frames ${spans(issue)}.</div></div></div>`,
        )
        .join("")
    : `<div class="item">${ICON.pass}<div><div class="title">Nothing flagged</div><div class="detail">No clipping, every joint inside its range, contacts held, movement smooth, balanced, and within the lifter's strength at ${state.loadKg} kg.</div></div></div>`;
  const form = checks
    .map(
      (check) =>
        `<div class="item">${check.pass ? ICON.pass : ICON.error}<div><div class="title">${check.label}</div><div class="detail">${check.measured}</div><details><summary>Instruction</summary><blockquote>${check.cue}</blockquote></details></div></div>`,
    )
    .join("");
  const a = exercise.agreement;
  const names = (muscles: Muscle[]) =>
    muscles.map((muscle) => MUSCLE_NAMES[muscle].toLowerCase()).join(", ");
  const faultsSection = exercise.faults.length
    ? `<h3>Detector tests</h3>
		<p class="note">Each one breaks this rep on purpose. Pick one to watch it and see what gets flagged.</p>
		${exercise.faults.map((item, i) => `<div class="item">${item.caught.length ? ICON.pass : ICON.error}<button class="fault" data-fault="${i}" aria-pressed="${i === state.fault}"><div class="title">${item.label}</div><div class="detail">${item.what} ${item.caught.length ? `Caught: ${item.raised.join(", ")}.` : "Missed."}</div></button></div>`).join("")}`
    : "";
  const framesHtml = exercise.images.length
    ? `<div class="frames">${exercise.images.map((src, i) => `<figure><img src="${src}" alt="" /><figcaption>Reference frame ${i + 1}</figcaption></figure>`).join("")}</div>`
    : "";
  panel.innerHTML = `
		<h3>Flags${fault ? " on this broken rep" : ""}</h3>${flagged}
		<h3>Form, checked against the app's instructions</h3>${form}
		<h3>Against the app's catalog</h3>
		<div class="stat"><span>Listed muscles among the model's most engaged<small>${names([...exercise.catalog.primary, ...exercise.catalog.secondary])}</small></span><span>${a.listedInTop} of ${a.listed}</span></div>
		<div class="stat"><span>Mean peak engagement<small>primary, secondary, unlisted</small></span><span>${pct(a.primaryMean)}% · ${pct(a.secondaryMean)}% · ${pct(a.otherMean)}%</span></div>
		${a.unexpected.length ? `<div class="stat"><span>Ranked high by the model, unlisted in the app<small>${names(a.unexpected)}</small></span><span>${a.unexpected.length}</span></div>` : ""}
		${a.stretched > 0 ? `<div class="stat"><span>Muscles the app marks as stretched that the model stretches<small>${names(exercise.catalog.stretched)}</small></span><span>${a.stretchedFound} of ${a.stretched}</span></div>` : ""}
		${framesHtml}
		${faultsSection}`;
  for (const button of panel.querySelectorAll<HTMLElement>(".fault")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.fault);
      state.fault = state.fault === index ? -1 : index;
      applyLoadedExercise(true);
    });
  }
  refresh = () => {};
}

function renderPanel() {
  const panel = $("panel");
  if (state.tab === "Muscles") renderMuscles(panel);
  else if (state.tab === "Tendons") renderTendons(panel);
  else renderReview(panel);
  const total = sequence.poses.length;
  $("flags").innerHTML = current()
    .issues.flatMap((issue) =>
      issue.frames.map(
        ([from, to]) =>
          `<i style="left:${(from / total) * 100}%;width:${((to - from + 1) / total) * 100}%;background:var(--${issue.severity === "error" ? "bad" : "warn"})"></i>`,
      ),
    )
    .join("");
  $("legend").innerHTML =
    state.mode === "Engagement"
      ? `<span>At rest</span><i style="background:linear-gradient(90deg,#5b5b60,#276ef1)"></i><span>Hardest this rep</span>`
      : `<span>Slack</span><i style="background:linear-gradient(90deg,#5b5b60,#f0883a)"></i><span>End of range</span>`;
  lastShown = -1;
}

function renderPlay() {
  $("play").innerHTML = state.playing ? ICON.pause : ICON.play;
  $("play").setAttribute("aria-label", state.playing ? "Pause" : "Play");
}

function renderDrawerList() {
  if (!isLibraryMode) return;
  const q = $<HTMLInputElement>("library-search").value.trim().toLowerCase();
  const cat = $<HTMLSelectElement>("filter-category").value;
  const mus = $<HTMLSelectElement>("filter-muscle").value;
  const filtered = libraryIndex.filter((item) => {
    if (cat && item.category !== cat) return false;
    if (mus && !item.primaryMuscles.includes(mus as Muscle) && !item.secondaryMuscles.includes(mus as Muscle)) {
      return false;
    }
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.equipmentLabel?.toLowerCase().includes(q) ?? false) ||
      (item.movementPattern?.toLowerCase().includes(q) ?? false) ||
      (item.alternativeNames?.some((n) => n.toLowerCase().includes(q)) ?? false)
    );
  });
  $("drawer-meta").textContent = `${filtered.length} of ${libraryIndex.length} exercises`;
  const list = $("drawer-list");
  const slice = filtered.slice(0, 200);
  list.innerHTML = slice
    .map(
      (item) =>
        `<button type="button" class="drawer-item" data-id="${item.id}" aria-selected="${item.id === state.exerciseId}">
          <span class="di-title">${item.name}</span>
          <span class="di-sub">${item.primaryMuscles.map((m) => MUSCLE_NAMES[m]).join(", ")}${item.equipmentLabel ? ` · ${item.equipmentLabel}` : ""}</span>
        </button>`,
    )
    .join("");
  for (const btn of list.querySelectorAll<HTMLButtonElement>(".drawer-item")) {
    btn.addEventListener("click", () => {
      $("library-drawer").hidden = true;
      $("picker-trigger").setAttribute("aria-expanded", "false");
      void selectExerciseById(btn.dataset.id!, true);
    });
  }
}

const frameA = { value: null as ReturnType<typeof newFrame> | null };
const pose = { value: new Float64Array(0) };
const qa = new Quaternion();
const qb = new Quaternion();
let lastShown = -1;
const stage = { width: 0, height: 0 };
let lastTime = performance.now();

function draw(now: number) {
  if (!activeExercise) {
    requestAnimationFrame(draw);
    return;
  }
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const count = sequence.poses.length;
  if (state.playing) state.frame = (state.frame + dt * sequence.fps * state.speed) % count;
  const i = Math.floor(state.frame) % count;
  const j = (i + 1) % count;
  const t = state.frame - Math.floor(state.frame);
  if (pose.value.length !== body.dofCount) pose.value = new Float64Array(body.dofCount);
  for (let d = 0; d < body.dofCount; d++)
    pose.value[d] = sequence.poses[i][d] + (sequence.poses[j][d] - sequence.poses[i][d]) * t;
  frameA.value ??= newFrame(body);
  figure.pose(fk(body, pose.value, frameA.value));
  const shown = Math.round(state.frame) % count;
  if (state.mode === "Engagement") {
    for (let k = 0; k < engagement.length; k++) {
      const a = analysis.activation[i][k];
      engagement[k] = (a + (analysis.activation[j][k] - a) * t) / hardest;
    }
    figure.tint(engagement, ENGAGE);
  } else {
    figure.tint(analysis.stretch[shown], STRETCH);
  }
  props.children.forEach((group, p) => {
    const a = sequence.propStates[i][p];
    const b = sequence.propStates[j][p];
    group.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t,
    );
    group.quaternion.copy(qa.set(...a.quat)).slerp(qb.set(...b.quat), t);
  });
  updateTethers(i, j, t);
  if (shown !== lastShown) {
    lastShown = shown;
    $<HTMLInputElement>("scrub").value = String(shown);
    refresh(shown);
  }
  const { clientWidth, clientHeight } = canvas.parentElement!;
  if (clientWidth !== stage.width || clientHeight !== stage.height) {
    const distance = camera.position.distanceTo(controls.target) / fitDistance();
    stage.width = clientWidth;
    stage.height = clientHeight;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    camera.position
      .sub(controls.target)
      .setLength(distance * fitDistance())
      .add(controls.target);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(draw);
}

async function init() {
  await preloadFigureAssets(".");

  const settingSelect = $<HTMLSelectElement>("setting");
  settingSelect.innerHTML = SETTINGS.map(
    (s) => `<option value="${s.id}">${s.label}</option>`,
  ).join("");
  settingSelect.value = state.setting;
  settingSelect.addEventListener("change", () => {
    state.setting = settingSelect.value as SettingId;
    stageEnv.apply(state.setting);
  });

  if (isLibraryMode) {
    $("exercises").hidden = true;
    $("library-picker").hidden = false;
    const resp = await fetch("./catalog.json");
    if (!resp.ok) throw new Error(`Failed to fetch catalog.json (${resp.status})`);
    libraryIndex = (await resp.json()) as CatalogSummary[];

    const categories = [...new Set(libraryIndex.map((e) => e.category))].sort();
    $<HTMLSelectElement>("filter-category").innerHTML =
      `<option value="">All categories</option>` +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    $<HTMLSelectElement>("filter-muscle").innerHTML =
      `<option value="">All muscles</option>` +
      MUSCLES.map((m) => `<option value="${m}">${MUSCLE_NAMES[m]}</option>`).join("");

    $("picker-trigger").addEventListener("click", () => {
      const drawer = $("library-drawer");
      drawer.hidden = !drawer.hidden;
      $("picker-trigger").setAttribute("aria-expanded", String(!drawer.hidden));
      if (!drawer.hidden) $<HTMLInputElement>("library-search").focus();
    });
    $("library-search").addEventListener("input", renderDrawerList);
    $("filter-category").addEventListener("change", renderDrawerList);
    $("filter-muscle").addEventListener("change", renderDrawerList);

    const startItem =
      libraryIndex.find((e) => e.id === state.exerciseId) ??
      libraryIndex[state.exerciseIndex] ??
      libraryIndex[0];
    if (!startItem) throw new Error("Library catalog is empty");
    await selectExerciseById(startItem.id, true, true);
  } else {
    const list = embedded.exercises!;
    const startEx =
      list.find((e) => e.sequence.id === state.exerciseId) ?? list[state.exerciseIndex] ?? list[0];
    state.exerciseIndex = Math.max(0, list.indexOf(startEx));
    segmented(
      "exercises",
      list.map((_, i) => i),
      state.exerciseIndex,
      (i) => list[i].sequence.name,
      (i) => {
        state.exerciseIndex = i;
        void selectExerciseById(list[i].sequence.id, true);
      },
    );
    await selectExerciseById(startEx.sequence.id, true, true);
  }

  segmented("tabs", TABS, state.tab, (tab) => tab, (tab) => {
    state.tab = tab;
    renderPanel();
  });
  segmented("modes", MODES, state.mode, (mode) => mode, (mode) => {
    state.mode = mode;
    renderPanel();
  });
  segmented("speeds", SPEEDS, state.speed, (speed) => `${speed}x`, (speed) => (state.speed = speed));
  segmented("views", VIEWS, state.view, (view) => view, setView);
  renderPlay();

  $("play").addEventListener("click", () => {
    state.playing = !state.playing;
    renderPlay();
  });
  $<HTMLInputElement>("scrub").addEventListener("input", (event) => {
    state.playing = false;
    state.frame = Number((event.target as HTMLInputElement).value);
    renderPlay();
  });
  $<HTMLInputElement>("load").addEventListener("input", (event) => {
    state.loadKg = Number((event.target as HTMLInputElement).value);
    buildProps();
    reanalyze();
    renderLoad();
    renderPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLSelectElement
    )
      return;
    if (event.key === " ") {
      event.preventDefault();
      $("play").click();
    }
  });

  // Programmatic hook for headless multi-view & multi-setting screenshot verification.
  (window as unknown as Record<string, unknown>).__MOTION_SET__ = async (opts: {
    id?: string;
    frame?: number;
    view?: (typeof VIEWS)[number];
    setting?: SettingId;
    mode?: (typeof MODES)[number];
    tab?: (typeof TABS)[number];
  }) => {
    if (opts.id && opts.id !== state.exerciseId) await selectExerciseById(opts.id, true);
    if (opts.setting) {
      state.setting = opts.setting;
      settingSelect.value = opts.setting;
      stageEnv.apply(opts.setting);
    }
    if (opts.view) setView(opts.view);
    if (opts.mode) {
      state.mode = opts.mode;
      select("modes", opts.mode);
      renderPanel();
    }
    if (opts.tab) {
      state.tab = opts.tab;
      select("tabs", opts.tab);
      renderPanel();
    }
    if (opts.frame !== undefined) {
      state.playing = false;
      state.frame = opts.frame;
      renderPlay();
    }
    draw(performance.now());
  };

  requestAnimationFrame(draw);
}

void init();
