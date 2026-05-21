# BACKLOG — Seeds Social Media Dashboard

Documento de handoff del proyecto. Recoge deuda técnica identificada durante los 13 sprints, edge cases conocidos, y mejoras futuras priorizadas.

---

## Deuda técnica

### Alta prioridad

- **`summaryText` duplicado**: Cada página (Instagram, LinkedIn, TikTok, Newsletter) tiene su propio `useMemo` de resumen de texto. La lógica es conceptualmente similar pero las métricas y el formato difieren. Evaluar si un helper paramétrico reduce duplicación sin introducir rigidez.

- **`freqBadge` duplicado**: Instagram y TikTok calculan frecuencia de publicación semanal con lógica distinta (Instagram usa buckets de días del mes, TikTok difiere). Si se homogeniza el cálculo, se puede extraer a un util.

- **Cache de sessionStorage sin TTL**: `queryCache.ts` no expira datos. Si un usuario deja la pestaña abierta de un día para otro, verá datos del día anterior hasta que refresque manualmente. Agregar TTL de ~1 hora o invalidación por fecha.

- **`getOverviewHistory` recomputa todo sin memoización server-side**: Cada carga de Overview hace joins y agregaciones en Supabase. Si el dataset crece (>24 meses), considerar una vista materializada o RPC en Supabase.

### Media prioridad

- **`colSpan` hardcodeado en tablas**: Varios `colSpan={N}` están hardcodeados. Si se agregan o eliminan columnas, hay que actualizarlos manualmente. Ejemplo reciente: el Score column en Sprint 12 requirió cambiar `colSpan={4}` a `colSpan={5}`.

- **`ratioToScore` sin tests**: La función en `src/lib/scoring.ts` es crítica para el MonthScore y el scoring de collabs, pero no tiene cobertura de tests. Un test unitario con los valores del docstring (ratio 1.5 → 70, ratio 0.5 → 28) prevendría regresiones.

- **Tipos `as unknown as boolean` para recharts `dot`**: Los cuatro usos de `<FollowerDot>` requieren el cast `as unknown as boolean` para satisfacer los tipos de recharts. Es un workaround por la limitación del tipado de recharts al usar componentes React como prop `dot`. No hay solución limpia sin parchear los tipos de la librería.

- **`igER` y `liER` en Overview history son 0 cuando no hay datos**: El valor 0 es ambiguo — puede significar "sin datos" o "0% de engagement". En `MonthScoreCard`, `dimSubScore(0, avg)` devuelve score 5, lo que puede penalizar meses donde simplemente no se registró ER. Considerar `null` en la DB y manejar explícitamente.

---

## Edge cases conocidos

### Datos y carga

- **Mes sin posts pero con datos mensuales manuales**: Si se carga `total_followers` y `new_followers` pero no hay posts individuales, el ER calculado es 0 y el MonthScore penaliza alcance. Esto es correcto pero puede sorprender al usuario.

- **Primer mes histórico**: `MonthScoreCard` muestra "Score estimado — mejora con más meses cargados" cuando solo hay 1 mes. El score es 55 en todas las dimensiones (sin historial para comparar). Esto es intencional pero puede confundir si el primer mes es atípicamente bueno o malo.

- **Historial con huecos (meses sin datos)**: `prior3Avg` filtra valores 0, lo que es correcto para meses no cargados. Pero si hay 3 meses cargados con un hueco en el medio, el promedio usa solo los meses con datos > 0, lo que puede distorsionar el score.

- **Newsletter sin datos históricos**: Cuando `nlActive = false` (sin datos de newsletter), el score de Newsletter se fija en 55 y el peso se redistribuye a Alcance y Engagement. Si en el futuro se activa el newsletter, el score puede caer hasta que haya historial suficiente.

- **Proyección de seguidores con tasa negativa**: El gráfico de evolución de seguidores proyecta 3 meses hacia adelante usando la tasa promedio de los últimos 6 meses. Si la tasa es negativa (pérdida de seguidores), la proyección muestra caída, lo que es correcto pero puede alarmar innecesariamente.

- **Posts con `views = 0`**: El scatter de Alcance vs Engagement usa `Math.log10(Math.max(views, 1))` para evitar log(0). Posts con 0 views aparecen en el extremo izquierdo del scatter, lo que puede ser confuso.

- **Collabs sin `collab_account`**: Los posts tipo Collab sin cuenta asociada no aparecen en el desglose de comparación de collabs, pero sí cuentan en los totales. No genera error, pero el desglose queda incompleto.

- **Meses futuros en el selector**: `MonthSelector` no bloquea seleccionar meses futuros. Si se selecciona un mes sin datos, las queries devuelven arrays vacíos y la página muestra métricas en 0 sin indicar que no hay datos cargados.

### Presentación y exportación

- **`presentation-hide` en CSS vs `presentationMode` en React**: El modo presentación se activa por dos vías: CSS (`body.presentation-mode`) y el estado React (`presentationMode` en Instagram). Ambos mecanismos deben estar sincronizados. Si se agrega un nuevo toggle de presentación que solo modifica uno de los dos, habrá inconsistencias.

- **CSV export sin encoding BOM**: El CSV exportado no incluye BOM UTF-8. Excel en Windows puede interpretar mal caracteres especiales (tildes, ñ). Agregar `﻿` al inicio del blob si se reportan problemas.

- **Print: gráficos de Recharts pueden cortarse**: `page-break-inside: avoid` funciona para tablas y cards, pero los SVG de Recharts dentro de `ResponsiveContainer` pueden igualmente cortarse en impresión si son muy altos. No hay solución perfecta sin establecer alturas fijas en print.

---

## Mejoras futuras priorizadas

### P1 — Alto valor analítico

- **Comparativa YoY (año sobre año)**: Actualmente solo se compara mes vs mes anterior y vs Q anterior. Agregar opción de comparar el mismo mes del año anterior, especialmente útil cuando hay estacionalidad (verano, diciembre, etc.).

- **Score breakdown exportable**: El MonthScore tiene un tooltip de desglose al hacer hover sobre el círculo. Incluir este desglose en el CSV de exportación y en el resumen de cierre de Q.

- **Alertas configurables**: Las anomalías de Overview usan umbrales hardcodeados (+30% / -20% / -50%). Permitir al usuario configurar estos umbrales por canal sería más flexible.

- **TikTok ER% en historia**: TikTok actualmente no tiene ER histórico en el gráfico de evolución. Se puede calcular como `interactions / views * 100` desde el historial existente.

### P2 — UX y calidad

- **Loading skeleton para comparación de meses (Instagram)**: Al activar el toggle "Comparar con mes anterior", hay una fracción de segundo donde el panel aparece vacío antes de cargar. Agregar un skeleton de tabla.

- **Confirmación antes de eliminar múltiples posts**: El botón "Eliminar seleccionados" muestra un `confirm()` nativo. Reemplazar con un modal in-page para evitar que el navegador bloquee el popup (algunos bloquean `confirm()` en ciertos contextos).

- **Ordenamiento persistido**: Las preferencias de ordenamiento de tablas (columna + dirección) no persisten entre navegaciones. Guardar en sessionStorage o URL params.

- **Navegación por teclado en MonthSelector**: El selector de mes no responde a flechas de teclado. Útil para presentaciones donde se navega mes a mes.

### P3 — Infraestructura

- **Tests de integración para queries**: `getOverviewHistory` y `getInstagramStats` son las queries más críticas y más complejas. Un test de integración contra Supabase (con datos de fixture) detectaría regresiones al modificar el schema.

- **Variables de entorno tipadas**: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se usan sin validación en startup. Si no están presentes, el error aparece en runtime. Validar en `next.config.js` o en un módulo de configuración.

- **Middleware de autenticación**: Actualmente cualquier persona con la URL puede ver el dashboard. Si se despliega fuera de una red privada, agregar autenticación básica (Supabase Auth + middleware de Next.js).

---

## Decisiones de diseño y sus motivaciones

- **Inline SVG para sparklines (no Recharts)**: Los sparklines de "Tendencias 6 meses" usan SVG inline para mantener el peso del bundle bajo y el render síncronos. Recharts agrega ~40KB min+gz y sus componentes son async. Para sparklines de 80×30px, SVG manual es suficiente.

- **`sessionStorage` para cache de queries**: Se eligió sessionStorage (no localStorage) para que el cache se limpie al cerrar la pestaña. Datos de redes sociales pueden cambiar durante el día; limpiar por sesión es un compromiso razonable entre velocidad y frescura.

- **`calculateMonthScore` exportada como función pura**: La lógica de scoring se exporta como función pura (sin hooks) para poder usarla tanto en el componente `MonthScoreCard` como en el histograma de scores del Overview. Mantener esta separación.

- **MonthScore con pesos adaptativos**: Si el cliente no usa newsletter, los pesos se redistribuyen a Alcance y Engagement. Esto evita penalizar meses sin newsletter. El comportamiento está documentado en los comentarios de `MonthScoreCard.tsx`.

- **`is_manual` flag en posts**: Los posts manuales (collabs externos, correcciones) usan `is_manual: true` para distinguirlos de los datos importados desde la API de Meta. Esto permite filtrarlos o agruparlos por separado sin ambigüedad.
