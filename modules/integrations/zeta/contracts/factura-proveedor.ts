import type {
  ZetaConnectionPayload,
  ZetaErrorPayload,
  ZetaWrappedOutput,
} from "@/modules/integrations/zeta/contracts/shared";

export interface ZetaFacturaProveedorAgregarIn {
  AgregarIn: {
    Connection: ZetaConnectionPayload;
    Data: {
      Movimiento: ZetaFacturaProveedorMovimiento[];
    };
  };
}

export interface ZetaFacturaProveedorMovimiento {
  CodigoComprobante: number;
  Serie?: string;
  Numero?: number;
  Fecha: string;
  CodigoMoneda: number;
  Cotizacion?: number;
  CodigoProveedor: string;
  CodigoCondicionPago?: string | number;
  CodigoDepositoOrigen?: number;
  CodigoDepositoDestino?: number;
  CodigoCentroCosto?: string;
  CodigoReferencia?: string | number;
  Notas?: string;
  CodigoLocal?: number;
  CodigoUsuario?: number;
  CodigoCaja?: number;
  Lineas: ZetaFacturaProveedorLinea[];
  FormasPago?: ZetaFacturaProveedorFormaPago[];
}

export interface ZetaFacturaProveedorLinea {
  // En comprobantes de gastos, Zeta usa el campo CodigoArticulo
  // para recibir el codigo del Concepto Zeta, no un articulo de stock.
  CodigoArticulo: string;
  Concepto?: string;
  CodigoLote?: string;
  Vencimiento?: string;
  Cantidad: number;
  PrecioUnitario: number;
  Descuento1?: number;
  Descuento2?: number;
  Descuento3?: number;
  CodigoIVA: number;
  Notas?: string;
}

export interface ZetaFacturaProveedorFormaPago {
  CodigoFormaPago: number;
  CodigoMonedaPago: number;
  MontoMonedaPago: number;
  MontoMonedaMovimiento: number;
}

export interface ZetaFacturaProveedorAgregarResponse {
  Succeed?: boolean | string;
  Mensaje?: string;
  RegistroId?: number | string;
  FacturaId?: number | string;
}

export type ZetaFacturaProveedorAgregarOut =
  ZetaWrappedOutput<ZetaFacturaProveedorAgregarResponse>;

export interface ZetaFacturaProveedorCompraQueryRow {
  RegistroId?: number | string;
  Fecha?: string;
  ComprobanteCodigo?: number | string;
  ComprobanteNombre?: string;
  ComprobanteTipo?: number | string;
  ComprobanteTipoNombre?: string;
  EsGasto?: string;
  Serie?: string;
  Numero?: number | string;
  ProveedorCodigo?: string;
  ProveedorNombre?: string;
  ProveedorRazonSocial?: string;
  MonedaCodigo?: number | string;
  MonedaSimbolo?: string;
  CotizacionEspecial?: number | string;
  CondicionCodigo?: string | number;
  LocalCodigo?: number | string;
  CajaCodigo?: number | string;
  Subtotal?: number | string;
  SubtotalSigno?: number | string;
  IVA?: number | string;
  IVASigno?: number | string;
  Total?: number | string;
  TotalSigno?: number | string;
  Saldo?: number | string;
  SaldoSigno?: number | string;
  UsuarioCodigo?: number | string;
  Error?: ZetaErrorPayload | null;
}
