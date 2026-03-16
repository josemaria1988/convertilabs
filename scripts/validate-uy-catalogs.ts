import activityCatalog from "@/data/uy/ciiu-rev4-activity-catalog.json";
import activityAliases from "@/data/uy/ciiu-rev4-activity-search-aliases.json";
import organizationTraits from "@/data/uy/organization-traits.json";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const entry of activityCatalog) {
  assert(typeof entry.code === "string" && entry.code.trim().length >= 1, "Cada actividad debe tener code valido.");
  assert(typeof entry.display_code === "string" && entry.display_code.trim().length >= 1, `La actividad ${entry.code} debe tener display_code.`);
  assert(typeof entry.description === "string" && entry.description.trim().length > 0, `La actividad ${entry.code} debe tener description.`);
  assert(typeof entry.level === "string" && entry.level.trim().length > 0, `La actividad ${entry.code} debe tener level.`);
  assert(typeof entry.is_leaf === "boolean", `La actividad ${entry.code} debe tener is_leaf.`);
  assert(typeof entry.source_version === "string" && entry.source_version.trim().length > 0, `La actividad ${entry.code} debe tener source_version.`);
}

for (const aliasEntry of activityAliases) {
  assert(typeof aliasEntry.code === "string" && aliasEntry.code.trim().length > 0, "Cada alias de actividad debe tener code valido.");
  assert(Array.isArray(aliasEntry.aliases), `La actividad ${aliasEntry.code} debe tener aliases.`);
}

for (const trait of organizationTraits) {
  assert(typeof trait.code === "string" && trait.code.trim().length > 0, "Cada trait debe tener code valido.");
  assert(typeof trait.group === "string" && trait.group.trim().length > 0, `El trait ${trait.code} debe tener group.`);
  assert(typeof trait.label === "string" && trait.label.trim().length > 0, `El trait ${trait.code} debe tener label.`);
  assert(Array.isArray(trait.affects_presets), `El trait ${trait.code} debe tener affects_presets.`);
  assert(Array.isArray(trait.affects_tax_profiles), `El trait ${trait.code} debe tener affects_tax_profiles.`);
}

console.log(`Catalogos UY validados: ${activityCatalog.length} actividades, ${activityAliases.length} overlays de alias y ${organizationTraits.length} traits.`);
