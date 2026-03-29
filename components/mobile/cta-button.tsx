import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";

type CTAButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  tone?: "primary" | "secondary";
  fullWidth?: boolean;
};

export function CTAButton({
  children,
  className = "",
  tone = "primary",
  fullWidth = true,
  type = "button",
  ...props
}: CTAButtonProps) {
  const toneClassName =
    tone === "secondary"
      ? buttonSecondaryChromeClassName
      : buttonPrimaryChromeClassName;

  return (
    <button
      type={type}
      className={`${buttonBaseClassName} ${toneClassName} ${fullWidth ? "w-full" : ""} px-4 py-3 text-sm disabled:opacity-60 ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
