Parámetros Generales de Contabilidad
Los Parámetros Generales definen las reglas fundamentales del módulo contable. Esta configuración establece qué funcionalidades estarán disponibles, cómo se organizan los capítulos del Plan de Cuentas, y qué controles aplicará el sistema sobre los asientos.

Es la primera pantalla que debés configurar antes de comenzar a trabajar con la contabilidad, ya que las decisiones tomadas aquí afectan todo el funcionamiento posterior.

Capítulos del Plan de Cuentas
Definí los códigos que identifican cada capítulo principal de tu Plan de Cuentas. La configuración estándar es:

Código	Capítulo	Naturaleza
1	Activo	Saldo deudor
2	Pasivo	Saldo acreedor
3	Capital / Patrimonio	Saldo acreedor
4	Ganancias / Ingresos	Saldo acreedor
5	Pérdidas / Gastos	Saldo deudor
6	Cuentas de Orden Activo	Contingentes
7	Cuentas de Orden Pasivo	Contingentes
Podés personalizar estos códigos según las necesidades de la empresa, pero una vez que comenzás a registrar asientos, modificarlos puede generar inconsistencias.

Cuentas de Orden
Las Cuentas de Orden (capítulos 6 y 7) registran valores que la empresa controla pero que no forman parte de su patrimonio: bienes en custodia, garantías otorgadas o recibidas, contratos pendientes. Se utilizan para fines informativos y de control interno.

Trabar Modificaciones
Este parámetro establece una fecha límite antes de la cual no se pueden modificar ni eliminar asientos. Es un control de integridad fundamental:

Los asientos con fecha anterior a la fecha de bloqueo quedan protegidos
Podés agregar asientos nuevos con fecha posterior
Si necesitás corregir un período ya bloqueado, debés actualizar primero esta fecha
Uso típico: a medida que cerrás meses o trimestres, movés esta fecha para proteger los períodos ya conciliados y auditados.

Empresa Cotizaciones
Permite centralizar el ingreso de cotizaciones de monedas extranjeras en una sola empresa. Esto es especialmente útil para estudios contables que administran múltiples empresas:

Ingresás las cotizaciones una sola vez en la empresa designada
Todas las demás empresas toman las cotizaciones de ahí
Evita duplicar trabajo y garantiza consistencia entre empresas
Si dejás este campo vacío, cada empresa maneja sus propias cotizaciones.

Opciones de informes
Incluir Nº de página en informes
Agrega numeración de páginas al pie de cada informe. Recomendado para informes formales y presentaciones a terceros.

Incluir fecha en informes
Agrega la fecha de emisión al pie de cada informe. Útil para identificar cuándo se generó el reporte.

Funcionalidades opcionales
Usa Literal Tributario y genera DGI 2/181
Activa el campo “Literal Tributario” en las cuentas del Plan de Cuentas y habilita la generación del Anexo 2/181 para la DGI.

Si tu empresa debe presentar este anexo fiscal, activá esta opción antes de configurar el Plan de Cuentas para poder asignar los literales correspondientes a cada cuenta.

Trabaja con Monedas Extranjeras
Habilita el manejo multimoneda en la contabilidad:

Permite definir cuentas en diferentes monedas
Habilita el ingreso de cotizaciones
Activa el cálculo automático de diferencias de cambio
Permite generar informes en moneda local y extranjera
Si la empresa opera exclusivamente en moneda local, podés dejar esta opción desactivada para simplificar la operativa.

Trabaja con Centros de Costo y Referencias
Habilita dos dimensiones adicionales de análisis en los asientos:

Centros de Costo: permiten asignar cada movimiento a un área, proyecto, sucursal o cualquier segmento de análisis definido por la empresa
Referencias: campo libre para vincular el asiento con documentación externa (número de factura, orden de compra, etc.)
Si activás esta opción, en el Plan de Cuentas podrás indicar para cada cuenta si el Centro de Costos es opcional, obligatorio o no aplica.

Impacto de cada parámetro
Parámetro	Si está activado	Si está desactivado
Literal Tributario / DGI 2/181	Campo visible en Plan de Cuentas, genera Anexo 2/181	Campo oculto, anexo no disponible
Monedas Extranjeras	Cuentas multimoneda, cotizaciones, diferencias de cambio	Solo moneda local, sin cotizaciones
Centros de Costo	Campo en asientos, filtros en informes, análisis por centro	Sin segmentación por centros
Orden de configuración recomendado
Los Parámetros Generales deben configurarse primero, antes que cualquier otra configuración contable:

Parámetros Generales (esta pantalla) – definí capítulos y funcionalidades
Grupos de Cuentas – si vas a usarlos
Plan de Cuentas – estructura completa
Auxiliares – categorías de asientos
Tipos de Asientos – clasificación operativa
Ejercicios Contables – períodos de trabajo
Números de RUT – terceros y definiciones de asientos
Buenas prácticas
Definí todo antes de comenzar a operar: cambiar parámetros después de registrar asientos puede generar inconsistencias
Activá solo lo que necesitás: funcionalidades desactivadas simplifican la operativa diaria
Actualizá “Trabar Modificaciones” regularmente: protegé períodos cerrados a medida que avanzás
Documentá tus decisiones: si elegís una configuración no estándar, dejá registro del motivo
Consultá con tu contador: algunas decisiones (literales tributarios, estructura de capítulos) tienen implicancias fiscales
Errores comunes
Activar Literal Tributario después de crear el Plan: debés volver a editar cada cuenta para asignar el literal
No activar Monedas Extranjeras cuando se necesita: luego no podés crear cuentas en otras monedas sin reconfigurar
Olvidar actualizar “Trabar Modificaciones”: permite modificaciones accidentales en períodos ya cerrados
Cambiar códigos de capítulo con asientos cargados: puede corromper la estructura del Plan de Cuentas



Números de RUT
Los Números de RUT permiten identificar a los terceros (clientes, proveedores, otros) en los asientos contables. Aunque es posible ingresar un RUT directamente en cada asiento sin tenerlo predefinido, mantener una tabla de RUTs ofrece ventajas significativas: autocompletado, consistencia en la razón social, y especialmente la posibilidad de automatizar la generación de asientos desde CFEs recibidos.

¿Para qué sirven?
Los Números de RUT cumplen dos funciones principales:

Generación del Anexo 2/181: el informe fiscal que la DGI requiere incluye el RUT de cada operación. Tener los RUTs configurados garantiza datos consistentes.
Generación automática de asientos desde CFEs: cuando recibís Comprobantes Fiscales Electrónicos (facturas de proveedores), el sistema puede crear automáticamente el asiento contable si el RUT del emisor tiene configuradas las cuentas correspondientes.
Datos básicos
Número de RUT
El identificador fiscal del tercero. Podés usar la lupa junto al campo para consultar automáticamente la base de datos de DGI e importar los datos básicos.

Razón Social
Nombre oficial del tercero según su registro en DGI. Este dato es obligatorio y aparece en el Anexo 2/181.

Consulta automática a DGI
Al ingresar un nuevo RUT, podés hacer clic en la lupa para que el sistema consulte la base de datos de la Dirección General Impositiva. Si el RUT existe, se completa automáticamente la Razón Social, evitando errores de tipeo y asegurando que los datos coincidan con los registros oficiales.

Definición de asientos para CFEs recibidos
Esta es la funcionalidad más potente de la tabla de RUTs. Para cada proveedor, podés configurar qué cuentas contables usar al generar automáticamente asientos desde sus CFEs.

La configuración se realiza expandiendo el RUT (clic en el símbolo “>” al final de cada línea) y definiendo las cuentas para cada combinación de:

Parámetros de clasificación
Parámetro	Descripción	Ejemplo
ISO de la Moneda	Divisa del comprobante	UYU, USD
Tipo de CFE	Tipo de comprobante fiscal	e-Factura, e-Ticket, Nota de Crédito
Forma de Pago	Condición de la operación	Crédito, Contado
Tipo de Asiento	Tipo a asignar al asiento generado	Compras Crédito, Compras Contado
Cuentas a configurar
Para cada combinación de parámetros, definís:

Cuenta Debe: típicamente la cuenta de gasto o activo (ej: Mercaderías, Gastos Generales)
Cuenta Haber: típicamente la cuenta del proveedor (ej: Proveedores Locales)
Cuentas de IVA: las cuentas para cada tasa de IVA (22%, 10%, exento, etc.)
Ejemplo de configuración
Para el proveedor “Distribuidora ABC S.A.” (RUT 123456780019):

Moneda	Tipo CFE	Forma Pago	Cuenta Debe	Cuenta Haber	IVA 22%
UYU	e-Factura	Crédito	Mercaderías	Proveedores	IVA Compras
UYU	e-Factura	Contado	Mercaderías	Caja	IVA Compras
UYU	Nota de Crédito	Crédito	Proveedores	Mercaderías	IVA Compras
Con esta configuración, cuando recibas una e-Factura a crédito de este proveedor, el sistema genera automáticamente el asiento con las cuentas indicadas.

Copiar definición desde otro RUT
Cuando muchos proveedores comparten la misma estructura de asientos (ej: todos los proveedores de mercadería usan las mismas cuentas), podés copiar la configuración de un RUT a otro:

Expandí el RUT destino (el que querés configurar)
Seleccioná el RUT origen en el campo correspondiente
Hacé clic en “Copia”
Esto replica toda la definición de asientos, que luego podés ajustar si es necesario.

Consideraciones sobre monedas
Si recibís CFEs en moneda extranjera, asegurate de que las monedas configuradas en el sistema tengan definidas las cuentas de Pérdidas y Ganancias por diferencia de cambio. Esto es necesario para contabilizar correctamente los redondeos que pueden venir en los CFEs.

Relación con otras funcionalidades
Generación de asientos desde CFEs
La herramienta Generar Asientos desde CFEs Recibidos utiliza esta configuración para crear asientos automáticamente. Sin definición de asientos para el RUT, el proceso no puede ejecutarse para ese proveedor.

Anexo 2/181
Los asientos que incluyen RUT (ya sean manuales o automáticos) se incorporan al Anexo 2/181 si el Tipo de Asiento tiene marcada esa opción.

Plan de Cuentas
Las cuentas que asignás en la definición de asientos deben existir previamente en el Plan de Cuentas.

Buenas prácticas
Usá la consulta a DGI: evita errores en la razón social y garantiza consistencia con los registros oficiales
Configurá los proveedores principales primero: priorizá aquellos de los que recibís más CFEs
Usá “Copiar definición” para proveedores similares: ahorra tiempo y reduce errores
Revisá periódicamente: si cambian las cuentas contables que usás, actualizá las definiciones
Contemplá todas las combinaciones: un proveedor puede emitir facturas y notas de crédito, en pesos y dólares, crédito y contado. Configurá todas las variantes que apliquen.
Errores comunes
RUT sin definición de asientos: el proceso de generación automática falla para ese proveedor
Cuentas de IVA no configuradas: el asiento se genera sin IVA o con error
Razón social incorrecta: discrepancias con DGI pueden generar observaciones en fiscalizaciones
Olvidar las notas de crédito: si solo configurás facturas, las notas de crédito no se procesan automáticamente
No considerar moneda extranjera: CFEs en USD fallan si no hay configuración para esa moneda
Orden de configuración recomendado
Configurar el Plan de Cuentas con todas las cuentas necesarias
Crear los Tipos de Asientos para compras
Dar de alta los RUTs de proveedores principales
Configurar la definición de asientos para cada RUT
Probar con algunos CFEs antes de procesar masivamente


Tipos de Asientos
Los Tipos de Asientos clasifican las operaciones contables según su naturaleza o propósito. Cada asiento que registrás en el sistema tiene un tipo asignado, lo que permite segmentar la información, generar informes específicos y automatizar comportamientos en la emisión de libros.

¿Para qué sirven?
Sin tipos de asiento, todos los registros contables serían indistinguibles. Los tipos permiten:

Identificar la naturaleza de cada operación (venta, compra, cobro, pago, ajuste)
Filtrar informes por tipo de operación
Agrupar en Auxiliares para consolidar operaciones relacionadas
Configurar comportamientos específicos para informes fiscales (Anexo 2/181, columna de IVA)
Sugerir conceptos automáticamente al crear asientos
Relación con Auxiliares
Cada Tipo de Asiento pertenece a un Auxiliar. Esta vinculación permite que al emitir un Libro Auxiliar (ej: Ventas), el sistema incluya automáticamente todos los asientos de los tipos asociados.

Por ejemplo, el Auxiliar “Ventas” puede contener los tipos:

Ventas Crédito
Ventas Contado
Notas de Crédito Emitidas
Devoluciones de Venta
Datos a configurar
Código
Identificador alfanumérico único. Ejemplos: VC (Venta Crédito), VE (Venta Contado), CC (Compra Crédito), PAG (Pagos).

Nombre
Descripción del tipo que aparece en informes y al seleccionar el tipo en el ingreso de asientos.

Concepto
Texto sugerido que se autocompleta en el campo “Concepto” del asiento al seleccionar este tipo. Por ejemplo, para el tipo “Ventas Crédito” podría ser “Factura de Venta”. El usuario puede modificarlo en cada asiento.

Auxiliar
Seleccioná el Auxiliar al que pertenece este tipo. Esto determina en qué Libro Auxiliar aparecerán los asientos de este tipo.

Columna del IVA
Indica si el IVA de los asientos de este tipo va al Debe o al Haber en la emisión de Libros Auxiliares y el Anexo 2/181. Configuración importante para que los informes fiscales reflejen correctamente la posición de IVA.

Anexo DGI 2/181
Marca si los asientos de este tipo deben incluirse en la generación del Anexo 2/181 para la DGI. Típicamente se activa para tipos de Ventas y Compras.

Importes negativos en Auxiliares
Indica que los importes de este tipo se muestren en negativo en los Libros Auxiliares. Útil para tipos que representan operaciones que reducen el total (ej: Devoluciones, Notas de Crédito).

Resumir en emisión de Diarios
Si está marcado, todos los asientos del mismo tipo y fecha se muestran como un único asiento resumido en la emisión de Diarios. Útil para tipos con muchas operaciones diarias (ej: ventas minoristas).

Tipos predefinidos del sistema
ZetaSoftware incluye cuatro tipos de asiento reservados que no pueden eliminarse ni modificarse. Se utilizan para procesos automáticos:

Código	Nombre	Uso
A	Apertura del Ejercicio	Asientos automáticos de apertura generados por Cierre y Apertura
Y	Resultados del Ejercicio	Asiento que traslada el resultado a patrimonio
Z	Cierre del Ejercicio	Asientos automáticos de cierre que cancelan saldos
X	Diferencias de Cambio	Asientos automáticos generados por el cálculo de diferencias de cambio
Estos tipos garantizan que los procesos automáticos funcionen correctamente y que los asientos generados sean identificables.

Ejemplos de tipos personalizados
Código	Nombre	Auxiliar	Concepto sugerido	Negativo
VC	Ventas Crédito	Ventas	Factura de Venta	No
VE	Ventas Contado	Ventas	Boleta de Venta	No
NC	Notas de Crédito Emitidas	Ventas	Nota de Crédito	Sí
CC	Compras Crédito	Compras	Factura de Compra	No
COB	Cobros	Caja	Cobranza	No
PAG	Pagos	Caja	Pago a Proveedor	No
AJU	Ajustes	Diversos	Ajuste Contable	No
Uso en el flujo de trabajo
Al ingresar asientos
Cuando creás un asiento, seleccionás el Tipo de Asiento correspondiente. El sistema autocompleta el concepto sugerido y asocia el asiento al Auxiliar configurado.

En informes
Los Diarios pueden filtrarse o resumirse por tipo. Los Libros Auxiliares agrupan automáticamente los asientos según el Auxiliar de cada tipo.

En procesos fiscales
El Anexo 2/181 incluye únicamente los asientos cuyos tipos tengan marcada esa opción, con la columna de IVA configurada correctamente.

Cómo se gestionan
Crear un tipo
Usá el botón Agregar. Completá código, nombre, auxiliar y las opciones de comportamiento.

Editar un tipo
Modificá los datos del tipo. Los cambios afectan la visualización en informes pero no alteran los asientos ya registrados.

Eliminar un tipo
Solo podés eliminar tipos que no tengan asientos asociados. Los tipos predefinidos (A, Y, Z, X) no pueden eliminarse.

Orden de configuración
Configurá en este orden:

Auxiliares (categorías amplias)
Tipos de Asientos (esta pantalla)
Comenzar a registrar asientos
Buenas prácticas
Creá tipos específicos: “Ventas Crédito” y “Ventas Contado” por separado permiten mejor análisis que un único tipo “Ventas”
Usá conceptos descriptivos: el concepto sugerido ahorra tiempo y estandariza la documentación
Configurá correctamente el IVA: errores en la columna de IVA generan problemas en el Anexo 2/181
Marcá negativos donde corresponda: Notas de Crédito y Devoluciones deben mostrarse en negativo para que los totales de auxiliares sean correctos
No abuses del resumen en Diarios: usalo solo para tipos con alto volumen donde el detalle individual no aporta valor
Errores comunes
No vincular al Auxiliar correcto: el asiento no aparece en el Libro Auxiliar esperado
Olvidar marcar Anexo 2/181: ventas o compras quedan fuera del informe fiscal
Columna de IVA invertida: el IVA aparece en la columna incorrecta del anexo
Usar tipos predefinidos para operaciones normales: los tipos A, Y, Z, X son solo para procesos automáticos


Auxiliares
Los Auxiliares agrupan Tipos de Asientos relacionados para facilitar su gestión y análisis. Funcionan como categorías que reúnen diferentes tipos bajo un mismo concepto operativo.

Nota: Esta página describe la configuración de Auxiliares (agrupaciones de tipos de asientos). Para los informes de Libros Auxiliares (ventas, compras, etc.), consultá Informes → Auxiliares.

¿Para qué sirven?
Mientras los Tipos de Asientos clasifican cada asiento contable individualmente (ventas contado, ventas crédito, compras, etc.), los Auxiliares agrupan esos tipos en categorías más amplias. Por ejemplo:

El Auxiliar “Ventas” puede incluir los tipos: Ventas Contado, Ventas Crédito, Notas de Crédito de Ventas
El Auxiliar “Compras” puede incluir los tipos: Compras Contado, Compras Crédito, Notas de Crédito de Compras
Esta agrupación permite generar Libros Auxiliares que consoliden información de varios tipos de asientos relacionados.

Auxiliares predefinidos
ZetaSoftware incluye auxiliares predefinidos que cubren las operaciones más comunes:

Ventas: agrupa todos los tipos de asientos relacionados con ventas
Compras: agrupa todos los tipos de asientos relacionados con compras
Cobranzas: agrupa los tipos de asientos de cobro a clientes
Pagos: agrupa los tipos de asientos de pago a proveedores
Podés crear auxiliares adicionales según las necesidades de análisis de tu empresa.

Relación con Tipos de Asientos
La relación es jerárquica:

Un Auxiliar contiene uno o más Tipos de Asientos
Cada Tipo de Asiento pertenece a un único Auxiliar
Al crear un nuevo Tipo de Asiento, debés asignarlo a un Auxiliar existente
Uso en informes
Los Auxiliares configurados aquí determinan qué Libros Auxiliares podés generar. Si necesitás un informe que agrupe ciertos tipos de asientos contables, primero debés crear el Auxiliar correspondiente y asignarle los tipos.

Ejemplo práctico
Una empresa quiere analizar por separado las operaciones de importación. Para esto:

Crea un Auxiliar llamado “Importaciones”
Crea Tipos de Asientos específicos: “Compras Importación”, “Gastos de Importación”
Asigna esos tipos al Auxiliar “Importaciones”
Ahora puede generar un Libro Auxiliar de Importaciones con todas las operaciones relacionadas
Buenas prácticas
Usá los auxiliares predefinidos: cubren la mayoría de las necesidades estándar
Creá auxiliares específicos solo cuando sea necesario: demasiadas categorías dificultan el análisis
Mantené coherencia: todos los tipos de asientos de una misma naturaleza deberían estar en el mismo auxiliar
Relación con otras funcionalidades
Tipos de Asientos: Los elementos que se agrupan dentro de cada Auxiliar
Libros Auxiliares (Informes): Donde se visualizan los asientos agrupados por Auxiliar
Asientos: Cada asiento contable tiene un tipo, y cada tipo pertenece a un auxiliar

Ejercicios Contables
El Ejercicio Contable define el período temporal de trabajo de la contabilidad. Determina qué fechas son válidas para registrar asientos contables, qué informes se pueden emitir, y cuándo corresponde ejecutar los procesos de cierre. Un ejercicio mal configurado o seleccionado incorrectamente es causa frecuente de errores operativos.

¿Qué es un Ejercicio Contable?
Es el período (generalmente de 12 meses) que abarca un ciclo contable completo: desde la apertura inicial hasta el cierre final. Típicamente coincide con el año fiscal, aunque puede definirse según las necesidades de la empresa.

Cada ejercicio tiene:

Fecha de inicio: primer día válido para registrar asientos contables
Fecha de fin: último día válido para registrar asientos contables
Estado: abierto (permite operaciones) o cerrado (bloqueado)
Ejercicio activo
En todo momento hay un ejercicio marcado como “activo” o “de trabajo”. Este ejercicio determina:

Dónde se registran los nuevos asientos contables
Qué período muestran los informes por defecto
Sobre qué datos operan las herramientas
Podés cambiar el ejercicio activo en cualquier momento para trabajar con períodos anteriores (si no están cerrados) o para preparar el ejercicio siguiente.

Crear un nuevo ejercicio
Al iniciar un nuevo año fiscal:

Accedé a Configuración → Ejercicios Contables
Creá el nuevo ejercicio indicando fechas de inicio y fin
El ejercicio se crea en estado “abierto”
Establecelo como ejercicio activo cuando comiences a operar en él
El nuevo ejercicio debe existir antes de generar los asientos de cierre y apertura, ya que la apertura se registra en el ejercicio siguiente.

Cerrar un ejercicio
Cerrar un ejercicio lo bloquea para evitar modificaciones. Antes de cerrar:

Verificá que todos los asientos contables estén registrados
Ejecutá Validar Asientos
Generá los asientos de diferencias de cambio si corresponde
Generá los asientos de resultado
Generá los asientos de cierre y apertura
Emití los Balances definitivos
Cambiá el estado del ejercicio a “cerrado”
Un ejercicio cerrado puede reabrirse si es necesario hacer correcciones, aunque esto debe hacerse con precaución.

Trabajar con múltiples ejercicios
Es común tener dos ejercicios abiertos simultáneamente durante el período de transición:

El ejercicio anterior (pendiente de cierre definitivo)
El ejercicio actual (donde se registran las operaciones corrientes)
Cambiá el ejercicio activo según dónde necesites trabajar. Los informes siempre respetan el ejercicio seleccionado.

Errores comunes
Registrar asientos en el ejercicio equivocado: verificá siempre qué ejercicio está activo antes de operar
Cerrar sin generar apertura: el nuevo ejercicio quedará sin saldos iniciales
Fechas fuera de rango: un asiento contable con fecha fuera del ejercicio activo genera error
Olvidar crear el ejercicio nuevo: no podrás generar la apertura ni registrar operaciones del nuevo período
Relación con otras funcionalidades
Asientos: Se registran dentro del ejercicio activo
Informes: Muestran datos del ejercicio seleccionado
Balances: El balance de cierre resume el ejercicio completo
Diarios: El libro diario documenta todas las operaciones del ejercicio
Mayores: Muestran movimientos dentro del rango del ejercicio
Cierre y Apertura: Proceso que conecta un ejercicio con el siguiente
Parámetros Generales: Configuración base que aplica a todos los ejercicios



Grupos de Cuentas
Los Grupos de Cuentas son una clasificación adicional que permite agrupar cuentas contables según criterios personalizados, independientemente del capítulo al que pertenezcan en el Plan de Cuentas.

¿Por qué existen los Grupos de Cuentas?
El Plan de Cuentas organiza las cuentas en una jerarquía rígida: Activo, Pasivo, Capital, Ganancias, Pérdidas. Esta estructura es perfecta para generar estados financieros, pero no siempre refleja cómo necesitás analizar la información.

Por ejemplo, las cuentas de IVA están dispersas en el Plan:

IVA Compras → Activo
IVA Ventas → Pasivo
IVA a Pagar → Pasivo
Si querés ver todas las cuentas relacionadas con IVA en un solo lugar, necesitás una clasificación transversal. Eso es exactamente lo que proporcionan los Grupos de Cuentas.

Diferencia entre cuenta contable y grupo de cuentas
Concepto	Cuenta contable	Grupo de cuentas
Función	Registra movimientos (Debe/Haber)	Clasifica cuentas para análisis
Jerarquía	Pertenece a un capítulo fijo (Activo, Pasivo, etc.)	Agrupa cuentas de cualquier capítulo
En asientos	Se imputa directamente	No se imputa, solo organiza
En informes	Muestra saldos y movimientos	Permite filtrar y agrupar
Datos a configurar
Código
Identificador único del grupo. Puede ser numérico o alfanumérico según tu preferencia de organización.

Nombre
Descripción del grupo que aparecerá en los informes y filtros. Elegí nombres claros que identifiquen la temática común de las cuentas agrupadas.

Ejemplos de grupos típicos
Código	Nombre	Cuentas que incluye	Utilidad práctica
01	Caja y Bancos	Caja Pesos, Caja Dólares, Banco X Cta Cte, Banco Y Caja Ahorro	Ver disponibilidades totales sin importar moneda o institución
02	Deudores Comerciales	Deudores por Ventas, Documentos a Cobrar, Cheques Diferidos Recibidos	Analizar el total de créditos otorgados a clientes
03	Proveedores	Proveedores Locales, Proveedores del Exterior, Documentos a Pagar	Controlar el total de deudas comerciales
04	Cuentas de IVA	IVA Compras, IVA Ventas, IVA a Pagar, IVA Retenido	Gestionar la posición fiscal de IVA en un solo vistazo
05	Retenciones	IRPF Retenido, IVA Retenido, Aportes Retenidos	Controlar obligaciones de retención pendientes
06	Costos de Personal	Sueldos, Cargas Sociales, Aguinaldo, Licencia, Salario Vacacional	Analizar el costo total de la nómina
07	Gastos de Estructura	Alquileres, Servicios Públicos, Seguros, Mantenimiento	Evaluar costos fijos de operación
Cómo se gestionan los grupos
Crear un grupo
Desde la pantalla de Grupos de Cuentas, utilizá el botón Agregar. Ingresá el código y nombre del nuevo grupo.

Editar un grupo
Seleccioná el grupo en la grilla y modificá sus datos. Los cambios de nombre se reflejan automáticamente en todos los informes.

Eliminar un grupo
Podés eliminar un grupo siempre que no tenga cuentas asignadas. Si el grupo tiene cuentas vinculadas, primero debés reasignarlas a otro grupo o dejarlas sin grupo desde el Plan de Cuentas.

Asignación de cuentas a grupos
La asignación se realiza cuenta por cuenta desde el Plan de Cuentas. Cada cuenta tiene un campo “Grupo” donde seleccionás a qué grupo pertenece.

Una cuenta puede pertenecer a un solo grupo (o a ninguno). Si necesitás que una cuenta aparezca en múltiples análisis, considerá usar filtros combinados en los informes en lugar de duplicar grupos.

Uso en informes
Los Grupos de Cuentas agregan una dimensión de análisis a los informes contables:

Balances
En los Balances podés filtrar por grupo para ver únicamente las cuentas de un tema específico, o agrupar la presentación por grupos en lugar de por capítulos.

Mayores
Los Mayores permiten filtrar por grupo para obtener el detalle de movimientos de todas las cuentas relacionadas con una temática.

Auxiliares
En los Auxiliares, los grupos facilitan la selección de cuentas cuando necesitás emitir libros de un conjunto específico.

Análisis
Las herramientas de Análisis aprovechan los grupos para generar reportes comparativos y de evolución por temática contable.

Buenas prácticas
Definí los grupos antes de crear el Plan de Cuentas: así podés asignar cada cuenta a su grupo desde el inicio
Usá nombres descriptivos: “Cuentas de IVA” es más claro que “Grupo 04”
No crees grupos redundantes: si el Plan de Cuentas ya agrupa naturalmente ciertas cuentas (ej: todas las de Disponibilidades bajo 111), no necesitás un grupo adicional
Pensá en los informes que necesitás: creá grupos que respondan preguntas de gestión concretas
Relación con otras configuraciones
Los Grupos de Cuentas se definen aquí, pero se utilizan en:

Plan de Cuentas → para asignar cada cuenta a un grupo
Balances, Mayores, Auxiliares y Análisis → como criterio de filtro y agrupación



Plan de Cuentas
El Plan de Cuentas es la estructura fundamental de tu sistema contable. Define todas las cuentas que utilizarás para registrar las operaciones de la empresa, organizadas en una jerarquía lógica que refleja la naturaleza de cada transacción.

¿Para qué sirve?
El Plan de Cuentas cumple tres funciones esenciales:

Clasificar cada operación económica en la cuenta correcta
Estructurar la información para generar estados financieros (Balance, Estado de Resultados)
Estandarizar el registro contable en toda la organización
Sin un Plan de Cuentas correctamente configurado, no es posible registrar asientos ni generar informes contables.

Estructura jerárquica
El Plan se organiza en niveles, desde lo más general hasta lo más específico:

Nivel	Nombre	Ejemplo de código	¿Se imputan asientos?	Color en grilla
1	Capítulo	1 (Activo)	No	Verde
2	Subcuenta	11 (Activo Corriente)	No	Azul
3	Subcuenta	111 (Disponibilidades)	No	Azul
4	Cuenta imputable	11101 (Caja Principal Pesos)	Sí	Blanco
El sistema determina automáticamente si una cuenta es imputable o es una subcuenta agrupadora, según su posición en la jerarquía de códigos.

Datos de cada cuenta
Código
Identificador numérico único que determina la posición jerárquica de la cuenta. La estructura del código define automáticamente quién es la “cuenta padre”. Por ejemplo, la cuenta 11101 es hija de 111, que a su vez es hija de 11.

Recomendación: Si necesitás más de 99 cuentas dentro de un grupo, usá códigos de 3 dígitos en el último nivel (ej: 111001 en lugar de 11101).

Nombre
Descripción clara de la cuenta. Aparece en todos los informes y al buscar cuentas durante el ingreso de asientos.

Presentación
Por defecto adopta el código, pero podés personalizarlo para que en los balances aparezca una representación alternativa (ej: “C.P.P.” en lugar de “11101”).

Moneda
Define la divisa en que opera la cuenta. Es fundamental para el cálculo de diferencias de cambio.

Centro de Costos
Determina si al imputar esta cuenta en un asiento se debe indicar un Centro de Costos:

No requerido: no se solicita
Opcional: se puede ingresar pero no es obligatorio
Obligatorio: el asiento no se puede guardar sin indicar el Centro de Costos
Esta opción solo está disponible si activaste “Trabaja con Centros de Costo” en los Parámetros Generales de Contabilidad.

Grupo
Permite clasificar la cuenta dentro de un Grupo de Cuentas. Los grupos son transversales a los capítulos: podés agrupar bajo “Cuentas de IVA” tanto cuentas de Activo (IVA Compras) como de Pasivo (IVA Ventas).

Literal Tributario
Código tributario asociado a la cuenta. Se utiliza para la generación del Anexo 2/181 de DGI. Esta opción solo está disponible si activaste “Usa Literal Tributario” en los Parámetros Generales de Contabilidad.

Calcular Diferencias de Cambio
Indica si esta cuenta se incluye en el proceso automático de cálculo de diferencias de cambio. Activalo para cuentas en moneda extranjera cuyos saldos generan resultados por variación del tipo de cambio (ej: Caja Dólares, Banco USD, Deudores en USD).

Notas
Campo libre para documentar políticas de uso, tipos de transacciones que debe registrar, o cualquier aclaración relevante para el equipo contable.

Acciones disponibles
Agregar cuenta
Dos formas de crear cuentas nuevas:

Botón “Agregar”: crea una cuenta desde cero
Opción “Agregar Cuenta” en cada fila: sugiere automáticamente el código padre. Si estás en la cuenta 111 y elegís esta opción, el sistema propone 11101 como nuevo código
Nuevo Capítulo
Crea cuentas de primer nivel (un solo dígito). Los capítulos estándar (1-Activo, 2-Pasivo, 3-Capital, 4-Ganancias, 5-Pérdidas) vienen predefinidos, pero podés agregar otros como Cuentas de Orden (6 y 7).

Exportar / Importar
Permite trabajar el Plan de Cuentas en Excel:

Exportar: genera un archivo Excel con todo el plan actual
Importar: carga un plan desde Excel. Útil para estudios contables que replican estructuras entre empresas
Importante: La importación solo está habilitada cuando la empresa no tiene asientos registrados.

Impacto en el sistema
El Plan de Cuentas es prerequisito para:

Registrar cualquier asiento contable
Configurar la Definición de Asientos por RUT para generación automática desde CFEs
Generar balances, estados de resultados y todos los informes contables
Calcular diferencias de cambio automáticas
Antes de configurar el Plan
Asegurate de haber definido previamente:

Parámetros Generales de Contabilidad (capítulos, monedas, centros de costo)
Grupos de Cuentas si vas a utilizarlos



Aquí tienes el curso express para dominar el sistema de manera arquitectónica:1. El Zen de la Partida Doble (El "Efecto Espejo")Olvida el "debe" y "haber" como palabras contables; piensa en Origen y Destino.Origen (Haber): ¿De dónde salió el dinero/valor? (Un préstamo, una venta, el bolsillo del dueño).Destino (Debe): ¿A dónde fue a parar? (A la caja, a comprar una silla, a pagar una deuda).Regla de Oro: En cada transacción, el total de los Orígenes debe ser exactamente igual al total de los Destinos. Si no cuadra, la realidad se rompe.2. La Dinámica de las Cuentas (El Código Fuente)Para ser un maestro, debes saber cómo se mueven los elementos sin dudar:ElementoAumenta por el...Disminuye por el...NaturalezaActivosDebe (Entrada)Haber (Salida)DeudoraGastosDebe (Uso)Haber (Ajuste)DeudoraPasivosHaber (Deuda)Debe (Pago)AcreedoraPatrimonioHaber (Aporte)Debe (Retiro)AcreedoraIngresosHaber (Venta)Debe (Devolución)Acreedora3. El Ciclo de Vida de la InformaciónUn contador maestro no solo registra, supervisa el flujo:Asiento Contable: La unidad mínima de información (la transacción).Libro Mayor: Agrupa los asientos por cuenta (el "resumen" de cada cosa).Balance de Comprobación: Verifica que $Debes = Haberes$.Estados Financieros: La foto final para tomar decisiones.4. Los Dos Grandes Reportes (La Verdad Desnuda)Balance General (Situación): Es una foto estática. Te dice qué tienes y qué debes en un momento exacto. Representa la ecuación:$$\text{Activo} = \text{Pasivo} + \text{Patrimonio}$$Estado de Resultados (Performance): Es una película de lo que pasó en un tiempo (un mes, un año). Te dice si ganaste o perdiste:$$\text{Ventas} - \text{Costos} - \text{Gastos} = \text{Utilidad}$$El Secreto del "Maestro": El DevengadoEste es el concepto que separa a los aficionados de los expertos. La contabilidad no se registra cuando el dinero "se mueve" físicamente (Criterio de Caja), sino cuando el hecho económico sucede (Criterio de Devengado).Ejemplo: Si recibes la factura de la luz en marzo, la registras como gasto de marzo, aunque la pagues en abril. Así reflejas la realidad del consumo, no solo del efectivo.



Gemini ha dicho
Para construir un software de contabilidad que no sea solo una "hoja de cálculo glorificada", sino un sistema robusto, escalable y auditable, debes basarte en principios arquitectónicos de integridad de datos.

Aquí tienes los pilares que separan a un software amateur de uno de nivel empresarial (ERP):

1. El Principio de Inmutabilidad (Hard Ledger)
En contabilidad profesional, nada se borra. Si un usuario comete un error, no se edita el registro original; se crea un asiento de reversión o ajuste.

Arquitectura: Los estados de los asientos deben ser Borrador, Confirmado o Anulado.

Auditoría: Cada transacción debe tener un timestamp, ID de usuario y IP. Si el sistema permite "borrar" un registro del ID 10 al ID 12, dejando un hueco en la secuencia, fallarás cualquier auditoría seria.

2. Árbol de Cuentas Jerárquico (Plan de Cuentas)
El sistema debe permitir una estructura de árbol (padres e hijos) para consolidar saldos automáticamente.

Niveles: 1. Activo -> 1.1 Activo Corriente -> 1.1.01 Caja y Bancos.

Regla: Solo las cuentas de último nivel (cuentas auxiliares o de movimiento) reciben asientos. Las cuentas "padre" solo muestran la suma de sus hijos.

3. Desacoplamiento de la Capa de Negocio (Sub-ledgers)
No mezcles la lógica de facturación o inventario con la tabla de contabilidad pura.

Documento Fuente: Una Factura de Venta es un objeto.

Asiento Contable: Es la representación financiera de esa factura.

Ventaja: Si cambias la tasa de un impuesto en la configuración, el software debe saber generar el asiento correcto sin alterar la estructura del documento original.

4. Multimoneda y Bimonetarismo (Core Engine)
Si el software nace solo para una moneda, morirá pronto.

Arquitectura: Cada línea de asiento debe guardar:

Monto en Moneda Original (ej. USD).

Tipo de Cambio a la fecha.

Monto en Moneda Local (ej. Pesos).

Diferencia de Cambio: El sistema debe ser capaz de calcular automáticamente la ganancia o pérdida por fluctuación cambiaria al cierre de mes.

5. El "Cierre de Período" (Locking Mechanism)
Debe existir un mecanismo lógico que bloquee fechas.

Funcionalidad: Una vez que se declara el IVA de marzo, nadie (ni el administrador) puede insertar un asiento con fecha de marzo. Esto garantiza que los reportes impresos coincidan siempre con la base de datos.

6. Motor de Reglas Determinísticas (Mapeo Contable)
El programador no debe escribir en el código: IF factura THEN DEBITO cuenta 400.

Arquitectura: Debes crear una capa de "Mapeo de Cuentas". El usuario (contador) define que las "Ventas de Servicios" van a la cuenta X. El software solo consulta esa regla y ejecuta. Esto permite que el software sea flexible para diferentes tipos de empresas.

Resumen Técnico de la Tabla de Asientos (JournalEntries)
Para que tu base de datos sea "maestra", la tabla de movimientos debería verse así:

Campo	Tipo	Descripción
TransactionID	UUID	Identificador único del evento económico.
AccountID	FK	Referencia al Plan de Cuentas.
Debit / Credit	Decimal	Montos (Nunca uses float por errores de redondeo).
CurrencyID	FK	Moneda de la transacción.
ExchangeRate	Decimal	Tasa de cambio al momento del registro.
SourceDoc	JSON/FK	Link al documento (Factura, Recibo, Nota de Crédito).
IsReversed	Boolean	Indica si este asiento fue anulado por otro.
