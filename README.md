# Revista LEHES · sitio web

**LEHES. Revista: Leer, Escribir, Hablar & Escuchar**
Revista institucional de la Escuela Normal Superior Oiba, Oiba, Santander, Colombia.

Sitio estático (HTML, CSS y JavaScript, sin servidor ni base de datos). Se publica gratis en GitHub Pages.

## Qué hay en cada carpeta

| Carpeta / archivo | Para qué sirve | ¿Se edita? |
|---|---|---|
| `css/colores.css` | **Panel de control visual**: todos los colores, letras y velocidades de animación | Sí, aquí se cambia el aspecto |
| `datos/revista.json` | Nombre, ISSN, enlaces, secciones, números y **comité editorial** (los `[CORCHETES]` se muestran como "Por designar") | Sí |
| `datos/articulos.json` | Ficha de cada artículo: título, autores, fechas, resumen, abstract, palabras clave | Sí, uno por artículo |
| `articulos/*.md` | Texto completo del artículo en Markdown, para leerlo dentro del sitio | Sí |
| `articulos/img/` | Figuras de los artículos | Sí |
| `pdf/` | PDF maquetado de cada artículo | Sí |
| `plantillas/` | Plantillas para autores (Word y LaTeX) | Solo si cambia el formato |
| `img/` | Logo LEHES, escudo ENSO, favicon, licencia CC | No |
| `index.html`, `css/estilos.css`, `js/app.js` | Estructura y lógica del sitio | Normalmente no |

## Probar en el computador

El navegador no deja leer los archivos de datos si se abre `index.html` con doble clic. Use un servidor local:

```bash
cd lehes-web
python -m http.server 8000
```

y abra `http://localhost:8000`. (Con VS Code también sirve la extensión *Live Server*.)

## Publicar un artículo nuevo

1. Copie el PDF en `pdf/` con un nombre sin tildes ni espacios, por ejemplo `2027-v2n1-apellido-tema.pdf`.
2. Copie el texto en `articulos/2027-v2n1-apellido-tema.md` (títulos con `##`, subtítulos con `###`).
3. Agregue un bloque nuevo en `datos/articulos.json` (copie el existente y cambie los valores).
4. Si es un número nuevo, agréguelo en `numeros` de `datos/revista.json` y cambie `numero_actual`.
5. Suba los cambios a GitHub. En uno o dos minutos el sitio se actualiza solo.

Licencias de terceros: `js/vendor/marked.min.js` (MIT, ver `marked-LICENSE.md`).
