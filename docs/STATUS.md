# STATUS — 2026-07-28

## Estado general
Motor físico completo (halation, curva Portra 400, grano, acutancia, papel Endura, grano riguroso para export) + primera versión funcional de la interfaz tipo Camera Raw (Fase 6): barra lateral agrupada, visor con zoom/arrastre, botón Original/Editada, y 6 controles nuevos de gradado (temperatura, matiz, luces, sombras, blancos, negros) funcionando de verdad en el motor. Verificado en el navegador con una imagen sintética; pendiente probar con una foto real del usuario.

## Último trabajo realizado
- **Interfaz tipo Camera Raw** (`index.html`, `src/style.css`, `src/main.ts`):
  - Layout nuevo: cabecera, visor de imagen a la izquierda (flexible) + barra lateral fija a la derecha con controles agrupados en secciones (Balance de blanco, Tono, Grano y nitidez, Salida).
  - Zoom con slider (10%–500%) + arrastre con el ratón (estilo Lightroom, no lupa — elegido por el usuario). Botón "Ajustar" calcula el porcentaje que encaja la imagen en el visor. Se reajusta automáticamente al cargar una imagen o redimensionar la ventana.
  - Botón "Ver original"/"Ver editada" (A/B): alterna entre el canvas del bitmap original y el resultado del pipeline, reutilizando el mismo `canvas-stack` (comparten zoom/arrastre sin duplicar lógica).
- **Motor: 6 controles nuevos** (temperatura, matiz, luces, sombras, blancos, negros) — no existían antes, se implementaron de verdad:
  - Nuevo pass `src/shaders/sceneGrade.wgsl`, insertado entre `decodeLinear` y el halation (en lineal, antes de cualquier física de la película — ver `decisions.md`).
  - Balance de blanco: ganancia multiplicativa simple. Zonas tonales: offset en dominio log (stops relativos al gris medio) ponderado por una máscara `smoothstep` — ancha para luces/sombras, estrecha en los extremos para blancos/negros. Un solo mecanismo reutilizado para los 4 controles.
  - La exposición (ya existente) no se tocó — sigue en `characteristicCurve.wgsl`, solo se reubicó visualmente.
- Verificado en el navegador embebido con una imagen sintética (cielo con degradado, punto brillante para halation, cartón gris y parches de color): cada slider nuevo produce el efecto esperado (temperatura cambia la dominante de color, luces/sombras oscurecen su zona, A/B alterna correctamente, zoom/arrastre/ajustar funcionan, sin errores de consola). Regresión comprobada: exposición, grano, acutancia y papel Endura siguen funcionando igual que antes.
- Los 23 tests existentes siguen pasando (no se tocó color science).

## Próxima acción
1. Probar con una foto real del usuario (pendiente desde la sesión anterior).
2. Recoger feedback visual sobre los controles nuevos (fuerza de temperatura/matiz, anchura de las zonas de luces/sombras/blancos/negros — hay constantes ajustables en `sceneGrade.wgsl` si algo se nota demasiado fuerte o débil).
3. Posibles pulidos de la interfaz: límites al arrastre (hoy no tiene, se puede arrastrar la imagen fuera de vista), selector de nivel de zoom con teclado o rueda del ratón.

## Blockers
Ninguno.

## Para revisar
- El grano riguroso en imágenes muy pequeñas (tests sintéticos) se ve un poco fuerte/grueso — con fotos reales de mayor resolución debería verse más fino, pero conviene confirmarlo y quizás ajustar la intensidad por defecto.
- Rendimiento del grano riguroso en imágenes grandes (varios MP) no probado todavía.
- Blancos/negros probados solo visualmente en una imagen sin negros/blancos puros reales — confirmar con una foto real que la zona "estrecha" de la máscara está bien calibrada.
