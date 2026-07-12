# Agent

**N/A — no agent framework.** Anaj Bahi is a deterministic, offline-first data/ledger PWA. It has **no LLM, no agent orchestration, no prompts, and no model provider**. There is no agent graph to specify. All logic is plain TypeScript: a pure calculation module (`lib/calc`) and a data repository (`lib/db`). See [architecture.md](architecture.md) and [data.md](data.md).

**The Firebase multi-tenant redesign (Phases 6–9) does NOT change this.** Firebase Auth (phone/OTP) and Cloud Firestore replace the retired FastAPI sync backend, but they are ordinary client SDKs — **still no AI, no LLM, no agent, no prompt, no model, no graph**. This file stays N/A.
