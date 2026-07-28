# STATUS — 2026-07-29

## Estado general
Motor físico completo + interfaz tipo Camera Raw funcional (Fase 6). El proyecto ya está en GitHub, privado, como **NW-FILM** (repo `javiersuarezginer/nw-film`), con despliegue en Vercel indicado (pendiente de confirmar que el usuario lo completó).

El usuario probó la app con su primera foto real y mandó una lista de 17 puntos de feedback, organizados con él en un orden de trabajo (ver `progress.md` para el detalle completo y `decisions.md` para el orden acordado). El renderizador de grano riguroso está roto y se deja explícitamente para el final, a petición del usuario.

**Los cuatro bloques de feedback ya están completos: "afinar el look", "controles nuevos" (undo/redo aparcado a petición del usuario) y "flujo de trabajo".** Solo quedan dos cosas de la lista original del usuario: decidir el enfoque del banding a 16 bits, y arreglar el renderizador de grano riguroso (dejado deliberadamente para el final).

## Último trabajo realizado
- Quitada la leyenda técnica del estado ("Imagen WxH. Halation + curva...") tras cargar una imagen — quedaba de las primeras fases de depuración visual del proyecto. Los demás mensajes de estado (cargando, errores, progreso) se mantienen.
- Botón "Lado a lado": el visor ahora tiene dos paneles reales (original y editada), que en modo normal siguen superpuestos como antes pero con el botón nuevo se reparten el ancho para verlos los dos a la vez, con zoom/arrastre sincronizados.
- Zoom con gesto de pellizco (pinch) en trackpad sobre el visor — detectado como `wheel` + `ctrlKey` (la forma estándar en que los navegadores entregan ese gesto), sincronizado con el slider de zoom existente.
- Botón "Exportar" en la barra de herramientas: descarga como PNG el preview en tiempo real (o el render riguroso si ya se hizo), sin depender de renderizar el grano riguroso primero.
- Eliminada la pantalla de bienvenida (`#dropzone`); el editor completo (menús, sliders, visor) está siempre visible desde el arranque. Nuevo botón "Abrir imagen". El arrastrar-soltar funciona sobre todo el visor, para primera carga y para reemplazar la imagen en cualquier momento.
- Verificado cada cambio en el navegador. Sin errores de consola, 23 tests siguen pasando.

## Próxima acción
1. Decidir con el usuario el enfoque para el banding a 16 bits: dithering (más simple) vs. salida de mayor precisión (más ambicioso, no garantizado en todos los navegadores).
2. Al final: diagnosticar y arreglar el renderizador de grano riguroso (roto, bug confirmado por el usuario) — y revisar si debe heredar el suavizado óptico, el tamaño de grano nuevo, y la saturación/viveza del preview.
3. Confirmar que el despliegue en Vercel se completó.
4. Cuando haya ocasión: probar todos los ajustes del bloque "afinar el look" con más fotos reales del usuario.
2. Decidir el enfoque para el banding a 16 bits (dithering vs. salida de mayor precisión).
3. Al final: arreglar el renderizador de grano riguroso (roto actualmente) — revisar si debe heredar el suavizado óptico decoplado, la misma proporción de tamaño de grano, y la saturación/viveza del preview.
4. Confirmar que el despliegue en Vercel se completó.
5. Cuando haya ocasión: probar todos los ajustes del bloque "afinar el look" con más fotos reales del usuario.
6. Si el usuario retoma undo/redo más adelante: no hay nada empezado, se plantea desde cero.

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
