/**
 * Collapses the catalog's raw equipment labels onto canonical machines and props.
 *
 * Every label in `exercises.json` (`resistanceEquipment` and `supportEquipment`) must match exactly one
 * rule; `scripts/machines/cluster-catalog.ts` fails on a label no rule claims. Ids in `BUILT` have a GLB
 * and a factory; every other id is a named canonical cluster that is not modelled yet (Tier 2) or
 * deliberately out of scope (Tier 3).
 */

export const BUILT_MACHINES = [
  "adjustable-bench",
  "power-rack",
  "olympic-incline-bench",
  "dual-adjustable-pulley",
  "single-cable-tower",
  "lat-pulldown",
  "seated-cable-row",
  "smith-machine",
  "leg-press-45",
  "leg-extension",
  "seated-leg-curl",
  "chest-press-machine",
  "dip-pullup-station",
  "preacher-bench",
  "back-extension-bench",
  "plyo-box",
  "aerobic-step",
  "landmine",
  "decline-bench",
  "ghd",
  "slant-board",
] as const;

/** Drawn by the engine without a GLB: a `TetherDef` of kind "band" (src/equipment.ts). */
export const ENGINE_BUILT = ["tether-band"] as const;

export const BUILT_PROPS = [
  "prop-trap-bar",
  "prop-safety-squat-bar",
  "prop-axle-bar",
  "prop-stability-ball",
  "prop-ab-wheel",
  "prop-barbell",
  "prop-plates",
  "prop-dumbbell",
  "prop-kettlebell",
  "prop-ez-bar",
  "prop-d-handle",
  "prop-lat-bar",
  "prop-v-bar",
  "prop-rope",
  "prop-medicine-ball",
] as const;

/** Clusters named here but not modelled: each would be one more canonical GLB. */
export const TIER2 = [
  "hack-squat",
  "belt-squat",
  "seated-leg-press",
  "lying-leg-curl",
  "standing-leg-curl",
  "hip-abductor-adductor",
  "multi-hip",
  "calf-raise-machine",
  "pec-deck",
  "press-machine",
  "row-machine",
  "t-bar-row",
  "arm-machine",
  "ab-crunch-machine",
  "torso-rotation",
  "assisted-dip-chin",
  "split-squat-stand",
  "sissy-squat",
  "nordic-bench",
  "neck-machine",
  "forearm-machine",
  "shrug-machine",
  "reverse-hyper",
  "prop-specialty-bar",
  "prop-weighted-vest",
  "prop-ankle-weight",
  "prop-belt",
  "prop-wrist-roller",
  "prop-bench-board",
  "prop-ankle-cuff",
  "prop-rings",
  "prop-small-tools",
] as const;

/** Out of scope for lifting motion: cardio, aquatic, partner, and household-only setups. */
export const TIER3 = ["cardio", "pool", "partner"] as const;

export type CanonicalId =
  | (typeof BUILT_MACHINES)[number]
  | (typeof BUILT_PROPS)[number]
  | (typeof ENGINE_BUILT)[number]
  | (typeof TIER2)[number]
  | (typeof TIER3)[number];

export interface ExerciseContext {
  name: string;
  movementPatterns: string[];
}

export interface Rule {
  match: RegExp;
  /** Canonical ids the label needs, or a function of the exercise for combo machines. */
  ids: CanonicalId[] | ((ex: ExerciseContext) => CanonicalId[]);
  /** True when the canonical stands in for something visibly different (a couch drawn as a bench). */
  substitute?: boolean;
  note?: string;
}

const isCurl = (ex: ExerciseContext) => /curl/i.test(ex.name);
const PLATES: CanonicalId[] = ["prop-plates"];

/** First match wins, so specific labels come before general ones. */
export const RESISTANCE_RULES: Rule[] = [
  { match: /^Bodyweight only$/, ids: [] },
  // Cable: every dual-column variant is one articulated rig.
  { match: /cable crossover|functional trainer|dual handle cable tower|Motorized dual cable|Total quad\/hip dual cable/i, ids: ["dual-adjustable-pulley"] },
  { match: /single cable machine|Single digital cable trainer|high\/low pulley|high pulley cable system|lat pulldown\/low row rack attachment/i, ids: ["single-cable-tower"] },
  { match: /^Seated (dual )?cable row$/i, ids: ["seated-cable-row"] },
  { match: /lat pulldown/i, ids: ["lat-pulldown"], note: "Pin/plate/dual-cable/fixed/front pulldowns share one station." },
  { match: /^Smith machine and weight plates$/, ids: ["smith-machine", ...PLATES] },
  { match: /^45° leg press$/, ids: ["leg-press-45", ...PLATES] },
  { match: /leg press/i, ids: ["seated-leg-press"] },
  { match: /leg extension\/leg curl combo|leg curl\/leg extension combo/i, ids: (ex) => (isCurl(ex) ? ["seated-leg-curl"] : ["leg-extension"]) },
  { match: /leg extension$/i, ids: ["leg-extension"] },
  { match: /^Seated (pin|plate)-loaded leg curl$/i, ids: ["seated-leg-curl"] },
  { match: /^Lying (pin|plate)-loaded leg curl$/i, ids: ["lying-leg-curl"] },
  { match: /(Kneeling|Standing) (pin|plate)-loaded leg curl/i, ids: ["standing-leg-curl"] },
  { match: /chest press$|^Horizontal (pin|plate)-loaded chest press$|wide chest press/i, ids: ["chest-press-machine"] },
  { match: /incline press|decline press|shoulder press|Viking press|super incline|incline bench press$|^Seated (pin|plate)-loaded dip$/i, ids: ["press-machine"] },
  { match: /pec deck|chest fly with arm pads|pec fly|incline fly/i, ids: ["pec-deck"] },
  { match: /T-bar row/i, ids: ["t-bar-row"] },
  { match: /row/i, ids: ["row-machine"] },
  { match: /hip abductor|hip adductor|abductor\/adductor/i, ids: ["hip-abductor-adductor"] },
  { match: /multi-hip|glute kickback|hip thrust/i, ids: ["multi-hip"] },
  { match: /calf raise|calf press|calf extension|Tibialis|Tib bar/i, ids: ["calf-raise-machine"] },
  { match: /hack squat|Pendulum squat|V-squat|Power squat pro|Leverage squat|Pin-loaded squat|Lunge machine|Step-up machine|Power runner/i, ids: ["hack-squat"] },
  { match: /belt squat/i, ids: ["belt-squat"] },
  { match: /preacher curl|biceps curl|triceps extension|triceps pushdown|Rotator cuff|pullover|lateral raise|Standing multi flight|iso-lateral high biceps/i, ids: ["arm-machine"] },
  { match: /crunch|Ab coaster|Incline sliding core trainer/i, ids: ["ab-crunch-machine"] },
  { match: /torso rotation|Combo twist/i, ids: ["torso-rotation"] },
  { match: /assisted pull-up\/dip/i, ids: ["assisted-dip-chin"] },
  { match: /45° back extension/i, ids: ["back-extension-bench"] },
  { match: /back extension/i, ids: ["ab-crunch-machine"], note: "Seated/combo back extension shares the crunch-machine cluster." },
  { match: /reverse hyperextension/i, ids: ["reverse-hyper"] },
  { match: /Nordic hamstring/i, ids: ["nordic-bench"] },
  { match: /4-way neck|Head harness/i, ids: ["neck-machine"] },
  { match: /Multi-forearm|Wrist curl machine|gripper|Hand gripper/i, ids: ["forearm-machine"] },
  { match: /shrug|Shrug\/deadlift machine/i, ids: ["shrug-machine"] },
  { match: /^Jammer$/, ids: ["landmine"] },
  // Free weights.
  { match: /^(Barbell and weight plates|Fixed-weight straight bar)$/, ids: ["prop-barbell", ...PLATES] },
  { match: /^Barbell, weight plates, and long resistance bands$/, ids: ["prop-barbell", ...PLATES, "tether-band"] },
  { match: /EZ bar/i, ids: ["prop-ez-bar", ...PLATES] },
  { match: /trap bar/i, ids: ["prop-trap-bar", ...PLATES], note: "Open and closed trap bars share the hex bar." },
  { match: /Safety squat bar/i, ids: ["prop-safety-squat-bar", ...PLATES] },
  { match: /Axle bar/i, ids: ["prop-axle-bar", ...PLATES] },
  { match: /Cambered|Buffalo bar|Marrs bar|Swiss bar|Strongman log|Yoke|T-bell|Farmer’s handles|End-loaded baseball bat|^Hammer$|Wrist bar/i, ids: ["prop-specialty-bar", ...PLATES] },
  { match: /Wrist roller/i, ids: ["prop-wrist-roller"] },
  { match: /Dip belt|Pull-up belt/i, ids: ["prop-belt", ...PLATES] },
  { match: /dumbbell/i, ids: ["prop-dumbbell"], note: "Fat-grip and plate-loaded adjustable dumbbells draw as the hex dumbbell." },
  { match: /kettlebell/i, ids: ["prop-kettlebell"] },
  { match: /^Weight plates?$/, ids: PLATES },
  { match: /Medicine Ball/i, ids: ["prop-medicine-ball"] },
  { match: /resistance band|elastic band/i, ids: ["tether-band"] },
  { match: /Weighted vest/i, ids: ["prop-weighted-vest"] },
  { match: /Ankle Weight/i, ids: ["prop-ankle-weight"] },
  { match: /Battle ropes|Sled and weight plates/i, ids: ["prop-small-tools"] },
  { match: /Treadmill|bike|Elliptical|Rowing machine|SkiErg|Stair climber|VersaClimber|Jacobs Ladder/i, ids: ["cardio"] },
  { match: /^Pool$/, ids: ["pool"] },
];

export const SUPPORT_RULES: Rule[] = [
  { match: /Decline bench/i, ids: ["decline-bench"] },
  { match: /^Incline bench press station$/, ids: ["olympic-incline-bench"] },
  { match: /bench press board\/block/i, ids: ["adjustable-bench", "power-rack", "prop-bench-board"] },
  { match: /^Flat bench press station$/, ids: ["adjustable-bench", "power-rack"], note: "A bench station is the bench inside the rack's J-hooks." },
  { match: /Seated overhead press station/i, ids: ["adjustable-bench", "power-rack"] },
  { match: /Landmine/i, ids: ["landmine"] },
  { match: /split squat roller/i, ids: ["split-squat-stand"] },
  { match: /Nordic/i, ids: ["nordic-bench"] },
  { match: /Glute ham developer/i, ids: ["ghd"] },
  { match: /Roman chair/i, ids: ["back-extension-bench"] },
  { match: /Preacher curl bench/i, ids: ["preacher-bench"] },
  { match: /Seal row bench/i, ids: ["row-machine"] },
  { match: /Smith machine/i, ids: ["smith-machine"] },
  { match: /assisted pull-up\/dip/i, ids: ["assisted-dip-chin"] },
  { match: /leg curl/i, ids: ["lying-leg-curl"] },
  { match: /Sissy squat/i, ids: ["sissy-squat"] },
  { match: /pull-up bar|Dip bars|Captain’s chair|Dip\/pull-up\/belt squat belt/i, ids: ["dip-pullup-station"] },
  { match: /Gymnastics Rings|Suspension trainer/i, ids: ["prop-rings"] },
  { match: /Cuff cable attachment/i, ids: ["prop-ankle-cuff"] },
  { match: /Anchor point|resistance band/i, ids: ["tether-band"] },
  { match: /Slant Board/i, ids: ["slant-board"] },
  { match: /Stability ball/i, ids: ["prop-stability-ball"] },
  { match: /Ab Wheel/i, ids: ["prop-ab-wheel"] },
  { match: /^(Couch|Chair|Bed)$/, ids: ["adjustable-bench"], substitute: true, note: "Household seats draw as the bench at the matching height." },
  { match: /^Staircase$/, ids: ["aerobic-step"], substitute: true },
  { match: /Another human/i, ids: ["partner"] },
  {
    match: /Stability ball|Bosu|Ab Wheel|Slant Board|Yoga blocks|Jump rope|Furniture slider|Push-up handles|Sled pulling/i,
    ids: ["prop-small-tools"],
  },
  { match: /^Medicine Ball$/, ids: ["prop-medicine-ball"] },
  // Combos: everything below is split on "and" / "," and each piece mapped by PIECE_RULES.
];

/** Pieces of compound support labels ("Adjustable bench, squat stand, and plyometric box"). */
export const PIECE_RULES: Rule[] = [
  { match: /^(adjustable|flat|seated) bench$|^hip thrust bench$|^bench$/i, ids: ["adjustable-bench"] },
  { match: /^(flat bench station)$/i, ids: ["adjustable-bench", "power-rack"] },
  { match: /^(power rack|squat stand|barbell and power rack|barbell)$/i, ids: ["power-rack"] },
  { match: /^(plyometric box(es)?|squat box)$/i, ids: ["plyo-box"] },
  { match: /^(aerobic steps?|deadlift blocks?|calf raise block)$/i, ids: ["aerobic-step"] },
  { match: /^bumper plates?$|^weight plates?$/i, ids: PLATES },
  { match: /^split squat roller( stand)?$/i, ids: ["split-squat-stand"] },
  { match: /^bench press board\/block$/i, ids: ["prop-bench-board"] },
];

/** Cable attachment the exercise draws with, from its name. */
export function cableAttachmentFor(ex: ExerciseContext): CanonicalId {
  const n = ex.name.toLowerCase();
  if (/rope|face pull/.test(n)) return "prop-rope";
  if (/pulldown|pull-down|straight-arm|lat pull/.test(n)) return "prop-lat-bar";
  if (/close[- ]grip|v-bar|v-handle|seated cable row|seated row/.test(n)) return "prop-v-bar";
  return "prop-d-handle";
}
