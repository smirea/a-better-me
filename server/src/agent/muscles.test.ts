import { describe, expect, test } from "bun:test";
import { testServer } from "../testing";

const { ok } = testServer({ clock: () => new Date("2026-10-22T12:00:00.000Z") });

const BENCH = "19f5c6f170d8808bb424e98de4472a7e";
const working = { type: "standard" };
const warmUp = { type: "warmUp" };

describe("program muscle effects", () => {
  test("each cycle counts its planned working sets, deload derived, and recovery carries every earlier day", async () => {
    const bench = (sets: object[]) => ({
      template: { name: "Bench", blocks: [{ exercises: [{ exerciseID: BENCH, sets }] }] },
    });
    const program = await ok("POST", "/programs", {
      name: "Chest",
      cycles: 1,
      config: { deload: "lastCycle" },
      days: [bench([warmUp, working, working, working, working]), bench([working, working]), {}],
    });

    const { cycles } = program.muscleEffects;
    expect(
      cycles.map((cycle: any) => ({
        deload: cycle.deload,
        chest: cycle.days.map((day: any) => day.muscleSets.chest ?? 0),
        recovery: cycle.days.map((day: any) => day.recoveryBefore.chest ?? null),
        weekly: cycle.weeklyMuscleSets.chest,
      })),
    ).toEqual([
      { deload: false, chest: [4, 2, 0], recovery: [1, 0.8, null], weekly: 14 },
      // Chest half-life 24 h, capacity 10: day 2 starts at 1 - (4 * 0.5^4 + 2 * 0.5^3 + 3 * 0.5) / 10.
      { deload: true, chest: [3, 1, 0], recovery: [0.9, 0.8, null], weekly: 9.33 },
    ]);
    expect(cycles[0].days[0].muscleSets.triceps).toBe(2);
  });
});
