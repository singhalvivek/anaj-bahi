// Client-side rasterise-and-share, fully offline (no server, no network, no
// external image service). Turns a rendered receipt node into a PNG and shares
// it via the phone's native share sheet (WhatsApp etc.); if file-sharing is
// unsupported (most desktop browsers, headless Chromium) it downloads the PNG
// instead. There is never a dead path — the caller always gets a result or a
// thrown error it can surface as `t('share.error')`.

import { toBlob } from 'html-to-image'

export type ShareResult = 'shared' | 'downloaded'

// `navigator.share` / `navigator.canShare` are not present in every browser; a
// loose (optional-member) view lets us feature-detect without lib-typing clashes.
interface ShareCapableNavigator {
  share?: (data?: ShareData) => Promise<void>
  canShare?: (data?: ShareData) => boolean
}

/**
 * Rasterise `node` to a PNG and share it. Returns:
 *   'shared'      — handed to the native share sheet via navigator.share
 *   'downloaded'  — fell back to a browser download (share unsupported)
 * Throws if rasterisation fails (blank blob) so the caller can show an error.
 */
export async function shareReceiptImage(
  node: HTMLElement,
  filename: string,
): Promise<ShareResult> {
  const blob = await toBlob(node, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    cacheBust: true,
  })

  if (!blob) {
    throw new Error('Failed to rasterise receipt to an image.')
  }

  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as ShareCapableNavigator

  // Native share sheet with the image file attached — the ideal path on phones.
  if (
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [file] })
  ) {
    try {
      await nav.share({
        files: [file],
        title: filename,
        text: filename,
      })
      return 'shared'
    } catch (err) {
      // A user cancelling the share sheet (AbortError) is not an error we
      // should surface as a failure, and it is not a reason to also download.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared'
      }
      // Any other share failure falls through to the download fallback below.
    }
  }

  // Fallback: trigger a download of the PNG.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the download has had time to start (revoking synchronously can
  // cancel the download in some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
