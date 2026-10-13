import type { ModelStructuredOutputDefinition } from "../../types/model-runtime";

const nonBlankString = () => ({
  type: "string",
  pattern: ".*\\S.*",
}) as const;

const nullableString = () => ({
  anyOf: [nonBlankString(), { type: "null" }],
}) as const;

const boundedStringArray = (maxItems: number) => ({
  type: "array",
  maxItems,
  items: nonBlankString(),
}) as const;

export const STRUCTURED_DISCOVERY_INTAKE_OUTPUT = Object.freeze({
  name: "intentlead_discovery_intake_v1",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "intake", "fieldSupports"],
    properties: {
      schemaVersion: { type: "integer", enum: [1] },
      intake: {
        type: "object",
        additionalProperties: false,
        required: [
          "offerSummary", "desiredOutcomes", "targetCompanyDescription", "targetBuyerDescription",
          "markets", "languages", "exclusions", "requestedConfirmedSignals", "missingRequiredFields",
          "assumptionsForReview", "ambiguitiesForClarification",
        ],
        properties: {
          offerSummary: nullableString(),
          desiredOutcomes: boundedStringArray(20),
          targetCompanyDescription: nullableString(),
          targetBuyerDescription: nullableString(),
          markets: boundedStringArray(10),
          languages: boundedStringArray(10),
          exclusions: boundedStringArray(30),
          requestedConfirmedSignals: {
            anyOf: [{ type: "integer", minimum: 20, maximum: 500 }, { type: "null" }],
          },
          missingRequiredFields: {
            type: "array",
            maxItems: 3,
            items: { type: "string", enum: ["offer", "target_company", "market"] },
          },
          assumptionsForReview: boundedStringArray(10),
          ambiguitiesForClarification: {
            type: "array",
            maxItems: 10,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "description"],
              properties: {
                field: {
                  type: "string",
                  enum: ["offer", "target_company", "target_buyer", "market", "language", "exclusions", "target_count"],
                },
                description: nonBlankString(),
              },
            },
          },
        },
      },
      fieldSupports: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "value", "turnId", "quote"],
          properties: {
            field: {
              type: "string",
              enum: [
                "offerSummary", "desiredOutcomes", "targetCompanyDescription", "targetBuyerDescription",
                "markets", "languages", "exclusions", "requestedConfirmedSignals", "assumptionsForReview",
                "ambiguitiesForClarification",
              ],
            },
            value: {
              anyOf: [nonBlankString(), { type: "integer", minimum: 20, maximum: 500 }],
            },
            turnId: { type: "string", pattern: "^[A-Za-z0-9._:-]+$" },
            quote: nonBlankString(),
          },
        },
      },
    },
  },
} satisfies ModelStructuredOutputDefinition);
