# STATUS — 2026-08-02

## Estado general
Motor físico completo + interfaz tipo Camera Raw funcional, y ahora **multi-película**: además de Kodak Portra 400 (la única que había), el motor soporta Kodak Portra 160, Kodak Ektar 100, Fujicolor Pro 400H y Kodak Gold 200, cada una con su curva característica digitalizada de su datasheet oficial y su propio carácter de color. El proyecto está en GitHub, privado, como **NW-FILM** (repo `javiersuarezginer/nw-film`), con despliegue automático en Vercel confirmado tras el push del commit `e63d56d` (sitio en producción sirve el build actualizado).

Sesión larga con varios bloques de trabajo encadenados: corrección del mecanismo de "intensidad" (ver `decisions.md`), motor multi-película desde cero (investigación + digitalización de 4 curvas reales + refactor de arquitectura), carácter de color por película, y una ronda de limpieza/simplificación de la interfaz (fuera render riguroso y selector de papel, dentro una cuadrícula de comparación entre películas).

## Último trabajo realizado
- **Intensidad del look**: habilitada por defecto (antes solo se activaba tras importar un preset) — Portra 400 ya se aplica al cargar la imagen, así que no tenía sentido que el control de intensidad empezara desactivado. Sigue siendo un fundido de imagen completa (0% = foto original, 100% = look completo), no una interpolación de sliders.
- **Motor multi-película**: extraído el ajuste de curva característica a un módulo compartido (`src/color-science/curveModel.ts`), reutilizado por las cinco emulsiones sin cambiar el comportamiento de Portra 400 (sus tests originales siguen pasando igual, byte a byte). Cada película nueva vive en su propia carpeta (`portra160/`, `ektar100/`, `fujiPro400h/`, `gold200/`) con su curva digitalizada de su datasheet oficial (Kodak Alaris E-4051/E-4046/E-7022, Fujifilm AF3-176E) y sus propios tests de fidelidad — 55 tests en total, antes 23. El desplegable "Emulsión" cambia la curva en la GPU en caliente (reescribe la LUT, realinea el offset de papel según el `Log H Ref` propio de cada película) sin recrear buffers ni texturas.
- **Carácter de color por película**: cada emulsión tiene ahora un sesgo de calidez/tinte por zona tonal (sombras y luces por separado) más un sesgo de saturación/viveza (`FilmColorCharacter` en `registry.ts`), inspirado en la descripción real del fabricante (Ektar = vívida/saturada, Fuji 400H = pastel/verde en sombras, Gold = cálida/nostálgica). Antes solo cambiaba la curva de tonalidad/contraste — el usuario notó correctamente que todas las películas "se sentían iguales con distinta curva"; esto lo corrige.
- **Limpieza de interfaz**: quitado el botón "Renderizar grano riguroso" y toda su UI (progreso, descarga) — el motor (`rigorousRender.ts`/`.worker.ts`) queda intacto sin usar, listo para retomarlo. Quitado el selector de papel (siempre Portra Endura ahora; eliminada la ruta de "vista previa plana" y su shader `previewEncode.wgsl`, que quedaba sin uso). "Temperatura del papel" pasó a vivir junto a Temperatura/Matiz en "Balance de blanco".
- **Cuadrícula de películas**: nuevo botón en la toolbar que renderiza la foto actual con las 5 emulsiones (reutilizando el pipeline real, una tras otra) y las muestra en una cuadrícula para comparar a simple vista; clic en una celda selecciona esa película.
- Verificado en el navegador en cada paso: las 5 películas dan resultados de píxel claramente distintos (tanto en tonalidad como en color por zona), la cuadrícula genera las 5 miniaturas correctamente y vuelve a la película original al cerrar, sin errores de consola ni de validación WebGPU. `tsc --noEmit`, 55 tests y `vite build` sin errores en cada commit.

## Próxima acción
1. **Polaroid** (única película pendiente de la lista original): sin datasheet real disponible, se aborda como aproximación artística documentada explícitamente como tal — pendiente de hacer.
2. Decidir con el usuario el enfoque para el banding a 16 bits: dithering (más simple) vs. salida de mayor precisión (más ambicioso, no garantizado en todos los navegadores).
3. Grano, halation y exposición por defecto siguen siendo constantes COMPARTIDAS entre las 5 películas (todas calibradas solo con la foto de referencia de Portra 400) — pendiente de fotos de referencia reales de las demás para diferenciarlas también ahí.
4. Cuando el usuario quiera retomarlo: diagnosticar y arreglar el renderizador de grano riguroso (roto, dejado deliberadamente para el final) — su UI ya no existe, habría que decidir si se reintroduce un botón o se aborca de otra forma.
5. Cuando haya ocasión: probar el carácter de color y las curvas nuevas con más fotos reales del usuario (todo lo de esta sesión se verificó con `docs/reference/portra400-grain-reference.jpg`, la única foto real disponible).

## Blockers
Ninguno.

## Para revisar
- El grano riguroso no tiene UI desde esta sesión (código intacto, sin punto de entrada) — si el usuario lo retoma, decidir cómo se expone.
- Grano, halation y exposición por defecto son iguales para las 5 películas — no reflejan diferencias reales de grano entre emulsiones (p. ej. Ektar tiene fama de grano muy fino, Gold de grano más visible).
- El carácter de color por película (`FilmColorCharacter`) es una aproximación artística basada en la descripción del fabricante y el consenso fotográfico, no en un dato de datasheet digitalizado — documentado así en el propio código. Si el usuario quiere más rigor, la vía real sería digitalizar las curvas de "Spectral-Sensitivity" y "Spectral-Dye-Density" que sí publican los datasheets (se consideró como opción 2 de este mismo trabajo, más grande, no abordada).
- Fuji Pro 400H no publica un "Log H Ref" en su datasheet — se usó el punto medio del rango de log-exposición medido como aproximación razonable, documentado en `fujiPro400h/characteristicCurveData.ts`.
- El slider de temperatura del papel corrige de forma uniforme en todo el rango tonal; si la calidez en luces altas de una foto real no se controla bien con él, revisar la calibración de canal.
- La exposición por defecto de -0.7 es un parche de calibración, no la solución de fondo — reevaluar cuando llegue la Fase 7 de reconstrucción de altas luces por IA.
- El slider de halation solo controla la intensidad, no su radio/tamaño.
- El tamaño de grano se calibró con UNA foto de referencia comprimida (JPEG, no datasheet) — puede necesitar ajuste fino con más fotos reales.
- Banding en sombras/negros a 8 bits — pendiente decidir dithering vs. mayor profundidad de salida.
- El diálogo nativo de guardado (`showSaveFilePicker`) solo existe en navegadores Chromium; sigue sin verificarse con un clic real de usuario fuera de este entorno de pruebas.
