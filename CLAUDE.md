# CLAUDE.md — Simulador de fotografía analógica

## Visión del proyecto

Web app de edición que aplica **simulación física de película fotográfica** (Portra 400 y otras emulsiones) sobre imágenes digitales, con foco especial en imágenes generadas por IA. 

**Lo que NO es este proyecto:** otro editor de LUTs con una capa de grano superpuesta. Esa categoría ya existe y está saturada. Si en algún momento una solución propuesta se reduce a "aplicar una lookup table de color + ruido encima", es la solución incorrecta: parar y replantear.

**Lo que SÍ es:** un pipeline que modela el proceso físico-químico por el que una imagen emerge en película — respuesta espectral de las capas de emulsión, curva característica, halation, grano dependiente de la exposición, simulación de escaneo/ampliación. Referentes de calidad en este enfoque: Filmbox (Video Village) y Dehancer. No existe un equivalente web bien hecho: ese es el hueco.

## Principios innegociables

1. **El look es 100% físico y determinista.** La misma imagen con los mismos parámetros produce siempre el mismo resultado, píxel a píxel. Ningún paso del look usa IA generativa.
2. **Todo el procesamiento de revelado corre en GPU en el cliente**, en tiempo real sobre imágenes de 20–50 MP. La única excepción permitida es el modelo de grano riguroso, que puede usar render diferido (aproximación rápida para preview, modelo completo para export).
3. **Espacio de trabajo interno: float lineal (scene-referred).** Decodificar sRGB/display-referred a lineal al importar; todas las operaciones del pipeline operan en lineal; codificar solo en la salida final. Nunca aplicar operaciones "físicas" sobre valores gamma-encoded.
4. **La capa de IA es preprocesado, nunca look.** Ver sección "Capa de IA".
5. **Arquitectura de passes extensible.** Cada etapa del pipeline es un pass independiente y componible. Añadir un pass nuevo debe ser trivial.

## Pipeline de revelado (orden fijo)

```
Imagen entrada (sRGB display-referred)
  → [opcional] Preprocesado IA (ver sección Capa de IA)
  → Decodificación a lineal scene-referred
  → Transformación espectral de la emulsión (matriz/aproximación espectral por película)
  → Halation (blur teñido rojizo-anaranjado del canal de altas luces, ANTES de la curva)
  → Curva característica H&D por canal (toe, zona lineal, hombro; datos de datasheets reales)
  → Grano dependiente de densidad local (no ruido gaussiano superpuesto)
  → Difusión inter-capa / acutancia (efectos de borde)
  → Simulación de salida: escáner (Frontier/Noritsu color science) o papel RA-4
  → Codificación a sRGB para display/export
```

### Notas por etapa

- **Curva H&D:** digitalizar las curvas de los datasheets publicados de Kodak/Fuji. El hombro suave en altas luces es la firma más importante de Portra: debe verse el "roll-off" en vez de clipping duro. Escribir tests numéricos de referencia: dado log-exposure X, densidad esperada Y según datasheet, con tolerancia definida.
- **Halation:** blur del canal de altas luces con kernel específico, teñido rojo-naranja, aplicado antes de la curva característica. Visualmente espectacular y relativamente simple; casi nadie lo implementa.
- **Grano:** referencia académica → Newson, Delon, Galerne, *"A Stochastic Film Grain Model for Resolution-Independent Rendering"* (modelo booleano de partículas). El grano real: (a) su intensidad depende de la exposición local — máximo en medios tonos, mínimo en negros puros y blancos quemados; (b) tamaño distinto por capa de color; (c) desplaza detalle, no se suma encima. Implementación en dos niveles: aproximación GPU en tiempo real para preview + modelo riguroso para export (worker o servidor).
- **Escáner/papel:** gran parte de la identidad "Portra" que la gente reconoce es en realidad Portra + escáner Frontier. Modelar la salida como etapa separada y conmutable.

## Capa de IA (preprocesado del "negativo digital")

Rol: preparar la imagen ANTES del pipeline físico. La IA hace de "captura idealizada"; el pipeline hace de laboratorio. Nunca al revés.

Usos permitidos:
1. **Inverse tone mapping / reconstrucción de altas luces:** las imágenes de IA llegan display-referred con altas luces clipeadas; el hombro de la curva H&D necesita información por encima del blanco para comprimir. La salida del modelo generativo se usa solo como guía de baja frecuencia en zonas quemadas, mezclada con la imagen original a resolución completa — nunca se acepta la imagen regenerada entera.
2. **De-texturizado del look plástico de IA** (normalizar micro-textura sintética antes de que el pipeline añada grano y acutancia propios).
3. **Inpainting de artefactos** (retoque opcional dirigido por el usuario).

Reglas de implementación:
- Paso **opcional**, ejecutado **una sola vez por imagen**, con resultado **cacheado como asset intermedio del proyecto**. Reexportar o reajustar el revelado NUNCA vuelve a llamar a la API ni cambia la imagen base.
- API candidata: Nano Banana (Google). Verificar estado actual de resolución, precios y capacidades de edición con máscara antes de integrar; evaluar alternativas (Flux + inpainting, modelos dedicados de HDR reconstruction open source auto-hospedados) según coste/calidad en el momento de implementar. La integración debe estar encapsulada tras una interfaz propia para poder cambiar de proveedor.
- La integración de IA es la ÚLTIMA fase del proyecto. No bloquea nada anterior.

## Stack técnico

- **Vite + TypeScript**
- **WebGPU** como target principal de render. (Fallback WebGL2: decisión pendiente, no implementar de entrada.)
- Shaders en WGSL, organizados como passes componibles.
- Sin frameworks pesados de estado por ahora; mantener el core de render desacoplado de la UI.

## Fases de desarrollo (orden estricto — validar lo difícil primero)

1. **Esqueleto:** carga de imagen (drag & drop), contexto WebGPU, pipeline con un único pass sRGB→lineal→sRGB. Objetivo: establecer la arquitectura de passes.
2. **Curva H&D por canal** con datos reales de Portra 400 + control de exposición. Criterio de éxito: las altas luces "ruedan" visiblemente en vez de clipear. Esta fase valida el proyecto entero.
3. **Halation.**
4. **Grano físico:** primero aproximación en tiempo real, después modelo riguroso para export.
5. **Simulación de escáner/papel + más emulsiones.**
6. **UI de presets y gestión de proyecto.**
7. **Capa de IA** (preprocesado, según sección anterior).

## Convenciones de trabajo

- **Modo debug de pipeline obligatorio desde la fase 1:** vista lado a lado de la imagen tras cada pass, para localizar en qué etapa se rompe algo visualmente.
- **Tests numéricos para color science:** las curvas y matrices tienen tests con valores de referencia de los datasheets. El color science se rompe silenciosamente en refactors; los tests son la red.
- **Commits frecuentes, uno por paso del pipeline o cambio de caracterización**, para poder comparar versiones visualmente.
- Nombres de passes y parámetros usan terminología fotoquímica real (density, log exposure, dye layer…), no genérica de editor ("contrast", "fade").

## Referencias

- Datasheets técnicos de Kodak (Portra 400, etc.) y Fuji: curvas características, sensibilidad espectral.
- Newson, Delon, Galerne — *A Stochastic Film Grain Model for Resolution-Independent Rendering*.
- Filmbox y Dehancer como referentes de calidad (enfoque físico), no para copiar sino como listón.

## Al final de cada sesión
1. Actualiza `docs/STATUS.md` con el estado actual
2. Añade entrada fechada (YYYY-MM-DD) a `docs/DECISIONS.md` si hubo alguna decisión de arquitectura
