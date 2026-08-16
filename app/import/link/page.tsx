import type { Metadata } from "next"

import { LinkImport } from "@/components/LinkImport"

export const metadata: Metadata = { title: "Import from a link" }

export default function LinkImportPage() {
  return <LinkImport />
}
