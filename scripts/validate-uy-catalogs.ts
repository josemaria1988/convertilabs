import activityCatalog from "@/data/uy/ciiu-rev4-activity-catalog.json";
import organizationTraits from "@/data/uy/organization-traits.json";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const entry of activityCatalog) {
  assert(typeof entry.code === "string" && entry.code.trim().length >= 4, "Cada actividad debe tener code valido.");
  assert(typeof entry.title === "string" && entry.title.trim().length > 0, `La actividad ${entry.code} debe tener title.`);
  assert(Array.isArray(entry.aliases), `La actividad ${entry.code} debe tener aliases.`);
}

for (const trait of organizationTraits) {
  assert(typeof trait.code === "string" && trait.code.trim().length > 0, "Cada trait debe tener code valido.");
  assert(typeof trait.group === "string" && trait.group.trim().length > 0, `El trait ${trait.code} debe tener group.`);
  assert(typeof trait.label === "string" && trait.label.trim().length > 0, `El trait ${trait.code} debe tener label.`);
  assert(Array.isArray(trait.affects_presets), `El trait ${trait.code} debe tener affects_presets.`);
  assert(Array.isArray(trait.affects_tax_profiles), `El trait ${trait.code} debe tener affects_tax_profiles.`);
}

console.log(`Catalogos UY validados: ${activityCatalog.length} actividades, ${organizationTraits.length} traits.`);
