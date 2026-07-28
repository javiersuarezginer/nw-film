# Decisiones

## [2026-07-29] Leyenda técnica del estado eliminada tras cargar la imagen
**Decisión:** Tras procesar una imagen con éxito, `setStatus("")` limpia el mensaje de estado en vez de mostrar `Imagen WxH. Halation + curva Portra 400 + grano + papel Endura aplicados.`. Los demás mensajes de estado (mientras carga, error, mientras corre el render riguroso) se dejan intactos — son información transitoria útil, no una leyenda técnica permanente.
**Por qué:** El usuario lo pidió explícitamente: es una leyenda de depuración de las primeras fases del proyecto (para confirmar visualmente qué se estaba aplicando) que ya no aporta nada a alguien usando la app para editar.
**Verificado:** cargada una imagen, confirmado que la cabecera queda solo con "NW-FILM" a la izquierda, sin texto a la derecha. Sin errores de consola nuevos, 23 tests siguen pasando.
**Revisitar si:** Nunca — es el comportamiento pedido.

## [2026-07-29] Vista lado a lado: dos paneles reales, no un recorte con clip-path
**Decisión:** El visor pasa de tener un único `.canvas-stack` (con original/editada/riguroso superpuestos y alternados por `hidden`) a tener DOS paneles (`#pane-original`, `#pane-processed`), cada uno con su propio `.canvas-stack` interno. En modo normal, los paneles siguen superpuestos exactamente como antes (uno a pantalla completa, el otro oculto, según "Ver original"). El nuevo botón "Lado a lado" añade la clase `.side-by-side` a `#canvas-panes`, que los convierte en un `display:flex` — cada panel pasa a ocupar la mitad del ancho, ambos visibles a la vez. El zoom/arrastre se sigue aplicando por igual a los dos `.canvas-stack` (antes había uno, ahora `applyCanvasTransform` recorre los dos con `querySelectorAll`), así que quedan siempre sincronizados tanto en modo normal como lado a lado.
**Por qué esta forma y no un slider de comparación con `clip-path`:** el usuario pidió explícitamente "ver A y B lado a lado", no un slider deslizante de comparación (eso sería otra función distinta). Dos paneles reales, cada uno mostrando la imagen completa, es la lectura más directa de "lado a lado" — y además es la opción más simple de implementar reutilizando los canvas ya existentes, sin duplicar recursos de GPU.
**Efectos secundarios manejados:** `fitToViewport()` ahora calcula el ancho disponible como la mitad del visor cuando el modo lado a lado está activo (si no, la imagen se ajustaría como si tuviera todo el ancho y se saldría de cada panel). El botón "Ver original" se deshabilita mientras el modo lado a lado está activo (ya se ven las dos a la vez, alternar no tendría sentido).
**Verificado:** cargada una imagen con un parche gris, activado "Lado a lado" (zoom se reajusta a la mitad del ancho, ambos paneles muestran contenido distinto — original más saturado/sin grano a la izquierda, revelado a la derecha), desactivado (vuelve a pantalla completa), y confirmado que "Ver original"/"Ver editada" sigue funcionando en modo normal. Sin errores de consola nuevos, 23 tests siguen pasando.
**Revisitar si:** Nunca — cubre exactamente lo pedido.

## [2026-07-29] Pinch en trackpad detectado como "wheel" con ctrlKey, no como gesto táctil
**Decisión:** El zoom con pinch de trackpad se implementa escuchando el evento `wheel` estándar en `#viewport-frame` y mirando si `e.ctrlKey` está activo — así es como Chrome/Safari/Firefox entregan el gesto de pellizco de trackpad (lo sintetizan como wheel+ctrlKey para distinguirlo del scroll normal de dos dedos). Con `ctrlKey`, se hace `preventDefault()` (si no, el navegador aplicaría su propio zoom de página) y se ajusta el zoom existente vía `setZoomPercent()` — la misma función que ya usaba el slider, así que el pinch y el slider quedan siempre sincronizados.
**Por qué:** No existe una API separada de "gesto de pellizco" en la web — es la forma estándar de detectarlo, la misma que usan Google Maps, Figma, etc.
**Verificado:** eventos `wheel` sintéticos con `ctrlKey: true` y `deltaY` negativo/positivo confirman que el zoom sube y baja en la dirección esperada; un evento `wheel` sin `ctrlKey` (scroll normal) no toca el zoom. Sin errores de consola nuevos, 23 tests siguen pasando.
**Revisitar si:** Nunca — es el mecanismo estándar de la plataforma.

## [2026-07-29] Botón "Exportar" genérico en la barra de herramientas, aparte del "Descargar PNG" del render riguroso
**Decisión:** Nuevo botón "Exportar" en la barra de herramientas del visor, siempre disponible en cuanto hay una imagen cargada. Descarga como PNG lo que se esté viendo en ese momento: el resultado del render riguroso si ya se hizo (`app.mode === "rendered"`), o si no, directamente el preview en tiempo real (`processedCanvas.toDataURL()`, el mismo canvas WebGPU que ya se está mostrando). No sustituye al botón "Descargar PNG" que ya existía junto a "Renderizar grano riguroso" — ese sigue apareciendo solo tras un render riguroso completado, como atajo contextual; el nuevo botón cubre el caso general (exportar sin tener que renderizar el grano riguroso primero).
**Por qué:** El usuario pidió un botón de exportar en la lista de feedback original. Antes solo se podía descargar imagen después de "Renderizar grano riguroso" — no había forma de exportar directamente el preview en tiempo real.
**Verificado:** cargada una imagen, exportado el PNG y comprobado programáticamente que el archivo generado decodifica correctamente, tiene las mismas dimensiones que la imagen (500×400) y contiene color real en el centro (no está en blanco/negro). Botón comprobado que no lanza errores. Sin errores de consola nuevos, 23 tests siguen pasando.
**Revisitar si:** Se decide unificar los dos botones de descarga en uno solo — de momento conviven porque cubren casos ligeramente distintos.

## [2026-07-29] La app abre directamente en el editor — sin pantalla de inicio separada
**Decisión:** Eliminada la pantalla de bienvenida (`#dropzone`) que antes ocupaba toda la ventana antes de cargar una imagen. Ahora `#editor` (cabecera, barra lateral con todos los controles, visor) está siempre visible desde el arranque. Dentro del visor, mientras no hay imagen cargada, se muestra un mensaje ("Arrastra una imagen aquí, o usa 'Abrir imagen'") superpuesto en `#empty-state`, que desaparece la primera vez que se carga una imagen y no vuelve a aparecer (no hay función de "quitar imagen", solo reemplazar). Nuevo botón "Abrir imagen" en la barra de herramientas del visor. El arrastrar-soltar ya no está limitado a la pantalla de bienvenida — funciona sobre todo el visor, tanto para la primera carga como para reemplazar la imagen actual en cualquier momento.
**Por qué:** El usuario lo pidió explícitamente: quiere que los menús estén siempre visibles desde el primer segundo, ya que ahora hay un botón dedicado para abrir/cambiar de imagen — no tiene sentido una pantalla de solo-carga aparte.
**Verificado:** cargada una imagen, comprobado que el mensaje desaparece y los canvas se muestran; arrastrada una SEGUNDA imagen de distinto tamaño encima para confirmar que el reemplazo funciona igual de bien (zoom se reajusta, título de estado se actualiza). Botón "Abrir imagen" comprobado que no lanza errores al pulsarlo. Sin errores de consola, 23 tests siguen pasando.
**Nota técnica:** `fileInput.value` se limpia tras cada `change` para poder volver a elegir el mismo archivo dos veces seguidas (si no, el navegador no dispara `change` la segunda vez porque el valor no cambia).
**Revisitar si:** Nunca — es el comportamiento pedido explícitamente.

## [2026-07-29] Undo/redo aparcado (no descartado)
**Decisión:** El usuario pidió saltarse el punto de undo/redo del bloque de controles nuevos, sin dar motivo — se deja aparcado, no se descarta ni se cierra como "no se va a hacer". Se pasa directamente al bloque de flujo de trabajo (abrir/cambiar imagen, exportar, pinch zoom, A/B lado a lado, quitar leyenda técnica).
**Por qué:** El usuario decide el orden y el alcance del trabajo; no se indagó más porque no hacía falta para seguir avanzando.
**Revisitar si:** El usuario lo vuelve a pedir en cualquier momento — no hay trabajo empezado que deshacer.

## [2026-07-29] Botones de reset: un solo listener delegado, reutilizando el "input" de cada slider
**Decisión:** Cada slider de edición (15 en total) tiene ahora un botón circular "↺" al lado, con `data-reset="<id-del-slider>"` y `data-default="<valor>"` en el propio botón HTML. Un único bloque de JS al final de `main.ts` recorre todos los `.reset-btn`, y al pulsar uno pone `slider.value = defaultValue` y dispara un evento `input` sintético sobre el slider — el mismo listener que ya existía para ese slider (actualizar la etiqueta, escribir el uniform buffer, redibujar) se encarga del resto.
**Por qué:** Con 15 sliders, cablear un `addEventListener` de reset distinto para cada uno habría sido puro copia-pega y una fuente fácil de bugs (olvidar actualizar alguno al añadir un slider nuevo en el futuro). Con el evento `input` sintético, añadir el reset a un slider nuevo el día de mañana es solo añadir el atributo `data-reset`/`data-default` en el HTML — cero JS nuevo.
**Verificado:** Probado por JavaScript (no solo visualmente) cambiando los 15 sliders a valores no por defecto y comprobando que los 15 vuelven a su valor correcto (incluido `-0.7` en exposición, que NO es cero) tras pulsar sus botones. Sin errores de consola nuevos, 23 tests siguen pasando.
**Revisitar si:** Nunca — patrón genérico, escala solo con HTML.

## [2026-07-29] Checkbox de papel sustituido por un desplegable ("Papel")
**Decisión:** La casilla "Simulación de papel Portra Endura" pasa a ser un `<select id="paper-select">` con dos opciones: "Portra Endura" (`value="endura"`) y "Ninguno (vista previa plana)" (`value="none"`). El comportamiento interno no cambia — sigue siendo la misma conmutación entre `scannerPaperPass` y `previewEncodePass` que ya existía (`Pipeline.displayFinal`), solo cambia el control de la interfaz.
**Por qué:** El usuario lo pidió explícitamente porque, aunque hoy solo hay un papel real implementado, una casilla no se puede ampliar con más opciones — un desplegable sí, cuando se añadan más papeles/escáneres en el futuro (fuera de alcance ahora mismo, aparcado como "más películas"). Cambio puramente de interfaz, cero riesgo para el motor.
**Verificado:** alternar entre las dos opciones cambia correctamente el resultado (papel real vs. vista previa plana) y deshabilita el slider "Temperatura del papel" cuando no hay papel activo. Sin errores de consola, 23 tests siguen pasando.
**Revisitar si:** Se añaden papeles/escáneres nuevos — el `<select>` ya está preparado para más `<option>`, solo hace falta la lógica de cada papel nuevo.

## [2026-07-29] Tamaño de grano: la textura fina escala junto al agrupamiento, no como tamaño fijo
**Decisión:** Nuevo slider "Tamaño de grano" (0.3×-3×, sección Grano y nitidez) multiplica `GRAIN_SIZE_FRACTION` antes de convertir a píxeles. Al mismo tiempo, en `grain.wgsl` se cambia `FINE_GRIT_SIZE` (constante fija, 1.1px) por `GRIT_SIZE_RATIO` (0.16 del tamaño de agrupamiento) — así la textura fina interna del grano escala junto con el tamaño general en vez de quedarse fija cuando se agranda mucho el grano.
**Por qué:** Sin este segundo cambio, subir mucho el tamaño de grano habría hecho que los "grumos" crecieran pero mantuvieran siempre la misma arenilla interna de 1.1px — dos escalas desacopladas que no se ven como un único grano más grande, sino como manchas grandes con un patrón fino ajeno encima.
**Verificado:** campo gris uniforme con grano al máximo, tamaño 0.3× vs 3× — a 0.3× el grano es fino y apretado, a 3× son grumos claramente más grandes que conservan su propia textura interna. Sin errores de consola, 23 tests siguen pasando.
**Revisitar si:** Nunca — es el comportamiento esperado del slider.

## [2026-07-29] Saturación/viveza: ajuste digital en las DOS etapas finales, no en el motor físico
**Decisión:** Dos sliders nuevos, "Saturación" y "Viveza" (sección Color), implementados con la misma función `applySaturationVibrance()` duplicada en `scannerPaper.wgsl` y `previewEncode.wgsl` — las dos etapas finales conmutables del pipeline (papel real / vista previa plana). Se aplican en lineal, sobre la imagen positiva YA revelada, justo antes de codificar a sRGB. La viveza reduce su efecto sobre colores que ya están saturados (protege pieles/tonos ya intensos), igual que "Vibrance" en editores conocidos.
**Por qué en las dos etapas finales y no en el motor (p. ej. en `sceneGrade.wgsl`):** aplicarlo en escena (antes de la curva) interactuaría de forma impredecible con la respuesta no lineal de la película — cambiaría también exposición/contraste aparente por canal, no sería "solo saturación". Aplicarlo al final, sobre el color ya revelado, es más parecido a como un fotógrafo ajustaría la saturación en un escaneo o en la impresión (un retoque digital sobre el resultado físico, no una alteración de la física). Se duplica en ambas etapas (no solo la del papel) para que el resultado sea consistente al alternar el checkbox de comparación papel/plano.
**Verificado:** imagen sintética con parches de color saturados — a -100 queda en blanco y negro, a +100 los colores se intensifican claramente; viveza a 100 da un refuerzo más sutil. Probado también con el papel desactivado (vista previa plana): mismo comportamiento, sin errores. 23 tests siguen pasando.
**Revisitar si:** Nunca — es un ajuste de edición puro, coherente con cómo ya se documentan otras constantes no físicas del proyecto.

## [2026-07-29] Suavizado óptico nuevo, ANTES del halation — no confundir con la acutancia
**Decisión:** Nuevo pass `opticalSoftening.wgsl`, insertado justo después de `sceneGrade` y antes del halation (mezcla `mix(original, blur(original), amount)`, con blur gaussiano separable reutilizando `gaussianBlur.wgsl`). Nuevo slider "Suavizado" (0×-2×, por defecto 1×) en la sección Grano y nitidez.
**Por qué aquí y no junto a la acutancia:** son efectos opuestos que representan cosas físicas distintas. La acutancia (`acutance.wgsl`) es un realce de borde químico que pasa DESPUÉS de la curva característica. Este suavizado representa el límite de resolución del objetivo+película (ninguna óptica real resuelve detalle infinito) y por tanto tiene que actuar sobre la luz ANTES de que le pase nada más — antes incluso del halation, para que el halo también se vea afectado por ese límite óptico, no pintado encima con nitidez artificial.
**Por qué se pidió:** el usuario notó que la simulación conserva "un rollo crispy" de las imágenes de IA — microtextura sintética más nítida que cualquier captura física real. `CLAUDE.md` ya preveía este problema en la sección "Capa de IA" (de-texturizado por IA, Fase 7), pero esa fase está deliberadamente aparcada para el final. Este suavizado es una solución física más simple mientras tanto: no usa IA, es 100% determinista, y no bloquea nada de la Fase 7 (cuando llegue, ambas cosas pueden convivir — el de-texturizado por IA sería preprocesado antes de todo el pipeline, este suavizado seguiría representando el límite óptico).
**Verificación:** imagen sintética con ruido de alta frecuencia y líneas finas de 1px — a 0× se ve nítido/crudo, a 2× claramente suavizado, sin errores de consola. Los 23 tests siguen pasando (no toca color science).
**Revisitar si:** Se implementa la Fase 7 (de-texturizado por IA) — entonces conviene revisar si ambos mecanismos juntos suavizan de más y hay que bajar el valor por defecto de este slider.

## [2026-07-29] Grano desacoplado del suavizado óptico: densidad de referencia sin suavizar solo para la visibilidad del grano
**Decisión:** El usuario probó el slider de suavizado y notó que también apagaba el grano en zonas con detalle — no debía. Causa: `grainVisibility()` decide cuánto grano mostrar según la densidad real de cada zona, y esa densidad ya incluía el suavizado (aplicado antes, en la escena). Arreglo: se añade un segundo pass de curva característica (`characteristic-curve-ref`), corriendo sobre `"graded"` (la escena ANTES del suavizado y del halation) en vez de `"sceneWithHalation"`, produciendo `densityRef`. El pass de grano pasa de `FullscreenPass` a `CompositePass` (dos texturas de entrada): sigue sumando la perturbación de grano sobre la densidad REAL (`density`, ya suavizada — el resultado final sí respeta el suavizado), pero decide CUÁNTO grano mostrar mirando `densityRef` (sin suavizar).
**Simplificación aceptada conscientemente:** `densityRef` tampoco incluye el halation (se calcula desde `"graded"`, no desde `"sceneWithHalation"`), para no duplicar todo el cálculo de halation (dos blurs más) solo para esta referencia. Efecto: en las zonas de halo de halation, la visibilidad de grano se decide como si ese halo no estuviera — una diferencia menor y localizada, no lo que el usuario reportó (que era un efecto grande y en toda la imagen). Si en el futuro se nota que el grano se ve raro específicamente en zonas de halation, revisar esto.
**Verificado:** foto de referencia real, grano al máximo, comparado 0× vs 2× de suavizado en la misma zona de piel — antes del arreglo el grano perdía fuerza claramente con más suavizado; después, se mantiene igual de presente en ambos casos, mientras el suavizado sigue notándose en el contorno/tono de la piel. 23 tests siguen pasando.
**Revisitar si:** El usuario nota grano raro en zonas de halo de halation (ver simplificación de arriba), o si se cambia la arquitectura de `grain.wgsl`/`opticalSoftening.wgsl`.

## [2026-07-29] Rediseño del grano en tiempo real: tamaño más grande + capa fina de textura, a partir de una foto de referencia real (no de datasheet)
**Decisión:** Dos cambios en `src/shaders/grain.wgsl`, guardando la foto de referencia del usuario en `docs/reference/portra400-grain-reference.jpg`:
1. El tamaño de grano por canal (`GRAIN_SIZE_FRACTION` en `main.ts`) sube de `{r:0.0022, g:0.0018, b:0.0028}` a `{r:0.0066, g:0.0054, b:0.0084}` (~3×), manteniendo el orden relativo entre canales (verde el más fino, azul el más grueso — justificación física abajo).
2. El ruido ya no es un único `valueNoise` suave (interpolado, aspecto de "nube" difusa). Ahora se suman dos capas: la misma `valueNoise` para el agrupamiento (clumping) de grano + una capa de ruido crudo sin interpolar a tamaño fijo pequeño (`FINE_GRIT_SIZE = 1.1px`) para la textura fina "arenosa". Sin esta segunda capa, el grano se veía como manchas blandas en vez de grano fotoquímico real.
**Cómo se midió el tamaño:** se analizó `docs/reference/portra400-grain-reference.jpg` (690×460, crop real de una foto Portra 400 que mandó el usuario) con un script Python (numpy/PIL, filtro paso-alto + autocorrelación 2D por FFT) sobre varios parches de piel en foco. El grano real mide aproximadamente 5-6px en esa imagen de 690px de ancho (fracción del ancho ≈ 0.007-0.009), notablemente más grande que la fracción anterior (≈0.002).
**Por qué esto NO es lo mismo que la digitalización del datasheet de Kodak (Fase 2):** el datasheet es un dato de laboratorio publicado, con ejes y unidades conocidas — se puede digitalizar con precisión. Esta foto de referencia es un JPEG comprimido de un móvil/red social, con ruido de compresión (subsampling de croma) y textura de piel (poros) mezclados con el grano real, sin escala física conocida (no sabemos el tamaño real del sensor de escaneo ni el aumento). La medición es una guía razonable de orden de magnitud, no un dato preciso — documentado con la misma honestidad que el resto de constantes artísticas del proyecto (halation, acutancia). El orden relativo entre canales (verde más fino, azul más grueso) NO viene de esta medición, que era demasiado ruidosa para fiarse por canal — viene del principio fotográfico real de que la capa sensible al azul (tinte amarillo) suele necesitar cristales de haluro de plata más grandes por ser la menos sensible, dando grano visualmente más grueso; es la misma asunción que ya tenía el código antes de este cambio.
**Verificación:** cargada la propia foto de referencia en la app (a 100% de zoom, mismo tamaño de píxel que el crop original) y comparado visualmente el grano simulado contra el real en la misma zona de piel (nariz/mejilla) — la escala y textura del grano simulado ahora se leen mucho más parecidas al original que antes del cambio.
**Revisitar si:** El usuario, viendo el resultado con más fotos reales, dice que el grano sigue sin verse bien (muy fino, muy grueso, o de carácter distinto) — las constantes (`GRAIN_SIZE_FRACTION`, `FINE_GRIT_SIZE`, `FINE_GRIT_WEIGHT`/`CLUMP_WEIGHT`) son las primeras a tocar. Esto NO toca el modelo de grano riguroso (`booleanGrain.ts`), que sigue pendiente y roto — cuando se retome, conviene revisar si debe heredar esta misma proporción de tamaño.

## [2026-07-28] Exposición por defecto recalibrada a -0.7 pasos (no en 0)
**Decisión:** El valor de partida del slider de exposición pasa de 0.0 a -0.7 pasos (`DEFAULT_EXPOSURE_STOPS` en `main.ts`). El slider sigue teniendo el mismo rango (-3 a +3) y se puede ajustar libremente por imagen — solo cambia dónde empieza.
**Por qué:** El usuario reportó que, con sus fotos reales, el resultado por defecto queda casi 1 punto sobreexpuesto y que "por norma general" tiene que bajar entre -0.5 y -1 para llegar al resultado que busca. La causa de fondo (documentada también en el comentario junto a la constante) es que las imágenes de entrada llegan display-referred — ya "reveladas" para verse bien en pantalla — no como una captura lineal real de la escena. Alimentar la curva característica del negativo sin corregir asume que el gris medio aparente de la imagen coincide con 0.18 lineal, y en la práctica las imágenes de IA/fotos normales suelen tener su tono medio bastante por encima de eso, empujando el punto de trabajo hacia la zona de luces del negativo. -0.7 es el punto medio del rango que reportó el usuario, verificado visualmente en un degradado sintético con una zona de luz clara (a 0 pasos se ve más lavada, a -0.7 se conserva más color y detalle).
**Nota:** esto es un parche de calibración, no la solución de fondo. La solución real a este problema es la reconstrucción de altas luces por IA de la Fase 7 (`CLAUDE.md`, sección "Capa de IA") — cuando se implemente esa fase, hay que revisar si este offset de -0.7 sigue haciendo falta o si debe eliminarse/reducirse porque la reconstrucción ya aporta la información de rango dinámico que falta ahora.
**Revisitar si:** Se implementa la Fase 7 (reconstrucción de altas luces por IA), o si con más fotos reales el punto óptimo resulta distinto de -0.7.

## [2026-07-28] Slider "Temperatura del papel": ajuste manual encima de la calibración automática de canal, no un mecanismo nuevo
**Decisión:** El nuevo slider "Temperatura del papel" (sección Salida) no añade ningún parámetro nuevo al shader `scannerPaper.wgsl`. Reutiliza directamente `offsetR/offsetG/offsetB`, el mecanismo que ya existía para alinear los tres canales en gris neutro en el punto de exposición de referencia (ver decisión de Fase 5 sobre calibración de canal): el valor del slider simplemente suma un delta a ese offset (más rojo/menos azul si es cálido, al revés si es frío), calculado en `main.ts` (`computePaperOffsets`), no en el shader.
**Por qué:** Es exactamente el mismo concepto que el filtro de color (CC) de una ampliadora real — el laboratorista ya tiene una filtración base neutra calculada, y el slider es la corrección manual que añadiría encima. Reutilizar el mecanismo existente evitó tocar el shader, redimensionar su buffer de uniforms o arriesgar una regresión en el render riguroso (que usa la misma fórmula de offsets en `rigorousRender.ts` y ahora también recibe el delta del slider vía `buildRigorousParams`, para que el color no diverja del preview el día que se arregle ese renderizador).
**Por qué la fuerza elegida (`PRINT_TEMPERATURE_STRENGTH = 0.15`):** aproximación a ojo verificada visualmente con una imagen sintética (parche gris pasa de azulado a claramente tostado entre -100 y +100) — no es un dato de datasheet, documentado como tal en el propio código, igual que las demás constantes de "fuerza de edición" del proyecto.
**Nota importante para la próxima sesión:** este slider corrige la calidez de forma uniforme en todo el rango tonal. El usuario reportó que la calidez es muy fuerte específicamente viendo una foto real (piel, con luces altas). Si tras probarlo con su foto la calidez sigue sin controlarse bien en luces altas concretamente, el problema real puede estar en que la calibración de gris solo es exacta en el punto de referencia (gris medio) y diverge en los extremos — eso requeriría revisar la calibración de canal en sí, no solo añadir un offset global.
**Revisitar si:** El usuario prueba con una foto real y la calidez no es controlable de forma pareja en todo el rango tonal (ver nota arriba).

## [2026-07-28] No extraer credenciales del Llavero de macOS por CLI, aunque el usuario ya las tenga guardadas
**Decisión:** Para autenticar con GitHub, nunca leer directamente el valor de una contraseña/token guardado en el Llavero de macOS (comandos como `security find-internet-password -w`) para reutilizarlo a mano en `curl` u otras peticiones. Dejar que sea la propia herramienta que originalmente guardó la credencial (aquí, `git` vía su `credential.helper=osxkeychain`) la que la use directamente cuando la necesite.
**Por qué:** Se intentó extraer el token guardado para crear un repositorio por API directamente. El comando `security -w` requiere el permiso de Acceso al Llavero para el proceso que pregunta — como `security` (ejecutado desde este entorno) no era una app ya autorizada para ese ítem, macOS mostró su propio diálogo nativo pidiendo la contraseña de inicio de sesión del Mac. El usuario, sin contexto de que era un diálogo del sistema operativo y no de GitHub, probó sus contraseñas de GitHub sin éxito — confusión evitable. Además, sacar un secreto de su almacén seguro para moverlo por procesos intermedios (variable de shell, argumento de `curl`) es peor práctica que dejar que la herramienta ya integrada (`git`) lo use internamente sin que el secreto pase nunca por mi contexto.
**Revisitar si:** Nunca — es una regla general de higiene con secretos, no específica de este proyecto.

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
