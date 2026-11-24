import type { Muscle } from "./muscles";

const DETAIL_TO_GROUP: [RegExp, Muscle][] = [
  [/adductor/i, "adductors"],
  [/semitend|semimemb|biceps femoris/i, "hamstrings"],
  [/gluteus maximus/i, "glutes"],
  [/vastus|rectus femoris/i, "quads"],
  [/pectoralis major/i, "chest"],
  [/deltoid anterior/i, "front_delts"],
  [/triceps|anconeus/i, "triceps"],
  [/latissimus/i, "lats"],
  [/gastrocnemius|soleus/i, "calves"],
];

/** The muscle groups behind the catalog's anatomical names, for the names that fall inside one of the 23 groups. */
export const groupsOf = (details: string[]) => [
  ...new Set(
    details.flatMap((detail) =>
      DETAIL_TO_GROUP.filter(([pattern]) => pattern.test(detail)).map(([, group]) => group),
    ),
  ),
];
