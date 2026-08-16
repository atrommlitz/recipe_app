import type { Metadata } from "next"

import { PhotoImport } from "@/components/PhotoImport"
import { getCookingMethods } from "@/lib/queries"

export const metadata: Metadata = { title: "Snap a photo" }

export default async function PhotoImportPage() {
  const methods = await getCookingMethods()
  return <PhotoImport methods={methods} />
}
