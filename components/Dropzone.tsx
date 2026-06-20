"use client";

import { useRef, useState } from "react";

export default function Dropzone({
  onFile,
  accept = ".csv,text/csv",
  hint = "Drag & drop your CSV here, or tap to choose a file",
}: {
  onFile: (file: File) => void;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  function handle(file: File | undefined) {
    if (!file) return;
    setFilename(file.name);
    onFile(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      className={`cursor-pointer rounded-2xl border-4 border-dashed p-8 text-center transition ${
        dragging
          ? "border-brand-orange bg-brand-sand"
          : "border-brand-green bg-white"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <div className="text-4xl">🏕️</div>
      <p className="mt-2 font-semibold text-brand-green">
        {filename ?? hint}
      </p>
      {filename ? (
        <p className="mt-1 text-xs text-brand-text/60">Tap to choose a different file</p>
      ) : null}
    </div>
  );
}
