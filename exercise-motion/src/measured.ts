import type { Muscle } from "./muscles";

/**
 * How hard a muscle group works in an exercise according to electromyography, read across the studies that measured
 * it: the one or two muscles that lead, the ones every study finds clearly working, the ones that tick over, and
 * the ones that stay quiet.
 */
export type Tier = "prime" | "synergist" | "moderate" | "quiet";
export const TIERS: Tier[] = ["prime", "synergist", "moderate", "quiet"];

export interface MeasuredMuscle {
  tier: Tier;
  /**
   * Lowest and highest study value while lifting, as a percentage of a maximal voluntary contraction. Studies
   * normalise differently, so the same muscle in the same lift ranges two- to four-fold: a range to sit near, not
   * a number to match.
   */
  lifting: [number, number];
  /** Activity while lowering as a share of activity while lifting, where a study split the two. */
  lowering?: [number, number];
  sources: (keyof typeof SOURCES)[];
  /** What makes the figure weaker than it looks: one study, another lift's data, one head of the group. */
  caveat?: string;
  /**
   * The studies measured one head that does a different job from the rest of the group (adductor longus, not the
   * adductor magnus that extends the hip; the triceps' long head, which also pulls the arm down). Kept for the
   * record and left out of the scoring.
   */
  oneHead?: true;
}

export interface MeasuredExercise {
  /** What the studies loaded, to set against the load the model is run at. */
  load: string;
  muscles: Partial<Record<Muscle, MeasuredMuscle>>;
}

export const SOURCES = {
  park2022: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9602963",
  swinton2012: "https://ojs.ub.uni-konstanz.de/cpa/article/view/5378/4946",
  contreras2015: "https://pubmed.ncbi.nlm.nih.gov/26214739/",
  yavuz2017: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5435978",
  straub2024: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10987311",
  martinFuentes2020LegPress: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7369968",
  stien2021: "https://www.jssm.org/jssm-20-56.xml-Fulltext",
  freeman2006: "https://pubmed.ncbi.nlm.nih.gov/16540847/",
  kowalski2021: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9121296",
  kang2014: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4085219",
  gioftsos2016: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4968519",
  mccurdy2025: "https://journal.iusca.org/index.php/Journal/article/download/370/482/4963",
  martinFuentes2020Deadlift: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7046193",
  signorile2002: "https://pubmed.ncbi.nlm.nih.gov/12423182/",
  edelburg2017: "https://minds.wisconsin.edu/bitstream/handle/1793/76924/Edelburg_Holly_Thesis.pdf",
  buonsenso2025: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12452428",
  lehman2004: "https://pmc.ncbi.nlm.nih.gov/articles/PMC449729",
} as const;

/**
 * Measured muscle activity for the exercises that have been studied, keyed by exercise id. `scripts/measured.ts`
 * holds the model against it. Only what a study measured is listed: a muscle missing here was not found quiet, it
 * was not wired up.
 */
export const MEASURED: Record<string, MeasuredExercise> = {
  "barbell-back-squat": {
    load: "60% of a one-rep maximum to a ten-rep maximum, 61 to 88 kg, trained lifters",
    muscles: {
      quads: {
        tier: "prime",
        lifting: [42, 110],
        lowering: [0.58, 0.87],
        sources: ["park2022", "swinton2012", "contreras2015"],
      },
      glutes: {
        tier: "synergist",
        lifting: [28, 67],
        lowering: [0.29, 0.29],
        sources: ["swinton2012", "contreras2015", "yavuz2017"],
      },
      lower_back: {
        tier: "synergist",
        lifting: [21, 76],
        lowering: [0.81, 1.07],
        sources: ["park2022", "swinton2012"],
      },
      hamstrings: {
        tier: "moderate",
        lifting: [15, 56],
        lowering: [0.52, 0.82],
        sources: ["park2022", "swinton2012", "contreras2015"],
      },
      calves: { tier: "moderate", lifting: [14, 45], lowering: [0.57, 0.57], sources: ["swinton2012", "straub2024"] },
      obliques: { tier: "moderate", lifting: [11, 22], lowering: [0.42, 0.82], sources: ["park2022", "swinton2012"] },
      adductors: {
        tier: "moderate",
        lifting: [13, 23],
        sources: ["straub2024"],
        caveat: "Adductor longus only. Adductor magnus, the head that extends the hip, has not been measured.",
        oneHead: true,
      },
      abs: { tier: "quiet", lifting: [3, 10], lowering: [0.39, 0.82], sources: ["park2022", "swinton2012"] },
    },
  },
  "45-deg-leg-press": {
    load: "40% of a one-rep maximum to a six-rep maximum, mostly on horizontal machines",
    muscles: {
      quads: { tier: "prime", lifting: [31, 105], sources: ["martinFuentes2020LegPress", "stien2021"] },
      glutes: {
        tier: "synergist",
        lifting: [39, 88],
        sources: ["martinFuentes2020LegPress", "stien2021"],
        caveat: "Two studies with different reference contractions: about three quarters of the vasti at 40% load.",
      },
      hamstrings: { tier: "moderate", lifting: [11, 37], sources: ["martinFuentes2020LegPress", "stien2021"] },
      calves: { tier: "moderate", lifting: [14, 40], sources: ["martinFuentes2020LegPress"] },
      adductors: {
        tier: "quiet",
        lifting: [7, 7],
        sources: ["martinFuentes2020LegPress"],
        caveat: "Adductor longus at a light load, one study. Adductor magnus has not been measured.",
        oneHead: true,
      },
    },
  },
  "push-up": {
    load: "Bodyweight",
    muscles: {
      chest: { tier: "prime", lifting: [24, 79], sources: ["freeman2006", "kowalski2021", "kang2014"] },
      triceps: { tier: "prime", lifting: [14, 101], sources: ["freeman2006", "kowalski2021"] },
      serratus: { tier: "synergist", lifting: [15, 92], sources: ["kowalski2021", "gioftsos2016"] },
      front_delts: { tier: "synergist", lifting: [26, 71], sources: ["freeman2006", "kowalski2021"] },
      abs: { tier: "moderate", lifting: [20, 25], sources: ["freeman2006", "kang2014"] },
      obliques: { tier: "moderate", lifting: [22, 27], sources: ["freeman2006"] },
      upper_back: { tier: "moderate", lifting: [6, 59], sources: ["kowalski2021"] },
      lats: { tier: "moderate", lifting: [11, 14], sources: ["freeman2006"] },
      upper_traps: {
        tier: "quiet",
        lifting: [3, 51],
        sources: ["kowalski2021"],
        caveat: "Median of eight studies is 11; two report 45 to 51.",
      },
      lower_back: { tier: "quiet", lifting: [3, 5], sources: ["freeman2006"] },
      biceps: { tier: "quiet", lifting: [4, 4], sources: ["freeman2006"] },
    },
  },
  "dumbbell-romanian-deadlift": {
    load: "Barbell Romanian and stiff-leg deadlifts at an 8 to 12-rep maximum, about 70 kg; nothing measures dumbbells",
    muscles: {
      hamstrings: {
        tier: "prime",
        lifting: [38, 72],
        lowering: [0.4, 0.6],
        sources: ["mccurdy2025", "martinFuentes2020Deadlift"],
      },
      lower_back: {
        tier: "prime",
        lifting: [69, 100],
        lowering: [0.55, 0.66],
        sources: ["mccurdy2025", "martinFuentes2020Deadlift"],
      },
      glutes: {
        tier: "synergist",
        lifting: [42, 59],
        lowering: [0.4, 0.58],
        sources: ["mccurdy2025", "martinFuentes2020Deadlift"],
      },
      upper_back: {
        tier: "synergist",
        lifting: [75, 75],
        lowering: [0.92, 0.92],
        sources: ["mccurdy2025"],
        caveat: "One study, with a spread between lifters as large as the mean.",
      },
      lats: {
        tier: "synergist",
        lifting: [53, 53],
        lowering: [0.94, 0.94],
        sources: ["mccurdy2025"],
        caveat: "One study, with a spread between lifters as large as the mean.",
      },
      quads: { tier: "quiet", lifting: [6, 14], sources: ["martinFuentes2020Deadlift"] },
    },
  },
  "wide-grip-cable-lat-pulldown": {
    load: "70% of a one-rep maximum to a ten-rep maximum, about 55 to 64 kg",
    muscles: {
      lats: {
        tier: "prime",
        lifting: [45, 128],
        lowering: [0.47, 0.71],
        sources: ["signorile2002", "edelburg2017", "buonsenso2025"],
        caveat: "Includes teres major, which the app counts with the lats.",
      },
      upper_back: { tier: "synergist", lifting: [23, 61], sources: ["edelburg2017", "lehman2004"] },
      chest: {
        tier: "synergist",
        lifting: [64, 64],
        lowering: [0.66, 0.66],
        sources: ["signorile2002"],
        caveat: "One study, read off a chart.",
      },
      triceps: {
        tier: "synergist",
        lifting: [60, 60],
        lowering: [0.73, 0.73],
        sources: ["signorile2002"],
        caveat: "Long head only, one study, read off a chart.",
        oneHead: true,
      },
      rear_delts: {
        tier: "synergist",
        lifting: [48, 48],
        lowering: [0.58, 0.58],
        sources: ["signorile2002"],
        caveat: "One study, read off a chart.",
      },
      biceps: {
        tier: "synergist",
        lifting: [15, 15],
        sources: ["lehman2004"],
        caveat: "A held position at mid-pull. No study readable in full reports the biceps through a moving rep.",
      },
      lower_back: { tier: "moderate", lifting: [20, 20], sources: ["edelburg2017"] },
    },
  },
};
