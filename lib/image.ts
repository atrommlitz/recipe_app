/**
 * Downscales and re-encodes an image in the browser before it's sent for OCR.
 *
 * Two reasons this has to happen client-side: a modern phone photo is 3-5 MB,
 * which overruns the serverless request body limit once you send two of them,
 * and full-resolution images cost meaningfully more vision tokens without
 * reading any better. 2048px on the long edge keeps handwriting legible.
 */
const MAX_EDGE = 2048
const QUALITY = 0.85

export type PreparedImage = {
  base64: string
  dataUrl: string
  bytes: number
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

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

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY)
  const base64 = dataUrl.split(",")[1] ?? ""

  return {
    base64,
    dataUrl,
    // base64 encodes 3 bytes as 4 characters.
    bytes: Math.round((base64.length * 3) / 4),
  }
}
