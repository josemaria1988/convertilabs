"use client";

import { useId, useRef } from "react";

type DocumentUploadButtonProps = {
  label: string;
  accept: string;
  disabled?: boolean;
  className?: string;
  onFileSelected: (file: File) => void;
};

export function DocumentUploadButton({
  label,
  accept,
  disabled,
  className,
  onFileSelected,
}: DocumentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (file) {
            onFileSelected(file);
          }

          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          inputRef.current?.click();
        }}
        className={
          className
          ?? "rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        }
      >
        {label}
      </button>
    </>
  );
}
