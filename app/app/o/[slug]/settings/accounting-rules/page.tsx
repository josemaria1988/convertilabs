import { redirect } from "next/navigation";

type LegacyAccountingRulesPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function LegacyAccountingRulesPage({
  params,
  searchParams,
}: LegacyAccountingRulesPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedRuleId = readSingleSearchParam(resolvedSearchParams.rule);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const singleValue = readSingleSearchParam(value);

    if (singleValue) {
      query.set(key, singleValue);
    }
  }

  if (selectedRuleId) {
    query.delete("rule");
    redirect(`/app/o/${slug}/rules/${selectedRuleId}${query.size > 0 ? `?${query.toString()}` : ""}`);
  }

  redirect(`/app/o/${slug}/rules${query.size > 0 ? `?${query.toString()}` : ""}`);
}
