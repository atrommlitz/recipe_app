import type { Metadata } from "next"

import { PhotoImport } from "@/components/PhotoImport"
import { getCookingMethods, getCourses } from "@/lib/queries"

export const metadata: Metadata = { title: "Snap a photo" }

export default async function PhotoImportPage() {
  const [methods, courses] = await Promise.all([getCookingMethods(), getCourses()])
  return <PhotoImport methods={methods} courses={courses} />
}
