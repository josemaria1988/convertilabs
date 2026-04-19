import type { ZetaJsonRecord } from "@/modules/integrations/zeta/contracts/shared";

export type ZetaEndpointKind = "query" | "load" | "save" | "delete";

export type ZetaEndpointDefinition = {
  endpointName: string;
  httpMethod: "POST";
  inputWrapper: string;
  outputWrapper: string;
  kind: ZetaEndpointKind;
  stream: string;
  description: string;
  requestShape: ZetaJsonRecord;
  responseShape: ZetaJsonRecord;
};

export const zetaEndpointRegistry = {
  userRolesQuery: {
    endpointName: "RESTUsuariosEmpresaV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.health.user_roles",
    description: "Read-only health probe against user role visibility.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: 0,
          CodigoHasta: 0,
          NombreContiene: "",
          UsuarioNombreContiene: "",
          UsuarioEmail: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: 0,
          Nombre: "",
          Tipo: "",
          Activo: "",
          Caducidad: "",
          HorarioDesde: "",
          HorarioHasta: "",
          Permiso: "",
          UsuarioNombre: "",
          UsuarioEmail: "",
        },
      ],
      IsLastPage: true,
    },
  },
  contactsQuery: {
    endpointName: "RESTContactosV3Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.contacts",
    description: "Contact master data for party/vendor/customer candidate mapping.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          Search: "",
          CodigoDesde: "",
          CodigoHasta: "",
          RUTContiene: "",
          DocumentoContiene: "",
          EsCliente: "",
          EsProveedor: "",
          ContactoActivo: "",
          PaisCodigo: "",
          ZonaCodigo: "",
          GiroCodigo: "",
          GrupoCodigo: "",
          OrigenCodigo: "",
          PropietarioCodigo: 0,
          FechaRegistroDesde: "",
          FechaRegistroHasta: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: "",
          Nombre: "",
          RazonSocial: "",
          DocumentoTipo: "",
          RUT: "",
          DocumentoSigla: "",
          Documento: "",
          EsCliente: "",
          EsProveedor: "",
          ContactoActivo: "",
          PaisCodigo: "",
          PaisNombre: "",
          DepartamentoCodigo: "",
          DepartamentoNombre: "",
          Localidad: "",
          Direccion: "",
          DireccionCompleta: "",
          CodigoPostal: "",
          Email1: "",
          Email2: "",
          FechaRegistro: "",
        },
      ],
      IsLastPage: true,
    },
  },
  contactLoad: {
    endpointName: "RESTContactosV3Load",
    httpMethod: "POST",
    inputWrapper: "LoadIn",
    outputWrapper: "LoadOut",
    kind: "load",
    stream: "zeta.masters.contacts",
    description: "Single contact load by Codigo.",
    requestShape: {
      Codigo: "",
    },
    responseShape: {
      Response: {
        Codigo: "",
        Nombre: "",
        RazonSocial: "",
        RUT: "",
        Documento: "",
      },
    },
  },
  costCentersQuery: {
    endpointName: "RESTCentrosCostoV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.cost_centers",
    description: "Cost center/project master data used by Rontil operation mapping.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: "",
          CodigoHasta: "",
          NombreContiene: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: "",
          Nombre: "",
        },
      ],
      IsLastPage: true,
    },
  },
  taxRatesQuery: {
    endpointName: "RESTTasasIVAV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.vat_rates",
    description: "VAT rates and accounting/literal references.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: 0,
          CodigoHasta: 0,
          NombreContiene: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: 0,
          Nombre: "",
          Tasa: 0,
          Tipo: "",
          Abreviacion: "",
          CodigoContableCompras: "",
          LiteralTributarioCompras: 0,
          CodigoContableVentas: "",
          LiteralTributarioVentas: 0,
        },
      ],
      IsLastPage: true,
    },
  },
  currencyRatesQuery: {
    endpointName: "RESTMonedasCotizacionesV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.currency_rates",
    description: "Zeta currency rates used as source FX evidence.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          MonedaCodigo: 0,
          FechaDesde: "",
          FechaHasta: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          MonedaCodigo: 0,
          Fecha: "",
          Dia: "",
          CotizacionComercial: 0,
          CotizacionFiscal: 0,
        },
      ],
      IsLastPage: true,
    },
  },
  journalTypesQuery: {
    endpointName: "RESTTiposAsientosV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.journal_types",
    description: "Journal type catalog for future Bandeja mapper validation.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: "",
          CodigoHasta: "",
          NombreContiene: "",
          AuxiliarCodigo: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: "",
          Nombre: "",
          Concepto: "",
          AuxiliarCodigo: "",
          AuxiliarNombre: "",
          ColumnaIVA: "",
          DGI2181: "",
          ImportesNegativoAuxiliares: "",
          ResumirDiarios: "",
        },
      ],
      IsLastPage: true,
    },
  },
  documentTypesQuery: {
    endpointName: "RESTTipoCFEV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.document_types",
    description: "CFE type catalog.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: 0,
          CodigoHasta: 0,
          NombreContiene: "",
          Etapa: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: 0,
          Nombre: "",
          Etapa: "",
        },
      ],
      IsLastPage: true,
    },
  },
  salesDocumentTypesQuery: {
    endpointName: "RESTComprobantesV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.masters.sales_document_types",
    description: "Sales document/comprobante type catalog.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          CodigoDesde: 0,
          CodigoHasta: 0,
          NombreContiene: "",
          Tipo: 0,
          LocalCodigo: 0,
          Activo: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          Codigo: 0,
          Nombre: "",
          Abreviacion: "",
          Tipo: 0,
          TipoNombre: "",
          LocalCodigo: 0,
          CFE: "",
          IVA: "",
          Activo: "",
          Notas: "",
        },
      ],
      IsLastPage: true,
    },
  },
  customerDocumentsQuery: {
    endpointName: "RESTComprobantesClienteV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.documents.sales",
    description: "Customer sales documents with line and payment facts.",
    requestShape: {
      Data: {
        ClienteCodigo: "",
        Mes: 0,
        Anio: 0,
        FechaDesde: "",
        FechaHasta: "",
      },
    },
    responseShape: {
      Response: {
        ListaMovimientos: [
          {
            ComprobanteCodigo: 0,
            Serie: "",
            Numero: 0,
            Fecha: "",
            MonedaCodigo: 0,
            Cotizacion: 0,
            ClienteCodigo: "",
            CentroCostoCodigo: "",
            ReferenciaCodigo: "",
            TotalRecibo: 0,
            ClienteNombre: "",
            ClienteDocumento: "",
            CFETipo: 0,
            CFEEstado: 0,
            Lineas: [
              {
                ArticuloCodigo: "",
                Concepto: "",
                Cantidad: 0,
                PrecioUnitario: 0,
                Neto: 0,
                IVA: 0,
                Total: 0,
              },
            ],
          },
        ],
      },
    },
  },
  receivedCfesQuery: {
    endpointName: "RESTCFEsRecibidosV1CFEsRecibidos",
    httpMethod: "POST",
    inputWrapper: "CFEsRecibidosIn",
    outputWrapper: "CFEsRecibidosOut",
    kind: "query",
    stream: "zeta.documents.received_cfes",
    description: "Received CFE summary list for purchase-side ingestion.",
    requestShape: {
      Data: {
        LocalCodigo: 0,
        FechaDesde: "",
        FechaHasta: "",
        TipoCFECodigo: 0,
        Pagina: 1,
      },
    },
    responseShape: {
      Response: {
        ListaCFEs: [
          {
            RUT: "",
            DenominacionSocial: "",
            EmisorCFETipo: "",
            Serie: "",
            Numero: 0,
            EstadoLocal: "",
            EstadoDGI: "",
            EstadoReceptor: "",
            FechaEmision: "",
            FechaVencimiento: "",
            Moneda: "",
            TipoCambio: 0,
            MontoAPagar: 0,
          },
        ],
        Succeed: true,
        Mensaje: "",
      },
    },
  },
  receivedCfeDetail: {
    endpointName: "RESTCFEsRecibidosV1CFERecibidoDetalle",
    httpMethod: "POST",
    inputWrapper: "CFERecibidoDetalleIn",
    outputWrapper: "CFERecibidoDetalleOut",
    kind: "load",
    stream: "zeta.documents.received_cfes",
    description: "Received CFE detail by issuer RUT, type, series and number.",
    requestShape: {
      Data: {
        EmisorRUT: "",
        CFETipo: "",
        CFESerie: "",
        CFENumero: 0,
      },
    },
    responseShape: {
      Response: {
        CFEDetalle: {
          Emisor: {
            RUT: "",
            SucursalId: 0,
          },
          Documento: {
            FechaEmision: "",
            FormaPago: "",
            FechaVencimiento: "",
            CFESerie: "",
            CFENumero: 0,
          },
          Receptor: {
            DenominacionSocial: "",
            Documento: "",
          },
          Totales: {
            Moneda: "",
            TipoCambio: 0,
            MontoNoGravado: 0,
            MontoExportado: 0,
            MontoNetoConIVATasaMinima: 0,
            MontoNetoConIVATasaBasica: 0,
            MontoIVAMinimo: 0,
            MontoIVABasico: 0,
            MontoTotal: 0,
            MontoAPagar: 0,
          },
          Detalle: [
            {
              NumeroDeLinea: 0,
              ItemCodigo: "",
              Nombre: "",
              Cantidad: 0,
              UnidadMedida: "",
              PrecioUnitario: 0,
              MontoTotal: 0,
            },
          ],
        },
      },
    },
  },
  bandejaJournalEntriesQuery: {
    endpointName: "RESTBandejaEntradaAsientosV1Query",
    httpMethod: "POST",
    inputWrapper: "QueryIn",
    outputWrapper: "QueryOut",
    kind: "query",
    stream: "zeta.outbound.bandeja_journal_entries",
    description: "Bandeja de Entrada de Asientos query for outbound reconciliation.",
    requestShape: {
      Data: {
        Page: 1,
        Filters: {
          AsientoIdDesde: 0,
          AsientoIdHasta: 0,
          FechaDesde: "",
          FechaHasta: "",
          TipoAsiento: "",
          Origen: "",
          Validado: "",
        },
      },
    },
    responseShape: {
      Response: [
        {
          RegistroId: 0,
          AsientoId: 0,
          Fecha: "",
          TipoAsiento: "",
          Concepto: "",
          Moneda: 0,
          TipoCambio: 0,
          RUT: "",
          Contacto: "",
          Cuenta: "",
          Importe: 0,
          DebeHaber: "",
          CentroCostos: "",
          Referencia: "",
          Local: 0,
          LiteralTributario: 0,
          Origen: "",
          Validado: "",
          Error: "",
        },
      ],
      IsLastPage: true,
    },
  },
  bandejaJournalEntrySave: {
    endpointName: "RESTBandejaEntradaAsientosV1Save",
    httpMethod: "POST",
    inputWrapper: "SaveIn",
    outputWrapper: "SaveOut",
    kind: "save",
    stream: "zeta.outbound.bandeja_journal_entries",
    description: "Bandeja de Entrada de Asientos save endpoint. Real writes stay disabled until PR-15.",
    requestShape: {
      Data: {
        RegistroId: 0,
        AsientoId: 0,
        Fecha: "",
        TipoAsiento: "",
        Concepto: "",
        Moneda: 0,
        TipoCambio: 0,
        RUT: "",
        Contacto: "",
        Cuenta: "",
        Importe: 0,
        DebeHaber: "",
        CentroCostos: "",
        Referencia: "",
        Local: 0,
        LiteralTributario: 0,
      },
    },
    responseShape: {
      Error: {
        Code: "",
        Message: "",
        Detail: [
          {
            Id: "",
            Tipo: "",
            Descripcion: "",
          },
        ],
      },
    },
  },
} as const satisfies Record<string, ZetaEndpointDefinition>;

export type ZetaEndpointKey = keyof typeof zetaEndpointRegistry;

export function listZetaEndpoints() {
  return Object.entries(zetaEndpointRegistry).map(([key, endpoint]) => ({
    key: key as ZetaEndpointKey,
    ...endpoint,
  }));
}

export function getZetaEndpoint(keyOrEndpointName: ZetaEndpointKey | string) {
  if (Object.prototype.hasOwnProperty.call(zetaEndpointRegistry, keyOrEndpointName)) {
    return zetaEndpointRegistry[keyOrEndpointName as ZetaEndpointKey];
  }

  const endpoint = listZetaEndpoints().find(
    (entry) => entry.endpointName === keyOrEndpointName,
  );

  if (!endpoint) {
    throw new Error(`Unknown Zetasoftware endpoint: ${keyOrEndpointName}`);
  }

  return endpoint;
}

export function buildZetaEndpointUrl(baseUrl: string, keyOrEndpointName: ZetaEndpointKey | string) {
  const endpoint = getZetaEndpoint(keyOrEndpointName);
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  if (!normalizedBaseUrl) {
    throw new Error("Missing Zetasoftware base URL.");
  }

  return `${normalizedBaseUrl}/APIs/${endpoint.endpointName}`;
}
