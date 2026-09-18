function cfe(options = {}) {
  const { number = "200", rut = "213554700012", issuer = "220918880014", total = "690.00", net = "565.57", tax = "124.43", bruto = true, prefix = "", nonBillable = "0.00", payable = total } = options;
  const xml = `<CFE xmlns="http://cfe.dgi.gub.uy" version="1.0"><eFact><Encabezado><IdDoc><TipoCFE>111</TipoCFE><Serie>A</Serie><Nro>${number}</Nro><FchEmis>2026-09-11</FchEmis>${bruto ? "<MntBruto>1</MntBruto>" : ""}<FmaPago>1</FmaPago></IdDoc><Emisor><RUCEmisor>${issuer}</RUCEmisor><RznSoc>Empresa de prueba</RznSoc></Emisor><Receptor><TipoDocRecep>2</TipoDocRecep><CodPaisRecep>UY</CodPaisRecep><DocRecep>${rut}</DocRecep><RznSocRecep>Empresa receptora</RznSocRecep></Receptor><Totales><TpoMoneda>UYU</TpoMoneda><MntNetoIVATasaBasica>${net}</MntNetoIVATasaBasica><IVATasaBasica>22</IVATasaBasica><MntIVATasaBasica>${tax}</MntIVATasaBasica><MntTotal>${total}</MntTotal><CantLinDet>1</CantLinDet><MontoNF>${nonBillable}</MontoNF><MntPagar>${payable}</MntPagar></Totales></Encabezado><Detalle><Item><NroLinDet>1</NroLinDet><CodItem><TpoCod>INT1</TpoCod><Cod>000100</Cod></CodItem><IndFact>3</IndFact><NomItem>Almuerzo &amp; bebida</NomItem><Cantidad>2</Cantidad><PrecioUnitario>${bruto ? "345.00" : "282.785"}</PrecioUnitario><MontoItem>${bruto ? total : net}</MontoItem></Item></Detalle></eFact></CFE>`;
  return prefix ? xml.replace(/xmlns=/, `xmlns:${prefix}=`).replace(/<(\/?)([A-Z_a-z][\w]*)/g, `<$1${prefix}:$2`) : xml;
}
function envelope(entries, extra = "") {
  return `<EnvioCFE_entreEmpresas xmlns="http://cfe.dgi.gub.uy"><Caratula><RutReceptor>213554700012</RutReceptor><RUCEmisor>220918880014</RUCEmisor><CantCFE>${entries.length}</CantCFE></Caratula>${entries.map((entry) => `<CFE_Adenda>${entry}<Adenda>${extra}</Adenda></CFE_Adenda>`).join("")}</EnvioCFE_entreEmpresas>`;
}
function secretCfe(options = {}) {
  return cfe(options).replace(/<Receptor>.*?<\/Receptor>/, "").replace("</IdDoc>", "<SecProf>1</SecProf></IdDoc>");
}
function secretAdenda(options = {}) {
  const { number = "200", series = "A", type = "111", rut = "213554700012", name = "Empresa receptora", documentType = "2", bankWrapper = false } = options;
  const block = `<?xml version="1.0" encoding="utf-16"?><SecretoProfesional><TipoCFE>${type}</TipoCFE><Serie>${series}</Serie><Nro>${number}</Nro><Receptor><TipoDocRecep>${documentType}</TipoDocRecep><CodPaisRecep>UY</CodPaisRecep><DocRecep>${rut}</DocRecep><RznSocRecep>${name}</RznSocRecep></Receptor><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><Reference URI="https://invalid.example/signature"/></SignedInfo></Signature></SecretoProfesional>`;
  return `<![CDATA[${bankWrapper ? `<AdendaBancos>${block}<LeyendasObligatorias/><LeyendasMisc/></AdendaBancos>` : `Texto bancario que no prueba identidad.\n${block}`}]]>`;
}
module.exports = { cfe, envelope, secretCfe, secretAdenda };
