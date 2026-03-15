"use client";

import { HelpHint } from "@/components/ui/help-hint";
import type { DecisionComment } from "@/modules/explanations/types";

type DecisionWhyPopoverProps = {
  decision: DecisionComment;
};

export function DecisionWhyPopover({ decision }: DecisionWhyPopoverProps) {
  return (
    <HelpHint
      content={{
        key: `decision-${decision.title}`,
        title: decision.title,
        shortLabel: decision.summary,
        whatIsIt: decision.summary,
        whyItMatters: decision.reasons.join(" "),
        impact: decision.impacts.join(" "),
        whatCanYouDo: decision.whatCanYouDo.join(" "),
        sourceLabel: decision.sourceLabel,
        expertNotes: decision.expertNotes,
      }}
    />
  );
}
