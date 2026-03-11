import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "..", "..");

export const canonicalFileOrder = [
  "db/schema/00_extensions.sql",
  "db/schema/01_enums.sql",
  "db/schema/02_identity_and_tenants.sql",
  "db/schema/03_master_data.sql",
  "db/schema/04_documents.sql",
  "db/schema/05_accounting.sql",
  "db/schema/06_tax_and_rules.sql",
  "db/schema/07_integrations_and_audit.sql",
  "db/rls/supabase_rls_policies.sql",
];

export const generatedMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260311_sync_canonical_schema_and_rls.sql",
);

function normalizeSql(sql) {
  return sql.replace(/\r\n/g, "\n").trim();
}

async function readRepoFile(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

export async function readCanonicalSections() {
  return Promise.all(
    canonicalFileOrder.map(async (relativePath) => ({
      relativePath,
      sql: normalizeSql(await readRepoFile(relativePath)),
    })),
  );
}

function parseEnumDefinitions(sql) {
  const enumPattern =
    /create type public\.([a-z0-9_]+) as enum\s*\(([\s\S]*?)\);/gi;
  const enums = [];

  for (const match of sql.matchAll(enumPattern)) {
    const [, name, body] = match;
    const labels = [...body.matchAll(/'([^']+)'/g)].map((labelMatch) => labelMatch[1]);

    enums.push({
      name,
      labels,
      createStatement: normalizeSql(match[0]),
    });
  }

  return enums;
}

function parseTableDefinitions(sql) {
  const tablePattern =
    /create table if not exists public\.([a-z0-9_]+)\s*\(([\s\S]*?)\);/gi;
  const tables = [];

  for (const match of sql.matchAll(tablePattern)) {
    const [, tableName, body] = match;
    const columns = [];
    const uniqueConstraints = [];
    const foreignKeys = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");

      if (!line) {
        continue;
      }

      const uniqueMatch = line.match(/^unique\s*\(([^)]+)\)$/i);
      if (uniqueMatch) {
        uniqueConstraints.push(
          uniqueMatch[1]
            .split(",")
            .map((columnName) => columnName.trim())
            .filter(Boolean),
        );
        continue;
      }

      if (/^(constraint|primary key|foreign key|check)\b/i.test(line)) {
        continue;
      }

      const columnMatch = line.match(/^([a-z_][a-z0-9_]*)\s+/i);
      if (!columnMatch) {
        continue;
      }

      const columnName = columnMatch[1];
      columns.push(columnName);

      const foreignKeyMatch = line.match(
        /\breferences\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(([^)]+)\)(?:\s+on delete\s+([a-z_ ]+))?/i,
      );

      if (!foreignKeyMatch) {
        continue;
      }

      const [, refSchema, refTable, refColumn, deleteRule] = foreignKeyMatch;

      foreignKeys.push({
        tableName,
        columnName,
        refSchema,
        refTable,
        refColumn: refColumn.trim(),
        deleteRule: deleteRule ? deleteRule.trim().replace(/\s+/g, " ").toUpperCase() : "NO ACTION",
      });
    }

    tables.push({
      tableName,
      columns,
      uniqueConstraints,
      foreignKeys,
    });
  }

  return tables;
}

function parseIndexDefinitions(sql) {
  const indexPattern =
    /create index if not exists ([a-z0-9_]+)\s+on public\.([a-z0-9_]+)/gi;

  return [...sql.matchAll(indexPattern)].map((match) => ({
    indexName: match[1],
    tableName: match[2],
  }));
}

function parseFunctionDefinitions(sql) {
  const functionPattern =
    /create or replace function public\.([a-z0-9_]+)\s*\(/gi;

  return [...sql.matchAll(functionPattern)].map((match) => match[1]);
}

function parseTriggerDefinitions(sql) {
  const triggerPattern =
    /create trigger ([a-z0-9_]+)\s+[\s\S]*?on\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi;

  return [...sql.matchAll(triggerPattern)].map((match) => ({
    triggerName: match[1],
    schemaName: match[2],
    tableName: match[3],
  }));
}

function parsePolicyDefinitions(sql) {
  const policyPattern =
    /create policy "([^"]+)"\s+on public\.([a-z0-9_]+)/gi;

  return [...sql.matchAll(policyPattern)].map((match) => ({
    policyName: match[1],
    tableName: match[2],
  }));
}

function parseRlsTables(sql) {
  const rlsPattern =
    /alter table public\.([a-z0-9_]+) enable row level security;/gi;

  return [...sql.matchAll(rlsPattern)].map((match) => match[1]);
}

export function buildIdempotentEnumSql(sql) {
  return parseEnumDefinitions(sql)
    .map(
      ({ name, createStatement }) => `do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = '${name}'
  ) then
    ${createStatement}
  end if;
end
$$;`,
    )
    .join("\n\n");
}

export async function buildCanonicalMigrationSql() {
  const sections = await readCanonicalSections();
  const renderedSections = [];

  for (const section of sections) {
    let sql = section.sql;

    if (section.relativePath.endsWith("01_enums.sql")) {
      sql = buildIdempotentEnumSql(sql);
    }

    renderedSections.push(
      `-- >>> ${section.relativePath}\n${sql}\n-- <<< ${section.relativePath}`,
    );
  }

  return `-- Generated from db/ canonical SQL. Do not edit manually.\n-- Regenerate with: npm run db:generate:migration\n\n${renderedSections.join(
    "\n\n",
  )}\n`;
}

export async function writeCanonicalMigrationFile(
  outputPath = generatedMigrationPath,
) {
  const sql = await buildCanonicalMigrationSql();
  await fs.writeFile(outputPath, sql, "utf8");
  return outputPath;
}

export async function extractExpectedSchemaSpec() {
  const sections = await readCanonicalSections();
  const enumSection = sections.find((section) =>
    section.relativePath.endsWith("01_enums.sql"),
  );
  const rlsSection = sections.find((section) =>
    section.relativePath.endsWith("supabase_rls_policies.sql"),
  );
  const tableDefinitions = sections.flatMap((section) =>
    parseTableDefinitions(section.sql),
  );

  return {
    tables: tableDefinitions.map((definition) => definition.tableName),
    columnsByTable: Object.fromEntries(
      tableDefinitions.map((definition) => [
        definition.tableName,
        definition.columns,
      ]),
    ),
    uniqueConstraints: tableDefinitions.flatMap((definition) =>
      definition.uniqueConstraints.map((columns) => ({
        tableName: definition.tableName,
        columns,
      })),
    ),
    foreignKeys: tableDefinitions.flatMap(
      (definition) => definition.foreignKeys,
    ),
    indexes: sections.flatMap((section) => parseIndexDefinitions(section.sql)),
    functionNames: [
      ...new Set(
        sections.flatMap((section) => parseFunctionDefinitions(section.sql)),
      ),
    ],
    triggers: sections.flatMap((section) => parseTriggerDefinitions(section.sql)),
    enums: enumSection ? parseEnumDefinitions(enumSection.sql) : [],
    policies: rlsSection ? parsePolicyDefinitions(rlsSection.sql) : [],
    rlsTables: rlsSection ? parseRlsTables(rlsSection.sql) : [],
  };
}
