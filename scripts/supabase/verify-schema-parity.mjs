import pg from "pg";
import { extractExpectedSchemaSpec } from "./canonical-schema.mjs";
import { loadProjectEnv } from "./env.mjs";

const { Client } = pg;

function toKey(parts) {
  return parts.join("|");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function formatList(values) {
  return values.map((value) => `  - ${value}`).join("\n");
}

function groupByTable(rows, keyName) {
  const grouped = {};

  for (const row of rows) {
    grouped[row.table_name] ??= [];
    grouped[row.table_name].push(row[keyName]);
  }

  return grouped;
}

function buildConnectionConfig(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");

  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

async function loadActualSchema(client) {
  const columnsResult = await client.query(`
      select
        table_name,
        column_name
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `);
  const uniqueResult = await client.query(`
      select
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position
      from information_schema.table_constraints as tc
      join information_schema.key_column_usage as kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      where tc.table_schema = 'public'
        and tc.constraint_type = 'UNIQUE'
      order by tc.table_name, tc.constraint_name, kcu.ordinal_position
    `);
  const foreignKeyResult = await client.query(`
      select
        src.relname as table_name,
        src_att.attname as column_name,
        ref_ns.nspname as foreign_table_schema,
        ref.relname as foreign_table_name,
        ref_att.attname as foreign_column_name,
        case con.confdeltype
          when 'a' then 'NO ACTION'
          when 'r' then 'RESTRICT'
          when 'c' then 'CASCADE'
          when 'n' then 'SET NULL'
          when 'd' then 'SET DEFAULT'
        end as delete_rule
      from pg_constraint as con
      join pg_class as src
        on src.oid = con.conrelid
      join pg_namespace as src_ns
        on src_ns.oid = src.relnamespace
      join unnest(con.conkey) with ordinality as src_cols(attnum, ord)
        on true
      join unnest(con.confkey) with ordinality as ref_cols(attnum, ord)
        on ref_cols.ord = src_cols.ord
      join pg_attribute as src_att
        on src_att.attrelid = src.oid
       and src_att.attnum = src_cols.attnum
      join pg_class as ref
        on ref.oid = con.confrelid
      join pg_namespace as ref_ns
        on ref_ns.oid = ref.relnamespace
      join pg_attribute as ref_att
        on ref_att.attrelid = ref.oid
       and ref_att.attnum = ref_cols.attnum
      where src_ns.nspname = 'public'
        and con.contype = 'f'
      order by src.relname, src_cols.ord
    `);
  const indexesResult = await client.query(`
      select
        tablename as table_name,
        indexname as index_name
      from pg_indexes
      where schemaname = 'public'
      order by tablename, indexname
    `);
  const policyResult = await client.query(`
      select
        tablename as table_name,
        policyname as policy_name
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `);
  const triggerResult = await client.query(`
      select
        n.nspname as schema_name,
        c.relname as table_name,
        t.tgname as trigger_name
      from pg_trigger as t
      join pg_class as c
        on c.oid = t.tgrelid
      join pg_namespace as n
        on n.oid = c.relnamespace
      where not t.tgisinternal
        and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
      order by n.nspname, c.relname, t.tgname
    `);
  const functionResult = await client.query(`
      select
        p.proname as function_name
      from pg_proc as p
      join pg_namespace as n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by p.proname
    `);
  const enumResult = await client.query(`
      select
        t.typname as enum_name,
        e.enumlabel
      from pg_type as t
      join pg_enum as e
        on e.enumtypid = t.oid
      join pg_namespace as n
        on n.oid = t.typnamespace
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder
    `);
  const rlsResult = await client.query(`
      select
        c.relname as table_name,
        c.relrowsecurity as rls_enabled
      from pg_class as c
      join pg_namespace as n
        on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
      order by c.relname
    `);

  const uniqueConstraints = {};
  for (const row of uniqueResult.rows) {
    const constraintKey = `${row.table_name}.${row.constraint_name}`;
    uniqueConstraints[constraintKey] ??= {
      tableName: row.table_name,
      columns: [],
    };
    uniqueConstraints[constraintKey].columns.push(row.column_name);
  }

  const enums = {};
  for (const row of enumResult.rows) {
    enums[row.enum_name] ??= [];
    enums[row.enum_name].push(row.enumlabel);
  }

  return {
    tables: uniqueSorted(columnsResult.rows.map((row) => row.table_name)),
    columnsByTable: groupByTable(columnsResult.rows, "column_name"),
    uniqueConstraints: Object.values(uniqueConstraints),
    foreignKeys: foreignKeyResult.rows.map((row) => ({
      tableName: row.table_name,
      columnName: row.column_name,
      refSchema: row.foreign_table_schema,
      refTable: row.foreign_table_name,
      refColumn: row.foreign_column_name,
      deleteRule: row.delete_rule,
    })),
    indexes: indexesResult.rows.map((row) => ({
      tableName: row.table_name,
      indexName: row.index_name,
    })),
    policies: policyResult.rows.map((row) => ({
      tableName: row.table_name,
      policyName: row.policy_name,
    })),
    triggers: triggerResult.rows.map((row) => ({
      schemaName: row.schema_name,
      tableName: row.table_name,
      triggerName: row.trigger_name,
    })),
    functionNames: uniqueSorted(functionResult.rows.map((row) => row.function_name)),
    enums,
    rlsEnabledByTable: Object.fromEntries(
      rlsResult.rows.map((row) => [row.table_name, row.rls_enabled]),
    ),
  };
}

function compareSchema(expected, actual) {
  const failures = [];
  const warnings = [];

  const expectedTables = uniqueSorted(expected.tables);
  const missingTables = difference(expectedTables, actual.tables);
  const extraTables = difference(actual.tables, expectedTables);

  if (missingTables.length) {
    failures.push(`Missing public tables:\n${formatList(missingTables)}`);
  }

  if (extraTables.length) {
    failures.push(`Unexpected public tables:\n${formatList(extraTables)}`);
  }

  for (const tableName of expectedTables) {
    const expectedColumns = uniqueSorted(expected.columnsByTable[tableName] ?? []);
    const actualColumns = uniqueSorted(actual.columnsByTable[tableName] ?? []);
    const missingColumns = difference(expectedColumns, actualColumns);
    const extraColumns = difference(actualColumns, expectedColumns);

    if (missingColumns.length || extraColumns.length) {
      const details = [];

      if (missingColumns.length) {
        details.push(`missing:\n${formatList(missingColumns)}`);
      }

      if (extraColumns.length) {
        details.push(`extra:\n${formatList(extraColumns)}`);
      }

      failures.push(`Column mismatch in public.${tableName}:\n${details.join("\n")}`);
    }
  }

  const actualUniqueKeys = new Set(
    actual.uniqueConstraints.map(({ tableName, columns }) =>
      toKey([tableName, ...columns]),
    ),
  );

  for (const { tableName, columns } of expected.uniqueConstraints) {
    const uniqueKey = toKey([tableName, ...columns]);
    if (!actualUniqueKeys.has(uniqueKey)) {
      failures.push(
        `Missing unique constraint on public.${tableName} (${columns.join(", ")})`,
      );
    }
  }

  const actualForeignKeys = new Set(
    actual.foreignKeys.map((foreignKey) =>
      toKey([
        foreignKey.tableName,
        foreignKey.columnName,
        foreignKey.refSchema,
        foreignKey.refTable,
        foreignKey.refColumn,
        foreignKey.deleteRule,
      ]),
    ),
  );

  for (const foreignKey of expected.foreignKeys) {
    const foreignKeyKey = toKey([
      foreignKey.tableName,
      foreignKey.columnName,
      foreignKey.refSchema,
      foreignKey.refTable,
      foreignKey.refColumn,
      foreignKey.deleteRule,
    ]);

    if (!actualForeignKeys.has(foreignKeyKey)) {
      failures.push(
        `Missing foreign key ${foreignKey.tableName}.${foreignKey.columnName} -> ${foreignKey.refSchema}.${foreignKey.refTable}.${foreignKey.refColumn} (${foreignKey.deleteRule})`,
      );
    }
  }

  const actualIndexes = new Set(
    actual.indexes.map((index) => toKey([index.tableName, index.indexName])),
  );

  for (const index of expected.indexes) {
    const indexKey = toKey([index.tableName, index.indexName]);
    if (!actualIndexes.has(indexKey)) {
      failures.push(`Missing index ${index.indexName} on public.${index.tableName}`);
    }
  }

  const expectedPolicyKeys = new Set(
    expected.policies.map((policy) => toKey([policy.tableName, policy.policyName])),
  );
  const actualPolicyKeys = new Set(
    actual.policies.map((policy) => toKey([policy.tableName, policy.policyName])),
  );
  const missingPolicies = [...expectedPolicyKeys].filter(
    (policyKey) => !actualPolicyKeys.has(policyKey),
  );
  const extraPolicies = actual.policies
    .filter((policy) => expected.tables.includes(policy.tableName))
    .map((policy) => toKey([policy.tableName, policy.policyName]))
    .filter((policyKey) => !expectedPolicyKeys.has(policyKey));

  if (missingPolicies.length) {
    failures.push(`Missing RLS policies:\n${formatList(missingPolicies)}`);
  }

  if (extraPolicies.length) {
    failures.push(`Unexpected RLS policies:\n${formatList(uniqueSorted(extraPolicies))}`);
  }

  const actualTriggerKeys = new Set(
    actual.triggers.map((trigger) =>
      toKey([trigger.schemaName, trigger.tableName, trigger.triggerName]),
    ),
  );

  for (const trigger of expected.triggers) {
    const triggerKey = toKey([
      trigger.schemaName,
      trigger.tableName,
      trigger.triggerName,
    ]);

    if (!actualTriggerKeys.has(triggerKey)) {
      failures.push(
        `Missing trigger ${trigger.triggerName} on ${trigger.schemaName}.${trigger.tableName}`,
      );
    }
  }

  const actualFunctions = new Set(actual.functionNames);

  for (const functionName of expected.functionNames) {
    if (!actualFunctions.has(functionName)) {
      failures.push(`Missing function public.${functionName}()`);
    }
  }

  for (const expectedEnum of expected.enums) {
    const actualLabels = actual.enums[expectedEnum.name] ?? [];

    if (toKey(uniqueSorted(expectedEnum.labels)) !== toKey(uniqueSorted(actualLabels))) {
      failures.push(
        `Enum mismatch for public.${expectedEnum.name}: expected [${expectedEnum.labels.join(", ")}], got [${actualLabels.join(", ")}]`,
      );
    }
  }

  for (const tableName of expected.rlsTables) {
    if (actual.rlsEnabledByTable[tableName] !== true) {
      failures.push(`RLS is not enabled on public.${tableName}`);
    }
  }

  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    warnings.push("DIRECT_URL is not set. Verification used DATABASE_URL.");
  }

  return { failures, warnings };
}

async function main() {
  loadProjectEnv();

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required to verify schema parity.");
  }

  const client = new Client(buildConnectionConfig(connectionString));

  await client.connect();

  try {
    const expected = await extractExpectedSchemaSpec();
    const actual = await loadActualSchema(client);
    const report = compareSchema(expected, actual);

    if (report.failures.length) {
      console.error("Schema parity check failed.");
      console.error(report.failures.join("\n\n"));

      if (report.warnings.length) {
        console.error("\nWarnings:");
        console.error(report.warnings.join("\n"));
      }

      process.exitCode = 1;
      return;
    }

    console.log("Schema parity check passed.");

    if (report.warnings.length) {
      console.log("Warnings:");
      console.log(report.warnings.join("\n"));
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
