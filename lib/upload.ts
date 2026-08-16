import { createClient } from "@/lib/supabase/client"

const BUCKET = "recipe-images"

/** Uploads a blob to the public recipe-images bucket and returns its URL. */
export async function uploadImage(file: Blob, filename?: string): Promise<string> {
  const supabase = createClient()

  const extFromName = filename?.includes(".") ? filename.split(".").pop() : undefined
  const extFromType = file.type?.split("/")[1]
  const ext = (extFromName || extFromType || "jpg").toLowerCase().replace("jpeg", "jpg")

  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  })
  if (error) throw new Error(`Image upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Paprika embeds photos as base64 JPEG in the recipe JSON. */
export function base64ToBlob(base64: string, contentType = "image/jpeg"): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: contentType })
}
