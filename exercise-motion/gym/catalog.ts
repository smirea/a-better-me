export type ZoneId =
  | "free-weights"
  | "plate-loaded"
  | "pin-loaded"
  | "pro-strength"
  | "cables"
  | "functional"
  | "cardio"
  | "studio";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  shortName: string;
  accent: string;
  floor: "rubber" | "platform" | "turf" | "wood";
  description: string;
}

export const ZONES: readonly ZoneDef[] = [
  {
    id: "free-weights",
    name: "Free Weights & Racks",
    shortName: "Free Weights",
    accent: "#4d8bf5",
    floor: "platform",
    description: "Power racks, Smith machine, Olympic benches, dumbbell & barbell racks, plate storage.",
  },
  {
    id: "plate-loaded",
    name: "Plate-Loaded Strength",
    shortName: "Plate-Loaded",
    accent: "#e06c4d",
    floor: "rubber",
    description: "Iso-lateral and leverage plate-loaded presses, rows, squats, hip thrusts, and leg stations.",
  },
  {
    id: "pin-loaded",
    name: "Pin-Loaded Selectorized",
    shortName: "Pin-Loaded",
    accent: "#3db892",
    floor: "rubber",
    description: "Full-body pin-loaded single-station and dual-function selectorized weight stack machines.",
  },
  {
    id: "pro-strength",
    name: "Pro & Smart Strength",
    shortName: "Pro Strength",
    accent: "#8f75f5",
    floor: "rubber",
    description: "Contoured commercial selectorized and adaptive digital-resistance strength machines.",
  },
  {
    id: "cables",
    name: "Cable Stations & Multi-Gyms",
    shortName: "Cables",
    accent: "#38a3d1",
    floor: "rubber",
    description: "Cable crossovers, dual adjustable pulleys, multi-stack jungle towers, and cable walls.",
  },
  {
    id: "functional",
    name: "Functional Rigs & Turf",
    shortName: "Functional",
    accent: "#5cb85c",
    floor: "turf",
    description: "Modular floor and wall rigs, training cages, athletic cubes, and circuit training clusters.",
  },
  {
    id: "cardio",
    name: "Cardio Deck",
    shortName: "Cardio",
    accent: "#e89b3c",
    floor: "wood",
    description: "Treadmills, curved sled runners, indoor rowers, upper-body ergs, bikes, ellipticals, climbers.",
  },
  {
    id: "studio",
    name: "Studio & Recovery",
    shortName: "Studio",
    accent: "#c974a8",
    floor: "wood",
    description: "Stretching stations, Pilates reformers, mats, stability balls, and assessment consoles.",
  },
];

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));

export interface EquipmentMeta {
  id: string;
  name: string;
  zone: ZoneId;
  subgroup: string;
  size: [width: number, height: number, depth: number];
  tris: number;
  bytes: number;
}

const EXACT_RENAMES: Record<string, string> = {
  multipower: "Smith Machine",
  unica: "Compact Multi-Gym",
  skillmill: "Curved Sled Treadmill",
  skillrow: "Indoor Rowing Machine",
  skillrun: "Performance Treadmill",
  skillup: "Upper-Body Ergometer",
  skillupwallmounted: "Wall-Mounted Upper-Body Ergometer",
  technogymbench: "Compact Functional Bench",
  technogymride: "Smart Indoor Bike",
  technogymrun: "Commercial Slat Treadmill",
  technogymbike: "Studio Spin Bike",
  technogymcycle: "Compact Upright Cycle",
  technogymelliptical: "Compact Elliptical",
  technogymconnecteddumbbells: "Smart Adjustable Dumbbell Set",
  technogymreformpearlgrey: "Pilates Reformer (Pearl Grey)",
  technogymreformsandstone: "Pilates Reformer (Sandstone)",
  myrun: "Compact Home Treadmill",
  mywellnesskiosk: "Workout Info Kiosk",
  technogymcheckup7000: "Body Assessment Station (7000)",
  technogymcheckup9000: "Body Assessment Station (9000)",
  technogymvisio: "Wall Workout Display",
  technogymvisioselfstanding: "Freestanding Workout Display",
  olympicmlitarybench: "Olympic Military Press Bench",
  scottbench: "Preacher Curl Bench",
  scottbenchpure: "Plate-Loaded Preacher Curl Bench",
  flexabilityanterior: "Anterior Stretching Machine",
  flexabilityposterior: "Posterior Stretching Machine",
  kinesisone: "Dual-Column Cable Trainer",
  kinesispersonalheritageblack: "Wall Cable Station (Heritage Black)",
  kinesispersonalheritageleatherdarkbrown: "Wall Cable Station (Dark Leather)",
  kinesispersonalheritageleathergoldbrown: "Wall Cable Station (Tan Leather)",
  kinesispersonalvision: "Mirrored Wall Cable Station",
  groupcyclegrey: "Group Spin Bike (Graphite)",
  groupcycleyellow: "Group Spin Bike (Sport)",
  skilltoolsstorage: "Functional Accessories Rack",
  "t-rowbar": "T-Bar Row Station",
};

/** Turn a raw catalog label and product line into a clean, unbranded equipment name. */
export function debrandEquipmentName(id: string, rawLabel: string, line: string): string {
  const exact = EXACT_RENAMES[id];
  if (exact) return exact;

  let name = rawLabel
    .replace(/\bTechnogym\b/gi, "")
    .replace(/\bMywellness\b/gi, "Fitness")
    .replace(/\bScott\b/gi, "Preacher Curl")
    .replace(/\bMlitary\b/gi, "Military")
    .replace(/\bMultipower\b/gi, "Smith Machine")
    .replace(/\bKinesis\b/gi, "Cable Wall")
    .replace(/\bUniverse\b/gi, "Modular")
    .replace(/\bBiocircuit\b/gi, "Circuit Training")
    .replace(/\bBiostrength\b/gi, "Smart")
    .replace(/\bArtis\b/gi, "Pro")
    .replace(/\bExcite\b/gi, "Commercial")
    .replace(/\bSelection 900\b/gi, "(900)")
    .replace(/\bSelection 700\b/gi, "(700)")
    .replace(/\bPure\b/gi, "")
    .replace(/\bPersonal\b/gi, "Studio")
    .replace(/\bREV\b/gi, "(Adaptive)")
    .replace(/\bSynchro\b/gi, "Elliptical")
    .replace(/\bVario\b/gi, "Adaptive Strider")
    .replace(/\bClimb\b/gi, "Stair Climber")
    .replace(/\bRecline\b/gi, "Recumbent Bike")
    .replace(/\bRun\b/gi, "Treadmill")
    .replace(/\bTop\b/gi, "Upper-Body Cycle")
    .replace(/\bCross\b/gi, "Cross-Trainer")
    .replace(/\bWellness Ball\b/gi, "Stability Ball")
    .replace(/\s+/g, " ")
    .trim();

  if (line === "Pure strength" && !name.toLowerCase().startsWith("plate-loaded")) {
    name = `Plate-Loaded ${name}`;
  } else if (line === "Selection 900" || line === "Selection 700") {
    name = name.replace(/\s*\((900|700)\)$/, "");
    const suffix = line === "Selection 700" ? " (Compact)" : "";
    name = `Pin-Loaded ${name}${suffix}`;
  } else if (line === "Biostrength") {
    if (!name.toLowerCase().includes("press") && name === "Smart Shoulder") {
      name = "Smart Shoulder Press";
    }
  } else if (line === "Excite") {
    name = name.replace(/^(.+?)\s+Commercial$/, "Commercial $1");
  }

  return name.replace(/\s+/g, " ").trim();
}

export function classifyZone(id: string, line: string): ZoneId {
  switch (line) {
    case "Racks":
      return "free-weights";
    case "Free Weights, Benches & Tools":
      if (/(mat|ball|skilltools|universalstorage)/i.test(id)) return "studio";
      return "free-weights";
    case "Pure strength":
      return "plate-loaded";
    case "Selection 900":
    case "Selection 700":
      return "pin-loaded";
    case "Artis Strength":
    case "Biostrength":
    case "REV":
      return "pro-strength";
    case "Cable Stations":
    case "Kinesis":
    case "Unica":
      return "cables";
    case "Rigs":
    case "Universe":
    case "Biocircuit":
      return "functional";
    case "Artis Cardio":
    case "Excite":
    case "Skill":
    case "Group Cycle":
      return id === "technogymbench" ? "studio" : "cardio";
    case "My":
      return id.includes("dumbbell") ? "free-weights" : "cardio";
    case "Personal":
      if (/(dumbbell|kettlebell|powerrack|bench)/i.test(id)) return "free-weights";
      return "cardio";
    case "Flexability":
    case "Technogym Reform":
    case "Digital devices":
      return "studio";
    default:
      return "studio";
  }
}

export function classifySubgroup(name: string, zone: ZoneId): string {
  const n = name.toLowerCase();
  if (zone === "free-weights") {
    if (/rack|smith|platform/.test(n)) return "01-Racks & Platforms";
    if (/olympic.*bench|military/.test(n)) return "02-Olympic Benches";
    if (/bench|ghd|chin|dip|leg raise/.test(n)) return "03-Utility Benches & Towers";
    if (/dumbbell|kettlebell/.test(n)) return "04-Dumbbells & Kettlebells";
    return "05-Bars, Plates & Storage";
  }
  if (zone === "plate-loaded" || zone === "pin-loaded" || zone === "pro-strength") {
    if (/chest|pec|fly|dip/.test(n)) return "01-Chest";
    if (/shoulder|delt|overhead|flight/.test(n)) return "02-Shoulders";
    if (/lat|pull|row|back|traction|pullover/.test(n)) return "03-Back";
    if (/arm|bicep|tricep|curl/.test(n)) return "04-Arms";
    if (/abdom|crunch|torso/.test(n)) return "05-Core";
    return "06-Legs & Glutes";
  }
  if (zone === "cables") {
    if (/station|crossover/.test(n)) return "01-Multi-Stations & Crossovers";
    if (/pulley|tower/.test(n)) return "02-Pulley Towers";
    return "03-Cable Walls & Multi-Gyms";
  }
  if (zone === "functional") {
    if (/circuit/.test(n)) return "01-Training Circuits";
    if (/floor.*rig|cage|cube|multirack|tower/.test(n)) return "02-Floor Rigs & Cages";
    return "03-Wall Rigs & Storage Walls";
  }
  if (zone === "cardio") {
    if (/treadmill/.test(n)) return "01-Treadmills";
    if (/row|ergometer|upper-body/.test(n)) return "02-Rowers & Ergs";
    if (/elliptical|strider|cross-trainer|climber/.test(n)) return "03-Ellipticals & Climbers";
    return "04-Bikes & Cycles";
  }
  if (/reformer|stretch/.test(n)) return "01-Reformers & Stretching";
  if (/kiosk|assessment|display/.test(n)) return "03-Assessment & Displays";
  return "02-Mats, Balls & Studio";
}
