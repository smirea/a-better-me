import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three';
import { MUSCLES, type Muscle } from '../src/muscles';

type Chart = 'torso' | 'arm' | 'leg';
type Plate = [Muscle, string];

// The atlas wraps in degrees around each section and runs in centimetres down the body.

const torso: Plate[] = [
	[
		'neck',
		'M186 3 Q192 2 192 9 Q190 12 184 15 L179 16 Q182 10 186 3 Z M329 3 Q337 1 338 6 L345 11 L353 14 Q341 15 331 12 Z',
	],
	[
		'upper_traps',
		'M187 16 Q198 14 225 14 Q229 14 226 15.5 Q212 16 195 17.5 Q186 18 187 16 Z M233 15 Q268 12 300 6 Q310 6 315 8 Q324 13 339 14 L353 15 Q358 15 358 17 L356 32 Q354 34 349 32 Q324 24 300 20 Q265 17 233 16 Z',
	],
	[
		'chest',
		'M185 18 C195 17 218 17 230 17.5 C238 18 244 20 245 21.5 C240 23 232 26 217 28.5 C206 31 189 29.5 185 27.5 Q182 23 185 18 Z',
	],
	['upper_back', 'M305 17.5 Q318 16 326 19.5 L345 28.5 Q350 32 336 32 C320 32 300 29 295 25 Q290 20 305 17.5 Z'],
	[
		'lats',
		'M293 28 C300 31 312 33 328 33.5 Q342 34 341 36 L326 44 Q324 49 316 53 Q312 55 305 54 Q286 50 281 45 Q272 40 268 36 C264 32 270 29 277 27 Z',
	],
	[
		'serratus',
		'M248 25.5 Q254 23 261 23 Q265 26 260 28.5 L238 34 Q232 35 232 33 Q234 30 248 25.5 Z M258 30 Q267 28 269 29 Q269 31 262 33 L241 38 Q234 39 235 37 Z M266 34 Q272 32 273 34 Q273 36 266 38 L246 42 Q240 42 241 40 Z',
	],
	[
		'abs',
		'M186 31.1 Q196 30 208 31.7 L219 35 Q220 36.7 214 36.9 L187 36.8 Q183 35.8 186 31.1 Z M186 38.4 Q200 37.9 214 38.9 Q221 39.8 220 42.5 Q218 44 187 43.7 Q183 43.4 186 38.4 Z M186 45.3 Q202 44.6 216 45.3 Q221 46.5 217 50.1 L187 50 Q183 49 186 45.3 Z M186 51.6 Q199 50.9 215 52 Q214 57 204 62 L193 65 Q188 65 186 62 Z',
	],
	[
		'obliques',
		'M229 37 C231 39 237 41 244 43 Q248 44 249 43 L272 39 Q275 39 277 41 Q277 44 268 47 Q252 51 222 51 Q222 45 224 42 Z M224 52 Q254 51 269 48 Q276 46 276 49 Q268 56 230 60 Q222 62 221 59 Z',
	],
	[
		'lower_back',
		'M350 34 Q355 34.2 355 35 L356 54 Q355 59 348 59 Q328 57 321 55 Q324 50 329 46 L344 37 Q346 35 350 34 Z',
	],
	[
		'abductors',
		'M264 53 Q273 51 280 49 Q291 53 300 56 Q303 57 294 59 L268 62 Q265 64 259 64 Q248 61 244 60 Q256 57 264 53 Z',
	],
	['hip_flexors', 'M225 61 Q234 61 241 60 Q248 60 250 63 Q251 65 242 67 L221 68 Q215 68 216 66 Z'],
	['glutes', 'M352 60 Q357 60 357 62 L356 69 L311 69 Q297 68 292 64 Q289 61 298 58 Q310 55 323 57 Z'],
];

const arm: Plate[] = [
	['front_delts', 'M9 2 Q26 0.8 57 1.5 Q67 3 68 5 Q62 9 54 10 Q45 10 38 9 Q22 7 9 5 Q5 4 9 2 Z'],
	[
		'side_delts',
		'M65 1 Q102 0 151 0.8 Q161 1.5 165 4 Q164 7 152 9 L120 12 Q113 12.2 105 11 L70 8 Q62 7 70 5 Q76 3 65 1 Z',
	],
	['rear_delts', 'M164 1.7 Q198 1 224 2.3 Q247 3.2 238 5 Q229 7 206 7.8 L160 10 Q155 10 158 9 Q175 6 171 4 Z'],
	[
		'biceps',
		'M8 7 Q25 8 41 10 Q59 11 64 14 C69 21 58 26 42 29 L26 30 Q8 29 5 25 Q0 17 8 7 Z M66 11 Q91 12 96 15 Q103 22 73 28 Q58 30 52 29 Q68 25 72 21 Q77 16 66 11 Z',
	],
	[
		'triceps',
		'M127 13 Q153 11 174 11 Q182 14 172 22 Q161 27 151 29 Q143 30 139 28 Q147 22 133 18 Q125 16 127 13 Z M180 10 Q206 8.6 225 8.5 Q247 8.5 246 13 Q248 20 225 26 Q205 29 178 29.5 Q170 30 171 28 Q190 23 185 17 Q180 14 180 10 Z M254 13 Q271 12 285 14 Q306 20 275 27 Q244 29 226 29 Q245 26 255 23 Q271 18 254 13 Z',
	],
	[
		'forearms',
		'M21 34 Q41 32 57 34 Q61 35 54 38 Q43 41 40 46 L44 55 Q43 56 36 55 Q12 49 10 43 Q12 37 21 34 Z M63 34 Q88 33 115 35 Q122 36 113 38 Q91 44 76 52 Q71 54 62 55 Q56 55 56 53 Q55 47 60 43 Q72 38 63 34 Z M124 35 Q144 34 157 35.5 Q172 36.5 163 39 Q144 44 130 51 Q124 55 104 55.5 Q97 56 98 54 Q106 47 121 42 Q135 37 124 35 Z M175 35 Q195 34.2 214 35 Q228 36 228 39 Q218 46 184 54 Q174 56 147 56 Q141 56 145 54 Q158 47 170 43 Q187 38 175 35 Z M245 35 Q274 34 291 36 Q302 38 289 43 Q273 50 243 55 Q221 58 212 56 Q209 55 219 53 Q249 45 244 40 Q238 37 245 35 Z M310 39 Q320 37 330 37.5 Q342 39 346 42 Q350 47 345 52 Q342 54 334 53 Q322 50 318 46 Z',
	],
];

const leg: Plate[] = [
	['abductors', 'M98 4 Q113 2.5 132 3 Q145 3.5 147 6 Q147 10 140 13 Q134 16 130 16 Q123 15 119 13 Q107 8 98 4 Z'],
	['hip_flexors', 'M26 2 Q52 1 66 3 Q72 4.5 68 6 L45 11 Q38 12 35 10 Q33 7 26 2 Z'],
	[
		'quads',
		'M35 12 Q42 9 56 9 Q68 9 73 13 C83 21 69 32 57 37 Q53 38 49 35 Q35 28 33 23 Q28 16 35 12 Z M80 9 Q91 8 104 10 C125 15 123 25 106 34 Q91 41 65 41 Q61 41 65 39 C83 34 92 26 91 20 Q91 15 80 11 Z M15 19 Q24 20 28 25 Q32 31 44 35 Q50 39 38 41 Q29 43 20 41 Q10 38 9 33 Q12 26 15 19 Z M2 28 Q7 29 8 34 Q7 39 17 42 Q18 44 11 44 Q1 43 0 40 L0 30 Z',
	],
	[
		'adductors',
		'M9 8 Q17 6 25 8 Q31 10 25 14 Q18 18 13 22 Q7 26 2 25 L0 25 L0 12 Z M319 9 Q336 7 356 9 Q360 12 359 16 L359 25 Q345 29 333 34 Q322 37 314 35 Q316 28 318 23 Q329 16 319 9 Z M291 10 Q307 8 315 12 Q320 16 304 23 Q294 29 290 29 Q281 29 280 26 Q285 18 291 10 Z',
	],
	['glutes', 'M184 -1 L264 -1 Q263 3 259 6 Q250 11 223 13 Q200 14 177 10 Q159 8 158 5 Q166 1 184 -1 Z'],
	[
		'hamstrings',
		'M152 11 Q169 12 177 14 Q180 17 168 23 Q152 28 156 35 Q160 39 151 40 Q130 38 129 33 Q125 26 136 21 Q148 15 152 11 Z M181 13 Q195 12.5 212 13 Q221 15 214 21 Q201 29 210 35 Q220 39 212 40 Q198 41 185 39 Q164 35 170 29 Q176 23 182 20 Q188 16 181 13 Z M226 15 Q247 13 260 11 Q276 11 275 15 Q273 20 261 25 Q259 30 271 34 Q274 38 268 40 Q257 42 240 40 Q219 35 226 30 Q236 24 230 20 Q225 17 226 13 Z',
	],
	[
		'tibs',
		'M12 49 Q27 46 40 46 Q50 46 54 50 Q62 58 53 67 L46 83 Q44 86 37 86 Q30 86 30 82 Q32 72 23 64 Q16 59 12 49 Z M61 47 Q72 45 83 47 Q99 52 96 61 Q92 71 73 81 Q66 83 63 81 Q71 70 69 60 Q67 53 61 47 Z',
	],
	[
		'calves',
		'M115 49 Q128 46 152 46 Q174 46 183 50 Q188 56 179 62 Q170 67 175 72 Q178 74 171 75 Q160 75 148 71 Q118 64 115 49 Z M196 47 Q209 45 227 46 Q252 47 263 51 Q272 57 251 65 Q236 69 222 73 Q212 75 203 74 Q194 73 199 70 Q206 66 194 59 Q185 51 196 47 Z M275 50 Q290 49 304 51 Q325 55 320 61 Q316 72 286 80 Q275 82 272 80 Q282 70 278 64 Q266 55 275 50 Z',
	],
];

const WIDTH = 1152;
const HEIGHT = 1472;
const tiles = {
	torso: { offset: 0, plates: torso },
	arm: { offset: 440, plates: arm },
	leg: { offset: 814, plates: leg },
};

export function atlasUv(chart: Chart, side: number, angle: number, length: number): [number, number] {
	return [(side * 576 + 8 + angle * 1.54) / WIDTH, (tiles[chart].offset + 8 + length * 6.2) / HEIGHT];
}

export const bareUv: [number, number] = [0.5 / WIDTH, 0.5 / HEIGHT];

export function createAnatomyAtlas() {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('The muscle atlas requires a 2D canvas');
	const charts: Chart[] = ['torso', 'arm', 'leg'];
	for (const chart of charts) {
		for (const side of [0, 1]) {
			const [u, v] = atlasUv(chart, side, 0, 0);
			context.setTransform(1.54, 0, 0, 6.2, u * WIDTH, v * HEIGHT);
			for (const [muscle, path] of tiles[chart].plates) {
				const id = MUSCLES.indexOf(muscle) * 2 + side + 1;
				context.fillStyle = `rgb(${(id % 4) * 85}, ${(Math.floor(id / 4) % 4) * 85}, ${Math.floor(id / 16) * 85})`;
				const shape = new Path2D(path);
				context.fill(shape, 'nonzero');
			}
		}
	}
	const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
	const atlas = new Uint8Array(pixels.length);
	const distances = new Float32Array(WIDTH * HEIGHT);
	for (let i = 0; i < distances.length; i++) {
		const p = i * 4;
		const id = Math.round(pixels[p] / 85) + 4 * Math.round(pixels[p + 1] / 85) + 16 * Math.round(pixels[p + 2] / 85);
		atlas[p + 1] = pixels[p + 3];
		atlas[p + 2] = Math.min(MUSCLES.length * 2, id);
		distances[i] = (pixels[p + 3] / 255) * 12;
	}

	for (let y = 1; y < HEIGHT - 1; y++) {
		for (let x = 1; x < WIDTH - 1; x++) {
			const i = y * WIDTH + x;
			distances[i] = Math.min(
				distances[i],
				distances[i - 1] + 1,
				distances[i - WIDTH] + 1,
				distances[i - WIDTH - 1] + Math.SQRT2,
				distances[i - WIDTH + 1] + Math.SQRT2,
			);
		}
	}
	for (let y = HEIGHT - 2; y > 0; y--) {
		for (let x = WIDTH - 2; x > 0; x--) {
			const i = y * WIDTH + x;
			distances[i] = Math.min(
				distances[i],
				distances[i + 1] + 1,
				distances[i + WIDTH] + 1,
				distances[i + WIDTH - 1] + Math.SQRT2,
				distances[i + WIDTH + 1] + Math.SQRT2,
			);
		}
	}
	const edgeNeighbors = [-WIDTH, -1, 1, WIDTH];
	for (let i = 0; i < distances.length; i++) {
		const t = Math.min(1, distances[i] / 11);
		atlas[i * 4] = Math.round(255 * t * t * (3 - 2 * t));
		if (!pixels[i * 4 + 3]) {
			// Bilinear coverage can reach a texel just outside the path.
			for (const offset of edgeNeighbors) {
				const j = i + offset;
				if (pixels[j * 4 + 3] === undefined || pixels[j * 4 + 3] === 0) continue;
				atlas[i * 4 + 2] = atlas[j * 4 + 2];
				break;
			}
		}
	}
	const texture = new DataTexture(atlas, WIDTH, HEIGHT, RGBAFormat, UnsignedByteType);
	texture.magFilter = texture.minFilter = LinearFilter;
	texture.needsUpdate = true;
	return texture;
}
