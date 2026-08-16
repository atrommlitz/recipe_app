import type { Metadata } from "next"

import { BulkPhotoImport } from "@/components/BulkPhotoImport"
import { getCookingMethods, getCourses } from "@/lib/queries"

export const metadata: Metadata = { title: "Bulk photo import" }

export default async function BulkPhotoImportPage() {
  const [methods, courses] = await Promise.all([getCookingMethods(), getCourses()])
  return <BulkPhotoImport methods={methods} courses={courses} />
}
