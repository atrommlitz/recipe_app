import type { Metadata } from "next"

import { LinkImport } from "@/components/LinkImport"
import { getCookingMethods, getCourses } from "@/lib/queries"

export const metadata: Metadata = { title: "Import from a link" }

export default async function LinkImportPage() {
  const [methods, courses] = await Promise.all([getCookingMethods(), getCourses()])
  return <LinkImport methods={methods} courses={courses} />
}
