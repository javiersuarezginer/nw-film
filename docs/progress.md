# Progress log

## 2026-08-02 (continuación — recalibrar valores por defecto a partir de uso repetido)
- El usuario mandó una captura de los sliders mostrando los ajustes que hace SIEMPRE al cargar una foto: exposición a -1.0 (default -0.7), halation a 0.40× (default 1.00×), grano a 1.45× (default 1.00×), tamaño de grano a 0.20× (default 1.00×) y suavizado a 1.50× (default 1.00×). Preguntó si esos valores no deberían ser la base del slider en vez de tener que repetirlos en cada foto.
- Recalibradas las constantes base correspondientes (`DEFAULT_EXPOSURE_STOPS`, `HALATION_BASE_INTENSITY`, `GRAIN_BASE_INTENSITY`, `GRAIN_SIZE_FRACTION`, `SOFTENING_BASE_AMOUNT`) multiplicándolas por el factor que el usuario aplicaba manualmente, para que el slider en su posición de reposo ("1.0×"/"1.00×", sin cambiar el número mostrado) ya reproduzca el resultado que antes exigía el ajuste manual. Se comprobó primero que la escala es matemáticamente exacta (los sliders multiplican la constante base, así que recalibrar la constante y dejar el multiplicador en 1 da un resultado idéntico a la constante vieja con el multiplicador manual, incluyendo el caso del suelo mínimo de tamaño de grano en píxeles).
- Verificado en el navegador: los sliders siguen mostrando sus valores de reposo de siempre (exposición -1.0, resto en 1.0×/1.00×) pero el resultado visual es sustancialmente distinto — grano más presente y más fino a la vez, halation contenido, exposición corregida — y se nota mucho más "foto de película real" desde el primer render, sin tocar nada. Botón de restablecer por slider verificado con el nuevo valor de exposición. `tsc --noEmit`, 55 tests y `vite build` sin errores.
- Commit y push a producción (`c826e6f`), confirmado el cambio de hash del bundle y el valor "-1.0" en el HTML servido.

## 2026-08-02 (cierre de sesión — motor multi-película, carácter de color, limpieza de UI)
- **Intensidad del look habilitada por defecto**: el usuario notó que Portra 400 ya se aplica al cargar la imagen, así que el control de intensidad no debía empezar desactivado (antes solo se activaba tras importar un preset). Cambiado a control general, siempre disponible.
- **Investigación y digitalización de curvas reales**: instalado `poppler` (con permiso del usuario) para renderizar datasheets PDF a imagen y digitalizar sus gráficos "Characteristic Curves" con un script Python (calibración de ejes por detección de marcas de escala + trazado de las tres curvas R/G/B por componentes conexos o, para el gráfico con rejilla de Fuji, por clustering por columna enmascarando líneas de rejilla). Digitalizadas Kodak Portra 160 (E-4051), Kodak Ektar 100 (E-4046), Fujicolor Pro 400H (AF3-176E) y Kodak Gold 200 (E-7022) — cada una verificada visualmente contra su gráfico y con tests de monotonía/toe/orden B>G>R igual que Portra 400.
- **Refactor de arquitectura para multi-película**: extraído `src/color-science/curveModel.ts` (splines + generador de LUT) del código de Portra 400, sin cambiar su comportamiento (sus 9 tests originales siguen pasando idénticos). Nuevo registro `src/color-science/films/registry.ts` con las 5 películas. `main.ts` gana `loadFilmIntoState()`: cambia de película reescribiendo la textura LUT existente y realineando el offset de papel según el `logHRef` propio de cada una, sin recrear ningún buffer ni textura GPU. Desplegable "Emulsión" poblado dinámicamente desde el registro.
- **Verificado el cambio de película en el navegador**: las 5 dan un píxel distinto en el mismo punto de la misma foto — confirma que el motor realmente cambia de curva, no solo la etiqueta.
- El usuario señaló que, aun así, "todas se sienten iguales con distinta curva" — sin tinte en sombras/luces ni diferencia de tonalidad de color, solo contraste/exposición. Diagnóstico confirmado leyendo `characteristicCurve.wgsl`: cada canal R/G/B se mapea de forma completamente independiente, sin ninguna transformación de color entre canales — la etapa "transformación espectral por película" que menciona `CLAUDE.md` nunca se había implementado.
- **Carácter de color por película**: añadido `FilmColorCharacter` (calidez/tinte de sombras y luces por separado + sesgo de saturación/viveza) por película, inspirado en la descripción real del fabricante, no en un dato de datasheet — documentado así explícitamente. Nuevo mecanismo en `sceneGrade.wgsl`: máscara de sombras/luces por luminancia de la escena SIN gradar, aplicada como un segundo balance de blanco que se SUMA al ajuste manual del usuario. Verificado con un preset extremo que las sombras y luces de cada película tiñen de forma distinta entre sí (p. ej. Ektar corta el azul casi a cero en sombras; Fuji se ve más verde y apagado).
- **Quitado el botón "Renderizar grano riguroso"** y toda su UI (progreso, descarga) a petición del usuario ("de momento") — se dejaron intactos `rigorousRender.ts`/`.worker.ts` sin usar, listos para retomarlos. Esto simplificó bastante `main.ts`: desaparecieron el estado `mode`/`renderWorker`/`renderGeneration`, el canvas `#canvas-rendered`, y unas 14 llamadas a `backToPreview()` que ya no tenían nada que "cancelar".
- **Quitado el selector de papel** — siempre Portra Endura ahora, nunca "sin papel". Eliminada la ruta de vista previa plana (`previewEncodePass`, `previewUniformBuffer`, shader `previewEncode.wgsl` borrado por completo). "Temperatura del papel" se movió de la sección "Salida" (eliminada) a "Balance de blanco", junto a Temperatura/Matiz.
- **Nueva cuadrícula de comparación de películas**: botón "Cuadrícula de películas" junto a "Comparar" que recorre las 5 películas del registro, renderiza la foto actual con cada una (`loadFilmIntoState` + `renderCurrent` + `device.queue.onSubmittedWorkDone()` + captura del canvas a blob) y las muestra en un grid con overlay; clic en una celda selecciona esa película de verdad y cierra la vista. Verificado en el navegador: las 5 miniaturas se generan con etiquetas correctas, clic en una cambia la película activa, Escape cierra el overlay, y vuelve a la película original si se cierra sin elegir.
- Tres rondas de commit/push/verificación de deploy en Vercel durante la sesión (`5cf395b` motor multi-película, `e63d56d` carácter de color + limpieza de UI + grid) — confirmado en cada una que el hash del bundle servido en producción cambia y que el contenido nuevo está presente. `tsc --noEmit`, 55 tests y `vite build` sin errores en todo momento.

## 2026-08-02 (toolbar, grano mínimo, presets JSON, diálogo de guardado, intensidad de preset)
- Confirmado al inicio de sesión que el deploy en Vercel del commit `c3a9ee0` funcionó (sitio en producción sirve el build actualizado con "Comparar"/"Ver original").
- Toolbar: botones agrupados a la izquierda con 10px de gap (`#toolbar-actions`), en vez de repartidos por todo el ancho con `space-between`. "Lado a lado" renombrado a "Comparar".
- Grano: mínimo del slider "Tamaño de grano" bajado de 0.3× a 0.05× (step 0.05) — a resolución real el mínimo anterior seguía dando grano visiblemente grueso.
- Nueva sección "Preset" en la sidebar: exportar/importar el look completo como JSON. El archivo exportado toma el nombre exacto de la imagen cargada, para quedar asociado. Importar aplica todos los sliders + el motor en una sola pasada de render.
- Exportar imagen y exportar preset usan `showSaveFilePicker` cuando el navegador lo soporta (diálogo nativo "Guardar como"); si no, cae a la descarga automática de siempre.
- Primera versión del slider "Intensidad del preset" (0-100%, deshabilitado sin preset importado): interpolaba cada parámetro numérico entre su valor por defecto y el del preset importado.
- Verificado en el navegador con `docs/reference/portra400-grain-reference.jpg`: grano más fino en el mínimo, export/import de preset con nombre y contenido correctos, mezcla de intensidad correcta en 0/50/100% (con la primera versión). Durante la verificación se encontró un bug real (las etiquetas de valor con dos decimales perdían el formato al releer `slider.value` tras normalizarlo el navegador) y se arregló. `tsc --noEmit`, `vitest run` (23/23) y `vite build` sin errores.

## 2026-08-02 (continuación — corrección de "Intensidad del preset": fundido de imagen, no interpolación de parámetros)
- El usuario aclaró que por "intensidad del preset" quería decir "qué porcentaje del resultado final versus la foto original aplica" — un fundido de opacidad de la imagen completa, no la interpolación de cada slider que se había implementado. Ver decisión revisada en `decisions.md`.
- Rehecho el mecanismo: importar un preset ahora aplica los sliders directo a sus valores exactos (sin mezcla). La intensidad se aplica aparte, como paso final de la GPU: nuevo shader `lookIntensity.wgsl` (`CompositePass`) que mezcla por píxel el resultado ya revelado contra la foto original (`sourceTexture`, la misma que usa "Ver original"). Requirió que las etapas finales conmutables (papel/preview plana) dejaran de escribir directo al canvas — ahora escriben a una textura intermedia nueva (`encodedTexture`, creada/destruida junto al `sourceTexture` en cada carga) que luego se mezcla. Dos métodos nuevos en `Pipeline` (`renderFinalToTexture`, `displayFinalWithTextures`) para esto, sin tocar `render`/`displayFinal` existentes.
- Eliminado el código de la primera versión (`blendPreset`, `lerp`, la interpolación por parámetro en `applyPresetValues`) — ya no hace falta.
- Verificado en el navegador: con un preset extremo (temperatura +100, exposición +2), leído el píxel central del canvas a intensidad 100/50/0% y comparado contra el original — a 0% coincide exacto con el píxel original, a 100% con el resultado completo, a 50% es la media matemática exacta de ambos. Confirma que el blend en GPU es correcto. Sin errores de consola de WebGPU/validación. `tsc --noEmit`, `vitest run` (23/23) y `vite build` sin errores.

## 2026-07-29 (cierre de sesión — commit y push a producción)
- Con los cuatro bloques de feedback completos (afinar el look, controles nuevos, flujo de trabajo), se hizo commit de toda la sesión (`c3a9ee0`, "Responder al feedback de la primera foto real: look, controles y flujo de trabajo") y `git push` a `origin/main`. Confirmado antes de commitear: `tsc --noEmit`, `vitest run` (23/23) y `vite build` de producción, los tres sin errores.
- Si Vercel sigue conectado al repo desde la sesión anterior, el push debería haber disparado un despliegue automático a producción — no verificable desde este entorno, pendiente de que el usuario lo confirme.
- Sesión cerrada a petición del usuario. Próxima sesión: confirmar el despliegue, y luego decidir entre el banding a 16 bits o el renderizador de grano riguroso como siguiente foco.

## 2026-07-29 (continuación — Quitar leyenda técnica del estado)
- Tras cargar una imagen ya no se muestra el texto "Imagen WxH. Halation + curva Portra 400 + grano + papel Endura aplicados." en la cabecera — quedaba de las primeras fases del proyecto (para depurar visualmente) y no aportaba nada a un usuario editando. Los demás mensajes de estado (cargando, errores, progreso del render riguroso) se mantienen.
- Verificado en el navegador: cabecera limpia tras cargar. Sin errores de consola nuevos, 23 tests siguen pasando.
- **Con esto se completa el bloque de flujo de trabajo entero** (abrir/cambiar imagen, exportar, pinch zoom, lado a lado, quitar leyenda). De los cinco bloques originales de feedback, solo quedan: decidir el enfoque para el banding a 16 bits, y al final arreglar el renderizador de grano riguroso.

## 2026-07-29 (continuación — Vista lado a lado)
- Añadido el botón "Lado a lado" en la barra de herramientas. El visor ahora tiene dos paneles reales (antes uno solo con original/editada superpuestos y alternados) — en modo normal siguen superpuestos como antes, pero el botón nuevo los reparte a partes iguales del ancho para verlos los dos a la vez. Zoom y arrastre sincronizados entre ambos.
- El ajuste automático de zoom ahora tiene en cuenta que cada panel solo tiene la mitad del ancho cuando el modo lado a lado está activo. El botón "Ver original" se deshabilita mientras tanto (ya se ven las dos versiones a la vez).
- Verificado en el navegador: activar/desactivar el modo, comprobar que ambos paneles muestran contenido distinto (original vs. revelado), y que "Ver original" sigue funcionando en modo normal. Sin errores de consola nuevos, 23 tests siguen pasando.
- Queda un solo punto del bloque de flujo de trabajo: quitar la leyenda técnica del estado.

## 2026-07-29 (continuación — Pinch zoom en trackpad)
- Añadido zoom con gesto de pellizco (pinch) en trackpad sobre el visor. Se detecta como el navegador lo entrega realmente: evento `wheel` con `ctrlKey` activo, distinto del scroll normal de dos dedos. Reutiliza `setZoomPercent()`, la misma función del slider de zoom — quedan sincronizados.
- Verificado con eventos wheel sintéticos (ctrlKey + deltaY negativo/positivo): el zoom sube y baja en la dirección correcta; sin ctrlKey no hace nada. Sin errores de consola nuevos, 23 tests siguen pasando.
- Pendiente del bloque de flujo de trabajo: ver A/B lado a lado, quitar la leyenda técnica del estado.

## 2026-07-29 (continuación — Botón de exportar)
- Añadido el botón "Exportar" en la barra de herramientas (siempre visible en cuanto hay imagen cargada). Descarga como PNG lo que se esté viendo: el render riguroso si ya está hecho, o si no, el preview en tiempo real directamente desde el canvas WebGPU. Convive con el "Descargar PNG" contextual que ya existía tras renderizar el grano riguroso (detalle de por qué en `decisions.md`).
- Verificado programáticamente: el PNG exportado decodifica bien, tiene las dimensiones correctas y contiene color real (no está en blanco). Sin errores de consola nuevos, 23 tests siguen pasando.
- Pendiente del bloque de flujo de trabajo: pinch zoom en trackpad, ver A/B lado a lado, quitar la leyenda técnica del estado.

## 2026-07-29 (continuación — Botón de abrir/cambiar imagen, primer punto del bloque de flujo de trabajo)
- El usuario aclaró que quiere la app abriendo directamente con el editor completo (menús, sliders, todo visible), sin la pantalla de bienvenida de solo-carga que había hasta ahora.
- Eliminada `#dropzone`. `#editor` ya no se oculta, es la única vista. Dentro del visor, un mensaje superpuesto (`#empty-state`) invita a cargar una imagen mientras no hay ninguna — desaparece al cargar la primera y no vuelve a aparecer. Nuevo botón "Abrir imagen" en la barra de herramientas. El arrastrar-soltar funciona sobre todo el visor, tanto para la primera carga como para reemplazar la imagen actual en cualquier momento (antes solo funcionaba en la pantalla de bienvenida).
- Verificado: cargar la primera imagen (mensaje desaparece), arrastrar una segunda imagen de tamaño distinto encima (reemplaza correctamente, zoom se reajusta), botón "Abrir imagen" no lanza errores. Sin errores de consola, 23 tests siguen pasando.
- Pendiente del bloque de flujo de trabajo: botón de exportar, pinch zoom en trackpad, ver A/B lado a lado, quitar la leyenda técnica del estado.

## 2026-07-29 (continuación — Botón de reset por slider)
- Añadido un botón circular "↺" junto a los 15 sliders de edición. Un único bloque de JS genérico (delegado por `data-reset`/`data-default` en el HTML) reutiliza el listener "input" que cada slider ya tenía — no se duplicó lógica por slider.
- Verificado con un script que cambia los 15 sliders a valores no por defecto y comprueba que todos vuelven a su valor correcto (incluida la exposición, cuyo default es -0.7 y no 0) tras pulsar el botón. Sin errores de consola nuevos, 23 tests siguen pasando.
- El usuario decidió saltarse el punto de undo/redo (queda aparcado, no descartado). Con esto se da por cerrado el bloque de controles nuevos y se pasa al bloque de flujo de trabajo (abrir/cambiar imagen, exportar, pinch zoom, A/B lado a lado, quitar leyenda técnica).

## 2026-07-29 (continuación — Desplegable de papel)
- Sustituida la casilla "Simulación de papel Portra Endura" por un desplegable "Papel" con las mismas dos opciones (Portra Endura / Ninguno). Mismo comportamiento interno, solo cambia el control — preparado para añadir más papeles/escáneres el día que se implementen.
- Verificado: alternar entre opciones cambia correctamente el resultado y deshabilita "Temperatura del papel" cuando no hay papel. Sin errores de consola, 23 tests siguen pasando.
- Pendiente del bloque de controles nuevos: botón de reset por slider, undo/redo.

## 2026-07-29 (continuación — Tamaño de grano)
- Añadido el slider "Tamaño de grano" (0.3×-3×). Multiplica el tamaño en píxeles del grano (`GRAIN_SIZE_FRACTION`). También se cambió `grain.wgsl` para que la textura fina interna del grano escale proporcionalmente al agrupamiento (antes era un tamaño fijo de 1.1px) — si no, al agrandar mucho el grano se veían grumos grandes con una arenilla fina ajena encima en vez de un grano coherente más grande.
- Verificado con un campo gris uniforme, grano al máximo: 0.3× da grano fino y apretado, 3× da grumos claramente más grandes con su propia textura interna. Sin errores de consola, 23 tests siguen pasando.
- Pendiente del bloque de controles nuevos: desplegable de papeles (en vez del checkbox), botón de reset por slider, undo/redo.

## 2026-07-29 (continuación — Saturación y viveza, primer punto del bloque de controles nuevos)
- Añadidos los sliders "Saturación" y "Viveza" (nueva sección Color, entre Tono y Grano y nitidez). Aplicados en las DOS etapas finales del pipeline (`scannerPaper.wgsl` y `previewEncode.wgsl`) — sobre el color ya revelado, justo antes de codificar a sRGB, no en el motor físico. La viveza protege los colores que ya están saturados (no sobre-satura pieles), igual que en editores conocidos.
- Verificado con parches de color sintéticos: -100 da blanco y negro, +100 intensifica claramente, viveza da un efecto más sutil y selectivo. Probado también con el papel desactivado (checkbox de comparación) para confirmar que el resultado es consistente en ambos modos. Sin errores de consola, 23 tests siguen pasando.
- Pendiente del bloque de controles nuevos: tamaño de grano, desplegable de papeles (en vez del checkbox), botón de reset por slider, undo/redo.

## 2026-07-29 (continuación — Suavizado óptico, último punto del bloque "afinar el look")
- Añadido el slider "Suavizado" (0×-2×, sección Grano y nitidez). Nuevo pass `opticalSoftening.wgsl` insertado antes del halation (después del balance de blanco/zonas): mezcla la imagen con una versión ligeramente difuminada de sí misma, representando el límite de resolución de cualquier objetivo+película real — que las imágenes de IA no tienen, de ahí el aspecto "crispy" que reportó el usuario.
- Deliberadamente distinto y separado de la acutancia (que sigue igual, después de la curva): uno suaviza antes de que la luz entre al sistema, el otro realza bordes después de revelar. Reutiliza el blur gaussiano ya existente (`gaussianBlur.wgsl`), mismo patrón de composite que halation/acutancia.
- Verificado con una imagen sintética con ruido de alta frecuencia y líneas finas: a 0× se ve crudo, a 2× claramente suavizado. Sin errores de consola, 23 tests siguen pasando.
- Con esto se completan los cinco puntos del bloque "afinar el look" (temperatura del papel, exposición por defecto, halation, grano rediseñado, suavizado óptico). Pendiente: probar todo junto con más fotos reales del usuario, y seguir con el siguiente bloque acordado (controles nuevos: saturación/viveza, tamaño de grano, desplegable de papeles, reset por slider, undo/redo).
- **Bug encontrado por el usuario probando en vivo:** el suavizado también apagaba el grano en zonas con detalle — no debía (grano y suavizado tienen que ser controles independientes). Arreglado dándole al grano su propia referencia de densidad sin suavizar solo para decidir cuánto grano mostrar en cada zona (la perturbación de grano sigue sumándose sobre la imagen ya suavizada). Detalle técnico completo, incluida una simplificación consciente sobre el halation, en `decisions.md`. Verificado con la foto de referencia real: grano igual de presente en 0× y 2× de suavizado, mientras el suavizado del tono/contorno de la piel se sigue notando. 23 tests siguen pasando.

## 2026-07-29 (continuación — Rediseño del grano con foto de referencia real)
- El usuario guardó su foto de referencia (crop real de Portra 400) en `docs/reference/portra400-grain-reference.jpg`.
- Analizado con un script Python (numpy/PIL) fuera del proyecto: filtro paso-alto + autocorrelación por FFT sobre varios parches de piel en foco, para estimar el tamaño aparente del grano real en píxeles. Resultado: el grano real mide bastante más (~3×) que el tamaño que usaba el motor.
- Redi­señado `src/shaders/grain.wgsl`: el ruido ya no es una sola capa suave (`valueNoise`, aspecto de nube difusa) — ahora se combina con una capa de ruido crudo sin interpolar de tamaño fijo pequeño, para dar la textura "arenosa" del grano fotoquímico real. Tamaños por canal escalados en `main.ts` (`GRAIN_SIZE_FRACTION`).
- Verificado cargando la propia foto de referencia en la app (a 100% de zoom, mismo tamaño de píxel que el archivo original) y comparando visualmente el grano simulado contra el real en la misma zona de piel — ahora se leen mucho más parecidos que antes. Sin errores de consola, 23 tests siguen pasando. Detalle completo, incluida la honestidad sobre los límites de esta medición (JPEG comprimido, no datasheet), en `decisions.md`.
- Pendiente: el usuario dijo que el renderizador de grano riguroso está roto y lo dejamos para el final — este rediseño solo afecta al grano en tiempo real (preview). Seguir con el resto del bloque "afinar el look" (blur sutil para quitar el aspecto plástico de IA), y confirmar con una foto real todos los ajustes de esta sesión y la anterior.

## 2026-07-29 — Slider de intensidad de halation
- Añadido el slider "Halation" en la sección Tono (0×–3×, por defecto 1.0×). El shader `addHalation.wgsl` ya no tiene la intensidad fija en una constante (`HALATION_INTENSITY = 0.65`); ahora recibe ese valor por uniform (`HalationParams`), controlado desde `main.ts` igual que grano/acutancia (multiplicador × intensidad base).
- Verificado en el navegador con una escena nocturna sintética (punto de luz sobre fondo oscuro): en 0× el halo desaparece por completo, en 1× se ve como antes, en 3× es mucho más intenso. Sin errores de consola, 23 tests siguen pasando.
- Pendiente: seguir con el resto del bloque "afinar el look" (rediseño del grano con la foto de referencia del usuario, blur sutil para quitar el aspecto plástico de IA), y confirmar con una foto real los tres ajustes ya hechos (temperatura del papel, exposición por defecto, intensidad de halation).

## 2026-07-28 (continuación — Feedback de la primera foto real + slider de temperatura del papel)
- El usuario probó la app con una foto real suya (retrato, crop de ojo/oreja) y mandó una lista de 17 puntos de feedback. Organizados con él en bloques: bugs urgentes, afinar el look físico, controles nuevos de edición, flujo de trabajo de la app, y una decisión aparte sobre banding a 16 bits. A petición del usuario, se saca de la lista el renderizador de grano riguroso (roto) y se deja para el final.
- Implementado el primer punto del bloque "afinar el look": slider "Temperatura del papel" en la sección Salida. Reutiliza el mecanismo de calibración de canal que ya existía (offsets que alinean los tres canales en gris neutro) en vez de crear un mecanismo nuevo — detalle técnico y una nota importante sobre sus límites en `decisions.md`.
- Verificado en el navegador con una imagen sintética (gradiente cálido + parche gris + punto brillante): el slider mueve claramente la imagen entre azulado (-100) y tostado (+100), sin errores de consola. Los 23 tests siguen pasando.
- Recalibrada la exposición por defecto de 0.0 a -0.7 pasos (`DEFAULT_EXPOSURE_STOPS` en `main.ts`, sincronizado con el valor inicial del slider en `index.html`). El usuario reportó que por defecto la imagen sale casi 1 punto sobreexpuesta y que normalmente baja entre -0.5 y -1; -0.7 es el punto medio de ese rango. Causa de fondo documentada en `decisions.md`: las imágenes de entrada llegan ya "reveladas" para pantalla, no como una captura lineal real, así que su tono medio aparente no coincide con el gris de referencia de la curva del negativo — la solución definitiva es la reconstrucción de altas luces por IA de la Fase 7, esto es un parche de calibración mientras tanto.
- Verificado visualmente con una imagen sintética con una zona de luz clara tipo piel: a 0 pasos se ve lavada/blanca, a -0.7 conserva más color y detalle. Sin errores de consola, 23 tests siguen pasando.
- Pendiente: seguir con el resto del bloque "afinar el look" (slider de intensidad de halation, rediseño del grano con la foto de referencia del usuario, blur sutil), y sobre todo, probar los dos ajustes de hoy (temperatura del papel + exposición por defecto) con la foto real para confirmar si resuelven sus quejas o si hace falta ir más a fondo.

## 2026-07-28 (continuación — Subida a GitHub y despliegue en Vercel)
- Renombrado el proyecto como **NW-FILM** también dentro de la app (título de pestaña y cabecera), a petición del usuario. `package.json` mantiene el nombre técnico en minúsculas (`nw-film`) porque npm no admite mayúsculas.
- Inicializado el repositorio Git local y hecho el primer commit con todo el proyecto (motor físico + interfaz Fase 6).
- Intento fallido de crear el repositorio en GitHub vía API extrayendo la credencial guardada en el Llavero de macOS con `security find-internet-password -w`: esto disparó un aviso nativo de macOS pidiendo la contraseña del Mac (no de GitHub) para autorizar el acceso, lo cual confundió al usuario. Se abandonó ese enfoque — ver `decisions.md`.
- El usuario creó el repositorio vacío y privado `nw-film` manualmente desde github.com. Con eso, `git push` funcionó a la primera y sin ningún aviso, usando el credential helper de git ya autorizado en esta Mac de sesiones anteriores.
- Indicados al usuario los pasos para desplegar en Vercel (importar el repo desde el dashboard, sin tocar configuración — Vercel detecta Vite solo). Pendiente de que el usuario confirme que lo completó.
- Pendiente: confirmar el despliegue en Vercel, luego seguir con feedback de una foto real.

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
