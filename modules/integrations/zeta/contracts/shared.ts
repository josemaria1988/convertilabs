export type ZetaPrimitive = string | number | boolean | null;

export type ZetaJsonRecord = {
  [key: string]: ZetaPrimitive | ZetaJsonRecord | ZetaJsonRecord[] | ZetaPrimitive[];
};

export type ZetaConnectionPayload = {
  DesarrolladorCodigo: string;
  DesarrolladorClave: string;
  EmpresaCodigo: string;
  EmpresaClave: string;
  UsuarioCodigo: number;
  UsuarioClave: string;
  RolCodigo: number;
};

export type ZetaErrorDetail = {
  Id?: string;
  Tipo?: string;
  Descripcion?: string;
  [key: string]: unknown;
};

export type ZetaErrorPayload = {
  Code?: string;
  Message?: string;
  Detail?: ZetaErrorDetail[];
  [key: string]: unknown;
};

export type ZetaWrappedOutput<TResponse = unknown> = {
  Succeed?: boolean | string;
  Response?: TResponse;
  IsLastPage?: boolean | string;
  Error?: ZetaErrorPayload | null;
  [key: string]: unknown;
};

export type ZetaQueryInput<TFilters extends ZetaJsonRecord = ZetaJsonRecord> = {
  Page: number;
  Filters: TFilters;
};

export type ZetaQueryResult<TRecord> = {
  rows: TRecord[];
  isLastPage: boolean;
  raw: ZetaWrappedOutput<TRecord[]>;
};
