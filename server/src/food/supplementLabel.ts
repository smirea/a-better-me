import { z } from "zod";
import { generateJson } from "./gemini";
import { FoodLabelRequest } from "./foodLabel";
import { GEMINI_MODEL } from "./mealPhoto";

const TIMEOUT_MS = 45_000;

export const SupplementLabelRequest = FoodLabelRequest;

/** What the photos say about one supplement, in the app's `Supplement` shapes. A field no photo shows is left out. */
export const SupplementLabel = z
  .object({
    name: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    serving: z.object({ quantity: z.number().positive(), unit: z.string().min(1) }).optional(),
    components: z
      .array(
        z.object({
          name: z.string().min(1),
          amount: z.number().min(0).optional(),
          unit: z.string().min(1).optional(),
        }),
      )
      .optional(),
  })
  .meta({ id: "SupplementLabel" });
export type SupplementLabel = z.output<typeof SupplementLabel>;

const ModelLabel = z.object({
  name: z.string().nullish(),
  brand: z.string().nullish(),
  serving: z.object({ quantity: z.number().positive(), unit: z.string().min(1) }).nullish(),
  components: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number().min(0).nullish(),
        unit: z.string().nullish(),
      }),
    )
    .nullish(),
});

const PROMPT = `You read supplement and medication packaging for a tracker. The photos all show one product: its front, its Supplement Facts or Drug Facts panel, or other sides. Combine what they show into one answer.

- "name" is the product's name as a person would call it ("Vitamin D3", "Magnesium Glycinate", "Omega-3 Fish Oil"), without the brand and without the count in the bottle. Keep a strength that is part of the name on the front ("Vitamin D3 5000 IU").
- "brand" is the brand printed on the package.
- "serving" is the panel's Serving Size: "2 Veggie Capsules" is quantity 2, unit "veggie capsules"; "1 Scoop (5 g)" is quantity 1, unit "scoop". Lowercase the unit and keep the label's singular or plural. Null when no photo shows a serving size.
- "components" is one row per ingredient the Supplement Facts panel or the active ingredients list gives an amount per serving for, in the panel's order: its name as printed without the parenthesised source ("Magnesium", not "Magnesium (as Magnesium Bisglycinate Chelate)"), the amount as a number, and the unit as printed ("mg", "mcg", "g", "IU", "mcg DFE", "billion CFU"). "EPA 400 mg" is amount 400, unit "mg". An ingredient of a proprietary blend that has no amount of its own keeps a null amount and unit. Never list "Other Ingredients", calories, or % Daily Value.
- "components" is null when no photo shows a facts panel or an active ingredients list. Leave everything null that no photo shows, and never guess amounts.`;

const nullable = (type: string) => ({ type, nullable: true });

/** The `responseSchema` subset Gemini accepts (OpenAPI 3.0), not JSON Schema. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: nullable("STRING"),
    brand: nullable("STRING"),
    serving: {
      type: "OBJECT",
      nullable: true,
      properties: { quantity: { type: "NUMBER" }, unit: { type: "STRING" } },
      required: ["quantity", "unit"],
      propertyOrdering: ["quantity", "unit"],
    },
    components: {
      type: "ARRAY",
      nullable: true,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          amount: nullable("NUMBER"),
          unit: nullable("STRING"),
        },
        required: ["name"],
        propertyOrdering: ["name", "amount", "unit"],
      },
    },
  },
  propertyOrdering: ["name", "brand", "serving", "components"],
};

const text = (value: string | null | undefined) => value?.trim() || undefined;

export async function readSupplementLabel(
  request: z.output<typeof SupplementLabelRequest>,
  apiKey: string,
): Promise<SupplementLabel> {
  const label = await generateJson(
    GEMINI_MODEL,
    {
      contents: [
        {
          role: "user",
          parts: [
            ...request.images.map((image) => ({
              inline_data: { mime_type: image.mediaType, data: image.image },
            })),
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: "low" },
      },
    },
    ModelLabel,
    { apiKey, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  const result: SupplementLabel = {};
  const name = text(label.name);
  const brand = text(label.brand);
  const unit = text(label.serving?.unit);
  if (name) result.name = name;
  if (brand) result.brand = brand;
  if (label.serving && unit) result.serving = { quantity: label.serving.quantity, unit };
  if (label.components) {
    result.components = label.components.flatMap((component) => {
      const name = text(component.name);
      if (!name) return [];
      const unit = text(component.unit);
      return [
        {
          name,
          ...(component.amount == null ? {} : { amount: component.amount }),
          ...(unit ? { unit } : {}),
        },
      ];
    });
  }
  return result;
}
