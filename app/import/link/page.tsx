import type { Metadata } from "next"

import { LinkImport } from "@/components/LinkImport"
import { getCookingMethods } from "@/lib/queries"

export const metadata: Metadata = { title: "Import from a link" }

export default async function LinkImportPage() {
  const methods = await getCookingMethods()
  return <LinkImport methods={methods} />
}
