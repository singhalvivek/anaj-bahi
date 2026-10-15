// Phase 13 — on-device photo preparation. Browser-only (canvas + Image).
//
// A modern Android camera produces a 12 MP, ~4 MB JPEG. Sending that raw would
// spend several megabytes of a village trader's mobile data per bill and buy no
// accuracy: handwriting on a bill is legible well below 1600 px on the long edge,
// and the extra pixels only cost him money and latency.
//
// Downscaling here also means the photo is re-encoded locally before anything
// leaves the phone, and EXIF (including any GPS tag the camera wrote) is dropped
// by the canvas round-trip — the request carries pixels and nothing else.

import { BillReadError, type InlineImage } from './types'

/** Longest edge after downscaling, in px. */
export const MAX_EDGE_PX = 1600

/** JPEG quality. 0.82 keeps pen strokes crisp at roughly a fifth of the bytes. */
export const JPEG_QUALITY = 0.82

/**
 * Hard ceiling on the base64 payload (~6 MB of base64 ≈ 4.5 MB of image).
 * Inline image data has to fit in one request; past this we ask for a tighter
 * crop rather than letting the API reject it with something unreadable.
 */
const MAX_BASE64_BYTES = 6_000_000

/** Decode a File/Blob into a bitmap, preferring createImageBitmap where available. */
async function decode(file: Blob): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  // createImageBitmap handles EXIF orientation natively and avoids an object URL.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { width: bitmap.width, height: bitmap.height, draw: bitmap }
    } catch {
      // Fall through to the <img> path (older WebViews, or an unsupported codec).
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new BillReadError('bad-response', 'could not decode the image'))
      el.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Scale factor that fits the long edge into MAX_EDGE_PX, never upscaling. */
function scaleFor(width: number, height: number): number {
  const longEdge = Math.max(width, height)
  return longEdge <= MAX_EDGE_PX ? 1 : MAX_EDGE_PX / longEdge
}

/**
 * Downscale a chosen photo and return it as inline base64 JPEG.
 *
 * Throws `BillReadError('image-too-large')` when even the downscaled result will
 * not fit inline, which asks the trader for a tighter crop — a message he can act
 * on, unlike a rejected request.
 */
export async function prepareBillPhoto(file: Blob): Promise<InlineImage> {
  const { width, height, draw } = await decode(file)
  if (width === 0 || height === 0) {
    throw new BillReadError('bad-response', 'image has no dimensions')
  }

  const scale = scaleFor(width, height)
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new BillReadError('bad-response', 'canvas unavailable')

  // White backdrop: a JPEG has no alpha, and a transparent source would otherwise
  // composite to black and swallow the writing.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(draw, 0, 0, targetW, targetH)

  if ('close' in draw && typeof (draw as ImageBitmap).close === 'function') {
    ;(draw as ImageBitmap).close()
  }

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  if (base64.length === 0) throw new BillReadError('bad-response', 'encoding produced no data')
  if (base64.length > MAX_BASE64_BYTES) {
    throw new BillReadError('image-too-large', `${base64.length} base64 bytes`)
  }

  return { mimeType: 'image/jpeg', base64 }
}

/** An object URL for the on-screen preview. Callers must revoke it on unmount. */
export function previewUrl(file: Blob): string {
  return URL.createObjectURL(file)
}
