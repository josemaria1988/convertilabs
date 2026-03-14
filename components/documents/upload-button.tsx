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
  multiple?: boolean;
  className?: string;
  onFilesSelected: (files: File[]) => void;
};

export function DocumentUploadButton({
  label,
  accept,
  disabled,
  isLoading,
  multiple = true,
  className,
  onFilesSelected,
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
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);

          if (files.length > 0) {
            onFilesSelected(files);
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
          ?? `${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-[14px]`
        }
      >
        {isLoading ? <InlineSpinner /> : null}
        {label}
      </button>
    </>
  );
}
