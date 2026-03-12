"use client";

import { useId, useRef } from "react";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type DocumentUploadButtonProps = {
  label: string;
  accept: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  onFileSelected: (file: File) => void;
};

export function DocumentUploadButton({
  label,
  accept,
  disabled,
  isLoading,
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
          ?? `${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`
        }
      >
        {isLoading ? <InlineSpinner /> : null}
        {label}
      </button>
    </>
  );
}
