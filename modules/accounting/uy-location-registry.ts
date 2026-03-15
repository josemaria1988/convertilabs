type UyLocationRow = {
  department: string;
  city: string;
  postalCode: string | null;
  lat: number;
  long: number;
  source: "seed_v1";
  sourceVersion: string;
  aliases?: string[];
};

const SOURCE_VERSION = "2026-03-step5-location-v1";

const seedLocations: UyLocationRow[] = [
  { department: "montevideo", city: "montevideo", postalCode: "11000", lat: -34.9011, long: -56.1645, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["centro", "ciudad vieja", "union"] },
  { department: "canelones", city: "canelones", postalCode: "90000", lat: -34.5228, long: -56.2778, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "canelones", city: "las piedras", postalCode: "90200", lat: -34.7302, long: -56.2192, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "canelones", city: "ciudad de la costa", postalCode: "15000", lat: -34.8167, long: -55.95, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["solymar", "lagomar", "el pinar", "shangrila"] },
  { department: "maldonado", city: "maldonado", postalCode: "20000", lat: -34.9, long: -54.95, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "maldonado", city: "punta del este", postalCode: "20100", lat: -34.9627, long: -54.9451, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "colonia", city: "colonia del sacramento", postalCode: "70000", lat: -34.4711, long: -57.8442, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["colonia"] },
  { department: "salto", city: "salto", postalCode: "50000", lat: -31.3833, long: -57.9667, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "paysandu", city: "paysandu", postalCode: "60000", lat: -32.3214, long: -58.0756, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "rivera", city: "rivera", postalCode: "40000", lat: -30.9053, long: -55.5508, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "rocha", city: "rocha", postalCode: "27000", lat: -34.4833, long: -54.3333, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "lavalleja", city: "minas", postalCode: "30000", lat: -34.3759, long: -55.2377, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["lavalleja"] },
  { department: "soriano", city: "mercedes", postalCode: "75000", lat: -33.2524, long: -58.0305, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["soriano"] },
  { department: "san jose", city: "san jose de mayo", postalCode: "80000", lat: -34.3375, long: -56.7136, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["san jose"] },
  { department: "florida", city: "florida", postalCode: "94000", lat: -34.0956, long: -56.2142, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "flores", city: "trinidad", postalCode: "85000", lat: -33.5165, long: -56.8996, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["flores"] },
  { department: "tacuarembo", city: "tacuarembo", postalCode: "45000", lat: -31.7169, long: -55.9811, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "durazno", city: "durazno", postalCode: "97000", lat: -33.3806, long: -56.5236, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "treinta y tres", city: "treinta y tres", postalCode: "33000", lat: -33.2333, long: -54.3833, source: "seed_v1", sourceVersion: SOURCE_VERSION },
  { department: "rio negro", city: "fray bentos", postalCode: "65000", lat: -33.1165, long: -58.3107, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["rio negro"] },
  { department: "cerro largo", city: "melo", postalCode: "37000", lat: -32.3703, long: -54.1675, source: "seed_v1", sourceVersion: SOURCE_VERSION, aliases: ["cerro largo"] },
  { department: "artigas", city: "artigas", postalCode: "55000", lat: -30.4, long: -56.4667, source: "seed_v1", sourceVersion: SOURCE_VERSION },
];

function normalizeToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bdepto\b/g, "departamento")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

const departmentAliases = new Map<string, string>([
  ["artigas", "artigas"],
  ["canelones", "canelones"],
  ["cerro largo", "cerro largo"],
  ["colonia", "colonia"],
  ["colonia del sacramento", "colonia"],
  ["durazno", "durazno"],
  ["flores", "flores"],
  ["florida", "florida"],
  ["lavalleja", "lavalleja"],
  ["maldonado", "maldonado"],
  ["montevideo", "montevideo"],
  ["paysandu", "paysandu"],
  ["rio negro", "rio negro"],
  ["rocha", "rocha"],
  ["rivera", "rivera"],
  ["salto", "salto"],
  ["san jose", "san jose"],
  ["san jose de mayo", "san jose"],
  ["soriano", "soriano"],
  ["tacuarembo", "tacuarembo"],
  ["treinta y tres", "treinta y tres"],
]);

export function getUyLocationSeed() {
  return [...seedLocations];
}

export function normalizeUyDepartment(value: string | null | undefined) {
  const normalized = normalizeToken(value);

  if (!normalized) {
    return null;
  }

  if (departmentAliases.has(normalized)) {
    return departmentAliases.get(normalized) ?? null;
  }

  for (const row of seedLocations) {
    if (row.department === normalized) {
      return row.department;
    }
  }

  return null;
}

export function findUyLocationByCity(input: {
  city: string | null | undefined;
  department?: string | null | undefined;
}) {
  const normalizedCity = normalizeToken(input.city);
  const normalizedDepartment = normalizeUyDepartment(input.department);

  if (!normalizedCity) {
    return null;
  }

  const exact = seedLocations.find((row) =>
    row.city === normalizedCity
    && (!normalizedDepartment || row.department === normalizedDepartment));

  if (exact) {
    return exact;
  }

  return seedLocations.find((row) =>
    (row.city === normalizedCity || (row.aliases ?? []).includes(normalizedCity))
    && (!normalizedDepartment || row.department === normalizedDepartment)) ?? null;
}

export function inferUyDepartmentFromText(value: string | null | undefined) {
  const normalized = normalizeToken(value);

  if (!normalized) {
    return null;
  }

  for (const [alias, department] of departmentAliases.entries()) {
    if (normalized.includes(alias)) {
      return department;
    }
  }

  return null;
}

export function inferUyCityFromText(input: {
  text: string | null | undefined;
  department?: string | null | undefined;
}) {
  const normalized = normalizeToken(input.text);
  const normalizedDepartment = normalizeUyDepartment(input.department);

  if (!normalized) {
    return null;
  }

  return seedLocations.find((row) =>
    (normalized.includes(row.city) || (row.aliases ?? []).some((alias) => normalized.includes(alias)))
    && (!normalizedDepartment || row.department === normalizedDepartment)) ?? null;
}
