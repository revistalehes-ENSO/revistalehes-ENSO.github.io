/* =====================================================================
   LEHES · lógica del sitio
   ---------------------------------------------------------------------
   No hace falta tocar este archivo para publicar un número nuevo:
   basta con editar datos/revista.json y datos/articulos.json, y
   agregar el texto (articulos/*.md) y el PDF (pdf/*.pdf).
   ===================================================================== */
(function () {
  "use strict";

  const VERBOS = {
    leer:     { nombre: "Leer",     frase: "Con atención y espíritu crítico." },
    escribir: { nombre: "Escribir", frase: "Para dejar huella del aula." },
    hablar:   { nombre: "Hablar",   frase: "Para poner las ideas en común." },
    escuchar: { nombre: "Escuchar", frase: "A la comunidad y a sus voces." }
  };
  const VISTAS_FIJAS = ["inicio", "numero-actual", "secciones", "archivo", "envios", "comite", "acerca", "suscribirse"];

  let R = null;       // datos de la revista
  let A = [];         // artículos
  const app = document.getElementById("contenido");

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vacio = (s) => !s || /^\s*\[.*\]\s*$/.test(String(s));
  const mostrarValor = (s, alterno = "Por designar") => vacio(s) ? `<span class="por-llenar">${esc(alterno)}</span>` : esc(s);
  const sinTilde = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = (s) => sinTilde(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const iniciales = (n) => vacio(n) ? "?" : n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const colorVerbo = (v) => `--c: var(--color-${v}); --t: var(--texto-sobre-${v});`;
  const seccion = (id) => (R.secciones.find((s) => s.id === id) || R.secciones[0]);
  const numero = (id) => R.numeros.find((n) => n.id === id);
  const reduceMov = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lee un archivo del sitio. En la vista previa los archivos vienen incrustados.
  async function leer(ruta, comoJSON) {
    const emb = window.LEHES_EMBEBIDO;
    if (emb && ruta in emb) return comoJSON ? JSON.parse(emb[ruta]) : emb[ruta];
    const r = await fetch(ruta, { cache: "no-cache" });
    if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status})`);
    return comoJSON ? r.json() : r.text();
  }
  const rutaRecurso = (ruta) => (window.LEHES_IMAGENES && window.LEHES_IMAGENES[ruta]) || ruta;

  function citaAPA(a) {
    const n = numero(a.numero);
    const doi = a.doi ? ` https://doi.org/${esc(a.doi)}` : "";
    return `${esc(a.autores_apa)} (${a.anio}). ${esc(a.titulo)}. <i>LEHES. Revista Leer, Escribir, Hablar &amp; Escuchar</i>, <i>${n.volumen}</i>(${n.numero}), ${esc(a.paginas)}.${doi}`;
  }

  function tarjeta(a) {
    const s = seccion(a.seccion), n = numero(a.numero);
    const autores = a.autores.map((x) => x.nombre).join(", ");
    return `<a class="art" href="#articulo-${esc(a.id)}" style="${colorVerbo(s.verbo)}">
      <span class="cinta" aria-hidden="true"></span>
      <span>
        <span class="chip">${esc(s.nombre)}</span>
        <h3>${esc(a.titulo)}</h3>
        <p>${esc(autores)} · Vol. ${n.volumen}, Núm. ${n.numero} · pp. ${esc(a.paginas)}</p>
        <span class="leer-mas">Leer el artículo →</span>
      </span></a>`;
  }

  const convocatoria = () => `<div class="convocatoria">
      <p class="mano">¡Tu investigación puede ser la próxima!</p>
      <p>Está abierta la convocatoria para el siguiente número. Pueden publicar docentes, estudiantes del PFC y semilleros de la ENSO.</p>
      <a class="btn ambar" href="#envios">Ver cómo publicar</a></div>`;

  /* ---------- vistas ---------- */
  const V = {};

  V.inicio = () => {
    const n = numero(R.numero_actual);
    const arts = A.filter((a) => a.numero === n.id);
    return `<section class="vista">
      <div class="portada">
        <div>
          <p class="maquina" aria-live="off"><span id="maquina">leer</span><span class="cursor" aria-hidden="true"></span></p>
          <h1>Donde la escuela se lee, se escribe, se habla y se <em>escucha<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14 C 50 4, 120 4, 197 12"/></svg></em></h1>
          <p class="lead">LEHES es la revista institucional de investigación de la ${esc(R.institucion)}. Publica artículos y procesos de investigación de docentes, estudiantes del Programa de Formación Complementaria y semilleros. Se lee aquí mismo o se descarga en PDF, y es de acceso abierto.</p>
          <div class="acciones">
            <a class="btn" href="#numero-actual">Leer el número actual</a>
            <a class="btn claro" href="#envios">Quiero publicar</a>
          </div>
        </div>
        <div class="verbos" aria-label="Los cuatro verbos de LEHES">
          ${R.secciones.map((s) => `<a class="verbo" href="#archivo" data-filtro="${esc(s.id)}" style="${colorVerbo(s.verbo)}"><b>${VERBOS[s.verbo].nombre}</b><span>${VERBOS[s.verbo].frase}</span></a>`).join("")}
        </div>
      </div>
      <div class="numero-destacado">
        <div class="tapa" aria-hidden="true">
          <small>Vol. ${n.volumen} · Núm. ${n.numero}</small>
          <img src="${rutaRecurso("img/logo-lehes@2x.png")}" alt="">
          <div class="barras"><i></i><i></i><i></i><i></i></div>
        </div>
        <div>
          <p class="meta">VOL. ${n.volumen} · NÚM. ${n.numero} · ${esc(n.fecha).toUpperCase()} · ISSN ${vacio(R.issn) ? "EN TRÁMITE" : esc(R.issn)}</p>
          <h2>${esc(n.titulo)}</h2>
          <div class="lista">${arts.map(tarjeta).join("")}</div>
          <div class="lista">${convocatoria()}</div>
        </div>
      </div>
    </section>`;
  };

  V["numero-actual"] = () => {
    const n = numero(R.numero_actual);
    const arts = A.filter((a) => a.numero === n.id);
    return `<section class="vista">
      <p class="meta">VOL. ${n.volumen} · NÚM. ${n.numero} · ${esc(n.fecha).toUpperCase()}</p>
      <h1>${esc(n.titulo)}</h1>
      <div class="resumen" style="border-left-color: var(--color-escuchar)">
        <h3>Nota del editor</h3>
        <p>${mostrarValor(n.nota_editor, "La nota del editor de este número está por escribirse.")}</p>
      </div>
      <div class="lista">${arts.map(tarjeta).join("")}</div>
    </section>`;
  };

  V.secciones = () => `<section class="vista">
      <h1>Secciones</h1>
      <p class="lead">Cada sección está ligada a uno de los cuatro verbos de LEHES. Así cada lector sabe qué tipo de texto va a encontrar.</p>
      <div class="rejilla">
        ${R.secciones.map((s) => {
          const total = A.filter((a) => a.seccion === s.id).length;
          return `<a class="seccion" href="#archivo" data-filtro="${esc(s.id)}" style="${colorVerbo(s.verbo)}">
            <span class="verbo-tag">${s.verbo}</span><h3>${esc(s.nombre)}</h3><p>${esc(s.descripcion)}</p>
            <p class="meta" style="margin-top:10px">${total} ${total === 1 ? "texto publicado" : "textos publicados"}</p></a>`;
        }).join("")}
      </div>
    </section>`;

  let filtroArchivo = "todas";
  V.archivo = () => `<section class="vista">
      <h1>Archivo</h1>
      <p class="lead">Todos los números de LEHES. Busca por título, autor o palabra clave, o filtra por sección.</p>
      <label class="etiqueta" for="buscar">Buscar en LEHES</label>
      <input id="buscar" class="campo" type="search" placeholder="Ej.: juego, escritura, inglés">
      <div class="filtros" role="group" aria-label="Filtrar por sección">
        <button type="button" data-k="todas">Todas</button>
        ${R.secciones.map((s) => `<button type="button" data-k="${esc(s.id)}">${esc(s.nombre)}</button>`).join("")}
      </div>
      <div class="lista" id="resultados"></div>
      <p class="aviso" id="sin-resultados" hidden>No hay textos con esa búsqueda. Prueba con otra palabra o quita el filtro.</p>
    </section>`;

  function activarArchivo() {
    const caja = document.getElementById("buscar");
    const botones = app.querySelectorAll(".filtros button");
    const pintar = () => {
      const q = sinTilde(caja.value.trim());
      botones.forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === filtroArchivo ? "true" : "false"));
      const res = A.filter((a) => (filtroArchivo === "todas" || a.seccion === filtroArchivo) &&
        (!q || sinTilde([a.titulo, a.titulo_ingles, a.autores.map((x) => x.nombre).join(" "), a.palabras_clave.join(" "), a.keywords.join(" ")].join(" ")).includes(q)));
      document.getElementById("resultados").innerHTML = res.map(tarjeta).join("");
      document.getElementById("sin-resultados").hidden = res.length > 0;
    };
    caja.addEventListener("input", pintar);
    botones.forEach((b) => b.addEventListener("click", () => { filtroArchivo = b.dataset.k; pintar(); }));
    pintar();
  }

  V.articulo = async (id) => {
    const a = A.find((x) => x.id === id);
    if (!a) return `<section class="vista"><h1>No encontramos ese artículo</h1><p><a href="#archivo">Ir al archivo</a></p></section>`;
    const s = seccion(a.seccion), n = numero(a.numero);
    let cuerpo = "";
    try {
      const md = await leer(a.texto, false);
      cuerpo = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;
    } catch (e) {
      cuerpo = `<p class="aviso">El texto completo se puede leer en el PDF.</p>`;
    }
    const pdfDisponible = !window.LEHES_EMBEBIDO;
    return `<section class="vista">
      <div class="cabeza-articulo">
        <span class="chip" style="${colorVerbo(s.verbo)}">${esc(a.tipo)}</span>
        <h1>${esc(a.titulo)}</h1>
        <p class="titulo-ingles" lang="en">${esc(a.titulo_ingles)}</p>
        <div class="autores">${a.autores.map((x) => `<div class="autor"><span class="avatar" aria-hidden="true">${iniciales(x.nombre)}</span>
          <span><b>${esc(x.nombre)}</b>${x.orcid ? `<a href="https://orcid.org/${esc(x.orcid)}" rel="noopener"><span class="orcid" aria-hidden="true"></span>ORCID ${esc(x.orcid)}</a>` : ""}</span></div>`).join("")}</div>
      </div>
      <div class="articulo">
        <div class="cuerpo">
          <div class="resumen">
            <div class="idiomas" role="group" aria-label="Idioma del resumen">
              <button type="button" data-idioma="es" aria-pressed="true">RESUMEN</button>
              <button type="button" data-idioma="en" aria-pressed="false">ABSTRACT</button>
            </div>
            <div data-panel="es"><p>${esc(a.resumen)}</p><p class="palabras"><b>Palabras clave:</b> ${esc(a.palabras_clave.join(", "))}.</p></div>
            <div data-panel="en" lang="en" hidden><p>${esc(a.abstract)}</p><p class="palabras"><b>Keywords:</b> ${esc(a.keywords.join(", "))}.</p></div>
          </div>
          ${vacio(a.voz_autor) ? "" : `<div class="voz"><span class="avatar" aria-hidden="true">${iniciales(a.autores[0].nombre)}</span><div><p>«${esc(a.voz_autor)}»</p><span class="meta">Por qué investigué esto</span></div></div>`}
          <div id="texto-articulo">${cuerpo}</div>
          ${pdfDisponible ? `<h2 id="pdf-completo">Versión en PDF</h2><iframe class="visor" src="${esc(a.pdf)}#view=FitH" title="PDF del artículo"></iframe>` : ""}
        </div>
        <aside class="ficha" aria-label="Ficha del artículo">
          <div class="caja">
            <h3>Descargar</h3>
            ${pdfDisponible ? `<a class="btn" href="${esc(a.pdf)}" download>PDF maquetado</a>` : `<a class="btn" aria-disabled="true">PDF maquetado</a><p class="aviso">En la vista previa no se incluye el PDF; en el sitio publicado se descarga desde aquí.</p>`}
          </div>
          <div class="caja">
            <h3>Cómo citar (APA 7)</h3>
            <div class="cita" id="texto-cita">${citaAPA(a)}</div>
            <button class="btn claro" type="button" id="btn-citar">Copiar cita</button>
          </div>
          <div class="caja">
            <h3>Datos del artículo</h3>
            <dl>
              <dt>Número</dt><dd>Vol. ${n.volumen}, Núm. ${n.numero} (${esc(n.fecha)})</dd>
              <dt>Páginas</dt><dd>${esc(a.paginas)}</dd>
              <dt>Recibido</dt><dd>${esc(a.fechas.recibido)}</dd>
              <dt>Aceptado</dt><dd>${esc(a.fechas.aceptado)}</dd>
              <dt>Aprobado</dt><dd>${esc(a.fechas.aprobado)}</dd>
              ${a.doi ? `<dt>DOI</dt><dd><a href="https://doi.org/${esc(a.doi)}">${esc(a.doi)}</a></dd>` : ""}
            </dl>
          </div>
          <div class="caja indice" id="indice"><h3>En este artículo</h3><ol></ol></div>
          <div class="caja">
            <h3>Licencia</h3>
            <div class="cc" aria-hidden="true"><span>CC</span><span>BY</span><span>NC</span><span>ND</span></div>
            <p style="margin:0">Este artículo se publica bajo licencia <a href="${esc(R.licencia.url)}" rel="license noopener">${esc(R.licencia.sigla)}</a>: se puede compartir citando a su autor, sin fines comerciales y sin modificarlo.</p>
          </div>
          ${a.autores[0].correo ? `<div class="caja"><h3>Correspondencia</h3><p style="margin:0">${esc(a.autores[0].nombre)}, ${esc(R.ciudad)}.<br><a href="mailto:${esc(a.autores[0].correo)}">${esc(a.autores[0].correo)}</a></p></div>` : ""}
        </aside>
      </div>
    </section>`;
  };

  function activarArticulo() {
    app.querySelectorAll(".idiomas button").forEach((b) => b.addEventListener("click", () => {
      app.querySelectorAll(".idiomas button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      app.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.idioma; });
    }));
    const texto = document.getElementById("texto-articulo");
    texto.querySelectorAll("table").forEach((t) => { const d = document.createElement("div"); d.className = "tabla"; t.replaceWith(d); d.appendChild(t); });
    texto.querySelectorAll("img").forEach((im) => { im.src = rutaRecurso(im.getAttribute("src")); im.loading = "lazy"; });
    const lista = document.querySelector("#indice ol");
    const h2s = texto.querySelectorAll("h2");
    h2s.forEach((h) => {
      h.id = slug(h.textContent);
      const li = document.createElement("li");
      li.innerHTML = `<a href="#${h.id}" data-ancla="${h.id}">${esc(h.textContent)}</a>`;
      lista.appendChild(li);
    });
    if (!h2s.length) document.getElementById("indice").remove();
    // Los enlaces del índice desplazan la página sin cambiar de vista
    lista.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-ancla]");
      if (!a) return;
      e.preventDefault();
      document.getElementById(a.dataset.ancla).scrollIntoView({ behavior: reduceMov ? "auto" : "smooth" });
    });
    document.getElementById("btn-citar").addEventListener("click", async (e) => {
      const t = document.getElementById("texto-cita").innerText;
      try { await navigator.clipboard.writeText(t); e.target.textContent = "¡Cita copiada!"; }
      catch (_) { e.target.textContent = "Selecciona el texto y cópialo"; }
      setTimeout(() => { e.target.textContent = "Copiar cita"; }, 2400);
    });
  }

  V.envios = () => {
    const e = R.enlaces;
    const boton = (url, txt, clase = "btn") => vacio(url) ? `<a class="${clase}" aria-disabled="true">${txt} (pronto)</a>` : `<a class="${clase}" href="${esc(url)}" ${url.startsWith("http") ? 'rel="noopener"' : "download"}>${txt}</a>`;
    return `<section class="vista">
      <h1>Publicar en LEHES</h1>
      <p class="lead">Pueden publicar docentes, estudiantes del PFC y semilleros de la ENSO. Más adelante la revista también recibirá autores externos.</p>
      <div class="descargas">
        ${boton(e.plantilla_word, "Plantilla en Word", "btn")}
        ${boton(e.plantilla_latex, "Plantilla en LaTeX", "btn claro")}
        ${boton(e.formulario_envio, "Enviar mi artículo", "btn ambar")}
      </div>
      <ol class="pasos">
        <li><div><h3>Descarga la plantilla</h3><p>En Word o LaTeX, con el diseño de LEHES. Trae los espacios para resumen, abstract, fechas, consideraciones éticas y referencias en APA 7.</p></div></li>
        <li><div><h3>Escribe y revisa</h3><p>Título en español e inglés, resumen de máximo 250 palabras, de 3 a 5 palabras clave y el texto completo.</p></div></li>
        <li><div><h3>Envía tu texto</h3><p>Por el formulario de envío. Recibirás un correo con la fecha de recibido.</p></div></li>
        <li><div><h3>Revisión por pares</h3><p>Dos lectores revisan el texto sin conocer a sus autores y devuelven comentarios para mejorarlo.</p></div></li>
        <li><div><h3>Ajustes y maquetación</h3><p>Los autores ajustan su texto y el equipo editorial lo maqueta en la web y en PDF.</p></div></li>
        <li><div><h3>Publicación</h3><p>El artículo sale en el número siguiente y llega a todos los suscriptores.</p></div></li>
      </ol>
    </section>`;
  };

  V.comite = () => `<section class="vista">
      <h1>Comité editorial</h1>
      <p class="lead">Las personas que cuidan la calidad de lo que se publica en LEHES.</p>
      <div class="comite">
        ${R.comite.map((p) => `<div class="persona ${vacio(p.nombre) ? "vacia" : ""}">
          <span class="avatar" aria-hidden="true">${iniciales(p.nombre)}</span>
          <div><span class="cargo">${esc(p.cargo)}</span><p><b>${mostrarValor(p.nombre)}</b><br>${vacio(p.filiacion) ? "" : esc(p.filiacion)}
          ${p.orcid ? `<br><a href="https://orcid.org/${esc(p.orcid)}">ORCID</a>` : ""}</p></div></div>`).join("")}
      </div>
    </section>`;

  V.acerca = () => `<section class="vista texto-largo">
      <p class="mano">Leer, escribir, hablar &amp; escuchar</p>
      <h1>Acerca de LEHES</h1>
      <p>LEHES es la revista institucional de la ${esc(R.institucion)} (${esc(R.sigla_institucion)}), en ${esc(R.ciudad)}. Su nombre reúne las cuatro habilidades que forman a un maestro y a un investigador: leer el mundo, escribirlo, hablarlo y escuchar a los demás.</p>
      <h2>Enfoque y alcance</h2>
      <p>Publica investigación educativa y pedagógica hecha en la ENSO o en diálogo con ella: artículos de investigación original, procesos en curso, experiencias de aula y textos de los semilleros.</p>
      <h2>Acceso abierto y licencia</h2>
      <p>Todos los contenidos son gratuitos: no se cobra por leer ni por publicar. Los artículos se publican bajo licencia <a href="${esc(R.licencia.url)}" rel="license noopener">${esc(R.licencia.nombre)}</a> (${esc(R.licencia.sigla)}). Se pueden copiar y compartir citando a sus autores, sin fines comerciales y sin modificarlos.</p>
      <h2>Ética de la publicación</h2>
      <p>Cada artículo declara la aprobación del comité de investigación de la ENSO, la contribución de cada autor, sus fuentes de financiación y sus posibles conflictos de interés. La revisión es por pares, con los nombres ocultos.</p>
      <h2>Periodicidad e identificación</h2>
      <p>${esc(R.periodicidad)}. ISSN: ${mostrarValor(R.issn, "en trámite")}.</p>
      <h2>Contacto</h2>
      <p>${vacio(R.correo_contacto) ? '<span class="por-llenar">Correo por definir</span>' : `<a href="mailto:${esc(R.correo_contacto)}">${esc(R.correo_contacto)}</a>`}</p>
    </section>`;

  V.suscribirse = () => {
    const e = R.enlaces;
    return `<section class="vista texto-largo">
      <p class="mano">Que cada número te llegue</p>
      <h1>Suscríbete a LEHES</h1>
      <p class="lead">Es gratis. Te avisamos cuando salga un número nuevo, con el enlace para leerlo aquí o descargarlo en PDF, y te contamos cuando abra una convocatoria.</p>
      <div class="descargas">
        ${vacio(e.formulario_suscripcion) ? `<a class="btn" aria-disabled="true">Formulario de suscripción (pronto)</a>` : `<a class="btn" href="${esc(e.formulario_suscripcion)}" rel="noopener">Suscribirme por correo</a>`}
        ${vacio(e.canal_whatsapp) ? "" : `<a class="btn claro" href="${esc(e.canal_whatsapp)}" rel="noopener">Seguir el canal de WhatsApp</a>`}
      </div>
      <p class="aviso">Tus datos solo se usan para enviarte la revista. Puedes darte de baja cuando quieras.</p>
    </section>`;
  };

  /* ---------- animación de la portada: los cuatro verbos ---------- */
  let temporizador = null;
  function maquinaDeEscribir() {
    const el = document.getElementById("maquina");
    if (!el) return;
    const palabras = ["leer…", "escribir…", "hablar…", "escuchar…", "investigar."];
    if (reduceMov) { el.textContent = palabras.join(" "); return; }
    let p = 0, c = 0, borrando = false;
    const paso = () => {
      if (!document.body.contains(el)) return;
      const w = palabras[p];
      c += borrando ? -1 : 1;
      el.textContent = w.slice(0, c);
      let espera = borrando ? 45 : 95;
      if (!borrando && c === w.length) { borrando = true; espera = 1400; }
      else if (borrando && c === 0) { borrando = false; p = (p + 1) % palabras.length; espera = 300; }
      temporizador = setTimeout(paso, espera);
    };
    paso();
  }

  /* ---------- barra de progreso ---------- */
  const barra = document.getElementById("progreso");
  function progreso() {
    if (!location.hash.startsWith("#articulo-")) { barra.style.width = "0"; return; }
    const h = document.documentElement.scrollHeight - innerHeight;
    barra.style.width = h > 0 ? `${Math.min(100, (scrollY / h) * 100)}%` : "0";
  }
  addEventListener("scroll", progreso, { passive: true });

  /* ---------- navegación por pestañas (#hash) ---------- */
  async function mostrar() {
    clearTimeout(temporizador);
    let h = (location.hash || "#inicio").slice(1);
    let html;
    if (h.startsWith("articulo-")) html = await V.articulo(h.slice(9));
    else { if (!VISTAS_FIJAS.includes(h)) h = "inicio"; html = V[h](); }
    app.innerHTML = html;
    const marcar = h.startsWith("articulo-") ? "archivo" : h;
    document.querySelectorAll(".pestanas a").forEach((a) => {
      if (a.getAttribute("href") === `#${marcar}`) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (h === "archivo") activarArchivo();
    if (h.startsWith("articulo-")) activarArticulo();
    if (h === "inicio") maquinaDeEscribir();
    app.querySelectorAll("[data-filtro]").forEach((x) => x.addEventListener("click", () => { filtroArchivo = x.dataset.filtro; }));
    scrollTo(0, 0);
    progreso();
  }

  function rellenarPie() {
    document.querySelectorAll("[data-campo]").forEach((el) => { el.innerHTML = mostrarValor(R[el.dataset.campo], "en trámite"); });
    const lic = document.querySelector('[data-enlace="licencia"]');
    lic.href = R.licencia.url; lic.textContent = R.licencia.sigla;
  }

  async function iniciar() {
    try {
      [R, A] = await Promise.all([leer("datos/revista.json", true), leer("datos/articulos.json", true)]);
    } catch (e) {
      app.innerHTML = `<section class="vista"><h1>No se pudieron cargar los datos</h1>
        <p>Si abriste el archivo index.html con doble clic, el navegador bloquea la lectura de los datos. Ábrelo con un servidor local (ver el paso a paso) o desde GitHub Pages.</p>
        <p class="aviso">${esc(e.message)}</p></section>`;
      return;
    }
    A.sort((x, y) => y.anio - x.anio);
    rellenarPie();
    addEventListener("hashchange", mostrar);
    mostrar();
  }
  iniciar();
})();
