import type { Muscle } from "./muscles";

const DETAIL_TO_GROUP: [RegExp, Muscle][] = [
  [/pectoralis major|pectoralis minor/i, "chest"],
  [/deltoid anterior|anterior deltoid/i, "front_delts"],
  [/deltoid lateral|lateral deltoid|deltoid middle|supraspinatus/i, "side_delts"],
  [/deltoid posterior|posterior deltoid|infraspinatus|teres minor/i, "rear_delts"],
  [/latissimus|teres major/i, "lats"],
  [/rhomboid|middle trapezius|lower trapezius/i, "upper_back"],
  [/upper trapezius|levator scapulae/i, "upper_traps"],
  [/serratus anterior/i, "serratus"],
  [/biceps brachii|brachialis/i, "biceps"],
  [/triceps|anconeus/i, "triceps"],
  [/brachioradialis|flexor carpi|extensor carpi|pronator|supinator|flexor digitorum|extensor digitorum|forearm/i, "forearms"],
  [/sternocleidomastoid|splenius|scalene|cervical/i, "neck"],
  [/rectus abdominis|transverse abdominis/i, "abs"],
  [/oblique|quadratus lumborum/i, "obliques"],
  [/erector spinae|iliocostalis|longissimus|spinalis|multifidus/i, "lower_back"],
  [/gluteus maximus/i, "glutes"],
  [/iliopsoas|psoas|iliacus|pectineus|sartorius|tensor fasciae/i, "hip_flexors"],
  [/gluteus medius|gluteus minimus/i, "abductors"],
  [/adductor|gracilis/i, "adductors"],
  [/vastus|rectus femoris/i, "quads"],
  [/semitend|semimemb|biceps femoris/i, "hamstrings"],
  [/gastrocnemius|soleus/i, "calves"],
  [/tibialis anterior/i, "tibs"],
];

/** The muscle groups behind the catalog's anatomical names, for the names that fall inside one of the 23 groups. */
export const groupsOf = (details: string[]) => [
  ...new Set(
    details.flatMap((detail) =>
      DETAIL_TO_GROUP.filter(([pattern]) => pattern.test(detail)).map(([, group]) => group),
    ),
  ),
];
