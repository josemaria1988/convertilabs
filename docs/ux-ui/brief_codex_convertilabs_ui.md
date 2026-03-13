# Brief ultra detallado para que Codex replique la UI de referencia de Convertilabs

## Instrucción principal
Tomá **la imagen de referencia como fuente visual dominante**. No reinterpretar, no modernizar, no “mejorar”, no reordenar, no hacer un layout más limpio por cuenta propia. El objetivo es **copiar la composición, la jerarquía, la densidad visual, las proporciones, los márgenes y el estilo** lo más fielmente posible.

## Advertencia importante
La imagen parece generada por IA, así que varios textos internos están deformados o no son del todo coherentes. **No hace falta copiar la tipografía rota literalmente**. Lo correcto es:
- mantener el **mismo largo visual** de los textos,
- conservar la **misma estructura de labels, títulos, botones y tablas**,
- reemplazar los textos raros por versiones legibles en español,
- pero **sin modificar tamaños, padding, jerarquía ni composición**.

---

## 1. Composición global del mosaico
El fondo exterior es un gris muy claro casi neutro:
- `#EAEBEF` aprox.

Sobre ese fondo hay **5 artboards oscuros** separados entre sí por calles blancas/gris claro de aproximadamente **26 a 34 px**.

### Posición aproximada de cada artboard dentro del collage original (2048 x 1365)
- **Pantalla A – Login / bienvenida:** `x: 15, y: 34, w: 781, h: 438`
- **Pantalla B – Documentos (tabla simple):** `x: 16, y: 502, w: 779, h: 332`
- **Pantalla C – Asientos / revisión:** `x: 17, y: 866, w: 778, h: 423`
- **Pantalla D – Dashboard principal:** `x: 822, y: 34, w: 1189, h: 672`
- **Pantalla E – Declaración IVA:** `x: 821, y: 736, w: 1190, h: 553`

Si vas a construir cada pantalla por separado, estas coordenadas no son necesarias. Si también querés replicar el collage para comparar visualmente, sí sirven.

---

## 2. Sistema visual compartido

### 2.1 Fondo general de las pantallas
Todas las pantallas tienen una base **semi-dark profesional**, no dark puro. La sensación es:
- azul marino apagado,
- grafito,
- humo azulado,
- con un leve glow azulado difuso.

Usar algo cercano a esto:
- fondo base: `#1C2230`
- segunda capa: `#243145`
- tercera capa / zonas iluminadas: `#31405A`

### 2.2 Gradiente recomendado
No usar un fondo plano. Tiene que sentirse como un software premium oscuro pero descansado.

Usar una combinación parecida a:
- `linear-gradient(180deg, #1A2130 0%, #253247 100%)`
- sumado a una luz suave tipo:
  - `radial-gradient(circle at 12% 50%, rgba(66,115,210,.15), transparent 28%)`
  - `radial-gradient(circle at 82% 12%, rgba(52,88,150,.10), transparent 24%)`
  - `radial-gradient(circle at 88% 88%, rgba(120,150,205,.08), transparent 30%)`

### 2.3 Superficies internas
Las tarjetas, tablas y bloques usan un tono apenas más claro que el fondo:
- card base: `#232B3A`
- card secundaria: `#2A3243`
- barra superior: `#202838`
- header de tabla: `#283244`
- fila hover / activa: `#313C50`
- separadores: `rgba(255,255,255,.06)`

### 2.4 Bordes, radios y sombras
- radio exterior del artboard: muy sutil, `4px` aprox.
- radio de tarjetas y botones: `6px`
- radio de pills/chips: `4px`
- bordes: `1px solid rgba(255,255,255,.05)`
- sombra: casi inexistente, más bien usar profundidad por contraste, no por sombra fuerte
- opcional: una línea superior muy tenue en tarjetas KPI para sugerir brillo `rgba(255,255,255,.05)`

### 2.5 Tipografía
Usar algo tipo **Inter / Manrope / SF Pro**.

Jerarquía aproximada:
- logo / nombre producto: `14–16px`, semibold
- títulos grandes: `20–22px`, semibold o bold
- subtítulos / títulos de sección: `13–16px`, semibold
- labels de inputs y headers de tabla: `11–12px`
- body / filas: `12–13px`
- chips: `10–11px`, semibold

Color texto:
- principal: `#E7EDF7`
- secundario: `#AEB9C9`
- tenue: `#7E8A9D`

### 2.6 Colores funcionales
- azul primario: `#4D78C9`
- azul secundario desaturado: `#5E82B8`
- verde correcto: `#5F9D73`
- ámbar: `#C39A52`
- rojo suave: `#C0625A`
- cian suave: `#79B6D7`

Los colores funcionales no deben ser chillones. Todo está ligeramente apagado.

### 2.7 Densidad visual
Muy importante: **diseño denso pero respirable**.
- No dejar espacios gigantes.
- No apilar elementos hasta asfixiarlos.
- Aprovechar el ancho.
- La sensación debe ser de software de trabajo serio, no de landing aireada.

### 2.8 Controles compartidos
- altura de botones medianos: `32px`
- altura de inputs: `34–36px`
- padding horizontal de botones: `14–18px`
- padding interno de cards: `14–18px`
- gap estándar entre bloques: `14–18px`
- gap chico entre labels/inputs: `8–10px`
- alto de top bar: `42–44px`
- ancho sidebar pantallas de app: `165–175px`

---

## 3. Pantalla A – Login / bienvenida (781 x 438)

### 3.1 Estructura general
No es un login minimalista centrado. Es una pantalla de acceso con **dos zonas claras**:
- columna izquierda: formulario de acceso
- columna derecha: panel informativo con 3 beneficios / features

El fondo completo es oscuro con gradiente azul-grafito. No hay borde blanco visible. Todo el artboard ocupa el ancho completo.

### 3.2 Logo
Ubicación aproximada:
- `x: 40–50`
- `y: 24–30`

Composición:
- ícono azul/celeste geométrico a la izquierda
- texto “Convertilabs” en blanco a la derecha
- altura visual total del bloque: `28–32px`

### 3.3 Columna izquierda
Ancho visual aproximado: `300–330px`
Posición inicial aproximada:
- inicio x: `55`
- bloque principal empieza alrededor de `y: 110`

#### Título
- texto grande: “Bienvenido a Convertilabs.”
- tamaño: `20–22px`
- peso: semibold / bold
- color: blanco suave
- sin subtítulo debajo

#### Input 1
- label pequeña arriba: correo / email
- caja oscura translúcida
- ancho: `255–270px`
- alto: `32–34px`
- borde tenue
- radio: `5–6px`

#### Input 2
- misma estética
- misma anchura
- separación vertical aprox.: `18–22px`

#### Fila “recordarme / olvidé contraseña”
- checkbox mínimo a la izquierda
- texto pequeño “Recordarme”
- link pequeño a la derecha en azul tenue
- todo alineado en una misma línea

#### Fila de botones
Dos botones en la misma línea.

1. **Botón primario “Ingresar”**
   - ancho aproximado: `130–145px`
   - alto: `38–40px`
   - fondo azul medio con leve gradiente
   - texto blanco
   - radio `5px`

2. **Botón secundario “Crear cuenta”**
   - mismo alto
   - fondo gris azulado más opaco
   - texto blanco tenue

Separación entre botones: `12–14px`

### 3.4 Panel derecho de beneficios
Ubicación aproximada:
- x inicial: `420`
- y inicial: `60–70`
- ancho aprox.: `300–315px`
- alto aprox.: `325–335px`

Es un gran rectángulo oscuro, apenas más claro que el fondo, con esquinas redondeadas.

#### Título del panel
En dos líneas, grande:
- “Automatiza tu Contabilidad”
- “e Impussíos” / texto deformado en la imagen

En implementación usar mejor un texto limpio tipo:
- “Automatiza tu Contabilidad”
- “e Impuestos”

Tamaño: `20–22px`
Peso: semibold
Color: blanco

#### Tres bloques internos apilados
Cada uno es una tarjeta horizontal con:
- icono circular a la izquierda
- título corto centrado verticalmente
- fondo ligeramente más claro que el panel contenedor
- altura aprox.: `54–58px`
- separación vertical entre tarjetas: `12–14px`

Tarjeta 1:
- círculo azul claro
- ícono de documento / upload
- texto: “Proceso Facturas y Recibos”

Tarjeta 2:
- círculo celeste
- ícono de grilla / puntos
- texto: “Sugiere Asientos Contables”

Tarjeta 3:
- círculo color durazno / arena
- ícono tipo auriculares / semicírculo
- texto: “Calcule IVA e Impuestos”

### 3.5 Sensación visual que no hay que perder
- panel derecho ligeramente flotante pero sin sombra obvia
- mucho contraste entre el azul del botón primario y los neutros
- nada centrado de forma simétrica perfecta; es un layout de producto, no un formulario genérico

---

## 4. Pantalla B – Documentos (779 x 332)

### 4.1 Estructura general
Esta pantalla ya tiene shell de aplicación:
- sidebar izquierda
- topbar superior
- contenido principal con título, filtros y tabla

### 4.2 Sidebar
Ancho aprox.: `170–185px`

Fondo:
- muy oscuro, ligeramente distinto del cuerpo
- divisor vertical suave hacia el contenido

#### Logo arriba
- alineado a la izquierda con padding `16–18px`
- altura del bloque superior total: `44–48px`

#### Menú vertical
Items con ícono a la izquierda y label a la derecha.
Orden:
- Inicio (activo)
- Documentos
- Asientos
- Impuestos
- Exportar

Item activo:
- tiene una cápsula / rectángulo más claro detrás
- altura aprox.: `34–36px`
- color de texto más brillante

Items inactivos:
- transparentes
- mismo alto visual pero sin fondo resaltado

### 4.3 Topbar
Altura aprox.: `44px`

Lado izquierdo:
- pequeño ícono cuadrado o documento
- texto “Documents” / “Documentos” con flecha desplegable

Lado derecho:
- píldora pequeña con nombre de organización/cliente
- ícono lupa
- avatar circular con cara/persona
- flecha pequeña o caret

Todo alineado horizontalmente y pegado arriba.

### 4.4 Contenido principal
Empieza aprox. en `x: 205`
Padding superior visible: `24–28px`

#### Título
- “Documentos”
- tamaño `22–24px`
- peso semibold

#### Botón superior derecho
- texto parecido a “Cargar Documentos”
- pequeño, gris-azulado
- ancho aprox.: `130–145px`
- alto `28–30px`
- ícono pequeño a la izquierda

### 4.5 Fila de filtros
Hay 4 controles horizontales alineados.
Altura: `30–32px`
Gap entre ellos: `10–12px`

Aproximadamente:
1. filtro corto: `Tipo`
2. filtro corto: `Estado`
3. filtro mediano con ícono lupa: `Estado` / búsqueda
4. filtro largo: `Escritorio` / categoría / selector grande

Todos con fondo oscuro medio y borde tenue.

### 4.6 Tabla
Empieza aprox. a `y: 145`
Ocupa casi todo el ancho restante.

#### Header de tabla
- altura `34px`
- fondo un poco más oscuro que las filas
- columnas aprox.:
  - checkbox / indicador
  - nombre/archivo
  - descriptor / proveedor
  - chip 1
  - chip 2
  - monto

#### Filas
- 4 filas principales visibles, más insinuación de una más abajo
- alto de fila `42–46px`
- alternancia sutil de fondo
- a la izquierda, pequeño cuadrado celeste o checkbox
- texto principal blanco suave
- texto secundario gris claro
- dos chips por fila en el centro/derecha
- monto final alineado a la derecha

#### Chips de estado
Rectangulares con radio pequeño, no píldoras grandes.
Ejemplos de color:
- verde suave
- ámbar
- rojo ladrillo
- azul frío

Texto del chip en blanco o muy claro.

### 4.7 Reglas de fidelidad
- no ensanchar la sidebar más de la cuenta
- no convertir filtros en controles gigantes
- la tabla debe verse compacta, no espaciosa tipo CRM vacío
- todo tiene que quedar bien pegado arriba, con poco desperdicio de espacio vertical

---

## 5. Pantalla C – Asientos / revisión (778 x 423)

### 5.1 Shell
Usa exactamente el mismo shell de la pantalla B:
- misma sidebar
- mismo topbar
- mismos paddings estructurales

### 5.2 Cabecera de contenido
En lugar del título grande “Documentos”, esta vista arranca con una barra de tabs.

#### Tabs superiores
Tres tabs alineados a la izquierda:
- “Sugerir” (activo)
- “En revisión”
- “Aprobados”

Características:
- alto `32px`
- cada tab es un rectángulo oscuro
- el activo va en azul
- separación `8–10px`

#### Botón superior derecho
- botón azul con ícono de filtro o embudo
- texto similar a “Separar Diferencias”
- ancho aprox.: `150–165px`
- alto `32px`

### 5.3 Tabla principal
Debajo de tabs y botón.

#### Header
Cinco columnas principales más una columna final mínima para chevrons:
- cuenta / código
- descripción
- saldo
- exentos
- ingresar / importe
- acción / chevron

Header con pequeños carets hacia abajo en varias columnas.

#### Filas
- 7 filas visibles
- alto aprox.: `42–44px`
- primera columna con mini checkbox o cuadrado apagado
- segunda columna códigos numéricos
- tercera columna texto descriptivo
- columnas numéricas alineadas a la derecha
- última columna tiene pequeño chevron `>` o caret

Los importes están muy apretados, lo cual es correcto; no abrir demasiado el tracking ni el inter-column spacing.

### 5.4 Footer de tabla
- en el centro inferior hay un pequeño control de paginación oscuro
- a ambos lados se ven líneas horizontales finas que lo enmarcan
- el control es muy chico, casi simbólico

### 5.5 Footer de sidebar
Abajo de todo aparecen dos links/elementos pequeños con íconos:
- uno relacionado con tablero / tareas / ventas
- otro relacionado con presentar / reportes

No darles protagonismo. Son microelementos.

---

## 6. Pantalla D – Dashboard principal (1189 x 672)

### 6.1 Estructura general
Es la pantalla más densa y más importante.

Composición:
- sidebar izquierda
- topbar superior
- fila de 4 KPI cards arriba
- gran área media con tabla de documentos + panel de preview de factura a la derecha
- fila inferior con gráfico “Resumen de IVA” + card “Obligaciones Fiscales”

Hay muy poco aire muerto. Todo usa el ancho.

### 6.2 Sidebar
Ancho aprox.: `165–175px`
Misma estructura que en las pantallas anteriores.

Menú:
- Inicio (activo)
- Documentos
- Asientos
- Impuestos
- Exportar

Abajo, 3 links pequeños de utilidades / historial / procesos.

### 6.3 Topbar
Altura: `42–44px`

Lado izquierdo:
- texto pequeño de sección con dropdown, algo tipo “Declaraciones”

Lado derecho:
- chip o pequeño badge de organización/nombre
- lupa
- avatar circular
- caret

### 6.4 Fila de KPIs
Empieza aprox. en `x: 240`, `y: 55`
Se compone de 4 tarjetas del mismo alto.

#### Distribución
- 4 cards horizontales
- ancho aprox. de las 3 primeras: `190–210px`
- la cuarta es un poco más ancha o similar según el ajuste
- gap entre cards: `14–16px`
- alto: `95–105px`

#### Card 1 – Documentos Pendientes
- título arriba izquierda con iconito
- línea superior/acento rojizo tenue
- número principal muy grande: `3560`
- debajo, subtítulo explicativo pequeño
- badge rojo pequeño arriba a la derecha con texto breve

#### Card 2 – Asientos en Revisión
- acento azul
- número principal: `227`
- badge verde pequeño a la derecha

#### Card 3 – Estado de IVA
- acento verde
- número grande: `174%`
- badge verde

#### Card 4 – Próximo Vencimientos
- acento anaranjado/rojizo
- no tiene un número central enorme como las otras
- tiene dos líneas de texto con valores alineados a la derecha, como una mini lista de próximos hitos

### 6.5 Bloque principal “Documentos”
Justo debajo de los KPIs.

#### Cabecera de bloque
- título “Documentos” a la izquierda
- a la derecha, 2 chips pequeños de filtro/acción
- luego botón azul “Cargar Documentos”
- luego botón gris “Importar” con caret

Los 4 controles de la derecha están todos en una misma línea.

### 6.6 Tabla de documentos dentro del dashboard
Ocupa la parte izquierda del bloque.
Ancho aprox.: `620–650px`

#### Header
- altura `32–34px`
- varias columnas compactas
- nombres pequeños con carets
- la tabla es más compleja que la de la pantalla B

#### Filas
- 5 filas visibles
- cada fila arranca con un ícono pequeño (círculo o documento)
- nombre de documento o entidad
- descriptor breve
- 2 chips de estados/flags
- 2 columnas numéricas a la derecha

Los chips están repartidos entre verde, azul, ámbar y rojo.

#### Pager
Debajo de la tabla, al centro, hay un mini pager muy pequeño.

### 6.7 Columna derecha del bloque principal
Ancho aprox.: `250–260px`

#### Preview de factura
- card blanca grande arriba
- fondo blanco puro o casi puro: `#F8F8F8` / `#FAFAFA`
- bordes muy suaves
- dentro se ve una factura mockeada, con título:
  - “Factura N° 1534”
- líneas finas grises separando ítems
- valores alineados a la derecha
- una cifra destacada cerca de la mitad/baja de la hoja

La hoja ocupa casi todo el ancho de la columna y tiene bastante margen interno blanco.

#### Card inferior “Detalles del Documento”
- fondo oscuro
- título pequeño arriba izquierda
- 2 filas de detalle con íconos chiquitos a la izquierda
- valores alineados a la derecha

### 6.8 Fila inferior izquierda – Gráfico “Resumen de IVA”
Card ubicada debajo de la tabla, a la izquierda.

#### Características
- ancho aprox.: `330px`
- alto aprox.: `160–175px`
- título arriba izquierda: “Resumen de IVA”
- gráfico de barras verticales agrupadas
- colores: azul, verde, rojo/ámbar, azul, verde
- línea blanca superpuesta con puntos circulares
- eje x con etiquetas tipo `M001`, `M002`, etc.
- grid horizontal muy tenue

### 6.9 Fila inferior centro – “Obligaciones Fiscales”
Card al lado del gráfico.

#### Características
- ancho aprox.: `330px`
- alto similar al del gráfico
- título arriba izquierda
- dropdown pequeño arriba derecha
- 2 filas internas
- cada fila tiene:
  - checkbox o tilde pequeña a la izquierda
  - label central
  - línea o campo tenue en el medio
  - valor numérico alineado a la derecha

### 6.10 Sensación general de esta pantalla
- muy operativa
- mucho dato en poco espacio
- profesional y densa
- no convertirla en dashboard “bonito” con widgets demasiado redondeados o aireados
- la preview de factura tiene que contrastar fuerte contra el entorno oscuro

---

## 7. Pantalla E – Declaración de IVA (1190 x 553)

### 7.1 Estructura general
- misma sidebar izquierda
- misma topbar superior
- gran título de página
- fila de métricas fiscales
- columna derecha con historial
- panel resumen del período
- panel alertas y diferencias

### 7.2 Título principal
Ubicación aproximada:
- `x: 245`
- `y: 68`

Texto:
- “Declaración de IVA - Noviembre 2023”

Tamaño:
- `20–22px`

### 7.3 Fila superior de métricas
Debajo del título, hay 3 tarjetas horizontales más una columna derecha independiente.

#### Card 1 – Débito Fiscal
- fondo oscuro medio
- ancho aprox.: `235–250px`
- alto aprox.: `88–94px`
- título arriba izquierda
- número grande debajo: `46 970`
- chip pequeño azul en el ángulo superior derecho con otro valor

#### Card 2 – Crédito Fiscal
- estructura igual
- número principal: `34 660`
- chip verde pequeño

#### Card 3 – IVA a Pagar
- esta tarjeta tiene tinte verde más evidente que las otras
- valor principal: `350 923`
- chip verde pequeño arriba derecha

### 7.4 Columna derecha superior – Historial de declaraciones
- ancho aprox.: `210–220px`
- altura aprox.: `190–205px`
- fondo oscuro
- título arriba
- lista vertical de 4 items con pequeño cuadrado/check a la izquierda
- a la derecha de cada item hay check o estado verde
- abajo un botón gris/oscuro, ancho casi completo

### 7.5 Panel “Resumen del Periodo”
Ubicado debajo de las tarjetas métricas, ocupando el cuerpo principal central.

#### Características
- ancho aprox.: `760–780px`
- alto aprox.: `110–120px`
- título arriba izquierda
- dropdown pequeño arriba derecha
- 2 filas de resumen
- cada fila tiene:
  - pequeño icono/tilde verde a la izquierda
  - label tipo “Ventas Gravadas”
  - cifras alineadas hacia el centro-derecha
  - al extremo derecho pequeños badges verdes con cifras

### 7.6 Panel “Alertas y Diferencias”
Está justo debajo del panel de resumen.

#### Contenedor
- ancho similar al panel anterior
- alto aprox.: `165–175px`
- título arriba izquierda
- pequeño ícono informativo o punto al lado del título
- filtro/dropdown arriba derecha

#### Dos alertas horizontales
Cada alerta es una barra grande color rojo apagado / vino suave.

**Alerta 1**
- ícono circular rojo/naranja a la izquierda
- texto: “Diferencia en Ventas”
- botón azul pequeño a la derecha: “Conciliar Diferencias”

**Alerta 2**
- ícono circular rojo
- texto: “Crédito Fiscal Inconsistente”
- botón azul pequeño a la derecha: “Ver Detalles”

Las barras ocupan casi todo el ancho del panel y están separadas por un gap corto.

#### Fila inferior del panel
- checkbox o ícono azul pequeño
- texto/link “Ver Detalles”
- caret hacia abajo

### 7.7 Columna derecha inferior – Historial / lista final
Debajo del card superior derecho hay un segundo card.

#### Características
- mismo ancho de la columna
- título tipo “Historia de Declaraciones”
- lista de 3 filas
- cada fila tiene checkbox o ícono pequeño a la izquierda
- código/periodo al centro
- valor/fecha a la derecha
- chevron o caret final

### 7.8 Sensación visual
- la tarjeta “IVA a Pagar” debe ser la más importante del bloque superior
- los paneles de alertas deben tener rojo desaturado, no rojo puro
- la columna derecha acompaña, pero no debe robar protagonismo al contenido central

---

## 8. Reglas de implementación para que no se desvíe

### 8.1 No hacer esto
- no usar blanco puro salvo en el preview de factura
- no usar cards con sombras fuertes
- no redondear de más
- no agrandar el texto para “mejorar legibilidad”
- no meter espaciado amplio estilo SaaS moderno minimalista
- no centrar contenedores angostos
- no convertir las tablas en tarjetas móviles
- no cambiar el orden de bloques

### 8.2 Sí hacer esto
- usar layout full width dentro de cada artboard
- mantener densidad alta pero prolija
- respetar gaps cortos
- usar bordes muy tenues
- usar estados coloreados discretos
- mantener sidebar compacta
- mantener topbar baja y liviana

### 8.3 Comportamiento responsive sugerido
Como la referencia es claramente desktop, primero clavar el desktop.
Después, si hace falta responsive:
- en `>= 1440px`, mantener estructura y dejar que crezca el ancho de tablas
- en `1280px`, reducir gaps, no apilar pronto
- en `< 1100px`, recién ahí considerar que el preview pase abajo o a drawer

Pero la prioridad es **pixel feel parecido al mockup de escritorio**.

---

## 9. Copy limpio sugerido para reemplazar el texto roto de la imagen

### Login
- Bienvenido a Convertilabs.
- Correo electrónico
- Contraseña
- Recordarme
- ¿Olvidaste tu contraseña?
- Ingresar
- Crear cuenta
- Automatiza tu Contabilidad e Impuestos
- Procesa facturas y recibos
- Sugiere asientos contables
- Calcula IVA e impuestos

### Sidebar
- Inicio
- Documentos
- Asientos
- Impuestos
- Exportar

### Dashboard
- Documentos Pendientes
- Asientos en Revisión
- Estado de IVA
- Próximos Vencimientos
- Cargar Documentos
- Importar
- Resumen de IVA
- Obligaciones Fiscales
- Detalles del Documento

### IVA
- Declaración de IVA - Noviembre 2023
- Débito Fiscal
- Crédito Fiscal
- IVA a Pagar
- Historial de Declaraciones
- Resumen del Período
- Alertas y Diferencias
- Diferencia en Ventas
- Crédito Fiscal Inconsistente
- Conciliar Diferencias
- Ver Detalles

---

## 10. Instrucción final corta para Codex
Recrear la UI exactamente en estilo, proporciones, densidad y layout según la imagen: semi-dark profesional, sidebar compacta, topbar baja, tarjetas oscuras con bordes muy sutiles, tablas densas, chips de estado discretos, preview de factura blanca a la derecha, dashboard full width y sin aire excesivo. No reinterpretar ni simplificar. Mantener la composición general casi calcada y usar textos limpios en español donde la imagen tenga texto deformado.
