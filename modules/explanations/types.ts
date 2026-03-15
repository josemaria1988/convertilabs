export type DecisionComment = {
  title: string;
  summary: string;
  reasons: string[];
  impacts: string[];
  whatCanYouDo: string[];
  sourceLabel?: string;
  expertNotes?: string[];
};

export type HelpHintContent = {
  key: string;
  title: string;
  shortLabel: string;
  whatIsIt: string;
  whyItMatters: string;
  impact: string;
  whatCanYouDo: string;
  sourceLabel?: string;
  expertNotes?: string[];
};
