export type ZetaYesNo = "S" | "N";

export interface ZetaChartAccountRaw {
  Codigo: string;
  Nombre: string;
  CodigoNombre: string;
  EsImputable: ZetaYesNo;
  CodigoPresentacion: string;
  Capitulo: string;
  CuentaPadre: string;
  Nivel: number;
  GrupoCodigo: string;
  GrupoNombre: string;
  CalculaDifCambio: ZetaYesNo;
  MonedaCodigo: number;
  MonedaSimbolo: string;
  MonedaNombre: string;
  MonedaAbreviacion: string;
  LiteralTributario: number;
  UsaCentroCostos: ZetaYesNo;
  Notas: string;
}

export interface ZetaConceptoRaw {
  Codigo: string;
  Nombre: string;
  Tipo: string;
  ConceptoActivo: ZetaYesNo;
  CodigoIVA: number;
  AbreviacionIVA: string;
  NombreIVA: string;
  TasaIVA: number;
  CodigoContable: string;
  CodigoGrupo: string;
  NombreGrupo: string;
  TotalizarReportes: ZetaYesNo;
}

export interface ZetaJournalTypeRaw {
  Codigo: string;
  Nombre: string;
  Concepto: string;
  AuxiliarCodigo: string;
  AuxiliarNombre: string;
  ColumnaIVA: string;
  DGI2181: ZetaYesNo;
  ImportesNegativoAuxiliares: ZetaYesNo;
  ResumirDiarios: ZetaYesNo;
}

export interface ZetaChartAccountCandidate {
  external_code: string;
  name: string;
  display_code_name: string;
  is_imputable: boolean;
  external_parent_code: string | null;
  account_level: number;
  literal_tributario: number | null;
  uses_cost_centers: boolean;
  provider_meta: {
    capitulo: string;
    grupo_codigo: string;
    grupo_nombre: string;
    codigo_presentacion: string;
    moneda_codigo: number | null;
    moneda_simbolo: string;
    moneda_nombre: string;
    moneda_abreviacion: string;
    calcula_dif_cambio: boolean;
    notas: string;
  };
}
