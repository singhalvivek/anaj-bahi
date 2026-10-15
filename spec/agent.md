# Agent

> **Status changed in Phase 13.** This file was `N/A — no agent framework` for Phases 1–12
> and said so three times over. [Bill Check](capabilities/bill-check.md) introduces the
> project's **first and only** LLM call, so this file is now real. What it describes is
> deliberately the smallest possible AI surface: **one stateless vision call, no agent, no
> graph, no orchestration framework, no tools, no memory, no multi-turn.**

## There is still no agent framework
No LangGraph, no CrewAI, no AutoGen, no LangChain, no Anthropic/OpenAI/Google *agent* SDK.
There is no graph to specify because there are no nodes, no edges, no state machine and no
loop. A single HTTP POST is not an agent and is not modelled as one.

What exists is **one function**:

```
readBill(image) → ReadBill | BillReadError
```

implemented in `frontend/src/lib/billcheck/reader.ts` as a `fetch` to the Gemini
`:generateContent` endpoint. It is called once per photo, by one screen, with no history
and no follow-up turn. Everything downstream of it is ordinary deterministic TypeScript.

## Role of the model: eyes only
The single most important constraint in this design, restated here because it is the thing
most likely to be eroded by a future change:

**The model transcribes. It never calculates.**

| Responsibility | Owner | Why |
|---|---|---|
| Read handwritten Devanagari/Latin digits off a photo | the model | genuinely hard, genuinely what it is good at |
| Report per-field confidence | the model | only it knows what it struggled to read |
| Multiply, deduct, round, add, compare | `lib/calc` (pure, unit-tested) | must be exact, reproducible and hand-checkable |
| Decide whether the paper is wrong | `lib/billcheck/verify.ts` (pure) | a verdict must be derivable and testable without a network |

A model asked to do the arithmetic would be non-deterministic on the one surface where
[plan.md](../strategy/plan.md) sets an absolute requirement: *"if your total is off by 0.01,
every number on the screen dies with it."* It would also be untestable without burning API
calls, and it would make every regression a coin-flip. Routing the read numbers through the
engine that already has unit-tested worked examples costs nothing and removes the entire
class of problem.

Practical consequence worth noting: because the math is local, **correcting a misread digit
re-verifies instantly with no second API call.** That is a UX win that falls straight out of
the architectural rule.

## Provider + model
| | |
|---|---|
| **Provider** | Google Gemini (Generative Language API), called directly from the client |
| **Model** | `NEXT_PUBLIC_GEMINI_MODEL`, default **`gemini-flash-lite-latest`** |
| **Why Gemini** | The product owner validated Gemini Flash reading these exact handwritten bills correctly before any code was written. Empirical evidence on the real input beats any benchmark, and it is the cheapest credible option. |
| **Why a Flash/Lite tier** | The model only has to read digits. Reasoning capability buys nothing here, and cost scales with bills/day — potentially ~100/day per trader. |
| **Swapping it** | One env var. The provider boundary is `reader.ts`; `parse.ts`, `verify.ts` and the whole UI are provider-agnostic and take plain JSON. A different provider is a new `reader.ts` implementation of the same `BillReader` type and nothing else. |

**Model choice is not yet settled by measurement.** The accuracy bake-off described in
[roadmap.md § Phase 13](roadmap.md) — 20 real bills, scored on *confident-and-wrong rate*,
not raw accuracy — has not been run. The default above is the starting point, not a
conclusion. `NEXT_PUBLIC_GEMINI_MODEL` exists precisely so that bake-off can be run against
the shipped screen without a code change.

## Request shape (frozen)
One `POST` to
`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`:

- `contents[0].parts` — the frozen prompt text (`lib/billcheck/prompt.ts`) plus one
  `inline_data` image part (downscaled JPEG, base64).
- `generationConfig.responseMimeType` — `application/json`.
- `generationConfig.responseSchema` — a strict schema pinning every field and type, so the
  model is constrained to the shape rather than merely asked for it.
- `generationConfig.temperature` — `0`. This is transcription; there is no creative latitude
  and run-to-run variation on the same photo is a defect.

**The response is still never trusted.** `responseSchema` is a constraint, not a guarantee:
`parse.ts` independently validates, coerces and range-checks everything, and a response that
fails validation becomes a typed error with a visible bilingual message. Those paths are
unit-tested against fixture JSON with no key and no network.

## Prompt
The prompt lives in **`lib/billcheck/prompt.ts`** as an exported constant, not inline in the
request — so it is reviewable, greppable and diffable like any other code. Its instructions
in substance:

- Transcribe only; do not compute, do not correct, do not fill in a number you cannot see.
- Report the grand total **exactly as written on the paper**, even when it disagrees with
  the lines — that disagreement is the entire product.
- Emit `null` and a low confidence rather than a guess. **A guess is worse than a blank**,
  because a confidently wrong digit silently corrupts a verdict the trader is trusting.
- Handle Devanagari and Latin numerals; handle a column of sack weights by reading the
  written total, not by summing.

## What this file does NOT authorise
To keep the AI surface honestly scoped, and because each of these would be a real
architectural change rather than an increment:

- No agent loop, tool use, function calling, or multi-turn conversation.
- No LLM anywhere else in the app. The ledger, calculations, search, rollups, sync, auth and
  receipts remain fully deterministic and fully offline-capable.
- No LLM in any test gate. Unit tests are pure; E2E intercepts the HTTP call. **No gate ever
  spends a real API call**, so the suite stays free, offline and deterministic.
- No writing to the ledger from a model-derived value — see
  [bill-check.md § Scope boundary](capabilities/bill-check.md).

See [architecture.md § Bill Check](architecture.md#bill-check-phase-13--frozen) for the
transport, key handling and security posture.
