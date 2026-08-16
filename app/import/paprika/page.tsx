import type { Metadata } from "next"

import { PaprikaImport } from "@/components/PaprikaImport"
import { getCookingMethods } from "@/lib/queries"

export const metadata: Metadata = { title: "Import from Paprika" }

export default async function PaprikaImportPage() {
  const methods = await getCookingMethods()
  return <PaprikaImport methods={methods} />
}
