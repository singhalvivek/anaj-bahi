import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  health,
  push,
  pull,
  SyncAuthError,
  SyncNetworkError,
  SyncServerError,
  type SyncSnapshot,
} from './client'

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const cfg = { baseUrl: 'https://api.example.com', token: 'tok' }
const emptySnapshot: SyncSnapshot = { bills: [], farmers: [], grainTypes: [], profile: null }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sync client — health', () => {
  it('returns true when /health responds { status: "ok" } (no auth header sent)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, { status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await health('https://api.example.com')).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toBe('https://api.example.com/health')
    // No Authorization header on the public health check.
    expect(init?.headers).toBeUndefined()
  })

  it('returns false when /health responds with a non-ok body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, { status: 'down' })))
    expect(await health('https://api.example.com')).toBe(false)
  })

  it('throws SyncNetworkError when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(health('https://api.example.com')).rejects.toBeInstanceOf(SyncNetworkError)
  })
})

describe('sync client — push/pull typed errors', () => {
  it('push maps a 401 to SyncAuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, {})))
    await expect(push(cfg, emptySnapshot)).rejects.toBeInstanceOf(SyncAuthError)
  })

  it('push maps a 500 to SyncServerError carrying the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(500, {})))
    await expect(push(cfg, emptySnapshot)).rejects.toMatchObject({
      name: 'SyncServerError',
      status: 500,
    })
  })

  it('push maps a fetch reject to SyncNetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(push(cfg, emptySnapshot)).rejects.toBeInstanceOf(SyncNetworkError)
  })

  it('pull returns the parsed snapshot on 200', async () => {
    const snap: SyncSnapshot = {
      bills: [],
      farmers: [{ id: 'f1', name: 'A', place: 'B', createdAt: 1 }],
      grainTypes: [],
      profile: { shopName: 'S', traderName: 'T', phone: 'P' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, snap)))
    const got = await pull(cfg)
    expect(got.farmers).toHaveLength(1)
    expect(got.profile?.shopName).toBe('S')
  })

  it('pull tolerates a malformed body by returning empty arrays / null profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, { bills: 'nope' })))
    const got = await pull(cfg)
    expect(got.bills).toEqual([])
    expect(got.farmers).toEqual([])
    expect(got.profile).toBeNull()
  })
})
