# Simulador de fotografía analógica

## Qué es
Web app de edición que aplica simulación física de película fotográfica (Portra 400 y otras emulsiones) sobre imágenes digitales, con foco especial en imágenes generadas por IA. Modela el proceso físico-químico real: respuesta espectral de la emulsión, curva característica, halation, grano dependiente de la exposición y simulación de escáner/ampliación.

## Por qué importa
La categoría de "editor con LUT + grano superpuesto" ya está saturada y no convence. No existe un equivalente web bien hecho de un simulador realmente físico (como Filmbox o Dehancer, pero para navegador). Ese es el hueco que cubre este proyecto.

## Para quién
Gente que quiere que sus fotos (incluidas las generadas por IA) tengan el aspecto real de haber sido reveladas en película, no un filtro estético superficial.

## Visión de producto (UI final)
Software de edición al estilo Adobe Camera Raw: panel lateral con todos los parámetros del revelado, selector de distintos film stocks (Portra 400 y otras emulsiones), y modo comparativa A/B con slider entre el antes y el después. Esto es la Fase 6 del roadmap (`CLAUDE.md`) — se construye encima del motor físico una vez esté validado, no antes.

## Despliegue
Vercel, como el resto de proyectos del usuario. Es una web app estática (Vite), sin backend — deploy directo por push a git. WebGPU requiere HTTPS (Vercel lo sirve por defecto) y un navegador compatible (Chrome/Edge recientes).

## Links
- Repo: (pendiente)
- Deploy: (pendiente)

## Cómo debe ayudar la IA
- El look final es 100% físico y determinista — nunca usar IA generativa en el look.
- Seguir el pipeline y el orden de fases definidos en `CLAUDE.md`.
- Mantener el core de render (WebGPU/WGSL) desacoplado de la UI.
- Actualizar `docs/` al final de cada sesión.
- Preguntar antes de hacer cambios estructurales grandes.
- El usuario no programa: explicar todo en lenguaje sencillo, sin jerga técnica.
