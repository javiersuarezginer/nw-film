# Decisiones

## [2026-07-28] Temperatura/matiz/luces/sombras/blancos/negros: nuevo pass antes del halation, la exposición no se toca
**Decisión:** Los 6 controles nuevos de la interfaz tipo Camera Raw se implementan en un pass nuevo (`sceneGrade.wgsl`), insertado entre `decodeLinear` y el halation. La exposición (que ya existía) se deja exactamente donde estaba, en `characteristicCurve.wgsl` — solo se reubica visualmente en la barra lateral, junto a los controles nuevos.
**Por qué:** Temperatura/matiz y los ajustes de zona tonal representan decisiones de fotógrafo *antes* de que la luz llegue a la película (filtro de color, iluminación) — no son química fija del negativo, así que van en lineal, antes del halation, dejando intacta toda la física posterior (halation, curva, grano, papel). Mover la exposición existente al nuevo pass habría sido technically más "limpio" (una sola fuente de verdad para todo lo relacionado con log-exposure) pero tocaba `characteristicCurve.wgsl`, que ya tiene tests numéricos contra el datasheet real — se prefirió el cambio de menor riesgo.
**Revisitar si:** En algún momento se decide unificar toda la lógica de exposición en un solo sitio; entonces sí tendría sentido mover el slider de exposición al pass `sceneGrade` y simplificar `characteristicCurve.wgsl`.

## [2026-07-28] Luces/sombras/blancos/negros comparten un único mecanismo (offset en dominio log ponderado por máscara), con máscaras de distinta anchura
**Decisión:** En vez de 4 fórmulas distintas, los 4 controles usan la misma idea — convertir a "stops" relativos al gris medio, añadir un offset ponderado por una máscara `smoothstep` — y solo cambia dónde se centra y de qué anchura es esa máscara: luces/sombras usan una zona ancha (mitad superior/inferior del rango), blancos/negros una zona estrecha concentrada justo en los extremos.
**Por qué:** Simplicidad — un solo mecanismo reutilizado en vez de cuatro implementaciones distintas, y produce el comportamiento esperado (blancos/negros solo tocan la punta de la curva) sin necesidad de un remapeo de extremos más complejo. Las constantes de anchura/fuerza son aproximaciones de herramienta de edición, no datos de datasheet — documentado honestamente en el propio shader, igual que ya se hace con halation/grano/acutancia.
**Revisitar si:** Con fotos reales el efecto de blancos/negros se nota demasiado sutil o demasiado fuerte — ajustar las constantes `EXTREME_ZONE_LOW/HIGH` y `EXTREME_SCALE` en `sceneGrade.wgsl`.

## [2026-07-28] Grano riguroso: cada muestra Monte Carlo debe ser una realización independiente del campo de grano
**Decisión:** En el modelo booleano riguroso, las N muestras Monte Carlo de un mismo píxel usan cada una su propia semilla (y por tanto su propia colocación aleatoria de granos), no solo un punto de consulta distinto sobre el MISMO campo de grano ya fijado.
**Por qué:** El radio de grano es, a propósito, mayor que un píxel de salida (para que el grano se vea). Si las N muestras solo movieran el punto de consulta pero preguntaran siempre a la misma colocación determinista de granos, casi todas caían dentro o fuera del mismo grano cercano a la vez — la media salía casi binaria (0 o 1), viéndose como "confeti" de colores saturados en vez de grano real. Promediar sobre realizaciones independientes sí converge a la probabilidad de cobertura real, sea cual sea el tamaño del grano relativo al píxel. Bug encontrado y corregido en sesión de pruebas; el usuario ayudó a diagnosticarlo con una pregunta sobre si tenía que ver con la resolución en píxeles de la imagen (no era la causa raíz, pero apuntaba en la dirección correcta: el tamaño del grano relativo al píxel).
**Revisitar si:** Se cambia el mecanismo de muestreo del grano riguroso (por ejemplo, a integración analítica de área en vez de Monte Carlo puro).

## [2026-07-28] Texturas del pipeline con `COPY_SRC` siempre activado
**Decisión:** Todas las texturas internas nombradas del pipeline (`Pipeline.getOrCreateTexture`) se crean con el uso `COPY_SRC` además de `RENDER_ATTACHMENT`/`TEXTURE_BINDING`.
**Por qué:** El render riguroso necesita volver a leer la textura de densidad a la CPU para pasársela al Web Worker. Sin `COPY_SRC`, `copyTextureToBuffer` falla en validación de forma silenciosa (sin lanzar una excepción JS capturable), devolviendo datos vacíos — un bug real que costó tiempo diagnosticar. Es barato tener el flag siempre activo.
**Revisitar si:** Nunca — coste insignificante, evita una clase entera de fallos silenciosos.

## [2026-07-28] Orden de trabajo tras la Fase 5: acutancia → grano riguroso → UI
**Decisión:** Se deja "más emulsiones" aparcado por ahora. El orden acordado es: (1) difusión/acutancia, (2) modelo de grano riguroso para exportación, (3) interfaz tipo Camera Raw (panel lateral de parámetros, zoom con lupa/slider, botón A/B).
**Por qué:** Difusión/acutancia era la pieza más pequeña que quedaba del motor físico ya empezado; el grano riguroso es la más costosa técnicamente (necesita ejecutarse aparte); la UI es la más visible pero tiene sentido construirla sobre un motor ya completo, seleccionable en cada momento por el usuario si quiere reordenar.
**Revisitar si:** El usuario pide cambiar el orden — ya ha ocurrido una vez (revisar decisiones anteriores de fecha 2026-07-28 sobre el orden de fases) y es normal que vuelva a pasar.

## [2026-07-28] Difusión/acutancia como unsharp mask en densidad, con radio pequeño
**Decisión:** El efecto de borde (adjacency/Eberhard) se modela restando de la densidad una versión suavizada de sí misma (`density + amount*(density - blur(density))`), con un radio mucho más pequeño que el del halation (pensado para representar difusión entre capas, no "nitidez" general).
**Por qué:** Es la forma estándar y bien fundamentada de simular este efecto real de revelado químico; reutiliza el blur gaussiano separable que ya existía para el halation, sin necesitar un shader de blur nuevo.
**Revisitar si:** Nunca — es la técnica correcta para este efecto.

## [2026-07-28] Curva del papel Portra Endura: una sola curva compartida R/G/B
**Decisión:** El gráfico real de Kodak (E-4021) muestra las curvas R/G/B del papel casi superpuestas (a diferencia de la película, donde estaban claramente separadas). En vez de forzar una separación poco fiable a partir de píxeles ambiguos, se usa una única curva de densidad compartida para los tres canales.
**Por qué:** Es más honesto que inventar una separación que los propios datos de Kodak no muestran con claridad. La diferencia real entre canales en este papel es pequeña.
**Revisitar si:** Se consigue una fuente de datos con mayor resolución donde sí se puedan separar de forma fiable.

## [2026-07-28] Densidad del negativo alimenta directamente la curva del papel
**Decisión:** El eje "log exposure" del gráfico de Kodak del papel está invertido (3.0 a 0.0) y corresponde a una cuña de densidades calibrada — en la práctica, es lo mismo que la densidad de un negativo real atenuando la luz de impresión. Por eso `scannerPaper.wgsl` alimenta la curva del papel directamente con `3.0 - densidadDelNegativo`, sin pasar por ningún cálculo adicional de exposición real.
**Por qué:** Es matemáticamente equivalente a cómo funciona una ampliadora real (la luz atraviesa el negativo y su densidad la atenúa), y evita inventar una conversión de unidades que Kodak ya resolvió al diseñar el propio gráfico así.
**Revisitar si:** Nunca — es una equivalencia física, no una aproximación.

## [2026-07-28] Calibración de canal alineada en el punto de exposición de referencia
**Decisión:** Antes de consultar la curva del papel, cada canal (R/G/B) se desplaza con un offset fijo para que los tres den el mismo valor en el punto de exposición de referencia de Kodak (Log H Ref). Así un gris neutro de la escena no sale con dominante de color después del papel.
**Por qué:** Cada capa de tinte del negativo tiene un nivel de densidad base distinto (ver dMin/dMax de `characteristicCurve.ts`); sin esta calibración, el papel exageraría esas diferencias en vez de compensarlas — justo lo que hace el filtro de color de una ampliadora real en un laboratorio.
**Revisitar si:** Se prueba con fotos reales y aparecen dominantes de color molestos en otros tonos — se podría pasar a una calibración por tramos en vez de un offset constante.

## [2026-07-28] Etapa de salida conmutable (papel real vs. vista previa plana)
**Decisión:** Se añadió `Pipeline.displayFinal()` para poder ejecutar la etapa final del pipeline (papel real o el placeholder anterior) sin recalcular el resto — con un checkbox en la UI para alternar entre las dos.
**Por qué:** `CLAUDE.md` pide explícitamente que la simulación de salida sea "una etapa separada y conmutable". De paso, sirve para comparar visualmente el antes/después y confirmar que el papel de verdad mejora el resultado.
**Revisitar si:** Se añadan más perfiles de salida (por ejemplo, distintos escáneres) — el mismo mecanismo sirve para eso.

## [2026-07-28] Curva característica dividida en "densidad" + "vista previa"
**Decisión:** El pass de la curva característica ya no convierte directamente a imagen visible. Ahora produce solo densidad (`characteristicCurve.wgsl`), y un pass nuevo y separado (`previewEncode.wgsl`) hace la normalización + codificación a sRGB para pantalla.
**Por qué:** El grano tiene que perturbar la densidad real, antes de que se convierta en vista previa — si el grano se aplicara sobre la imagen ya "revelada" sería un filtro cosmético superpuesto, justo lo que el proyecto quiere evitar. Separar los passes respeta el orden físico del pipeline (curva → grano → ... → vista final).
**Revisitar si:** Nunca — es la forma correcta de encajar el grano en el pipeline.

## [2026-07-28] Extrapolación asintótica (no lineal) en el toe de sombras extremas
**Decisión:** Por debajo del rango medido por Kodak, la curva ahora se aproxima suavemente a una asíntota (con un margen de densidad configurable, 0.15 por defecto) en vez de continuar en línea recta sin límite.
**Por qué:** La extrapolación lineal podía, en teoría, dar densidades negativas en subexposición extrema (físicamente imposible) y amplificaba más de lo necesario pequeñas diferencias de exposición en sombras muy oscuras. La curva real de una película sigue aplanándose más allá de donde Kodak la midió, así que una asíntota es más fiel a la física que una recta infinita. (Nota: al investigar esto se pensó inicialmente que había un bug de ruido visible en sombras; resultó ser un error de medición propio, no un problema real de la app — pero la mejora de la extrapolación se mantuvo por ser correcta igualmente.)
**Revisitar si:** Se consiguen datos reales de la zona de sombras extremas que permitan sustituir esta asíntota por algo medido.

## [2026-07-28] Grano: aproximación GPU en tiempo real ahora, modelo riguroso más adelante
**Decisión:** Esta fase solo implementa la aproximación rápida de grano (ruido por hash, perturbando densidad, con visibilidad en forma de campana según densidad local). El modelo riguroso de partículas booleanas (Newson/Delon/Galerne) que pide `CLAUDE.md` para exportación de calidad queda pendiente para una fase dedicada, probablemente en un worker o servidor por su coste computacional.
**Por qué:** Es exactamente el plan de fases que ya estaba escrito en `CLAUDE.md` — validar primero que el efecto se ve y se comporta bien en tiempo real, antes de invertir en el modelo caro.
**Revisitar si:** Se aborda la fase de exportación de alta calidad.

## [2026-07-28] Pipeline como grafo de texturas con nombre, no cadena lineal
**Decisión:** `Pipeline` pasó de encadenar passes con ping-pong genérico a un grafo de texturas con nombre (`addStep(pass, inputs, output)`), donde cualquier paso puede leer la salida de cualquier paso anterior por nombre, no solo la inmediatamente previa.
**Por qué:** El halation necesita la escena original (de antes del halo) Y el halo ya difuminado al mismo tiempo, para sumarlos — eso es una rama real en el grafo de dependencias, no una cadena. El ping-pong de 2 texturas no podía representar eso.
**Revisitar si:** El número de texturas intermedias vivas a la vez crece mucho con imágenes grandes (cada textura nombrada ocupa memoria GPU aparte; con imágenes de 50MP en `rgba16float` cada una pesa cientos de MB). Si se vuelve un problema, valorar pooling/reciclado de texturas en vez de una textura fija por nombre.

## [2026-07-28] Umbral, tinte e intensidad del halation: aproximación artística, no datasheet
**Decisión:** El halo de halation usa un umbral de brillo, un color rojo-anaranjado y una intensidad elegidos a ojo (documentados como tal directamente en los shaders `halationSource.wgsl` y `addHalation.wgsl`), no valores sacados de una publicación de Kodak.
**Por qué:** A diferencia de la curva característica (Fase 2), Kodak no publica una curva espectral de la base anti-halo ni un radio de halo — no existe un dato real digitalizable equivalente. Inventar una precisión que no existe sería peor que ser honesto sobre que es una aproximación razonable.
**Revisitar si:** Aparece una referencia real (paper técnico, medición propia) que permita sustituir estos valores por datos reales.

## [2026-07-28] El redondeo de luces altas NO va en la curva del negativo
**Decisión:** La curva característica H&D de Portra 400 (Fase 2) se implementa con los datos reales del datasheet de Kodak (E-4050) tal cual son: compresión en sombras (toe), luces casi rectas sin ningún redondeo. No se inventa ninguna compresión de luces altas en esta fase.
**Por qué:** Al digitalizar el gráfico oficial de Kodak se comprobó que el negativo real no tiene "hombro" visible en el rango medido — las tres curvas (R, G, B) suben en línea recta hasta donde llega el gráfico. El "roll-off" de luces que la gente asocia visualmente a Portra viene de la conversión negativo→positivo (papel RA-4 o escáner Frontier/Noritsu), que es una fase posterior y separada del pipeline (Fase 5). Inventar una compresión de luces aquí sería falsear datos que el proyecto se comprometió a no falsear.
**Revisitar si:** Se consiguen datos reales de la curva de la fase de papel/escáner — ahí sí corresponde modelar el redondeo de luces.

## [2026-07-28] Curva característica como LUT en GPU, generada por interpolación cúbica monótona
**Decisión:** Los 52 puntos digitalizados del datasheet se interpolan con splines cúbicos monótonos (método Fritsch-Carlson, sin overshoot) para generar una LUT de 512 muestras (`rgba32float`) que se sube a la GPU y se consulta con interpolación manual en el shader (`textureLoad` + `mix`, no sampler filtrado, para evitar depender de la extensión `float32-filterable`).
**Por qué:** Es la forma más fiel de representar una curva medida por sensitometría real (no es la misma categoría que un "LUT de color" genérico que el proyecto rechaza — aquí la tabla ES literalmente el dato científico digitalizado, con extrapolación lineal fuera del rango medido para no recortar en seco al mover la exposición).
**Revisitar si:** Se necesite mezclar esta curva con la de otras películas de forma continua (por ejemplo, para un slider entre dos emulsiones); ahí convendría revisar el formato de LUT.

## [2026-07-28] Texturas intermedias del pipeline en `rgba16float`
**Decisión:** Las texturas que pasan de un pass a otro dentro del pipeline usan formato `rgba16float`, distinto del formato del canvas (que sigue siendo el preferido del navegador, normalmente 8 bits).
**Por qué:** El espacio de trabajo interno es lineal y sin recortar (principio innegociable del proyecto); un formato de 8 bits en las texturas intermedias recortaría a 0–1 y rompería la exposición y cualquier valor por encima de blanco.
**Revisitar si:** Nunca — es necesario mientras el pipeline sea lineal.

## [2026-07-28] Sistema de memoria en docs/
**Decisión:** Usar la carpeta `docs/` (README, STATUS, progress, decisions) como memoria persistente entre sesiones de Claude Code.
**Por qué:** Claude Code no recuerda nada entre sesiones; con estos archivos se retoma el contexto en segundos sin tener que reexplicar el proyecto.
**Revisitar si:** El proyecto crece tanto que estos 4 archivos se quedan cortos.

## [2026-07-28] Look 100% físico y determinista, sin IA generativa
**Decisión:** El resultado visual final (el "look" de la película) se calcula siempre con el mismo pipeline matemático/físico. La misma imagen y los mismos parámetros dan siempre el mismo resultado píxel a píxel.
**Por qué:** Es la diferencia central frente a editores tipo "LUT + grano encima". La IA generativa introduciría variabilidad y perdería la fidelidad física que es la propuesta de valor del proyecto.
**Revisitar si:** Nunca, es un principio innegociable del proyecto (ver `CLAUDE.md`).

## [2026-07-28] Todo el procesamiento corre en GPU en el cliente
**Decisión:** El pipeline de revelado corre en tiempo real en el navegador vía WebGPU, sobre imágenes de 20–50 MP. Única excepción: el modelo riguroso de grano, que puede usar render diferido en export.
**Por qué:** Da una experiencia interactiva (ver los cambios al momento) sin depender de un servidor para cada ajuste.
**Revisitar si:** WebGPU no da el rendimiento necesario en la práctica; entonces se evaluaría un fallback WebGL2.

## [2026-07-28] Espacio de trabajo interno en float lineal (scene-referred)
**Decisión:** Decodificar sRGB a lineal al importar, operar siempre en lineal, y codificar a sRGB solo en la salida final.
**Por qué:** Las operaciones físicas (exposición, halation, curva característica) solo tienen sentido matemático en espacio lineal; aplicarlas sobre valores gamma-encoded da resultados incorrectos.
**Revisitar si:** Nunca, es un principio innegociable del proyecto.

## [2026-07-28] La IA es preprocesado, nunca el look, y es la última fase
**Decisión:** La IA (p. ej. Nano Banana) solo se usa antes del pipeline físico, para reconstruir altas luces quemadas, de-texturizar el look plástico de IA, o inpainting dirigido por el usuario — nunca para generar el look final. Se ejecuta una sola vez por imagen y el resultado se cachea; reexportar no vuelve a llamar a la API. Es la última fase del proyecto y no bloquea nada anterior.
**Por qué:** Mantiene el look determinista y evita coste/latencia de API en cada ajuste de revelado.
**Revisitar si:** Cambia el proveedor de IA (evaluar Flux + inpainting u otros); la interfaz debe estar encapsulada para poder cambiarlo sin tocar el resto del pipeline.

## [2026-07-28] Arquitectura de passes con texturas ping-pong
**Decisión:** Cada pass del pipeline implementa una interfaz común (`Pass`) y se ejecuta a través de una clase `Pipeline` que encadena los passes usando dos texturas intermedias alternas (ping-pong). El último pass siempre escribe directo al canvas.
**Por qué:** Permite añadir un pass nuevo (halation, curva característica, grano...) sin tocar los demás ni la lógica de encadenado — solo se añade a la lista con `pipeline.addPass(...)`.
**Revisitar si:** Se necesite un grafo de passes no lineal (por ejemplo, un pass que combine dos entradas a la vez, como el halation mezclando con la imagen base).

## [2026-07-28] Deploy en Vercel
**Decisión:** La app se despliega en Vercel, igual que otros proyectos del usuario.
**Por qué:** Es una web app estática (Vite) sin backend, encaja directo con el flujo de deploy que el usuario ya usa. WebGPU necesita HTTPS, que Vercel sirve por defecto.
**Revisitar si:** En algún momento se necesita un backend real (por ejemplo, para la Fase 7 de IA si se decide no llamar a la API directamente desde el cliente).

## [2026-07-28] Visión de UI final: editor tipo Camera Raw
**Decisión:** La interfaz final tendrá panel lateral de parámetros, selector de film stocks, y comparativa A/B con slider. Esto es explícitamente la Fase 6 del roadmap — no se adelanta antes de tener el motor físico (curva, halation, grano, escáner) funcionando.
**Por qué:** El usuario quiere una herramienta de edición seria, no solo una demo técnica. Pero el proyecto vive o muere por si el look físico convence, así que ese sigue siendo el criterio de éxito antes de invertir en UI.
**Revisitar si:** Nunca — es coherente con el orden de fases ya definido en `CLAUDE.md`.

## [2026-07-28] Stack: Vite + TypeScript + WebGPU (WGSL)
**Decisión:** Sin frameworks pesados de estado por ahora; core de render desacoplado de la UI.
**Por qué:** Mantener el proyecto simple mientras se valida la parte difícil (el pipeline físico), antes de invertir en arquitectura de UI.
**Revisitar si:** La complejidad de la UI (presets, gestión de proyecto) lo justifique en la Fase 6.
