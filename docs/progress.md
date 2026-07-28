# Progress log

## 2026-07-28 (continuación — Interfaz tipo Camera Raw, Fase 6)
- Planificado y aprobado con el usuario un cambio de alcance completo (no solo maquetar, también dejar funcionando los controles nuevos) y zoom por slider+arrastre (no lupa).
- Layout nuevo: cabecera + visor de imagen flexible + barra lateral fija con controles agrupados en secciones (Balance de blanco, Tono, Grano y nitidez, Salida) — sustituye la vista de depuración lado a lado.
- Zoom (slider 10%–500%) + arrastre con ratón + botón "Ajustar" (fit-to-window); se reajusta solo al cargar imagen o redimensionar ventana.
- Botón A/B ("Ver original"/"Ver editada") reutilizando el mismo canvas-stack que ya existía para preview/render riguroso.
- Implementados de verdad 6 controles nuevos que no existían en el motor: temperatura, matiz, luces, sombras, blancos, negros. Nuevo pass `sceneGrade.wgsl` insertado en lineal, antes del halation (justificación completa en `decisions.md`). Un solo mecanismo de máscara `smoothstep` en dominio log reutilizado para luces/sombras (zona ancha) y blancos/negros (zona estrecha en los extremos).
- La exposición ya existente no se tocó (sigue en `characteristicCurve.wgsl`), solo se reubicó en la nueva barra lateral — decisión de menor riesgo para no rehacer código con tests numéricos ya validados.
- Verificado en el navegador embebido con una imagen sintética: cada control nuevo produce el efecto esperado, zoom/arrastre/A-B funcionan, sin errores de consola. Regresión confirmada en exposición/grano/acutancia/papel. Los 23 tests existentes siguen pasando.
- Pendiente: probar con una foto real del usuario y recoger su feedback sobre la fuerza de los controles nuevos.

## 2026-07-28 (continuación — Grano riguroso en Web Worker)
- Implementado el modelo de grano riguroso (booleano de partículas, Newson/Delon/Galerne) en un Web Worker, con botón "Renderizar grano riguroso", barra de progreso y botón de descarga PNG. Vuelve automáticamente al preview rápido al tocar cualquier control, tal como pidió el usuario.
- Tres bugs reales encontrados y corregidos en el proceso (ver `decisions.md` para el detalle técnico): texturas sin `COPY_SRC` (volcado a CPU fallaba en silencio), λ de célula recalculado por el píxel que preguntaba en vez de por la propia célula (incoherencia espacial), y el más sutil — muestras Monte Carlo del mismo píxel consultando siempre la misma colocación de granos ya fijada, dando un resultado casi binario ("confeti" de colores) en vez de una media suave. El usuario hizo una pregunta clave (¿tiene que ver con la resolución en píxeles?) que ayudó a encontrar el tercer bug.
- 23 tests en total (nuevos: convergencia estadística del grano, más varianza en medios tonos, determinismo).
- El usuario probó la app en vivo en su propio Chrome (no solo en el navegador de pruebas) — quedó muy contento ("la hostia de momento").
- Sesión cerrada a petición del usuario con varios feedbacks pendientes de compartir y con la idea de probar con una foto real suya la próxima vez.
- Pendiente: recoger feedback, probar con foto real, y seguir con la interfaz tipo Camera Raw.

## 2026-07-28 (continuación — Difusión/acutancia)
- El usuario definió las prioridades tras la Fase 5: difusión/acutancia → grano riguroso para export → interfaz tipo Camera Raw (dejando "más películas" aparcado por ahora). Detalle de la interfaz pedida: panel lateral con temperatura, matiz, exposición, luces, sombras, blancos, negros, etc.; zoom (lupa que sigue el ratón o slider); botón A/B original/editada.
- Implementada la difusión inter-capa / acutancia (efecto de borde químico real, tipo unsharp mask pero aplicado en densidad con un radio pequeño y físicamente motivado), insertada entre el grano y la simulación de papel según el orden de `CLAUDE.md`.
- Generalizado `CompositePass` para aceptar parámetros extra.
- Verificado numéricamente en un borde de alto contraste: aparece la franja oscura+clara característica del efecto, proporcional al slider de intensidad.
- Pendiente: grano riguroso para exportación (necesita decidir arquitectura — worker o servidor).

## 2026-07-28 (continuación — Fase 5)
- Descargado y digitalizado el datasheet real de Kodak del papel Portra Endura (E-4021) — su curva SÍ tiene un hombro real en luces altas (a diferencia de la película).
- Descubierto que el eje de ese gráfico corresponde a una cuña de densidades calibrada, así que se puede alimentar directamente con la densidad del negativo.
- R/G/B del papel están casi superpuestas en el dato real, así que se usa una curva compartida (documentado como simplificación razonable).
- Implementada la calibración de canal (alinear los tres canales en el punto de exposición de referencia, como el filtro de una ampliadora real) para evitar dominantes de color en los grises.
- Nuevo pass `scannerPaper.wgsl`: por fin la conversión real de densidad a imagen positiva, con el redondeo de luces altas que llevábamos varias fases esperando.
- Etapa final hecha conmutable con un checkbox (papel real vs. vista previa plana anterior), tal como pedía `CLAUDE.md`.
- Verificado con negro/blanco puros que el comportamiento es físicamente correcto: negro no absoluto, blanco con transición suave.
- 6 tests nuevos (21 en total). Probado visualmente combinando halation + grano + papel: aspecto ya reconociblemente "de película".
- Pendiente: difusión/acutancia, más emulsiones, grano riguroso para export, fases 6 (UI) y 7 (IA) — a decidir orden con el usuario.

## 2026-07-28 (continuación — Fase 4)
- Implementado el grano dependiente de densidad local (aproximación GPU en tiempo real; el modelo riguroso de Newson/Delon/Galerne para exportación queda para más adelante).
- Separada la curva característica en dos passes (densidad / vista previa) para que el grano pueda perturbar la densidad real antes de convertirla en imagen.
- Verificado numéricamente (leyendo píxeles del canvas) que la visibilidad del grano tiene forma de campana: máxima en medios tonos, mínima en negro puro y luces quemadas.
- Al investigar un falso positivo de "ruido en sombras", se encontró un error en mi propia medición (no en la app) — corregido el método de medición y confirmado que el grano funciona bien. De paso se mejoró la extrapolación de la curva en sombras extremas (asintótica en vez de lineal), con 3 tests nuevos de regresión (9 en total).
- Añadido slider de intensidad de grano.
- Pendiente: Fase 5 — simulación de escáner/papel (aquí llega el redondeo real de luces altas).

## 2026-07-28 (continuación — Fase 3)
- Implementado el halation (halo rojo-anaranjado en altas luces, antes de la curva característica).
- Generalizada la arquitectura de passes de cadena lineal a grafo de texturas con nombre (`Pipeline.addStep`), porque el halation necesita la escena original una segunda vez (rama, no cadena simple). Nuevo `CompositePass` para combinar dos texturas dinámicas.
- Pipeline del halo: extracción de altas luces (transición suave) → blur gaussiano horizontal → blur gaussiano vertical → suma con la escena.
- Probado con una escena nocturna simulada: halo visible y proporcional al tamaño/brillo de cada luz. Probado también que las imágenes normales y el control de exposición de la Fase 2 siguen funcionando bien.
- Documentado con honestidad que el umbral/tinte/intensidad del halo son aproximaciones razonables, no datos de datasheet (Kodak no publica eso).
- Pendiente: Fase 4 — grano físico (aproximación en tiempo real primero, modelo riguroso para exportación después).

## 2026-07-28
- Primera sesión. Revisados los archivos existentes del proyecto (`CLAUDE.md`, guía de memoria).
- Creada la carpeta `docs/` con los cuatro archivos de memoria (`README.md`, `STATUS.md`, `progress.md`, `decisions.md`).
- Montado el proyecto base con Vite + TypeScript + WebGPU.
- Implementada la Fase 1 (esqueleto): drag & drop de imagen, contexto WebGPU, arquitectura de passes extensible (`Pass`/`FullscreenPass`/`Pipeline`), primer pass sRGB→lineal→sRGB, y vista de debug lado a lado.
- Probado en navegador con una imagen de test: el resultado es visualmente idéntico al original, sin errores en consola.
- Corregido bug de CSS que hacía visible el panel de resultados antes de cargar ninguna imagen.
- El usuario aclaró la visión final del producto: editor tipo Adobe Camera Raw (panel lateral de parámetros, selector de film stocks, comparativa A/B con slider) desplegado en Vercel. Anotado en `README.md` y `decisions.md` — no cambia el orden de fases, es la Fase 6.
- Implementada la Fase 2 (curva característica H&D de Portra 400):
  - Descargado el datasheet oficial de Kodak (E-4050) y digitalizados por análisis de píxeles los puntos reales de densidad de los canales R, G, B.
  - Hallazgo: el negativo real no tiene redondeo de luces altas, solo compresión de sombras (toe) — el roll-off de luces viene del papel/escáner (Fase 5). Decisión con el usuario: usar solo datos reales ahora, sin inventar nada.
  - Curva implementada como interpolación cúbica monótona + LUT en GPU (`rgba32float`, 512 muestras), con extrapolación lineal fuera del rango medido.
  - Pipeline pasado a 2 passes (decodificar a lineal → curva característica), con texturas intermedias en `rgba16float` para no recortar valores en el camino.
  - Control de exposición por slider (en pasos), ligado al `Log H Ref` real del datasheet.
  - Tests numéricos con Vitest contra los datos digitalizados (monotonía, toe real, orden de canales, extrapolación).
  - Corregido un error de signo que dejaba la vista previa como un negativo literal (colores y tonos invertidos).
  - Probado en navegador: polaridad correcta, y el velo de sombras se ve claramente al subir la exposición.
- Pendiente: Fase 3 — halation.
