// Phase 13 — the ONLY external AI call in this project, and the only place a
// network failure mode exists outside Firebase.
//
// One stateless POST per photo. No agent, no loop, no tools, no history, no
// retry-with-reasoning. The model gets a photo and a frozen prompt, and returns
// JSON that `parse.ts` then refuses to trust. See spec/agent.md.
//
// This file is also the provider boundary: it is the only module that knows the
// word "Gemini". Moving to a key-holding proxy, or to another provider, is a
// change to this file and nothing else — `parse.ts`, `verify.ts` and the whole UI
// take plain JSON and are provider-agnostic.
//
// KEY EXPOSURE: `NEXT_PUBLIC_GEMINI_API_KEY` is inlined into the client bundle and
// is therefore PUBLIC — readable by anyone who opens devtools on the deployed
// site. That was a deliberate, recorded trade-off to avoid standing up a proxy
// before the pilot; it is NOT the same as the NEXT_PUBLIC_FIREBASE_* values, which
// are designed to be public and guarded by Firestore Rules. The required
// mitigations (dedicated key, HTTP-referrer restriction, hard quota cap) and the
// migration path are in spec/architecture.md § Bill Check.

import { BILL_READ_PROMPT, BILL_READ_RESPONSE_SCHEMA } from './prompt'
import { parseReadBillFromText } from './parse'
import { BillReadError, isBillReadError, type BillReader, type InlineImage } from './types'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Default model. Flash-Lite because the job is transcription, not reasoning. */
export const DEFAULT_MODEL = 'gemini-flash-lite-latest'

/** Abandon a read after this long — a trader will not wait, and neither should the UI. */
const TIMEOUT_MS = 45_000

/** The configured model, overridable so the accuracy bake-off needs no code change. */
export function configuredModel(): string {
  const m = process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim()
  return m && m.length > 0 ? m : DEFAULT_MODEL
}

/** The configured key, or null. Null drives the labelled `check-unconfigured` state. */
export function configuredApiKey(): string | null {
  const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim()
  return k && k.length > 0 ? k : null
}

/** Whether Bill Check can run at all. The screen checks this before offering a read. */
export function isBillCheckConfigured(): boolean {
  return configuredApiKey() !== null
}

/** Map a non-2xx response to a typed cause, so each gets its own visible message. */
function errorForStatus(status: number): BillReadError {
  if (status === 429) return new BillReadError('rate-limited', `HTTP ${status}`)
  // 400/403 on this endpoint almost always means the key is bad, revoked, or
  // referrer-restricted away from this origin — which is a configuration problem
  // the trader cannot fix by retrying, so it must not read as a network blip.
  if (status === 400 || status === 401 || status === 403) {
    return new BillReadError('not-configured', `HTTP ${status}`)
  }
  return new BillReadError('network', `HTTP ${status}`)
}

/** Pull the model's text out of the Gemini envelope. */
function textFromResponse(body: unknown): string {
  const candidates = (body as { candidates?: unknown })?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new BillReadError('bad-response', 'no candidates in response')
  }
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts
  if (!Array.isArray(parts)) {
    // A candidate with no parts is usually a safety/recitation block. There is
    // nothing to read and nothing the trader can do differently with the same photo.
    throw new BillReadError('bad-response', 'candidate carried no content parts')
  }
  const text = parts
    .map((p) => (typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : ''))
    .join('')
  if (text.trim() === '') throw new BillReadError('bad-response', 'empty text part')
  return text
}

/**
 * Read a bill photo with Gemini.
 *
 * `temperature: 0` because this is transcription: run-to-run variation on the same
 * photo would be a defect, not creativity. The response schema constrains the
 * shape; `parseReadBillFromText` validates it anyway.
 */
export const readBillWithGemini: BillReader = async (image: InlineImage) => {
  const apiKey = configuredApiKey()
  if (!apiKey) throw new BillReadError('not-configured', 'NEXT_PUBLIC_GEMINI_API_KEY is not set')

  // Checked before the fetch, not after it fails: this is the only online-only
  // screen in an otherwise offline app, so "you are offline" has to be the first
  // thing we can say rather than a guess at why a request died.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new BillReadError('offline')
  }

  const url = `${API_BASE}/${encodeURIComponent(configuredModel())}:generateContent?key=${encodeURIComponent(apiKey)}`
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: BILL_READ_PROMPT },
          { inline_data: { mime_type: image.mimeType, data: image.base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: BILL_READ_RESPONSE_SCHEMA,
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (e) {
    // A fetch rejection is a transport failure: offline mid-flight, DNS, timeout.
    // Re-check onLine because connectivity can drop between the guard and here.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new BillReadError('offline')
    }
    throw new BillReadError('network', e instanceof Error ? e.message : 'fetch failed')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw errorForStatus(res.status)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new BillReadError('bad-response', 'response body was not JSON')
  }

  // parse errors are already typed ('bad-response' / 'no-bill-found'); anything
  // else that escapes becomes a generic bad-response rather than an unhandled throw.
  try {
    return parseReadBillFromText(textFromResponse(body))
  } catch (e) {
    if (isBillReadError(e)) throw e
    throw new BillReadError('bad-response', e instanceof Error ? e.message : 'unparseable')
  }
}
