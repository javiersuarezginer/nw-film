# STATUS — 2026-08-02

## Estado general
Motor físico completo + interfaz tipo Camera Raw funcional (Fase 6). El proyecto está en GitHub, privado, como **NW-FILM** (repo `javiersuarezginer/nw-film`), con despliegue automático en Vercel confirmado tras el push del `c3a9ee0` (sitio en producción sirve el build actualizado).

El usuario probó la app con su primera foto real y mandó una lista de 17 puntos de feedback. Los cuatro bloques de esa lista ya estaban completos (ver sesión anterior); esta sesión añadió cinco mejoras nuevas pedidas aparte, todas de interfaz/flujo de trabajo, ninguna toca el motor de revelado.

## Último trabajo realizado
- Toolbar: los cuatro botones de acción (Abrir imagen, Exportar, Ver original, Comparar) ahora están agrupados a la izquierda con 10px de separación entre ellos (`#toolbar-actions`), en vez de repartidos con `space-between` por todo el ancho. "Lado a lado" renombrado a "Comparar".
- Grano: el mínimo del slider "Tamaño de grano" baja de 0.3× a 0.05× (step 0.05) — el mínimo anterior seguía dando un grano visualmente grueso en fotos de resolución real; el suelo físico en píxeles (`GRAIN_SIZE_MIN_PX = 1.2`) no cambia.
- Presets en JSON: nueva sección "Preset" en la barra lateral con Importar/Exportar. El JSON exportado toma el nombre exacto de la imagen cargada (p. ej. `boda.jpg` → `boda.json`) para quedar asociado visualmente en el sistema de archivos. Importar aplica el preset entero salvo el papel (ver más abajo) y sincroniza todos los sliders + el motor en una sola pasada (no un render por slider).
- Diálogo de guardado nativo: exportar imagen y exportar preset usan `showSaveFilePicker` (Chrome/Edge) para elegir dónde guardar; en navegadores sin soporte (Firefox, Safari) cae automáticamente a la descarga directa de siempre, sin romper nada.
- Intensidad del preset: slider 0–100% que interpola cada parámetro numérico entre su valor por defecto y el valor del preset importado (energy_math: `lerp(default, preset, intensidad/100)`). Deshabilitado hasta que se importa un preset. El papel (`paper-select`) es una elección discreta y se aplica entero al importar, sin mezclar — a 0% de intensidad todos los sliders numéricos vuelven a su valor por defecto pero el papel elegido por el preset se mantiene (documentado como decisión de diseño, revisar con el usuario si prefiere que también se revierta).
- Verificado en el navegador con la imagen de referencia real (`docs/reference/portra400-grain-reference.jpg`): grano visiblemente más fino en el mínimo del slider, export/import de preset con contenido y nombre de archivo correctos, mezcla de intensidad correcta en 0/50/100%. Se encontró y arregló un bug real durante la verificación (ver abajo). `tsc --noEmit`, `vitest run` (23/23) y `vite build` sin errores.

## Bug encontrado y arreglado esta sesión
Al aplicar un preset, las etiquetas de valor con dos decimales (grano, tamaño de grano, acutancia, suavizado, halation, exposición) se leían de vuelta desde `slider.value` después de asignarle un string tipo `"1.00"` — los `<input type="range">` normalizan ese valor internamente y lo devuelven como `"1"`, así que la etiqueta perdía el formato (mostraba "Halation: 1×" en vez de "1.00×"). Arreglado usando directamente el string ya formateado para la etiqueta, sin releerlo del slider.

## Próxima acción
1. Decidir con el usuario el enfoque para el banding a 16 bits: dithering (más simple) vs. salida de mayor precisión (más ambicioso, no garantizado en todos los navegadores).
2. Al final: diagnosticar y arreglar el renderizador de grano riguroso (roto, bug confirmado por el usuario) — y revisar si debe heredar el suavizado óptico, el tamaño de grano nuevo, y la saturación/viveza del preview.
3. Cuando haya ocasión: probar todos los ajustes del bloque "afinar el look" con más fotos reales del usuario.
4. Si el usuario retoma undo/redo más adelante: no hay nada empezado, se plantea desde cero.
5. Confirmar con el usuario si el papel del preset debería revertir a su valor por defecto a intensidad 0%, en vez de quedarse fijo al valor del preset (ver decisión de diseño arriba).

## Blockers
Ninguno.

## Para revisar
- El grano riguroso no funciona (bug confirmado por el usuario, pendiente de diagnosticar — deliberadamente para el final). Ninguno de los cambios de esta sesión lo toca (todos son del preview en tiempo real); cuando se arregle, revisar si debe incorporar suavizado óptico, saturación/viveza, y la nueva forma de decidir visibilidad de grano.
- El slider de temperatura del papel corrige de forma uniforme en todo el rango tonal; si la calidez en luces altas de una foto real no se controla bien con él, revisar la calibración de canal.
- La exposición por defecto de -0.7 es un parche de calibración, no la solución de fondo — reevaluar cuando llegue la Fase 7 de reconstrucción de altas luces por IA.
- El slider de halation solo controla la intensidad, no su radio/tamaño.
- El tamaño de grano se calibró con UNA foto de referencia comprimida (JPEG, no datasheet) — puede necesitar ajuste fino con más fotos reales.
- La referencia de densidad que usa el grano para decidir su visibilidad (`densityRef`) no incluye el halation (por coste) — si se nota el grano raro específicamente en zonas de halo, revisar eso (ver `decisions.md`).
- Banding en sombras/negros a 8 bits — pendiente decidir dithering vs. mayor profundidad de salida.
- Blancos/negros y demás controles de `sceneGrade.wgsl` probados solo visualmente en sintético — confirmar con foto real.
- El diálogo nativo de guardado (`showSaveFilePicker`) solo existe en navegadores Chromium; no se ha podido probar el flujo de gesto de usuario real end-to-end en este entorno (los clics disparados por script no cuentan como gesto de usuario y activan el fallback de descarga automática) — comportamiento esperado y estándar, pero pendiente de que el usuario confirme que el diálogo se abre en su navegador real.
- El campo `paper` del preset no se mezcla con la intensidad (se aplica entero al importar) — ver "Próxima acción" punto 5.
