"use client"

import Image from "next/image"
import { useRef, useState } from "react"

import { buttonQuiet, labelClass } from "@/components/ui"
import { uploadImage } from "@/lib/upload"

export function ImageUpload({
  value,
  onChange,
}: {
  value: string | null
  onChange: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      onChange(await uploadImage(file, file.name))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className={labelClass}>Photo</span>

      {value ? (
        <div className="relative mb-2 aspect-[4/3] w-full max-w-xs overflow-hidden rounded-[2px] border border-rule bg-ground">
          <Image src={value} alt="" fill sizes="320px" className="object-cover" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={buttonQuiet}
        >
          {busy ? "Uploading…" : value ? "Replace photo" : "Choose photo"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-ink-mute hover:text-alert"
          >
            Remove
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ""
        }}
      />

      {error ? (
        <p role="alert" className="mt-1 text-sm text-alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
