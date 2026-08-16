import type { Metadata } from "next"

import { PaprikaImport } from "@/components/PaprikaImport"

export const metadata: Metadata = { title: "Import from Paprika" }

export default function PaprikaImportPage() {
  return <PaprikaImport />
}
