/**
 * Image decoding and re-encoding in the browser.
 *
 * Everything that comes out of here is a JPEG, which matters for two reasons:
 * phone photos are 3-5 MB and would overrun the serverless request body limit
 * once you send two of them, and iPhones shoot HEIC by default — a format no
 * browser except Safari can decode, and that Supabase would happily store and
 * then fail to display everywhere else.
 */

/** Long-edge cap. Enough for handwriting to stay legible under OCR. */
const OCR_MAX_EDGE = 2048
/** Display photos don't need OCR-grade detail. */
const PHOTO_MAX_EDGE = 1600
const QUALITY = 0.85

export type PreparedImage = {
  base64: string
  dataUrl: string
  bytes: number
}

// ISO-BMFF brands that indicate HEIF/HEIC rather than some other MP4 relative.
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
])

/**
 * Cheap HEIC sniff. Reads twelve bytes rather than the whole file — the
 * converter library's own check pulls the entire photo into memory just to
 * look at four of them, and this runs before we decide whether to download it.
 *
 * The filename and MIME checks come first because iOS sometimes reports an
 * empty type, and some pickers hand over a name with no readable header.
 */
async function looksLikeHeic(file: Blob): Promise<boolean> {
  const name = (file as File).name
  if (name && /\.hei[cf]$/i.test(name)) return true
  if (/^image\/hei[cf]/i.test(file.type)) return true

  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (head.length < 12) return false

    const box = String.fromCharCode(...head.subarray(4, 8))
    if (box !== "ftyp") return false

    const brand = String.fromCharCode(...head.subarray(8, 12)).replace(/\0/g, " ").trim()
    return HEIC_BRANDS.has(brand)
  } catch {
    return false
  }
}

/**
 * Decodes an image to a bitmap, converting HEIC first where the browser can't.
 *
 * Native decoding is tried first on purpose: Safari reads HEIC itself and is
 * far quicker than the WebAssembly decoder, so only the browsers that actually
 * need the 3 MB converter download it, and only when a HEIC is picked.
 */
async function decodeToBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch (nativeError) {
    if (!(await looksLikeHeic(file))) {
      throw new Error("That file isn't an image the browser can read.")
    }

    try {
      const { heicTo } = await import("heic-to/next")
      const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 })
      return await createImageBitmap(jpeg)
    } catch {
      throw nativeError instanceof Error
        ? new Error(`Couldn't read that HEIC photo. ${nativeError.message}`)
        : new Error("Couldn't read that HEIC photo.")
    }
  }
}

/** Draws a bitmap to a canvas at a capped size, on a white backdrop. */
function drawScaled(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Couldn't read that image.")

  // White backdrop so transparent PNGs don't OCR as black-on-black.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas
}

/** Prepares a photo for OCR: capped, re-encoded as JPEG, base64 for transport. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const canvas = drawScaled(await decodeToBitmap(file), OCR_MAX_EDGE)

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY)
  const base64 = dataUrl.split(",")[1] ?? ""

  return {
    base64,
    dataUrl,
    // base64 encodes 3 bytes as 4 characters.
    bytes: Math.round((base64.length * 3) / 4),
  }
}

/**
 * Prepares a photo for storage: capped and re-encoded as JPEG so a HEIC from
 * an iPhone displays everywhere, not just in Safari.
 */
export async function toJpegBlob(file: File, maxEdge = PHOTO_MAX_EDGE): Promise<Blob> {
  const canvas = drawScaled(await decodeToBitmap(file), maxEdge)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  )
  if (!blob) throw new Error("Couldn't process that image.")
  return blob
}

/**
 * The file-input accept list. `image/*` alone isn't enough: several browsers
 * won't offer .heic files under it, so they appear greyed out in the picker.
 */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,image/heic,image/heif"
