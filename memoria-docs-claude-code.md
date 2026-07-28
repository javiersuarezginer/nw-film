# Sistema de memoria `/docs` para Claude Code

> Cómo darle memoria persistente a Claude Code entre sesiones, sin depender de ninguna app externa.

---

## El problema que resuelve

Claude Code no recuerda nada entre sesiones. Cada vez que abres una nueva sesión en un proyecto, empieza desde cero. Este sistema resuelve eso con archivos Markdown simples que Claude lee al inicio y actualiza al final de cada sesión.

---

## La idea central

Cada proyecto tiene una carpeta `docs/` con cuatro archivos. Claude los lee al arrancar y los mantiene actualizados al terminar. Eso es todo.

No hay base de datos, no hay app especial, no hay plugin. Son archivos de texto plano versionables con git.

---

## Estructura de archivos

```
mi-proyecto/
├── docs/
│   ├── README.md       ← qué es el proyecto (no cambia casi nunca)
│   ├── STATUS.md       ← dónde está ahora mismo
│   ├── progress.md     ← diario fechado de sesiones
│   └── decisions.md    ← decisiones tomadas y por qué
├── CLAUDE.md           ← instrucciones para Claude en este proyecto
└── ... (código del proyecto)
```

---

## Los cuatro archivos explicados

### `README.md` — Visión estable
Lo que es el proyecto, por qué existe, para quién es, links útiles (repo, deploy, diseño), y cómo debe ayudar la IA. Se escribe una vez y apenas cambia.

```markdown
# Nombre del proyecto

## Qué es
[descripción en 2-3 frases]

## Por qué importa
[el problema que resuelve]

## Para quién
[usuario objetivo]

## Links
- Repo: https://github.com/...
- Deploy: https://...
- Figma: https://...

## Cómo debe ayudar la IA
- Mantener el código modular y sin dependencias innecesarias
- Actualizar docs/ al final de cada sesión
- Preguntar antes de hacer cambios estructurales grandes
```

---

### `STATUS.md` — Snapshot actual
El estado exacto del proyecto en este momento: qué está hecho, qué es lo próximo, qué está bloqueado. Se actualiza cada sesión. Es lo primero que lee Claude al empezar.

```markdown
# STATUS — [fecha última actualización]

## Estado general
[En desarrollo / Listo para revisión / Bloqueado / etc.]

## Último trabajo realizado
[qué se hizo en la última sesión]

## Próxima acción
[la tarea más inmediata y concreta]

## Blockers
[qué impide avanzar, si hay algo]

## Para revisar
[cosas pendientes de decisión o validación]
```

---

### `progress.md` — Diario de sesiones
Log fechado de todo lo que ha pasado. Cada sesión añade una entrada. Nunca se borra nada, solo se añade arriba.

```markdown
# Progress log

## 2026-06-26
- Implementado X
- Corregido bug en Y
- Pendiente: revisar Z

## 2026-06-20
- Primera sesión. Configurado entorno base.
- Decidido usar vanilla JS sin frameworks.
```

---

### `decisions.md` — Registro de decisiones
Decisiones importantes que se han tomado, con el razonamiento y cuándo revisarlas. Evita volver a debatir lo mismo en sesiones futuras.

```markdown
# Decisiones

## [2026-06-20] Vanilla JS sin frameworks
**Decisión:** No usar React ni ningún framework.
**Por qué:** El proyecto es una herramienta estática simple. Añadir un bundler complica el deploy sin aportar valor real.
**Revisitar si:** El proyecto crece hasta necesitar estado compartido entre componentes.

## [2026-06-15] Deploy en Vercel via GitHub push
**Decisión:** Push a `main` despliega automáticamente.
**Por qué:** Sin pasos manuales, sin CLI en cada deploy.
**Revisitar si:** Se necesita entorno de staging separado.
```

---

## Configuración de Claude Code

### 1. `CLAUDE.md` por proyecto

En la raíz de cada proyecto, un archivo `CLAUDE.md` con las instrucciones específicas de ese proyecto y la instrucción de mantener `docs/` actualizado.

```markdown
# Nombre del proyecto — instrucciones para Claude

## Contexto
@docs/README.md
@docs/STATUS.md

## Convenciones del proyecto
- [tus convenciones técnicas aquí]
- [stack, estilo de código, restricciones]

## Al final de cada sesión
1. Actualiza `docs/STATUS.md` con el estado actual
2. Añade entrada fechada (YYYY-MM-DD) a `docs/progress.md`
3. Si se tomó alguna decisión importante, añádela a `docs/decisions.md`
```

La sintaxis `@docs/STATUS.md` hace que Claude importe y lea ese archivo automáticamente al cargar el proyecto. Sin hacer nada más, Claude arranca cada sesión con el contexto completo.

---

### 2. `~/.claude/CLAUDE.md` global

Un archivo en tu carpeta de usuario que aplica a **todos** tus proyectos. Aquí van las preferencias personales y la instrucción global de mantener la memoria.

```markdown
# Preferencias globales

## Memoria de proyectos
Al final de cada bloque de trabajo, siempre:
1. Actualizar `docs/STATUS.md` con el estado actual del proyecto
2. Añadir entrada fechada a `docs/progress.md` con qué se hizo, qué queda y decisiones tomadas
3. Si se tomó alguna decisión, añadirla también a `docs/decisions.md`

## Estilo de trabajo
- Pedir confirmación antes de hacer cambios estructurales grandes
- Preferir soluciones simples sobre soluciones elegantes pero complejas
- [tus preferencias aquí]
```

---

## Cómo funciona en la práctica

### Al inicio de una sesión
```
Revisa /docs y dime en qué estamos
```
Claude lee `STATUS.md`, `progress.md` y `decisions.md`, y en 30 segundos tiene todo el contexto de donde se quedó la última vez.

### Durante la sesión
Trabajas normalmente. Claude sabe el contexto sin que tengas que re-explicar nada.

### Al final de la sesión
```
Actualiza docs/
```
O simplemente cierra la sesión — si tienes configurado el `CLAUDE.md` correctamente, Claude lo hace solo antes de terminar.

---

## Jerarquía de CLAUDE.md

Claude Code carga los archivos en este orden, de más general a más específico:

```
~/.claude/CLAUDE.md        ← global (todos los proyectos)
    ↓
./CLAUDE.md                ← raíz del proyecto
    ↓
@imports dentro de CLAUDE.md  ← archivos que importa (docs/STATUS.md, etc.)
```

Los más específicos tienen prioridad en caso de conflicto.

---

## Lo mínimo para empezar

Si quieres implementarlo de forma gradual, el orden recomendado:

**Paso 1** — Crea `docs/` en un proyecto con los cuatro archivos. Rellena `README.md` y `STATUS.md` con lo que sabes ahora.

**Paso 2** — Añade `CLAUDE.md` en la raíz del proyecto con los imports y la instrucción de actualizar al final.

**Paso 3** — Prueba una sesión. Al acabar, dile a Claude: *"actualiza docs/"*. Revisa que `STATUS.md` y `progress.md` reflejen lo que se hizo.

**Paso 4** — Cuando el sistema funcione en un proyecto, repítelo en los demás. Luego añade el `~/.claude/CLAUDE.md` global para que la instrucción aplique a todos.

---

## Lo que NO necesitas

- **Obsidian ni ningún visor de Markdown** — los archivos son texto plano, Claude los lee directamente con el sistema de archivos.
- **Base de datos** — todo vive en archivos `.md` versionables con git.
- **Plugins de Claude Code** — el sistema usa solo funcionalidad nativa: `CLAUDE.md` y lectura de archivos.
- **Scripts de sincronización** — innecesarios a menos que quieras copiar los docs a otro lugar.

---

## Preguntas frecuentes

**¿Hay que hacer algo especial al iniciar Claude Code?**
No. Claude carga `CLAUDE.md` automáticamente al abrir un proyecto. Si los imports están bien configurados, ya tiene el contexto.

**¿Qué pasa si Claude no actualiza docs/ al final?**
Puedes recordárselo: *"antes de cerrar, actualiza docs/"*. Con el `~/.claude/CLAUDE.md` global bien configurado, debería hacerlo solo.

**¿Se puede versionar con git?**
Sí, y es recomendable. Los cuatro archivos de `docs/` son Markdown puro, sin dependencias.

**¿Funciona con equipos?**
El `CLAUDE.md` del proyecto (en el repo) lo ven todos. El `~/.claude/CLAUDE.md` global es personal de cada desarrollador.

---

*Sistema diseñado y puesto en producción por Albert / STRK · Querida Studio*
