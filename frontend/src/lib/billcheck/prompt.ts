// Phase 13 — the Bill Check prompt and response schema.
//
// Kept here as exported constants rather than inline in the request so the prompt
// is reviewable, greppable and diffable like any other code. Changing the wording
// changes product behaviour, and it should show up in a diff when it does.
//
// The whole instruction set rests on one rule from spec/agent.md: the model
// TRANSCRIBES. It must not compute, must not correct, and must not fill in a
// number it cannot see. A guess is worse than a blank — a blank is an amber cell
// the trader fixes in two seconds, while a confidently wrong digit silently
// corrupts a verdict he is trusting.

/**
 * The instruction text sent with every photo.
 *
 * Written against a village grain trader's handwritten purchase bill: Devanagari
 * or Latin numerals, often a column of sack weights with a written total, a rate
 * per quintal, an amount per grain, and a grand total at the bottom that may or
 * may not be right.
 */
export const BILL_READ_PROMPT = `You are reading a photograph of a HANDWRITTEN grain purchase bill from a village grain trader in India. Transcribe it into the given JSON schema.

YOUR ONLY JOB IS TO READ. Do not calculate anything. Do not correct anything.

Rules:

1. TRANSCRIBE, NEVER COMPUTE. Report every number exactly as it is written on the paper. Never multiply, add, subtract or round. If the written amount disagrees with the rate times the weight, report the written amount anyway — finding that disagreement is the entire purpose of this task, and it is not your job to resolve it.

2. REPORT THE GRAND TOTAL AS WRITTEN. If a total is written at the bottom of the bill, put it in paperTotal exactly as written, even when it does not match the lines above it. If no total is written anywhere, set paperTotal to null. Never derive it yourself.

3. NEVER GUESS. If you cannot clearly read a digit, set that field's value to null and its confidence to 0. A null is correct and useful. A guess is harmful: the trader will trust a number you report confidently. When you can read a field but are unsure of a digit, report your best reading with a confidence below 0.7.

4. CONFIDENCE IS PER FIELD. Give each field an honest 0..1 confidence for how certain you are of THAT field's digits — not an overall impression of the photo. Smudged, overwritten, crossed-out and cramped figures should carry low confidence.

5. NUMERALS. The bill may use Devanagari digits (०१२३४५६७८९) or Latin digits, often mixed. Convert all of them to plain Latin digits. Decimal points may be written as commas or dots.

6. SACK WEIGHTS. Many bills list each sack's weight in a column and then a written total weight for the grain. Put the WRITTEN TOTAL in weightKg — do not add the column up yourself. If only individual sack weights are listed and no total is written, set weightKg to null. Put the number of sacks in sackCount if it is written.

7. UNITS. weightKg and deductionKg are in kilograms. ratePerQuintal is rupees per quintal (1 quintal = 100 kg); it is usually the largest per-unit figure on the line, often labelled भाव / रेट / rate. amount is rupees for that grain line.

8. DEDUCTIONS. A deduction (कटौती / काट / धर्मदा) reduces the weight. Report it in kilograms in deductionKg. If the bill shows no deduction for a line, set deductionKg to 0.

9. PALDARI (पल्लेदारी / हम्माली) is a bill-level labour charge in rupees, usually written once near the total, not per grain. Put it in paldari, or 0 if absent.

10. ONE LINE PER GRAIN. Create one entry in lines for each grain on the bill. Use the grain name as written (Hindi or English, as it appears). If the photo contains no bill at all, or no figures you can read, return an empty lines array.

Return only JSON matching the schema. No commentary, no explanation, no markdown fence.`

/**
 * Gemini `responseSchema` — an OpenAPI-subset schema that constrains the model to
 * the shape rather than merely asking for it.
 *
 * Every numeric field is `nullable` on purpose: rule 3 above requires the model to
 * be ABLE to say "I could not read this", and a non-nullable schema would force it
 * to invent a value instead. `parse.ts` still independently validates everything
 * that comes back — a schema is a constraint, not a guarantee.
 */
const CONFIDENT_NUMBER = {
  type: 'OBJECT',
  properties: {
    value: { type: 'NUMBER', nullable: true },
    confidence: { type: 'NUMBER' },
  },
  required: ['value', 'confidence'],
} as const

const CONFIDENT_STRING = {
  type: 'OBJECT',
  properties: {
    value: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
  },
  required: ['value', 'confidence'],
} as const

export const BILL_READ_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    farmerName: CONFIDENT_STRING,
    place: CONFIDENT_STRING,
    date: CONFIDENT_STRING,
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          grainName: CONFIDENT_STRING,
          ratePerQuintal: CONFIDENT_NUMBER,
          weightKg: CONFIDENT_NUMBER,
          deductionKg: CONFIDENT_NUMBER,
          sackCount: CONFIDENT_NUMBER,
          amount: CONFIDENT_NUMBER,
        },
        required: ['grainName', 'ratePerQuintal', 'weightKg', 'amount'],
      },
    },
    paldari: CONFIDENT_NUMBER,
    paperTotal: CONFIDENT_NUMBER,
  },
  required: ['lines'],
} as const
