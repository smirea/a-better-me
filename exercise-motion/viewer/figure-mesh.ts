import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';
import type { Body } from '../src/body';
import { atlasUv, bareUv } from './anatomy';

type Point = [number, number, number];
type Uv = [number, number];
type Profile = [height: number, width: number, front: number, back: number][];
type Weights = [joint: number, next: number, blend: number];

interface Vertex {
	point: Vector3;
	normal: Vector3;
	weights: Weights;
	gripShift: number;
}

interface Corner {
	vertex: Vertex;
	uv: Uv;
}

const RADIAL = 80;
const radians = Math.PI / 180;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (start: number, end: number, value: number) => {
	const t = clamp((value - start) / (end - start), 0, 1);
	return t * t * (3 - 2 * t);
};
const bell = (value: number, center: number, width: number) => Math.exp(-(((value - center) / width) ** 2));

// Metres in the rig's neutral pose, relative to the pelvis and scaled to the lifter's height.
const torso: Profile = [
	[-0.025, 0.155, 0.093, 0.109],
	[0.025, 0.168, 0.102, 0.123],
	[0.085, 0.156, 0.104, 0.116],
	[0.155, 0.126, 0.1, 0.091],
	[0.228, 0.131, 0.113, 0.081],
	[0.29, 0.149, 0.129, 0.087],
	[0.356, 0.178, 0.137, 0.097],
	[0.41, 0.184, 0.137, 0.097],
	[0.465, 0.174, 0.112, 0.088],
	[0.502, 0.164, 0.082, 0.073],
	[0.527, 0.133, 0.062, 0.062],
	[0.551, 0.082, 0.046, 0.051],
	[0.575, 0.051, 0.044, 0.051],
	[0.608, 0.049, 0.048, 0.047],
	[0.633, 0.054, 0.072, 0.049],
	[0.655, 0.064, 0.09, 0.055],
	[0.679, 0.066, 0.101, 0.064],
	[0.719, 0.076, 0.098, 0.069],
	[0.758, 0.077, 0.095, 0.071],
	[0.788, 0.067, 0.086, 0.06],
	[0.815, 0.048, 0.068, 0.04],
	[0.832, 0.024, 0.049, 0.02],
	[0.837, 0.002, 0.023, -0.019],
];

const arm: Profile = [
	[0, 0.054, 0.052, 0.053],
	[0.057, 0.053, 0.054, 0.054],
	[0.1, 0.049, 0.054, 0.054],
	[0.165, 0.046, 0.054, 0.051],
	[0.23, 0.043, 0.047, 0.047],
	[0.29, 0.038, 0.038, 0.041],
	[0.331, 0.036, 0.034, 0.039],
	[0.366, 0.039, 0.037, 0.041],
	[0.413, 0.044, 0.041, 0.043],
	[0.456, 0.039, 0.036, 0.038],
	[0.523, 0.029, 0.027, 0.028],
	[0.565, 0.024, 0.021, 0.027],
	[0.591, 0.023, 0.02, 0.026],
	[0.613, 0.021, 0.026, 0.036],
	[0.644, 0.024, 0.034, 0.043],
	[0.669, 0.025, 0.035, 0.037],
	[0.686, 0.018, 0.03, 0.031],
	[0.696, 0.003, 0.012, 0.018],
];

const leg: Profile = [
	[0.02, 0.089, 0.089, 0.097],
	[0.105, 0.087, 0.095, 0.094],
	[0.165, 0.084, 0.088, 0.082],
	[0.23, 0.079, 0.084, 0.077],
	[0.29, 0.07, 0.076, 0.066],
	[0.355, 0.06, 0.063, 0.055],
	[0.402, 0.054, 0.052, 0.048],
	[0.436, 0.053, 0.052, 0.046],
	[0.47, 0.049, 0.049, 0.049],
	[0.518, 0.055, 0.045, 0.062],
	[0.563, 0.057, 0.047, 0.063],
	[0.619, 0.054, 0.045, 0.06],
	[0.68, 0.044, 0.039, 0.048],
	[0.75, 0.036, 0.034, 0.038],
	[0.823, 0.031, 0.03, 0.034],
	[0.874, 0.032, 0.041, 0.038],
	[0.894, 0.036, 0.081, 0.048],
	[0.911, 0.047, 0.149, 0.05],
	[0.926, 0.052, 0.191, 0.05],
	[0.934, 0.052, 0.201, 0.05],
	[0.941, 0.048, 0.197, 0.048],
	[0.943, 0.047, 0.195, 0.05],
];

function profile(points: Profile, value: number): Point {
	const index = points.findIndex(([t]) => t > value);
	const i = index === -1 ? points.length - 2 : Math.max(0, index - 1);
	const a = points[i];
	const b = points[i + 1];
	const span = b[0] - a[0];
	const t = clamp((value - a[0]) / span, 0, 1);
	const previous = points[i - 1];
	const next = points[i + 2];
	const sample = (axis: 1 | 2 | 3) => {
		const slope = (b[axis] - a[axis]) / span;
		const tangent = (other: number) => (slope * other > 0 ? (2 * slope * other) / (slope + other) : 0);
		const da = previous ? tangent((a[axis] - previous[axis]) / (a[0] - previous[0])) : slope;
		const db = next ? tangent((next[axis] - b[axis]) / (next[0] - b[0])) : slope;
		return mix(a[axis], b[axis], t * t * (3 - 2 * t)) + span * t * (1 - t) * ((1 - t) * da - t * db);
	};
	return [sample(1), sample(2), sample(3)];
}

function rings(points: number[], step = 0.01) {
	const heights = [points[0]];
	for (let i = 1; i < points.length; i++) {
		const count = Math.ceil((points[i] - points[i - 1]) / step);
		for (let j = 1; j <= count; j++) heights.push(mix(points[i - 1], points[i], j / count));
	}
	return heights;
}

export function createFigureGeometry(body: Body) {
	const joints = body.index;
	const scale = body.height / 1.78;
	const vertices: Vertex[] = [];
	const corners: Corner[] = [];
	const vertex = (point: Point, weights: Weights, gripShift = 0) => {
		const result = { point: new Vector3(...point).multiplyScalar(scale), normal: new Vector3(), weights, gripShift };
		vertices.push(result);
		return result;
	};
	const corner = (v: Vertex, uv = bareUv): Corner => ({ vertex: v, uv });
	const ab = new Vector3();
	const ac = new Vector3();
	const face = (a: Corner, b: Corner, c: Corner, reverse: boolean) => {
		if (reverse) [b, c] = [c, b];
		const normal = ab.subVectors(b.vertex.point, a.vertex.point).cross(ac.subVectors(c.vertex.point, a.vertex.point));
		for (const v of [a, b, c]) v.vertex.normal.add(normal);
		corners.push(a, b, c);
	};
	const strip = (a: Corner[], b: Corner[], reverse: boolean, omit: (i: number) => boolean = () => false) => {
		for (let i = 0; i < a.length - 1; i++) {
			if (omit(i)) continue;
			face(a[i], a[i + 1], b[i], reverse);
			face(a[i + 1], b[i + 1], b[i], reverse);
		}
	};
	const cap = (rim: Corner[], center: Vertex, reverse: boolean) => {
		const tip = corner(center);
		const bareRim = rim.map(c => corner(c.vertex));
		for (let i = 0; i < bareRim.length - 1; i++) face(bareRim[i], bareRim[i + 1], tip, reverse);
	};
	const blend = (a: string, b: string, t = 0): Weights => [joints[a], joints[b], t];
	const shoulderArc = { near: 13, far: 27, bottom: 0.365, top: 0.507 };
	const heights = rings([
		-0.025,
		0.085,
		0.228,
		shoulderArc.bottom,
		shoulderArc.top,
		0.575,
		0.655,
		0.788,
		0.815,
		0.827,
		0.832,
		0.835,
		0.837,
	]);
	const bottom = heights.indexOf(shoulderArc.bottom);
	const top = heights.indexOf(shoulderArc.top);
	const torsoRings = heights.map(y =>
		Array.from({ length: RADIAL }, (_, i) => {
			const angle = (2 * Math.PI * i) / RADIAL;
			const sin = Math.sin(angle);
			const cos = Math.cos(angle);
			const phi = Math.acos(cos) / radians;
			const [width, front, back] = profile(torso, y);
			const pec = 0.019 * bell(y, 0.422, 0.053) * bell(phi, 31, 25);
			const abs =
				(0.005 * bell(y, 0.303, 0.023) +
					0.006 * bell(y, 0.236, 0.025) +
					0.007 * bell(y, 0.173, 0.025) +
					0.006 * bell(y, 0.096, 0.053)) *
				bell(phi, 18, 17);
			const scapula = 0.008 * bell(y, 0.422, 0.062) * bell(phi, 153, 19);
			const glute = 0.019 * bell(y, -0.029, 0.081) * bell(phi, 147, 23);
			const lat = 0.009 * bell(y, 0.338, 0.093) * bell(phi, 120, 28);
			const z = cos * (cos > 0 ? front : back) + pec + abs - scapula - glute - lat - 0.02 * smooth(0.055, 0.355, y);
			const crotch = 0.036 * (1 - smooth(0, 0.117, y + 0.025)) * cos ** 4;
			const side = sin >= 0 ? 'L' : 'R';
			const clavicle =
				smooth(28, 92, phi) * (1 - smooth(97, 151, phi)) * smooth(0.304, 0.472, y) * (1 - smooth(0.507, 0.577, y));
			const hip = smooth(4, 38, phi) * (1 - smooth(150, 180, phi)) * (1 - smooth(-0.025, 0.125, y)) * 0.35;
			const weights =
				y > 0.385
					? clavicle > 0.05
						? blend('thoracic', `clavicle_${side}`, clavicle * 0.92)
						: blend('thoracic', 'neck', smooth(0.496, 0.626, y))
					: y > 0.17
						? blend('lumbar', 'thoracic', smooth(0.17, 0.327, y))
						: hip > 0.01
							? blend('pelvis', `hip_${side}`, hip)
							: blend('pelvis', 'lumbar', smooth(0.044, 0.17, y));
			return vertex([sin * width, y - crotch, z], weights);
		}),
	);
	const torsoCorner = (row: number, i: number, side: number) => {
		const phi = (180 * i) / (RADIAL / 2);
		const sign = side === 0 ? 1 : -1;
		return corner(
			torsoRings[row][(RADIAL + sign * i) % RADIAL],
			atlasUv('torso', side, 180 + phi, clamp((0.64 - heights[row]) * 100, 0, 70)),
		);
	};
	for (const side of [0, 1]) {
		const rows = heights.map((_, row) =>
			Array.from({ length: RADIAL / 2 + 1 }, (_unused, i) => torsoCorner(row, i, side)),
		);
		for (let row = 1; row < rows.length; row++) {
			strip(
				rows[row - 1],
				rows[row],
				side === 1,
				i => row > bottom && row <= top && i >= shoulderArc.near && i < shoulderArc.far,
			);
		}
		cap(rows[rows.length - 1], vertex([0, 0.8372, 0.001], blend('neck', 'neck')), side === 1);
	}

	// Both legs share the saddle under the pelvis and the arms join the openings in the rib cage.
	const hipBridge = Array.from({ length: 13 }, (_, i) => {
		const t = i / 12;
		if (i === 0) return torsoRings[0][RADIAL / 2];
		if (i === 12) return torsoRings[0][0];
		return vertex([0, -0.061 - 0.034 * Math.sin(t * Math.PI), mix(-0.109, 0.093, t)], blend('pelvis', 'pelvis'));
	});
	for (const side of [0, 1]) {
		const sign = side === 0 ? 1 : -1;
		const suffix = side === 0 ? 'L' : 'R';
		const j = (joint: string) => `${joint}_${suffix}`;
		const grip = body.anchors[j('grip')].local.clone().divideScalar(scale);
		const gripTravel = body.anchors[j('press')].local.y / scale - grip.y;
		const attachment: [Vertex, number][] = [];
		const attach = (row: number, col: number, angle: number) =>
			attachment.push([torsoCorner(row, col, side).vertex, angle]);
		const { near, far } = shoulderArc;
		for (let row = bottom; row < top; row++) attach(row, near, mix(-45, 42, (row - bottom) / (top - bottom)));
		for (let col = near; col < far; col++) attach(top, col, mix(42, 138, (col - near) / (far - near)));
		for (let row = top; row > bottom; row--) attach(row, far, mix(138, 222, (top - row) / (top - bottom)));
		for (let col = far; col > near; col--) attach(bottom, col, mix(222, 315, (far - col) / (far - near)));
		attachment.push([attachment[0][0], 315]);

		const armPosition = (t: number, angle: number): Point => {
			const [width, front, back] = profile(arm, t);
			const sin = Math.sin(angle * radians);
			const cos = Math.cos(angle * radians);
			const capY = 0.444 + 0.081 * sin - 0.03 * Math.max(0, -sin);
			const shoulderEnd = 0.235;
			const y = 0.515 - t;
			const shoulderWeight = 1 - smooth(0.027, shoulderEnd, t);
			const shoulderY = mix(y, capY - Math.max(0, t - 0.027) * 0.25, shoulderWeight);
			const belly = 0.007 * bell(t, 0.16, 0.085) * bell(angle, 12, 49);
			const palmTurn = smooth(0.568, 0.63, t);
			const palmX = sin * width + cos * (cos > 0 ? front : back) * 0.13;
			const palmZ = -sin * width * 1.12 + cos * (cos > 0 ? front : back);
			return [
				sign * (0.19 + sin * width + palmTurn * (palmX - sin * width)),
				shoulderY,
				mix(cos * (cos > 0 ? front : back) + belly, palmZ, palmTurn * 0.35) - 0.01,
			];
		};
		let previousArm = attachment.map(([v, angle]) => corner(v, atlasUv('arm', side, angle + 45, 0)));
		for (const t of rings([0.027, 0.057, 0.22, 0.331, 0.428, 0.591, 0.696])) {
			const row = attachment.slice(0, -1).map(([base, angle]) => {
				const p = armPosition(t, angle);
				const blendFromTorso = (1 - smooth(0, 0.1, t)) * 0.72;
				const weights =
					t < 0.16
						? blend(j('clavicle'), j('shoulder'), smooth(0, 0.14, t))
						: t < 0.348
							? blend(j('shoulder'), j('elbow'), smooth(0.25, 0.365, t))
							: t < 0.51
								? blend(j('elbow'), j('forearm'), smooth(0.348, 0.516, t))
								: blend(j('forearm'), j('wrist'), smooth(0.532, 0.615, t));
				const pos: Point = [
					mix(p[0], base.point.x / scale, blendFromTorso),
					mix(p[1], base.point.y / scale, blendFromTorso),
					mix(p[2], base.point.z / scale, blendFromTorso),
				];
				return corner(
					vertex(pos, weights, 0.7 * gripTravel * smooth(0.61, 0.686, t)),
					atlasUv('arm', side, angle + 45, Math.min(59, t * 100)),
				);
			});
			row.push(corner(row[0].vertex, atlasUv('arm', side, 360, Math.min(59, t * 100))));
			strip(previousArm, row, side === 0);
			previousArm = row;
		}
		cap(
			previousArm,
			vertex([sign * 0.19, -0.182, -0.007], blend(j('wrist'), j('wrist')), 0.7 * gripTravel),
			side === 0,
		);

		const wrist: Point = [sign * 0.19, -0.076, -0.01];
		const finger = (z: number, width: number, radius: number, thumb = false) => {
			let previous: Corner[] = [];
			const steps = 17;
			for (let i = 0; i <= steps; i++) {
				const u = i / steps;
				const angle = mix(thumb ? -1.24 : -0.83, thumb ? 1.9 : 3.14, u);
				const thickness = mix(width, width * 0.76, u) * (0.92 + 0.08 * Math.sin(u * Math.PI));
				const x = grip.x * sign + radius * Math.cos(angle);
				const y = grip.y - radius * Math.sin(angle);
				const band = Array.from({ length: 10 }, (_, n) => {
					const a = (Math.PI * 2 * n) / 10;
					return corner(
						vertex(
							[
								wrist[0] + sign * (x + Math.cos(angle) * Math.cos(a) * thickness),
								wrist[1] + y - Math.sin(angle) * Math.cos(a) * thickness,
								wrist[2] + grip.z + z + Math.sin(a) * thickness + (thumb ? -0.023 * u : 0.002 * u),
							],
							blend(j('wrist'), j('wrist')),
							gripTravel,
						),
					);
				});
				band.push(band[0]);
				if (i === 0 || i === steps) {
					cap(
						band,
						vertex(
							[wrist[0] + sign * x, wrist[1] + y, wrist[2] + grip.z + z + (thumb ? -0.023 * u : 0.002 * u)],
							blend(j('wrist'), j('wrist')),
							gripTravel,
						),
						(i === 0) !== (side === 1),
					);
				}
				if (previous.length) strip(previous, band, side === 1);
				previous = band;
			}
		};
		for (let i = 0; i < 4; i++) finger(-0.025 + i * 0.0175, i === 3 ? 0.0078 : 0.009, i === 3 ? 0.023 : 0.025);
		finger(0.035, 0.012, 0.024, true);

		const saddle = Array.from(
			{ length: RADIAL / 2 + 1 },
			(_, i) => [torsoCorner(0, i, side).vertex, mix(-45, 225, i / (RADIAL / 2))] satisfies [Vertex, number],
		);
		for (let i = 1; i < hipBridge.length; i++) saddle.push([hipBridge[i], mix(225, 315, i / 12)]);
		let previousLeg = saddle.map(([v, angle]) => corner(v, atlasUv('leg', side, angle + 45, 0)));
		for (const t of rings([
			0.048, 0.105, 0.165, 0.436, 0.563, 0.823, 0.874, 0.894, 0.911, 0.926, 0.934, 0.941, 0.943,
		])) {
			const row = saddle.slice(0, -1).map(([base, angle]) => {
				const [width, front, back] = profile(leg, t);
				const sin = Math.sin(angle * radians);
				const cos = Math.cos(angle * radians);
				const phi = Math.abs(angle);
				const aroundHip = 1 - smooth(0, 0.18, t);
				const aroundFoot = smooth(0.86, 0.931, t);
				const outerThigh = 0.009 * bell(t, 0.21, 0.14) * bell(phi, 51, 29);
				const quad = 0.005 * bell(t, 0.2, 0.13) * bell(phi, 5, 24);
				const calf = 0.004 * bell(t, 0.556, 0.073) * bell(phi, 185, 34);
				const baseWeight = (1 - smooth(0.03, 0.143, t)) * 0.81;
				const innerLift = Math.max(0, -sin) * aroundHip * -0.05;
				const arch = 0.012 * aroundFoot * Math.max(0, -sin) * bell(cos, 0.41, 0.35);
				const toe = Math.max(0, cos);
				const footWidth = width * (cos < 0 ? 0.82 : 1 + 0.47 * toe);
				const x =
					sign *
					(0.088 +
						0.008 * bell(t, 0.16, 0.18) +
						sin * mix(width, footWidth, aroundFoot) -
						0.013 * aroundFoot * toe +
						sin * outerThigh);
				const gluteBelly = 0.016 * bell(t, 0.067, 0.063) * bell(phi, 175, 35);
				const z =
					cos * (cos > 0 ? front : back) + quad - calf - gluteBelly - 0.013 * aroundFoot * toe * Math.max(0, sin);
				const weights =
					t < 0.23
						? blend('pelvis', j('hip'), smooth(-0.025, 0.167, t))
						: t < 0.54
							? blend(j('hip'), j('knee'), smooth(0.366, 0.511, t))
							: blend(j('knee'), j('ankle'), smooth(0.8, 0.906, t));
				return corner(
					vertex(
						[
							mix(x, base.point.x / scale, baseWeight),
							mix(-t + innerLift + arch, base.point.y / scale, baseWeight),
							mix(z, base.point.z / scale, baseWeight),
						],
						weights,
					),
					atlasUv('leg', side, angle + 45, t * 100),
				);
			});
			row.push(corner(row[0].vertex, atlasUv('leg', side, 360, t * 100)));
			strip(previousLeg, row, side === 0);
			previousLeg = row;
		}
		cap(previousLeg, vertex([sign * 0.085, -0.943, 0.066], blend(j('ankle'), j('ankle'))), side === 0);
	}

	for (const v of vertices) v.normal.normalize();
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const weightData: number[] = [];
	const gripData: number[] = [];
	const geometry = new BufferGeometry();
	const indexByCorner = new Map<Corner, number>();
	geometry.setIndex(
		corners.map(c => {
			const existing = indexByCorner.get(c);
			if (existing !== undefined) return existing;
			const index = uvs.length / 2;
			indexByCorner.set(c, index);
			const v = c.vertex;
			positions.push(v.point.x, v.point.y, v.point.z);
			normals.push(v.normal.x, v.normal.y, v.normal.z);
			uvs.push(...c.uv);
			indices.push(v.weights[0], v.weights[1]);
			weightData.push(v.weights[2]);
			gripData.push(v.gripShift * scale);
			return index;
		}),
	);
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	geometry.setAttribute('jointPair', new Uint16BufferAttribute(indices, 2));
	geometry.setAttribute('jointBlend', new Float32BufferAttribute(weightData, 1));
	geometry.setAttribute('gripShift', new Float32BufferAttribute(gripData, 1));
	return geometry;
}
