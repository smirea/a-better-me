export type TextureAction =
  | "hide"
  | "fill-dark"
  | "fill-black"
  | "fill-steel"
  | "flat-normal"
  | "plate-bumper"
  | "plate-grip"
  | "plate-blue"
  | "cap-grey"
  | "cap-brushed"
  | "cap-chrome"
  | "medball"
  | "mat-quilted"
  | "mat-stripe"
  | "mat-yellow"
  | "placard-vertical"
  | "placard-url"
  | "placard-horizontal"
  | "screen"
  | "plaque-desat";

/**
 * Exhaustive SHA-256 (12-char prefix) audit map covering every branded texture across all 283 raw
 * catalog models. Every hash was visually verified across all 12 texture contact sheets.
 */
const RULES_BY_ACTION: Record<TextureAction, readonly string[]> = {
  // Transparent PNG logo decals — delete primitive so zero floating badge remains.
  hide: [
    "e751a9ff5f8c", // #000 yellow wordmark
    "cf41f24e528f", // #029 silver wordmark
    "8c00e992d430", // #032 silver wordmark
    "5f2c51aa7310", // #042 yellow wordmark
    "105cdf1f8f76", // #060 silver wordmark
    "8778600f25bf", // #070 silver wordmark
    "5eecf7e99d46", // #105 silver wordmark
    "9ca0fae87b2d", // #143 dark wordmark
    "dc93228a7e6f", // #175 yellow wordmark
    "8112cf7590cc", // #181 silver wordmark
    "75a3a607c643", // #276 silver wordmark
    "1f9e55e1dd47", // #279 silver wordmark
    "d8de43211f14", // #280 silver wordmark
    "cede8e19b14d", // #350 yellow wordmark
    "cd07fedee230", // #356 yellow wordmark
    "f5c53d55c9b0", // #358 black wordmark
    "381ac2d658bd", // #367 mirrored silver wordmark
    "e7326b5bd3ea", // #386 yellow wordmark
    "69f7a579c5f7", // #388 yellow wordmark
    "8b0281ff8da7", // #398 REV white wordmark
  ],

  // Opaque dark/yellow logo banners on structural surfaces — replace with neutral matte charcoal.
  "fill-dark": [
    "f7bbeec0b929", // #005
    "f852d18dbb61", // #007
    "221f9607a603", // #011
    "7fd7bcbebb26", // #015
    "69986b33ff2e", // #017
    "8225b3dc89f8", // #024
    "66b7b3bf8ec7", // #073
    "e911ace0eabe", // #079
    "465afeebc59d", // #102
    "1529907f5d43", // #127
    "653bab7fe2cc", // #178
    "6586b90f3ff8", // #192 mywellness QR
    "f3530ba06f69", // #199 QR badge
    "46b73a602383", // #285
    "cba0ffed12ec", // #315
    "29a9dd0df81e", // #378
    "f1e71e313d9a", // #381 stitched logo patch
    "23678c013c60", // #383
  ],

  // Opaque black-backed logos / flywheels / QR plaques — replace with deep matte black.
  "fill-black": [
    "aa1d1606b7a2", // #027
    "38695a83b733", // #120
    "0865e21e58a0", // #167
    "fa4347a709c4", // #179
    "d52cd193fd1f", // #201
    "0764e82928cb", // #281
    "e4a601ba5015", // #293
    "0f427d7b4590", // #295
    "ce393c8e1190", // #296
    "40c82366058c", // #342
    "dea12cabb73f", // #354 mywellness QR
    "416693fc2e2f", // #364
    "568feb750897", // #365 REV circle
    "1f6e5aa190a0", // #369
    "277d5d1641a2", // #376
    "d41f5b9056d1", // #380 technogym.com QR
    "44bb0f0b97ef", // #412
  ],

  // Brushed silver gradient nameplates — replace with clean unbranded brushed metal.
  "fill-steel": [
    "ac9818ea4717", // #021
    "38cc7c841c1f", // #044
    "0b31dad2a422", // #061
    "d5036ee34c61", // #071
    "ae60bfafe090", // #078
    "25e5d4558b87", // #129
    "94ae76f504e5", // #233
  ],

  // Normal maps with embossed brand lettering — flatten to neutral normal.
  "flat-normal": [
    "1f015aa85b5e", // #056
    "5319e9035541", // #172
  ],

  // Black 20kg bumper plates with brand arcs top & bottom — mask top/bottom arcs, keep 20 KG.
  "plate-bumper": [
    "5621a21cd096", // #001
    "d9a8dc168597", // #054
    "da02d858d29d", // #128
    "dc0c1783b4b6", // #230
  ],

  // Cast/urethane grip plates with curved brand text left & right — mask side arcs, keep hub & weight.
  "plate-grip": [
    "a72c4175e66c", // #009
    "68aae08c1197", // #065
    "0f9ab051d9e0", // #094
    "5395be63dd18", // #153
    "e55bb7c00bb4", // #154
    "13ec0b0672b4", // #288
    "aedc49f96b2b", // #362
  ],

  // Blue competition 20kg bumper plate — mask top/bottom brand rects with matching blue.
  "plate-blue": [
    "62093fd03a2e", // #214
  ],

  // Grey flat dumbbell / barbell endcaps with centered weight and top/bottom brand text.
  "cap-grey": [
    "a5b96aec4b06", // #096
    "a4e033461d96", // #098
    "ec5f2f1bda07", // #165
    "d5bc662d9302", // #166
    "4218e34166df", // #169
    "9d472cfe0b6a", // #173
    "b15b6877ce5c", // #174
    "3b78cab5f154", // #310
    "d10537c86b5b", // #312
    "4b202e2cdbc6", // #313
    "2e2729486518", // #319
    "89e93a9387e3", // #325
    "08bb817bba9b", // #344
    "9b38d4b51851", // #346
    "f82c3eb17848", // #347
    "7eb37ba37083", // #348
    "6367024fd33f", // #349
    "c2df0c24209b", // #351
  ],

  // Brushed stainless dumbbell/kettlebell endcaps with centered weight and top/bottom brand text.
  "cap-brushed": [
    "a09ef840736d", // #144
    "2e96cc149bc0", // #145
    "69422197a678", // #146
    "bc7cc29d20ab", // #147
    "ccb21b79a452", // #148
    "f72e89542376", // #149
    "fa6279b9a4fb", // #182
    "bd10a10c703e", // #183
    "1a9b85c1c53e", // #184
    "9ddceb08e51d", // #185
    "a2695c1749ce", // #186
    "829f7186be31", // #187
    "4c5511557edd", // #188
    "c4ff1d061ef6", // #189
  ],

  // Chrome round plates with stamped brand text — replace with clean radial brushed steel.
  "cap-chrome": [
    "94488b71280d", // #393
    "713469dc9e5e", // #417
  ],

  // Medicine / wall balls with brand box above lacing — patch with matte dark leather.
  medball: [
    "96321a93bb09", // #020
    "0693b2c86a2a", // #055
    "6d946d0ad1bb", // #132
  ],

  "mat-quilted": ["fbfd9d09ff10"], // #023
  "mat-stripe": ["2a465d1e425c"], // #271
  "mat-yellow": ["a650433d0205"], // #249 yellow speckled mat -> neutral slate

  // Vertical exercise placards with QR code + brand URL in bottom ~20% — mask footer black.
  "placard-vertical": [
    "cb6695f6ff11", // #072
    "002c2a54f265", // #081
    "f5a3acd95a25", // #087
    "0608b2861f60", // #095
    "41920ecbbccf", // #150
    "a929629cceaf", // #155
    "88f42aec69c3", // #156
    "5ba3530ebd74", // #157
    "ee3c3c49c9b6", // #158
    "93e3e5465e9f", // #159
    "720330461b8a", // #160
    "294a736de7f3", // #161
    "151d506a9fde", // #162
    "5decd70b2663", // #163
    "7742187c71b8", // #164
    "8e1c98b3191c", // #168
    "84f4e496d8bf", // #213
    "7a84dc47eaaf", // #228
    "2fc0c2b2ea07", // #234
    "139e63521e79", // #274
    "57f864cd3e77", // #283
    "8b475dc12d42", // #286
    "b8783361ccfa", // #287
    "b7cdb9a26497", // #289
    "5758cf2d6752", // #290
    "3e85a8e6b0a7", // #291
    "6772570d5d6f", // #294
    "c53fe6ea0908", // #299
    "91473205de4a", // #301
    "4e11e5ae5877", // #302
    "6250e1205577", // #304
    "116522728e0c", // #305
    "d625158055fc", // #306
    "22e88b0ec33d", // #308
    "8ae8a52da03c", // #309
    "88df8e2e4b3d", // #317
    "7967a9bc0b1b", // #318
    "47998199488e", // #323
    "0b1eb9b7ac8c", // #326
    "704114e2a057", // #330
    "72a25436c674", // #370
    "4b0c5064086b", // #371
    "3c6e30b2430a", // #372
    "e5f869cad9f8", // #373
  ],

  // Warning/diagram stickers with URL line at bottom ~12%.
  "placard-url": [
    "43244970c61a", // #363
    "02b90a257568", // #374
  ],

  // Horizontal exercise placards — mask bottom 8% edge strip to scrub any footer text.
  "placard-horizontal": [
    "2072186182dc", // #232
    "af657fcfc639", // #236
    "77cfe24098e1", // #237
    "66d2381e1462", // #239
    "31b0878224ec", // #240
    "e9b123a1e827", // #241
    "6cdfbc684f18", // #244
    "cabc21aa5bcb", // #245
    "05221d1662c7", // #246
    "35ce3f6a5344", // #248
    "1197c3f687f0", // #251
    "a65e61735f7d", // #252
    "64e185e60761", // #253
    "8df20710ff08", // #254
    "20418e6b5978", // #255
    "686df9d3d1e3", // #256
    "4bb487d64ad7", // #263
    "4fcf913c07e9", // #264
    "ca7299e74e83", // #266
    "3c2b6b361a82", // #268
    "fdb0d8c7536c", // #297
    "24abc4653ed0", // #333
    "c8c91de55686", // #357
  ],

  // Branded touchscreen consoles (Mywellness / brand splash UI) — replace with clean neutral console UI.
  screen: [
    "d414459cc4a6", // #012
    "47e7f5b1686f", // #040
    "ab20908ebc36", // #063
    "5d2e8e336f53", // #064
    "26c93611a845", // #068
    "c77997c8f3db", // #069
    "5fc9bad1025b", // #076
    "bde1fc07e168", // #090
    "02fa123e7673", // #122
    "e73d8c6a497d", // #126
    "dbe75eec8ca6", // #136
    "d5e8b7a53646", // #140
    "9cd64e67e19e", // #152
    "f7c9aecf99db", // #210
    "f5febcc87d23", // #216
    "7212a6450105", // #217
    "f89089d68de8", // #219
    "ff15b530c106", // #220
    "625e9b5ee453", // #222
    "a045f96a3be0", // #225
    "8cd3029eca7f", // #265
    "afd42796f824", // #270
    "e05743885ac5", // #275
  ],

  // Station title circles with bright brand-yellow outer border — desaturate ring to brushed silver.
  "plaque-desat": [
    "1e6fcabe6cb2", // #097
    "c917f173c832", // #099
    "77c7189277fe", // #100
    "05736cb7ea30", // #101
    "d0badc9c43bd", // #103
    "c0da78c2960a", // #104
    "25fd17831f26", // #170
    "b68f388f8028", // #171
    "5cfea23ed35e", // #298
    "ba41d57a3293", // #316
    "fa9d37400fc9", // #320
    "9b8296d55b1e", // #321
    "e9f116b7d5ff", // #322
    "2d493476937f", // #324
    "9c34ca1798f2", // #327
    "488c22cf10c2", // #328
    "dab6771139d5", // #329
    "83fce8dc967d", // #331
    "3217a7fbdc9a", // #332
    "611d14bda9f9", // #339
    "090d26a4e6e3", // #340
    "eaedda2c6c76", // #345
  ],
};

export const TEXTURE_ACTION_BY_HASH = new Map<string, TextureAction>();
for (const [action, hashes] of Object.entries(RULES_BY_ACTION) as [
  TextureAction,
  readonly string[],
][]) {
  for (const hash of hashes) {
    TEXTURE_ACTION_BY_HASH.set(hash, action);
  }
}

/**
 * Neutralize bright brand-signature yellow powder-coat paint to brushed dark slate titanium while
 * leaving subtle neutral surfaces, wood, leather, chrome, and black frames untouched.
 */
export function isBrandYellowFactor(factor: readonly number[]): boolean {
  if (factor.length < 3) return false;
  const [r, g, b] = factor;
  // Linear RGB for bright saturated yellow (e.g. [0.42, 0.32, 0.01], [0.59, 0.62, 0.01], [1, 1, 0])
  return r > 0.3 && g > 0.22 && b < 0.09 && r / Math.max(g, 0.01) < 1.8 && g / Math.max(r, 0.01) < 1.5;
}
