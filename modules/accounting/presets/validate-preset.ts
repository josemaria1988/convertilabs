import type {
  JournalTemplateSeed,
  PresetAccountSeed,
  PresetBundle,
  PresetUiHint,
  TaxProfileSeed,
} from "@/modules/accounting/presets/types";

function mergeAccountSeed(current: PresetAccountSeed, incoming: PresetAccountSeed) {
  if (current.semanticKey !== incoming.semanticKey) {
    throw new Error(
      `Conflicto de preset: el codigo ${incoming.code} intenta representar dos significados distintos.`,
    );
  }

  return {
    ...current,
    ...incoming,
    semanticKey: current.semanticKey,
    systemRole: incoming.systemRole ?? current.systemRole,
  } satisfies PresetAccountSeed;
}

export function mergePresetAccounts(bundles: PresetBundle[]) {
  const merged = new Map<string, PresetAccountSeed>();

  for (const bundle of bundles) {
    for (const account of bundle.accounts) {
      const existing = merged.get(account.code);

      if (!existing) {
        merged.set(account.code, account);
        continue;
      }

      merged.set(account.code, mergeAccountSeed(existing, account));
    }
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.code.localeCompare(right.code, "es", { numeric: true, sensitivity: "base" }),
  );
}

function uniqueByCode<T extends { code: string }>(items: T[]) {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(item.code, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    left.code.localeCompare(right.code, "es", { numeric: true, sensitivity: "base" }),
  );
}

function uniqueByKey<T extends { key: string }>(items: T[]) {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(item.key, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    left.key.localeCompare(right.key, "es", { numeric: true, sensitivity: "base" }),
  );
}

export function mergePresetJournalTemplates(bundles: PresetBundle[]) {
  return uniqueByCode<JournalTemplateSeed>(bundles.flatMap((bundle) => bundle.journalTemplates));
}

export function mergePresetTaxProfiles(bundles: PresetBundle[]) {
  return uniqueByCode<TaxProfileSeed>(bundles.flatMap((bundle) => bundle.taxProfiles));
}

export function mergePresetUiHints(bundles: PresetBundle[]) {
  return uniqueByKey<PresetUiHint>(bundles.flatMap((bundle) => bundle.uiHints ?? []));
}
