import type { Metadata } from "next"

import { PaprikaImport } from "@/components/PaprikaImport"
import { getCookingMethods, getCourses } from "@/lib/queries"

export const metadata: Metadata = { title: "Import from Paprika" }

export default async function PaprikaImportPage() {
  const [methods, courses] = await Promise.all([getCookingMethods(), getCourses()])
  return <PaprikaImport methods={methods} courses={courses} />
}
