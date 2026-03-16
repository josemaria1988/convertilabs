"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueDocumentExtractionAction } from "@/app/app/o/[slug]/documents/actions";

type DocumentRecoveryActionButtonProps = {
  slug: string;
  documentId: string;
  label: string;
};

export function DocumentRecoveryActionButton({
  slug,
  documentId,
  label,
}: DocumentRecoveryActionButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await enqueueDocumentExtractionAction({
          slug,
          documentId,
        });

        setMessage(result.message);

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No pudimos reencolar la extraccion en este momento.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="ui-button ui-button--secondary"
      >
        {isPending ? "Procesando..." : label}
      </button>
      {message ? (
        <p className="text-sm text-[color:var(--color-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
