import { fk, newFrame, type Body } from './body';
import type { Built, Sequence } from './exercise';
import { quatFromRotVec, rad, rotVecFromQuat } from './math';
import type { Issue } from './validate';
import { Quaternion, Vector3 } from 'three';

/**
 * A deliberate mistake applied to a finished rep, with the flags the validators must raise for it. These are the
 * system's own test of its detectors: a generated rep that passes clean only means something if a broken one fails.
 */
export interface Fault {
	id: string;
	exercise: string;
	label: string;
	what: string;
	/** Issue codes or form-check ids, at least one of which has to fire. */
	expect: (Issue['code'] | string)[];
	loadKg?: number;
	apply?: (sequence: Sequence, body: Body, built: Built) => void;
}

const q = new Quaternion();
const extra = new Quaternion();

function rotateBall(body: Body, pose: number[], joint: string, axis: Vector3, degrees: number) {
	const i = body.joints[body.index[joint]].dofStart;
	quatFromRotVec(pose[i], pose[i + 1], pose[i + 2], q).multiply(extra.setFromAxisAngle(axis, rad(degrees)));
	const v = rotVecFromQuat(q);
	pose[i] = v[0];
	pose[i + 1] = v[1];
	pose[i + 2] = v[2];
}

const dof = (body: Body, joint: string, n = 0) => body.joints[body.index[joint]].dofStart + n;

function refreshProps(sequence: Sequence, body: Body, built: Built) {
	const frame = newFrame(body);
	sequence.propStates = sequence.poses.map((pose, f) => {
		const followed = built.propState(
			fk(body, pose, frame),
			sequence.propStates[f].map(state => state.pos[1]),
		);
		// A bar keeps the path it was given, so a hand that wanders leaves it. Dumbbells go wherever the hands go.
		return sequence.props.map((prop, p) => (prop.kind === 'dumbbell' ? followed[p] : sequence.propStates[f][p]));
	});
}

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

export const FAULTS: Fault[] = [
	{
		id: 'squat-knees-cave',
		exercise: 'smith-machine-back-squat',
		label: 'Legs swing inward',
		what: 'Both legs swing in up to 14° as the squat deepens, dragging the feet across the floor.',
		expect: ['contact-slides', 'contact-lost'],
		apply: (sequence, body) => {
			sequence.poses.forEach((pose, f) => {
				rotateBall(body, pose, 'hip_L', Z, -14 * sequence.s[f]);
				rotateBall(body, pose, 'hip_R', Z, 14 * sequence.s[f]);
			});
		},
	},
	{
		id: 'squat-round-back',
		exercise: 'smith-machine-back-squat',
		label: 'Lower back rounds at the bottom',
		what: 'The lumbar spine flexes up to 22° toward the bottom of the squat.',
		expect: ['flat-back', 'contact-lost'],
		apply: (sequence, body) =>
			sequence.poses.forEach((pose, f) => rotateBall(body, pose, 'lumbar', X, 22 * sequence.s[f] ** 2)),
	},
	{
		id: 'squat-too-heavy',
		exercise: 'smith-machine-back-squat',
		label: '260 kg on the bar',
		what: 'The same rep with more weight than the modelled lifter can stand up with.',
		expect: ['overload'],
		loadKg: 260,
	},
	{
		id: 'rdl-stoop',
		exercise: 'dumbbell-romanian-deadlift',
		label: 'Stoop lift: the back rounds',
		what: 'The spine flexes up to 35° on the way down, the stoop the instructions warn against.',
		expect: ['flat-back', 'equipment-clip', 'self-collision'],
		apply: (sequence, body, built) => {
			sequence.poses.forEach((pose, f) => {
				rotateBall(body, pose, 'lumbar', X, 20 * sequence.s[f]);
				rotateBall(body, pose, 'thoracic', X, 15 * sequence.s[f]);
			});
			refreshProps(sequence, body, built);
		},
	},
	{
		id: 'rdl-drift',
		exercise: 'dumbbell-romanian-deadlift',
		label: 'Dumbbells drift forward',
		what: 'The arms swing up to 25° forward of where they should hang, taking the dumbbells away from the legs.',
		expect: ['close-to-legs', 'off-balance'],
		apply: (sequence, body, built) => {
			sequence.poses.forEach((pose, f) => {
				rotateBall(body, pose, 'shoulder_L', X, -25 * sequence.s[f]);
				rotateBall(body, pose, 'shoulder_R', X, -25 * sequence.s[f]);
			});
			refreshProps(sequence, body, built);
		},
	},
	{
		id: 'rdl-locked-knees',
		exercise: 'dumbbell-romanian-deadlift',
		label: 'Knees pushed past straight',
		what: 'The knees are driven 12° into hyperextension through the whole rep.',
		expect: ['joint-limit'],
		apply: (sequence, body, built) => {
			for (const pose of sequence.poses) {
				pose[dof(body, 'knee_L')] = rad(-12);
				pose[dof(body, 'knee_R')] = rad(-12);
			}
			refreshProps(sequence, body, built);
		},
	},
	{
		id: 'bench-bar-through-chest',
		exercise: 'barbell-bench-press',
		label: 'Bar sinks 5 cm into the chest',
		what: 'The bar path is extended 5 cm below where it meets the sternum, and the hands stay where they were.',
		expect: ['equipment-clip', 'touch-lower-chest', 'contact-lost'],
		apply: sequence => sequence.propStates.forEach((states, f) => (states[0].pos[1] -= 0.05 * sequence.s[f])),
	},
	{
		id: 'bench-flared-wrists',
		exercise: 'barbell-bench-press',
		label: 'Wrists cocked back',
		what: 'Both wrists bend back a further 35° under the bar.',
		expect: ['straight-wrists', 'contact-lost'],
		apply: (sequence, body) => {
			for (const pose of sequence.poses) {
				pose[dof(body, 'wrist_L')] -= rad(35);
				pose[dof(body, 'wrist_R')] -= rad(35);
			}
		},
	},
	{
		id: 'bench-skipped-frames',
		exercise: 'barbell-bench-press',
		label: 'A third of the descent goes missing',
		what: 'Frames 20 to 39 are replaced by frame 40, so the arms teleport.',
		expect: ['jerky'],
		apply: sequence => {
			for (let f = 20; f < 40; f++) {
				sequence.poses[f] = [...sequence.poses[40]];
				sequence.propStates[f] = structuredClone(sequence.propStates[40]);
			}
		},
	},
	{
		id: 'bench-too-heavy',
		exercise: 'barbell-bench-press',
		label: '200 kg on the bar',
		what: 'The same rep with more weight than the modelled lifter can press.',
		expect: ['overload'],
		loadKg: 200,
	},
];
