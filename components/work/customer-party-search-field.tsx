"use client";

import { useMemo, useState } from "react";

export type CustomerPartySearchOption = {
  id: string;
  displayName: string;
  taxId: string | null;
};

type CustomerPartySearchFieldProps = {
  name: string;
  options: CustomerPartySearchOption[];
  disabled?: boolean;
};

const resultLimit = 40;

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function optionLabel(option: CustomerPartySearchOption) {
  return `${option.displayName}${option.taxId ? ` / ${option.taxId}` : ""}`;
}

export function filterCustomerPartyOptions(
  options: CustomerPartySearchOption[],
  query: string,
  limit = resultLimit,
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return options.slice(0, limit);
  }

  const tokens = normalizedQuery.split(" ").filter(Boolean);

  return options
    .filter((option) => {
      const haystack = normalizeSearchText(`${option.displayName} ${option.taxId ?? ""}`);

      return tokens.every((token) => haystack.includes(token));
    })
    .slice(0, limit);
}

export function CustomerPartySearchField({
  name,
  options,
  disabled = false,
}: CustomerPartySearchFieldProps) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId],
  );
  const results = useMemo(
    () => filterCustomerPartyOptions(options, query),
    [options, query],
  );

  return (
    <div className="relative space-y-1 lg:col-span-2">
      <label
        htmlFor="customer-party-search"
        className="block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]"
      >
        Cliente existente
      </label>
      <input type="hidden" name={name} value={selectedId} />
      <input
        id="customer-party-search"
        value={query}
        disabled={disabled}
        placeholder="Nombre o RUT"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="customer-party-search-results"
        className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 pr-20 text-sm text-white"
        onFocus={() => {
          setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setIsOpen(true);
        }}
      />
      {selected || query ? (
        <button
          type="button"
          disabled={disabled}
          className="absolute right-2 top-[30px] rounded-[6px] border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-muted)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            setSelectedId("");
            setQuery("");
            setIsOpen(true);
          }}
        >
          Limpiar
        </button>
      ) : null}

      {isOpen && !disabled ? (
        <div
          id="customer-party-search-results"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-lg border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]"
          role="listbox"
        >
          <button
            type="button"
            className="w-full rounded-[6px] px-3 py-2 text-left text-sm text-[color:var(--color-muted)] transition hover:bg-white/8 hover:text-white"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              setSelectedId("");
              setQuery("");
              setIsOpen(false);
            }}
          >
            Sin cliente asignado
          </button>

          <div className="mt-1 max-h-80 overflow-y-auto">
            {results.length > 0 ? (
              results.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selectedId === option.id}
                  className={`w-full rounded-[6px] px-3 py-2 text-left text-sm transition ${
                    selectedId === option.id
                      ? "bg-[color:var(--color-accent)] text-white"
                      : "text-white/90 hover:bg-white/8"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    setSelectedId(option.id);
                    setQuery(optionLabel(option));
                    setIsOpen(false);
                  }}
                >
                  <span className="block truncate font-medium">{option.displayName}</span>
                  {option.taxId ? (
                    <span className="mt-0.5 block text-xs text-[color:var(--color-muted)]">
                      {option.taxId}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] px-3 py-3 text-sm text-[color:var(--color-muted)]">
                Sin resultados
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
