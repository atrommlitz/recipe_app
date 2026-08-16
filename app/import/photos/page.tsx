import type { Metadata } from "next"

import { BulkPhotoImport } from "@/components/BulkPhotoImport"
import { getCookingMethods } from "@/lib/queries"

export const metadata: Metadata = { title: "Bulk photo import" }

export default async function BulkPhotoImportPage() {
  const methods = await getCookingMethods()
  return <BulkPhotoImport methods={methods} />
}
