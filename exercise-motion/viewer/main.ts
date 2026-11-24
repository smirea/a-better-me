import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { analyze, type Analysis } from "../src/biomech";
import { createBody, fk, newFrame, type Body } from "../src/body";
import { propParts, type Material, type Part } from "../src/equipment";
import { kinematics, type CheckResult, type Kinematics, type Sequence } from "../src/exercise";
import { MUSCLE_NAMES, MUSCLES, TENDON_STRAIN_AT_PEAK, TENDONS, type Muscle } from "../src/muscles";
import { validateLoad, validateMotion, type Issue } from "../src/validate";
import { Figure } from "./figure";

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

interface ExerciseData {
  sequence: Sequence;
  checks: CheckResult[];
  catalog: { primary: Muscle[]; secondary: Muscle[]; stretched: Muscle[] };
  agreement: {
    listedInTop: number;
    listed: number;
    primaryMean: number;
    secondaryMean: number;
    otherMean: number;
    unexpected: Muscle[];
    stretchedFound: number;
    stretched: number;
  };
  faults: FaultData[];
  images: string[];
}

const data: { exercises: ExerciseData[] } = JSON.parse(
  document.getElementById("data")!.textContent,
);
const params = new URLSearchParams(location.hash.slice(1));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ENGAGE = new Color("#276ef1");
const STRETCH = new Color("#f0883a");
const TABS = ["Muscles", "Tendons", "Review"] as const;
const VIEWS = ["Front", "Back", "Side", "Angle", "Top"] as const;
const MODES = ["Engagement", "Stretch"] as const;
const SPEEDS = [0.25, 0.5, 1];
const PHASE_NAMES = { lower: "Lower", bottom: "Bottom", raise: "Lift", top: "Top" };

const state = {
  exercise: Number(params.get("ex") ?? 0),
  fault: params.has("fault") ? Number(params.get("fault")) : -1,
  frame: Number(params.get("frame") ?? 0),
  playing: params.get("play") !== "0",
  speed: Number(params.get("speed") ?? 1),
  mode: (params.get("mode") ?? "Engagement") as (typeof MODES)[number],
  tab: (params.get("tab") ?? "Muscles") as (typeof TABS)[number],
  view: (params.get("view") ?? "Angle") as (typeof VIEWS)[number],
  loadKg: 0,
};

let body: Body;
let sequence: Sequence;
let kin: Kinematics;
let analysis: Analysis;
let issues: Issue[] = [];
let figure: Figure;

const canvas = $<HTMLCanvasElement>("canvas");
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new Scene();
// A clean stage is the lifter and the equipment on white with no controls, for recording a rep as video.
const clean = params.get("clean") === "1";
document.documentElement.classList.toggle("clean", clean);
scene.background = new Color(clean ? "#ffffff" : "#151414");
const camera = new PerspectiveCamera(32, 1, 0.1, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 9;
scene.add(new HemisphereLight("#ffffff", "#2a2622", 1.6), new AmbientLight("#ffffff", 0.35));
const key = new DirectionalLight("#ffffff", 2.2);
key.position.set(-2.5, 4, 3.5);
const rim = new DirectionalLight("#9db8ff", 1.2);
rim.position.set(3, 2.5, -3.5);
const undersideLight = new DirectionalLight("#ffffff", 1.5);
undersideLight.position.set(-2, -4, 1.5);
scene.add(key, rim, undersideLight);
const floor = new Mesh(
  new CircleGeometry(3.2, 64),
  new MeshStandardMaterial({ color: "#1c1b1b", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
const grid = new GridHelper(6, 12, "#2b2929", "#242222");
if (!clean) scene.add(floor, grid);

const MATERIALS: Record<Material, MeshStandardMaterial> = {
  steel: new MeshStandardMaterial({ color: "#444850", roughness: 0.55, metalness: 0.5 }),
  chrome: new MeshStandardMaterial({ color: "#c4c8cf", roughness: 0.28, metalness: 0.85 }),
  pad: new MeshStandardMaterial({ color: "#232427", roughness: 0.9 }),
  plate: new MeshStandardMaterial({ color: "#19191b", roughness: 0.6, metalness: 0.2 }),
  rubber: new MeshStandardMaterial({ color: "#8b4334", roughness: 0.9 }),
};
const equipment = new Group();
const props = new Group();
const figureSlot = new Group();
scene.add(equipment, props, figureSlot);

function partMesh(part: Part) {
  const geometry =
    part.shape === "box"
      ? new BoxGeometry(...part.size)
      : new CylinderGeometry(part.size[0], part.size[0], part.size[1], 32).rotateZ(Math.PI / 2);
  const mesh = new Mesh(geometry, MATERIALS[part.material]);
  mesh.position.set(...part.pos);
  mesh.quaternion.set(...part.quat);
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

function setView(view: (typeof VIEWS)[number]) {
  state.view = view;
  const lying = sequence.support.kind === "lying";
  const underside = lying && view === "Back";
  controls.maxPolarAngle = underside ? Math.PI - 0.02 : Math.PI / 2 - 0.02;
  floor.visible = grid.visible = equipment.visible = !underside;
  undersideLight.visible = underside;
  const offset = {
    Front: lying ? new Vector3(0, 0.3, 1) : new Vector3(0, 0, 1),
    Back: lying ? new Vector3(0, -1, -0.02) : new Vector3(0, 0, -1),
    Side: new Vector3(-1, 0.06, 0),
    Angle: lying ? new Vector3(-0.7, 0.45, 0.62) : new Vector3(-0.66, 0.2, 0.72),
    Top: new Vector3(0, 1, 0.02),
  }[view];
  controls.target.copy(fit.center);
  camera.position.copy(fit.center).addScaledVector(offset.normalize(), fitDistance());
  controls.update();
  select("views", view);
}

/** The sphere the camera frames, measured once per rep at the start position. */
const fit = new Sphere();

// Framed on the lifter, not the machine: a Smith machine is twice the lifter's width and would shrink the figure to
// a third of the stage. The frame grows only far enough to keep a hint of the equipment around it.
function measureFit() {
  figure.pose(kin.frames[0]);
  const lifter = figure.bounds().getBoundingSphere(new Sphere());
  const everything = figure.bounds().union(new Box3().setFromObject(equipment)).getBoundingSphere(new Sphere());
  fit.center.copy(lifter.center).lerp(everything.center, 0.25);
  fit.radius = Math.max(lifter.radius * 1.12, everything.radius * 0.62);
}

// A stage narrower than it is tall has to back off until the scene fits its width.
const fitDistance = () =>
  ((fit.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.04) /
  Math.min(1, camera.aspect * 1.15);

function reanalyze() {
  analysis = analyze(body, sequence, kin, state.loadKg);
  // The weight changes the plates and dumbbell heads, so what clips is checked again at the weight on screen.
  const loaded = { ...sequence, loadKg: state.loadKg };
  issues = [...validateMotion(body, loaded, kin), ...validateLoad(loaded, analysis)];
}

function current() {
  const exercise = data.exercises[state.exercise];
  const fault = state.fault >= 0 ? exercise.faults[state.fault] : undefined;
  return {
    exercise,
    fault,
    issues,
    checks: fault?.checks ?? exercise.checks,
  };
}

function load(resetLoad: boolean) {
  const { exercise, fault } = current();
  sequence = fault?.sequence ?? exercise.sequence;
  if (!body || body.height !== sequence.lifter.height) {
    body = createBody(sequence.lifter.height, sequence.lifter.mass);
    figure = new Figure(body);
    figureSlot.clear();
    figureSlot.add(figure.group);
  }
  figure.setPressGrip(sequence.props.some((prop) => prop.kind !== "dumbbell"));
  kin = kinematics(body, sequence);
  if (resetLoad) state.loadKg = Number(params.get("load") ?? sequence.loadKg);
  state.frame = Math.min(state.frame, sequence.poses.length - 1);
  equipment.clear();
  for (const part of sequence.equipment) equipment.add(partMesh(part));
  buildProps();
  reanalyze();

  const slider = $<HTMLInputElement>("load");
  slider.max = sequence.loadUnit === "perSide" ? "80" : "260";
  slider.value = String(state.loadKg);
  $("load-label").textContent =
    sequence.loadUnit === "perSide" ? "Each dumbbell" : "Bar and plates";
  $<HTMLInputElement>("scrub").max = String(sequence.poses.length - 1);
  const total = sequence.poses.length;
  $("phases").innerHTML = sequence.phases
    .map(
      (phase) =>
        `<span style="flex:${phase.to - phase.from + 1} 1 0">${(phase.to - phase.from + 1) / total > 0.12 ? PHASE_NAMES[phase.name] : ""}</span>`,
    )
    .join("");
  const note = $("variant-note");
  note.hidden = !fault;
  if (fault) note.innerHTML = `<strong>Detector test: ${fault.label}.</strong> ${fault.what}`;
  measureFit();
  setView(state.view);
  renderLoad();
  renderPanel();
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
  const x = (i: number) => (i / (values.length - 1)) * w;
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
    const x = String((frame / (sequence.poses.length - 1)) * 96);
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
  panel.innerHTML = `
		<h3>Flags${fault ? " on this broken rep" : ""}</h3>${flagged}
		<h3>Form, checked against the app's instructions</h3>${form}
		<h3>Against the app's catalog</h3>
		<div class="stat"><span>Listed muscles among the model's most engaged<small>${names([...exercise.catalog.primary, ...exercise.catalog.secondary])}</small></span><span>${a.listedInTop} of ${a.listed}</span></div>
		<div class="stat"><span>Mean peak engagement<small>primary, secondary, unlisted</small></span><span>${pct(a.primaryMean)}% · ${pct(a.secondaryMean)}% · ${pct(a.otherMean)}%</span></div>
		${a.unexpected.length ? `<div class="stat"><span>Ranked high by the model, unlisted in the app<small>${names(a.unexpected)}</small></span><span>${a.unexpected.length}</span></div>` : ""}
		<div class="stat"><span>Muscles the app marks as stretched that the model stretches<small>${names(exercise.catalog.stretched)}</small></span><span>${a.stretchedFound} of ${a.stretched}</span></div>
		<div class="frames">${exercise.images.map((src, i) => `<figure><img src="${src}" alt="" /><figcaption>The app's ${i === 0 ? "first" : "second"} frame</figcaption></figure>`).join("")}</div>
		<h3>Detector tests</h3>
		<p class="note">Each one breaks this rep on purpose. Pick one to watch it and see what gets flagged.</p>
		${exercise.faults.map((item, i) => `<div class="item">${item.caught.length ? ICON.pass : ICON.error}<button class="fault" data-fault="${i}" aria-pressed="${i === state.fault}"><div class="title">${item.label}</div><div class="detail">${item.what} ${item.caught.length ? `Caught: ${item.raised.join(", ")}.` : "Missed."}</div></button></div>`).join("")}`;
  for (const button of panel.querySelectorAll<HTMLElement>(".fault")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.fault);
      state.fault = state.fault === index ? -1 : index;
      load(true);
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
      ? `<span>At rest</span><i style="background:linear-gradient(90deg,#5b5b60,#276ef1)"></i><span>All it has</span>`
      : `<span>Slack</span><i style="background:linear-gradient(90deg,#5b5b60,#f0883a)"></i><span>End of range</span>`;
  lastShown = -1;
}

function renderPlay() {
  $("play").innerHTML = state.playing ? ICON.pause : ICON.play;
  $("play").setAttribute("aria-label", state.playing ? "Pause" : "Play");
}

const frameA = { value: null as ReturnType<typeof newFrame> | null };
const pose = { value: new Float64Array(0) };
const qa = new Quaternion();
const qb = new Quaternion();
let lastShown = -1;
const stage = { width: 0, height: 0 };
let lastTime = performance.now();

function draw(now: number) {
  // The first callback can carry a timestamp from before this script ran.
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
  figure.tint(
    state.mode === "Engagement" ? analysis.activation[shown] : analysis.stretch[shown],
    state.mode === "Engagement" ? ENGAGE : STRETCH,
  );
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
  if (shown !== lastShown) {
    lastShown = shown;
    $<HTMLInputElement>("scrub").value = String(shown);
    refresh(shown);
  }
  const { clientWidth, clientHeight } = canvas.parentElement!;
  // Compared against the stage's own size, not the canvas's pixel size: at a fractional pixel ratio the two never
  // agree after rounding, and a resize that fires every frame would reset the camera each time.
  if (clientWidth !== stage.width || clientHeight !== stage.height) {
    const distance = camera.position.distanceTo(controls.target) / fitDistance();
    stage.width = clientWidth;
    stage.height = clientHeight;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    // Keeps the angle the viewer chose and only backs off or closes in for the new shape.
    camera.position
      .sub(controls.target)
      .setLength(distance * fitDistance())
      .add(controls.target);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(draw);
}

segmented(
  "exercises",
  data.exercises.map((_, i) => i),
  state.exercise,
  (i) => data.exercises[i].sequence.name,
  (i) => {
    state.exercise = i;
    state.fault = -1;
    state.frame = 0;
    load(true);
  },
);
segmented(
  "tabs",
  TABS,
  state.tab,
  (tab) => tab,
  (tab) => {
    state.tab = tab;
    renderPanel();
  },
);
segmented(
  "modes",
  MODES,
  state.mode,
  (mode) => mode,
  (mode) => {
    state.mode = mode;
    renderPanel();
  },
);
segmented(
  "speeds",
  SPEEDS,
  state.speed,
  (speed) => `${speed}x`,
  (speed) => (state.speed = speed),
);
load(true);
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
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.key === " ") {
    event.preventDefault();
    $("play").click();
  }
});
requestAnimationFrame(draw);
