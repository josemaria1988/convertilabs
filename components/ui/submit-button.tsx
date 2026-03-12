"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
};

export function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel,
  type,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      {...props}
      type={type ?? "submit"}
      disabled={isDisabled}
      className={className}
    >
      {pending ? <InlineSpinner /> : null}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}
