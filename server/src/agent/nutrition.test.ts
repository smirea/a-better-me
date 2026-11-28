import { describe, expect, test } from "bun:test";
import type { SyncResponse } from "sync-engine/core";
import { handle } from "../api";
import { testServer } from "../testing";

let tick = Date.parse("2026-10-22T12:00:00.000Z");
// Each request a millisecond later, so rows ordered by when they were written keep the order they were sent in.
const { config, app, call, ok, phone, phoneWrites } = testServer({ clock: () => new Date(tick++) });

const status = async (method: string, path: string, body?: unknown) => ({
  status: (await call(method, path, body)).status,
});

/** Derived amounts are float products; compare them to the micro-unit. */
const round = (amounts: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(amounts).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6]),
  );

const oats = {
  name: "Oats",
  nutrition: {
    nutrients: { k: 380, p: 13, f: 7, c: 68, "291": 10 },
    baseGrams: 100,
    measures: [{ name: "cup", quantity: 1, servings: 0.8 }],
  },
};

describe("nutrition agent API", () => {
  test("foods: custom ids are UUIDs, cached ones are keyed, and an id is created once", async () => {
    const created = await ok("POST", "/foods", oats);
    expect(created).toMatchObject({ source: "custom", name: "Oats", brand: null, archived: false });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    expect((await status("POST", "/foods", { ...oats, source: "usda" })).status).toBe(400);
    await ok("POST", "/foods", { ...oats, id: "usda-173904", source: "usda", name: "Oats, USDA" });
    expect(
      (await status("POST", "/foods", { ...oats, id: "usda-173904", source: "usda" })).status,
    ).toBe(409);

    const patched = await ok("PATCH", `/foods/${created.id}`, { brand: "Quaker" });
    expect(patched.brand).toBe("Quaker");
    expect((await ok("GET", "/foods?q=quaker")).items.map((food: any) => food.id)).toEqual([
      created.id,
    ]);
    expect((await ok("GET", "/foods?source=usda")).items.map((food: any) => food.id)).toEqual([
      "usda-173904",
    ]);

    const row = (await phone("foods")).find((food) => food.id === created.id);
    expect(row!.nutrition).toBe(
      '{"baseGrams":100,"measures":[{"name":"cup","quantity":1,"servings":0.8}],"nutrients":{"291":10,"c":68,"f":7,"k":380,"p":13}}',
    );
  });

  test("recipes derive their nutrition per serving from the ingredient snapshots", async () => {
    const food = await ok("POST", "/foods", {
      ...oats,
      id: "00000000-0000-4000-8000-000000000001",
    });
    const milk = {
      source: "custom",
      name: "Milk",
      nutrition: {
        nutrients: { k: 50, p: 3.4, c: 5, nc: 5 },
        measures: [{ name: "mL", quantity: 100, servings: 1 }],
      },
    };
    const recipe = await ok("POST", "/recipes", {
      name: "Overnight Oats",
      servings: 2,
      cookedGrams: 500,
      ingredients: [
        {
          foodId: food.id,
          serving: { measure: { name: "cup", quantity: 1, servings: 0.8 }, quantity: 1 },
        },
        {
          food: milk,
          serving: { measure: { name: "mL", quantity: 100, servings: 1 }, quantity: 300 },
        },
      ],
    });
    expect(recipe.ingredients[0].food).toEqual({
      foodID: food.id,
      source: "custom",
      name: "Oats",
      nutrition: oats.nutrition,
    });
    expect({ ...recipe.nutrition, nutrients: round(recipe.nutrition.nutrients) }).toEqual({
      nutrients: { k: 227, p: 10.3, f: 2.8, c: 34.7, "291": 4, nc: 30.7 },
      baseGrams: 250,
      measures: [{ name: "serving", quantity: 1, servings: 1 }],
    });
    expect(
      (await ok("PATCH", `/recipes/${recipe.id}`, { ingredients: [], steps: ["Stir"] })).nutrition
        .nutrients,
    ).toEqual({});
  });

  test("entries snapshot a stored food, scale by their serving, and total by day", async () => {
    const food = await ok("POST", "/foods", { ...oats, name: "Granola" });
    const logged = await ok("POST", "/food-entries", {
      day: "2026-10-20",
      minute: 480,
      foodId: food.id,
      serving: { measure: { name: "cup", quantity: 1, servings: 0.8 }, quantity: 0.5 },
    });
    expect(logged).toMatchObject({
      day: "2026-10-20",
      minute: 480,
      food: { foodID: food.id, source: "custom", name: "Granola" },
    });
    expect(round(logged.amounts)).toEqual({ k: 152, p: 5.2, f: 2.8, c: 27.2, "291": 4 });
    const quick = await ok("POST", "/food-entries", {
      day: "2026-10-20",
      food: {
        source: "quick_add",
        name: "Quick Add",
        nutrition: {
          nutrients: { k: 100, p: 10 },
          measures: [{ name: "serving", quantity: 1, servings: 1 }],
        },
      },
    });
    expect(quick.minute).toBe(720);
    expect(quick.serving).toEqual({
      measure: { name: "serving", quantity: 1, servings: 1 },
      quantity: 1,
    });

    expect((await status("POST", "/food-entries", { day: "2026-10-20" })).status).toBe(400);
    expect(
      (await status("POST", "/food-entries", { day: "2026-10-20", foodId: "nope" })).status,
    ).toBe(404);
    expect(
      (await status("POST", "/food-entries", { day: "20-10-2026", foodId: food.id })).status,
    ).toBe(400);
    expect(
      (await status("POST", "/food-entries", { id: quick.id, day: "2026-10-20", foodId: food.id }))
        .status,
    ).toBe(409);

    const day = await ok("GET", "/food-log/2026-10-20");
    expect(day).toMatchObject({ status: "none", override: null });
    expect(round(day.totals)).toEqual({ k: 252, p: 15.2, f: 2.8, c: 27.2, "291": 4 });
    expect(day.entries.map((entry: any) => entry.id)).toEqual([logged.id, quick.id]);

    await ok("PATCH", `/food-entries/${quick.id}`, { day: "2026-10-21", minute: 60 });
    expect(
      (await ok("GET", "/food-entries?from=2026-10-21&to=2026-10-21")).items.map(
        (entry: any) => entry.id,
      ),
    ).toEqual([quick.id]);
    await ok("DELETE", `/food-entries/${quick.id}`);
    expect(await ok("GET", "/food-entries?from=2026-10-21")).toEqual({ total: 0, items: [] });
    const row = (await phone("food_entries")).find((entry) => entry.id === logged.id);
    expect(row!.serving).toBe(
      '{"measure":{"name":"cup","quantity":1,"servings":0.8},"quantity":0.5}',
    );
  });

  test("an altered recipe's alterations sync, survive a serving change, and go with a food swap", async () => {
    const measure = { name: "serving", quantity: 1, servings: 1 };
    const grams = { name: "g", quantity: 1, servings: 0.01 };
    const snapshot = {
      foodID: "r1",
      source: "recipe",
      name: "Pasta sauce",
      nutrition: { nutrients: { k: 200, p: 20 }, measures: [measure] },
    };
    const beef = {
      foodID: "usda-1",
      source: "usda",
      name: "Beef",
      nutrition: { nutrients: { k: 200, p: 20 }, baseGrams: 100, measures: [grams] },
    };
    const alterations = [
      {
        id: "a",
        food: beef,
        original: { measure: grams, quantity: 50 },
        serving: { measure: grams, quantity: 100 },
      },
      { id: "b", food: beef, original: { measure: grams, quantity: 20 } },
    ];
    const write = (id: string, values: Record<string, unknown>) =>
      handle(
        new Request("http://api.test/api/sync", {
          method: "POST",
          headers: { authorization: `Bearer ${config.ownerToken}` },
          body: JSON.stringify({
            protocol: 2,
            client: `phone-${crypto.randomUUID()}`,
            cursor: 0,
            writes: [{ seq: 1, table: "food_entries", id, op: "put", values }],
          }),
        }),
        app,
      ).then((response) => response.json() as Promise<SyncResponse>);
    const row = (alterations: unknown) => ({
      day: "2026-10-25",
      minute: 600,
      food: JSON.stringify(snapshot),
      serving: JSON.stringify({ measure, quantity: 1 }),
      alterations: JSON.stringify(alterations),
      created_at: "2026-10-25T10:00:00.000Z",
      updated_at: "2026-10-25T10:00:00.000Z",
    });
    expect((await write("altered", row(alterations))).rejected).toEqual([]);
    expect((await write("bad", row([{ id: "c", food: beef }]))).rejected).toHaveLength(1);

    expect((await ok("GET", "/food-entries/altered")).alterations).toEqual(alterations);
    const doubled = await ok("PATCH", "/food-entries/altered", {
      serving: { measure, quantity: 2 },
    });
    expect(doubled.alterations).toEqual(alterations);
    expect(doubled.amounts).toEqual({ k: 400, p: 40 });
    expect(
      (
        await ok("PATCH", "/food-entries/altered", {
          food: beef,
          serving: { measure: grams, quantity: 100 },
        })
      ).alterations,
    ).toBeNull();
    expect(
      (await phone("food_entries")).find((entry) => entry.id === "altered")!.alterations,
    ).toBeNull();
  });

  test("favorites keep the newest fifty", async () => {
    const food = await ok("POST", "/foods", { ...oats, name: "Favorite" });
    const ids: string[] = [];
    for (let index = 0; index < 51; index++) {
      ids.push((await ok("POST", "/food-favorites", { foodId: food.id })).id);
    }
    const kept = (await ok("GET", "/food-favorites")).map((favorite: any) => favorite.id);
    expect(kept.length).toBe(50);
    expect(kept).not.toContain(ids[0]);
    expect(kept).toContain(ids[50]);
  });

  test("body metrics, plans, and nutrient goals are one row per key", async () => {
    await ok("PUT", "/body-metrics/2026-10-20/waist", { value: 86 });
    const metric = await ok("PUT", "/body-metrics/2026-10-20/waist", { value: 85.5 });
    expect(metric).toMatchObject({
      id: "2026-10-20/waist",
      day: "2026-10-20",
      kind: "waist",
      value: 85.5,
    });
    expect((await ok("GET", "/body-metrics?kind=waist")).total).toBe(1);
    expect((await status("PUT", "/body-metrics/2026-10-20/elbow", { value: 1 })).status).toBe(400);

    const targets = Array.from({ length: 7 }, () => ({
      energy: 2000,
      protein: 160,
      fat: 60,
      carbs: 200,
    }));
    const goal = {
      kind: "lose",
      targetWeightKg: 80,
      ratePercentPerWeek: -0.5,
      startedOn: "2026-10-01",
    };
    const plan = await ok("PUT", "/nutrition-plans/2026-10-01", { kind: "setup", goal, targets });
    expect(plan).toMatchObject({
      id: "2026-10-01",
      kind: "setup",
      coaching: {
        style: "coached",
        diet: "balanced",
        protein: "moderate",
        floor: "standard",
        training: "lifting",
        highDays: [],
      },
      expenditureKcal: null,
    });
    const replaced = await ok("PUT", "/nutrition-plans/2026-10-01", {
      kind: "edit",
      goal,
      targets,
      expenditureKcal: 2500,
    });
    expect(replaced.createdAt).toBe(plan.createdAt);
    expect((await ok("GET", "/nutrition-plans")).map((row: any) => [row.id, row.kind])).toEqual([
      ["2026-10-01", "edit"],
    ]);
    expect(
      (await status("PUT", "/nutrition-plans/2026-10-08", { goal, targets: targets.slice(1) }))
        .status,
    ).toBe(400);

    await ok("PUT", "/nutrient-goals/2026-10-01/291", { mode: "custom", floor: 25, ceiling: 60 });
    const reset = await ok("PUT", "/nutrient-goals/2026-10-01/291", { mode: "auto", floor: 1 });
    expect(reset).toEqual({
      id: "2026-10-01/291",
      nutrient: "291",
      startsOn: "2026-10-01",
      mode: "auto",
      floor: null,
      target: null,
      ceiling: null,
    });
    expect((await status("PUT", "/nutrient-goals/2026-10-01/fiber", { mode: "none" })).status).toBe(
      400,
    );
  });

  test("a row copied from Apple Health is read-only, and a manual value cannot replace it", async () => {
    const weighIn = "00000000-0000-4000-8000-0000000000bb";
    const steps = "2026-10-21/steps";
    await phoneWrites([
      {
        seq: 1,
        table: "body_weights",
        id: weighIn,
        op: "put",
        values: { measured_at: "2026-10-21T07:00:00.000Z", weight_kg: 88, source: "healthkit" },
      },
      {
        seq: 2,
        table: "body_metrics",
        id: steps,
        op: "put",
        values: {
          day: "2026-10-21",
          kind: "steps",
          value: 9000,
          source: "healthkit",
          updated_at: "2026-10-21T20:00:00.000Z",
        },
      },
    ]);
    expect((await status("PATCH", `/body-weights/${weighIn}`, { weightKg: 70 })).status).toBe(409);
    expect((await status("DELETE", `/body-weights/${weighIn}`)).status).toBe(409);
    expect((await status("PUT", `/body-metrics/${steps}`, { value: 1 })).status).toBe(409);
    expect((await status("DELETE", `/body-metrics/${steps}`)).status).toBe(409);
    expect((await ok("GET", `/body-weights/${weighIn}`)).weightKg).toBe(88);
    expect(
      (await ok("GET", "/body-metrics?kind=steps&from=2026-10-21&to=2026-10-21")).items[0].value,
    ).toBe(9000);
    expect((await ok("PUT", "/body-metrics/2026-10-22/steps", { value: 7000 })).source).toBe(
      "manual",
    );
  });

  test("weigh-ins take a given id and body fat; settings merge the profile and the Nutrition settings", async () => {
    const id = "00000000-0000-4000-8000-0000000000aa";
    const weight = await ok("POST", "/body-weights", {
      id,
      weightKg: 90,
      bodyFatPercent: 20,
      measuredAt: "2026-10-20T12:00:00Z",
    });
    expect(weight).toEqual({
      id,
      weightKg: 90,
      bodyFatPercent: 20,
      measuredAt: "2026-10-20T12:00:00.000Z",
      source: "manual",
    });
    expect((await status("POST", "/body-weights", { id, weightKg: 91 })).status).toBe(409);
    expect((await ok("PATCH", `/body-weights/${id}`, { weightKg: 89.5 })).weightKg).toBe(89.5);

    await ok("PATCH", "/settings", {
      nutrition: { checkInWeekday: 3, timeline: { firstHour: 6 } },
    });
    const settings = await ok("PATCH", "/settings", {
      profile: { heightCm: 180, birthDate: "1990-01-31" },
      nutrition: { timeline: { lastHour: 22 } },
    });
    expect(settings.nutrition).toEqual({
      checkInWeekday: 3,
      timeline: { firstHour: 6, lastHour: 22 },
    });
    expect(settings.profile).toEqual({ heightCm: 180, birthDate: "1990-01-31" });
    expect((await status("PATCH", "/settings", { nutrition: { checkInWeekday: 8 } })).status).toBe(
      400,
    );
    const columns = await ok("PATCH", "/settings", {
      nutrition: { summaryNutrients: ["k", "nc", "f", "291"] },
    });
    expect(columns.nutrition.summaryNutrients).toEqual(["k", "nc", "f", "291"]);
    expect(
      (
        await status("PATCH", "/settings", {
          nutrition: { summaryNutrients: ["k", "p", "p", "c"] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await status("PATCH", "/settings", {
          nutrition: { summaryNutrients: ["k", "p", "f", "301"] },
        })
      ).status,
    ).toBe(400);
    await ok("PATCH", "/settings", { nutrition: { summaryNutrients: ["k", "p", "f", "c"] } });

    await ok("PATCH", "/settings", { nutrition: { mealRating: { enabled: true } } });
    const rated = await ok("PATCH", "/settings", {
      nutrition: { mealRating: { formula: "caloriesPerProtein" } },
    });
    expect(rated.nutrition.mealRating).toEqual({ enabled: true, formula: "caloriesPerProtein" });
    expect(
      (await status("PATCH", "/settings", { nutrition: { mealRating: { formula: "fatPerCarb" } } }))
        .status,
    ).toBe(400);

    await ok("PATCH", "/settings", {
      nutrition: { standardFloorKcal: 1300, logger: { timeSelection: "timePad" } },
    });
    const later = await ok("PATCH", "/settings", {
      nutrition: {
        logger: { optimization: "context" },
        coachingModules: { fasting: true },
        visibleBodyMetrics: ["waist"],
      },
    });
    expect(later.nutrition).toEqual({
      checkInWeekday: 3,
      timeline: { firstHour: 6, lastHour: 22 },
      summaryNutrients: ["k", "p", "f", "c"],
      standardFloorKcal: 1300,
      logger: { timeSelection: "timePad", optimization: "context" },
      coachingModules: { fasting: true },
      visibleBodyMetrics: ["waist"],
      mealRating: { enabled: true, formula: "caloriesPerProtein" },
    });
    const stripped = await ok("PATCH", "/settings", { nutrition: { searchOpenFoodFacts: true } });
    expect(stripped.nutrition).not.toHaveProperty("searchOpenFoodFacts");
  });

  test("entries keep the meal section they were logged into when the sections change", async () => {
    const food = await ok("POST", "/foods", { ...oats, name: "Section Oats" });
    const log = (body: object) =>
      ok("POST", "/food-entries", { day: "2026-10-23", foodId: food.id, ...body });
    expect((await log({ minute: 9 * 60 + 30 })).section).toBe("breakfast");
    expect((await log({ minute: 9 * 60 + 30, section: "lunch" })).section).toBe("lunch");
    expect(
      (
        await status("POST", "/food-entries", {
          day: "2026-10-23",
          foodId: food.id,
          section: "brunch",
        })
      ).status,
    ).toBe(422);

    const sections = [
      { id: "breakfast", name: "Breakfast", start: 0 },
      { id: "brunch", name: "Brunch", start: 9 * 60 },
      { id: "dinner", name: "Dinner", start: 17 * 60 },
    ];
    const moved = await log({ minute: 8 * 60 });
    await ok("PATCH", "/settings", {
      nutrition: { mealSections: sections, timeline: { display: "sections" } },
    });
    expect((await ok("GET", `/food-entries/${moved.id}`)).section).toBe("breakfast");
    const brunch = await log({ minute: 9 * 60 + 30 });
    expect(brunch.section).toBe("brunch");
    expect((await ok("PATCH", `/food-entries/${moved.id}`, { minute: 18 * 60 })).section).toBe(
      "dinner",
    );
    expect(
      (await ok("PATCH", `/food-entries/${moved.id}`, { quantity: 2, day: "2026-10-24" })).section,
    ).toBe("dinner");
    expect((await ok("GET", "/settings")).nutrition).toMatchObject({
      mealSections: sections,
      timeline: { display: "sections" },
    });

    for (const bad of [
      [],
      [sections[0], { ...sections[1], start: 0 }],
      [sections[0], sections[0]],
    ]) {
      expect(
        (await status("PATCH", "/settings", { nutrition: { mealSections: bad } })).status,
      ).toBe(400);
    }
    const [breakfast, , dinner] = sections;
    await ok("PATCH", "/settings", { nutrition: { mealSections: [breakfast, dinner] } });
    expect((await ok("GET", `/food-entries/${brunch.id}`)).section).toBe("brunch");
    await ok("PATCH", "/settings", {
      nutrition: { mealSections: [breakfast, { ...dinner!, start: 600 }] },
    });
    const rows = await phone("food_entries");
    expect(rows.find((entry) => entry.id === brunch.id)!.section).toBe("breakfast");
    expect(rows.find((entry) => entry.id === moved.id)!.section).toBe("dinner");

    await ok("PATCH", "/settings", {
      nutrition: { mealSections: [{ ...breakfast!, start: 300 }, dinner] },
    });
    expect((await log({ minute: 60 })).section).toBe("dinner");
  });
});
