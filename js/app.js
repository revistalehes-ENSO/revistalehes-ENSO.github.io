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
  const VISTAS_FIJAS = ["inicio", "numero-actual", "secciones", "archivo", "docentes", "envios", "comite", "acerca", "suscribirse"];

  let R = null;       // datos de la revista
  let A = [];         // artículos
  let D = null;       // docentes
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
  // En el sitio publicado cada artículo tiene su propia página (articulo/<id>/), que es la que leen los buscadores.
  const enlaceArticulo = (id) => window.LEHES_EMBEBIDO ? `#articulo-${id}` : `articulo/${id}/`;
  const enlaceDocente = (id) => window.LEHES_EMBEBIDO ? `#docente-${id}` : `docente/${id}/`;
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

  /* ---------- estadísticas (GoatCounter, sin cookies) ---------- */
  const GC = { codigo: "", listo: false, cola: [] };
  function iniciarEstadisticas() {
    const c = R.estadisticas && R.estadisticas.goatcounter;
    if (vacio(c) || window.LEHES_EMBEBIDO) return;
    GC.codigo = c.trim();
    const sc = document.createElement("script");
    sc.async = true; sc.src = "https://gc.zgo.at/count.js";
    sc.dataset.goatcounter = `https://${GC.codigo}.goatcounter.com/count`;
    sc.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    sc.onload = () => { GC.listo = true; GC.cola.splice(0).forEach(contar); };
    document.head.appendChild(sc);
  }
  function contar(x) {
    if (!GC.codigo) return;
    if (!GC.listo || !window.goatcounter || !window.goatcounter.count) { GC.cola.push(x); return; }
    try { window.goatcounter.count({ path: x.path, title: x.title || x.path }); } catch (_) {}
  }
  async function cifra(path) {
    if (!GC.codigo) return null;
    try {
      const r = await fetch(`https://${GC.codigo}.goatcounter.com/counter/${encodeURIComponent(path)}.json`);
      if (r.status === 404) return "0";
      if (!r.ok) return null;
      return (await r.json()).count;
    } catch (_) { return null; }
  }
  async function pintarCifras(raiz = document) {
    raiz.querySelectorAll("[data-cifra]").forEach(async (el) => {
      const v = await cifra(el.dataset.cifra);
      el.textContent = v === null ? "—" : v;
    });
  }
  const yaUtil = (id) => { try { return localStorage.getItem("lehes-util-" + id) === "1"; } catch (_) { return false; } };

  function citaAPA(a) {
    const n = numero(a.numero);
    const doi = a.doi ? ` https://doi.org/${esc(a.doi)}` : "";
    return `${esc(a.autores_apa)} (${a.anio}). ${esc(a.titulo)}. <i>LEHES. Revista Leer, Escribir, Hablar &amp; Escuchar</i>, <i>${n.volumen}</i>(${n.numero}), ${esc(a.paginas)}.${doi}`;
  }

  const perfilPublico = (id) => D && D.personas.some((p) => p.id === id && p.autoriza_publicacion && !p.ejemplo);
  const perfilDe = (nombre) => D && D.personas.find((p) => p.autoriza_publicacion && !p.ejemplo && sinTilde(p.nombre) === sinTilde(nombre));

  function tarjeta(a) {
    const s = seccion(a.seccion), n = numero(a.numero);
    const autores = a.autores.map((x) => x.nombre).join(", ");
    return `<a class="art" href="${esc(enlaceArticulo(a.id))}" style="${colorVerbo(s.verbo)}">
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
          <span><b>${perfilDe(x.nombre) ? `<a class="a-perfil" href="${esc(enlaceDocente(perfilDe(x.nombre).id))}">${esc(x.nombre)}</a>` : esc(x.nombre)}</b>${x.orcid ? `<a href="https://orcid.org/${esc(x.orcid)}" rel="noopener"><span class="orcid" aria-hidden="true"></span>ORCID ${esc(x.orcid)}</a>` : ""}</span></div>`).join("")}</div>
      </div>
      <div class="barra-indice">
        <div class="barra-indice-interior">
          <span class="indice-donde"><span class="indice-etiqueta">Estás leyendo</span> <b class="indice-actual">Resumen</b></span>
          <span class="indice-acciones">
            <button class="indice-arriba" type="button" aria-label="Volver al inicio del artículo" title="Volver arriba"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5l-7 7m7-7 7 7M12 5v14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="indice-boton" type="button" aria-expanded="false" aria-controls="indice-panel"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Índice</span></button>
          </span>
        </div>
        <nav class="indice-panel" id="indice-panel" aria-label="En este artículo" hidden><p class="indice-titulo">En este artículo</p><ol></ol></nav>
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
          <div class="caja interaccion">
            <h3>Lectores de este artículo</h3>
            ${GC.codigo ? `<div class="cifras">
              <div><b data-cifra="/articulo/${esc(a.id)}">…</b><span>lecturas</span></div>
              <div><b data-cifra="/descarga/${esc(a.id)}">…</b><span>descargas</span></div>
              <div><b data-cifra="/util/${esc(a.id)}">…</b><span>le fue útil</span></div>
            </div>` : `<p class="aviso" style="margin:0 0 8px">Las cifras de lecturas y descargas aparecerán cuando se active el contador de visitas.</p>`}
            <button class="btn claro util" type="button" id="btn-util" ${yaUtil(a.id) ? 'aria-pressed="true" disabled' : 'aria-pressed="false"'}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>
              <span>${yaUtil(a.id) ? "¡Gracias por contarnos!" : "Este artículo me fue útil"}</span></button>
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

  function activarArticulo(id) {
    contar({ path: `/articulo/${id}`, title: `Lectura: ${(A.find((x) => x.id === id) || {}).titulo || id}` });
    const pdf = app.querySelector('.ficha a[download]');
    if (pdf) pdf.addEventListener("click", () => contar({ path: `/descarga/${id}`, title: `Descarga PDF: ${id}` }));
    const util = document.getElementById("btn-util");
    if (util) util.addEventListener("click", () => {
      contar({ path: `/util/${id}`, title: `Me fue útil: ${id}` });
      try { localStorage.setItem("lehes-util-" + id, "1"); } catch (_) {}
      util.disabled = true; util.setAttribute("aria-pressed", "true");
      util.querySelector("span").textContent = "¡Gracias por contarnos!";
      util.classList.add("latido");
    });
    pintarCifras(app);
    app.querySelectorAll(".idiomas button").forEach((b) => b.addEventListener("click", () => {
      app.querySelectorAll(".idiomas button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      app.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.idioma; });
    }));
    const texto = document.getElementById("texto-articulo");
    texto.querySelectorAll("table").forEach((t) => { const d = document.createElement("div"); d.className = "tabla"; t.replaceWith(d); d.appendChild(t); });
    texto.querySelectorAll("img").forEach((im) => { im.src = rutaRecurso(im.getAttribute("src")); });
    if (window.LEHESIndice) window.LEHESIndice.iniciar(app);
    document.getElementById("btn-citar").addEventListener("click", async (e) => {
      const t = document.getElementById("texto-cita").innerText;
      try { await navigator.clipboard.writeText(t); e.target.textContent = "¡Cita copiada!"; }
      catch (_) { e.target.textContent = "Selecciona el texto y cópialo"; }
      setTimeout(() => { e.target.textContent = "Copiar cita"; }, 2400);
    });
  }

  const colorNucleo = (n) => `--c: var(--${n.color});`;
  const visibles = () => (D ? D.personas.filter((p) => p.autoriza_publicacion) : []);
  const nucleoDe = (id) => D.nucleos.find((n) => n.id === id) || D.nucleos[0];
  function retrato(p, clase = "retrato") {
    const n = nucleoDe(p.nucleo);
    return !vacio(p.foto) && p.foto
      ? `<img class="${clase}" src="${esc(rutaRecurso(p.foto))}" alt="Retrato de ${esc(p.nombre)}" loading="lazy" style="${colorNucleo(n)}">`
      : `<span class="${clase} avatar-grande" style="${colorNucleo(n)}" aria-hidden="true">${iniciales(p.nombre)}</span>`;
  }
  const anios = (p) => vacio(p.anios_experiencia) ? "" : `<span class="anios"><b>${esc(p.anios_experiencia)}</b> años enseñando</span>`;

  const etiquetaNucleo = (t) => { const x = t.replace(/^Núcleo (de )?/, ""); return x.charAt(0).toUpperCase() + x.slice(1); };
  let filtroDocentes = "todos";
  V.docentes = () => {
    if (!D) return `<section class="vista"><h1>Nuestros maestros</h1><p class="aviso">Pronto conocerás aquí al equipo de la ENSO.</p></section>`;
    return `<section class="vista">
      <p class="mano">Quienes enseñan, también investigan</p>
      <h1>Nuestros maestros</h1>
      <p class="lead">El equipo directivo y docente de la ${esc(R.institucion)}, organizado por núcleos. Cada tarjeta cuenta su formación, su recorrido en la investigación y algo de lo que les mueve fuera del aula.</p>
      <label class="etiqueta" for="buscar-docente">Buscar por nombre o área</label>
      <input id="buscar-docente" class="campo" type="search" placeholder="Ej.: matemáticas, inglés, preescolar">
      <div class="filtros" role="group" aria-label="Filtrar por núcleo">
        <button type="button" data-n="todos">Todos</button>
        ${D.nucleos.map((n) => `<button type="button" data-n="${esc(n.id)}">${esc(etiquetaNucleo(n.nombre))}</button>`).join("")}
      </div>
      <div id="nucleos"></div>
      <p class="aviso" id="sin-docentes" hidden>No hay perfiles con esa búsqueda.</p>
      <p class="aviso">Los perfiles se publican con autorización de cada persona, según la Ley 1581 de 2012 de protección de datos personales.</p>
    </section>`;
  };
  function tarjetaDocente(p) {
    const n = nucleoDe(p.nucleo);
    return `<a class="docente ${p.ejemplo ? "ejemplo" : ""}" href="${esc(p.ejemplo ? "#docente-" + p.id : enlaceDocente(p.id))}" style="${colorNucleo(n)}">
      ${retrato(p)}
      <span class="docente-texto">
        <b>${mostrarValor(p.nombre, "Por designar")}</b>
        <span class="cargo-d">${mostrarValor(p.cargo, "")}</span>
        ${vacio(p.aula) ? "" : `<span class="aula">${esc(p.aula)}</span>`}
        ${anios(p)}
        ${vacio(p.frase) ? "" : `<span class="frase">«${esc(p.frase)}»</span>`}
        ${p.ejemplo ? `<span class="muestra">Perfil de ejemplo</span>` : ""}
      </span></a>`;
  }
  function activarDocentes() {
    const caja = document.getElementById("buscar-docente");
    const botones = app.querySelectorAll(".filtros button");
    const pintar = () => {
      const q = sinTilde(caja.value.trim());
      botones.forEach((b) => b.setAttribute("aria-pressed", b.dataset.n === filtroDocentes ? "true" : "false"));
      let total = 0;
      document.getElementById("nucleos").innerHTML = D.nucleos.filter((n) => filtroDocentes === "todos" || n.id === filtroDocentes).map((n) => {
        const gente = visibles().filter((p) => p.nucleo === n.id && (!q || sinTilde([p.nombre, p.cargo, p.aula, (p.formacion || []).join(" ")].join(" ")).includes(q)));
        total += gente.length;
        if (!gente.length && (q || filtroDocentes === "todos")) return "";
        return `<section class="nucleo" style="${colorNucleo(n)}">
          <h2><span class="punto" aria-hidden="true"></span>${esc(n.nombre)}</h2>
          <p class="nucleo-desc">${esc(n.descripcion)}</p>
          <div class="rejilla-docentes">${gente.length ? gente.map(tarjetaDocente).join("") : `<p class="aviso">Pronto conocerás a los maestros de este núcleo.</p>`}</div>
        </section>`;
      }).join("");
      document.getElementById("sin-docentes").hidden = total > 0 || !q;
    };
    caja.addEventListener("input", pintar);
    botones.forEach((b) => b.addEventListener("click", () => { filtroDocentes = b.dataset.n; pintar(); }));
    pintar();
  }

  V.docente = (id) => {
    const p = visibles().find((x) => x.id === id);
    if (!p) return `<section class="vista"><h1>Perfil no disponible</h1><p><a href="#docentes">Ver todos los maestros</a></p></section>`;
    const n = nucleoDe(p.nucleo);
    const formacion = (p.formacion || []).filter((f) => !vacio(f));
    const enl = p.enlaces || {};
    const enlaces = [
      enl.orcid && `<a href="https://orcid.org/${esc(enl.orcid)}" rel="noopener">ORCID</a>`,
      enl.cvlac && `<a href="${esc(enl.cvlac)}" rel="noopener">CvLAC (Minciencias)</a>`,
      enl.scholar && `<a href="${esc(enl.scholar)}" rel="noopener">Google Académico</a>`,
    ].filter(Boolean);
    const pubs = (p.publicaciones || []).filter((x) => !vacio(x));
    const suyos = A.filter((a) => a.autores.some((x) => sinTilde(x.nombre) === sinTilde(p.nombre)));
    return `<section class="vista perfil" style="${colorNucleo(n)}">
      <a class="volver" href="#docentes">← Nuestros maestros</a>
      <div class="perfil-cabeza">
        ${retrato(p, "retrato retrato-grande")}
        <div>
          <span class="chip" style="--c: var(--${n.color}); --t: ${n.color === "color-hablar" ? "var(--azul-noche)" : "#fff"}">${esc(n.nombre)}</span>
          <h1>${mostrarValor(p.nombre)}</h1>
          <p class="lead" style="margin:0">${mostrarValor(p.cargo, "")}${vacio(p.aula) ? "" : ` · ${esc(p.aula)}`}</p>
          ${anios(p)}
          ${vacio(p.frase) ? "" : `<p class="frase-grande">«${esc(p.frase)}»</p>`}
        </div>
      </div>
      <div class="perfil-rejilla">
        <div class="caja"><h3>Formación</h3>${formacion.length ? `<ul>${formacion.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="por-llenar">Por completar</p>`}</div>
        ${vacio(p.investigacion) && !pubs.length && vacio(p.otros_cargos) && !enlaces.length ? "" : `<div class="caja"><h3>Trayectoria en investigación</h3>
          ${vacio(p.investigacion) ? "" : `<p>${esc(p.investigacion)}</p>`}
          ${pubs.length ? `<h4 class="sub-caja">Publicaciones</h4><ul class="pubs">${pubs.map((x) => `<li>${esc(x).replace(/(https?:\/\/[^\s<]+[^\s<.,;])/g, '<a href="$1" rel="noopener">$1</a>')}</li>`).join("")}</ul>` : ""}
          ${vacio(p.otros_cargos) ? "" : `<p class="aviso">${esc(p.otros_cargos)}</p>`}
          ${enlaces.length ? `<p class="enlaces-perfil">${enlaces.join(" · ")}</p>` : ""}</div>`}
        ${vacio(p.hobbies) ? "" : `<div class="caja"><h3>Fuera del aula</h3><p>${esc(p.hobbies)}</p></div>`}
        ${suyos.length ? `<div class="caja"><h3>Publicado en LEHES</h3><ul>${suyos.map((a) => `<li><a href="${esc(enlaceArticulo(a.id))}">${esc(a.titulo)}</a></li>`).join("")}</ul></div>` : ""}
      </div>
    </section>`;
  };

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

  const perfilPorNombre = (n) => D && D.personas.find((p) => p.autoriza_publicacion && !p.ejemplo && sinTilde(p.nombre) === sinTilde(n));
  const nombreEnlazado = (n) => { const p = perfilPorNombre(n); return p ? `<a class="a-perfil" href="${esc(enlaceDocente(p.id))}">${esc(n)}</a>` : esc(n); };
  V.comite = () => {
    const n = numero(R.numero_actual);
    const fotoDe = (nom) => { const p = perfilPorNombre(nom); return p && !vacio(p.foto) ? rutaRecurso(p.foto) : ""; };
    return `<section class="vista">
      <h1>Comité editorial</h1>
      <p class="lead">Las personas que cuidan la calidad de lo que se publica en LEHES.</p>
      <div class="comite">
        ${R.comite.map((p) => {
          const foto = vacio(p.nombre) ? "" : fotoDe(p.nombre);
          return `<div class="persona ${vacio(p.nombre) ? "vacia" : ""} ${p.grupo ? "grupo" : ""}">
          ${foto ? `<img class="avatar" src="${esc(foto)}" alt="">` : `<span class="avatar" aria-hidden="true">${p.grupo ? "∞" : iniciales(p.nombre)}</span>`}
          <div><span class="cargo">${esc(p.cargo)}</span><p><b>${vacio(p.nombre) ? mostrarValor(p.nombre) : nombreEnlazado(p.nombre)}</b>
          ${vacio(p.filiacion) ? "" : `<br>${esc(p.filiacion)}`}
          ${p.correo ? `<br><a href="mailto:${esc(p.correo)}">${esc(p.correo)}</a>` : ""}
          ${p.orcid ? `<br><a href="https://orcid.org/${esc(p.orcid)}">ORCID</a>` : ""}</p></div></div>`;
        }).join("")}
      </div>
      ${n.creditos ? `<h2 style="margin-top:1.6em">Equipo del Vol. ${n.volumen}, Núm. ${n.numero}</h2>
      <div class="tabla-creditos">${n.creditos.map(([rol, nom]) => `<div class="credito"><span class="rol">${esc(rol)}</span><span>${vacio(nom) ? `<span class="por-llenar">Por registrar</span>` : nom.split(/\s+y\s+/).map(nombreEnlazado).join(" y ")}</span></div>`).join("")}</div>` : ""}
      <p class="aviso">Sello editorial: ${esc(R.sello_editorial || R.institucion)}. Este número es financiado por la ${esc(R.financiacion || R.institucion)}.</p>
    </section>`;
  };

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
      ${SITIOS().length ? `<h2>Sitios de la ENSO</h2><p>Conoce más de la institución en sus sitios oficiales:</p><ul class="sitios sitios-grandes">${listaSitios()}</ul>` : ""}
      <h2>Financiación</h2>
      <p>LEHES es financiada por la ${esc(R.financiacion || R.institucion)}. Sello editorial: ${esc(R.sello_editorial || R.institucion)}.</p>
      <h2>Adquisición, canje y contacto</h2>
      <p>${esc(R.institucion)}${R.direccion ? `<br>${esc(R.direccion)}` : ""}
      ${vacio(R.correo_contacto) ? "" : `<br>Correo: <a href="mailto:${esc(R.correo_contacto)}">${esc(R.correo_contacto)}</a>`}
      ${R.whatsapp && !vacio(R.whatsapp.numero) ? `<br>WhatsApp: <a href="${esc(R.enlaces.canal_whatsapp)}" rel="noopener">${esc(R.whatsapp.numero)}</a> (${esc(R.whatsapp.nombre)}, ${esc(R.whatsapp.cargo)})` : ""}</p>
      ${R.estado_legal ? `<p class="aviso">Estado legal: NIT ${esc(R.estado_legal.nit)} · DANE ${esc(R.estado_legal.dane)}</p>` : ""}
    </section>`;

  V.suscribirse = () => {
    const e = R.enlaces;
    return `<section class="vista texto-largo">
      <p class="mano">Que cada número te llegue</p>
      <h1>Suscríbete a LEHES</h1>
      <p class="lead">Es gratis. Te avisamos cuando salga un número nuevo, con el enlace para leerlo aquí o descargarlo en PDF, y te contamos cuando abra una convocatoria.</p>
      <div class="descargas">
        ${vacio(e.formulario_suscripcion) ? `<a class="btn" aria-disabled="true">Formulario de suscripción (pronto)</a>` : `<a class="btn" href="${esc(e.formulario_suscripcion)}" rel="noopener">Suscribirme por correo</a>`}
        ${vacio(e.canal_whatsapp) ? "" : `<a class="btn whatsapp" href="${esc(e.canal_whatsapp)}" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>Recibir la revista por WhatsApp</a>`}
      </div>
      ${R.whatsapp && !vacio(R.whatsapp.numero) ? `<p class="aviso">Por WhatsApp te atiende ${esc(R.whatsapp.nombre)}, ${esc(R.whatsapp.cargo)}: <b>${esc(R.whatsapp.numero)}</b>.</p>` : ""}
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
    if (h.startsWith("articulo-") && !window.LEHES_EMBEBIDO) { location.replace(enlaceArticulo(h.slice(9))); return; }
    if (h.startsWith("articulo-")) html = await V.articulo(h.slice(9));
    else if (h.startsWith("docente-") && !window.LEHES_EMBEBIDO && perfilPublico(h.slice(8))) { location.replace(enlaceDocente(h.slice(8))); return; }
    else if (h.startsWith("docente-")) html = V.docente(h.slice(8));
    else { if (!VISTAS_FIJAS.includes(h)) h = "inicio"; html = V[h](); }
    app.innerHTML = html;
    const marcar = h.startsWith("articulo-") ? "archivo" : h.startsWith("docente-") ? "docentes" : h;
    document.querySelectorAll(".pestanas a").forEach((a) => {
      if (a.getAttribute("href") === `#${marcar}`) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (h === "archivo") activarArchivo();
    if (h === "docentes") activarDocentes();
    if (!h.startsWith("articulo-")) contar({ path: "/" + h, title: document.title + " · " + h });
    if (h.startsWith("articulo-")) activarArticulo(h.slice(9));
    if (h === "inicio") maquinaDeEscribir();
    app.querySelectorAll("[data-filtro]").forEach((x) => x.addEventListener("click", () => { filtroArchivo = x.dataset.filtro; }));
    scrollTo(0, 0);
    progreso();
  }

  const SITIOS = () => [
    [R.enlaces.sitio_enso, "Escuela Normal Superior Oiba", "Sitio institucional"],
    [R.enlaces.pfc_medios, "ENSO PFC Medios", "Programa de Formación Complementaria"],
  ].filter(([u]) => !vacio(u));
  const listaSitios = () => SITIOS().map(([u, t, d]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a><span>${esc(d)}</span></li>`).join("");
  function rellenarPie() {
    const ul = document.getElementById("sitios-enso");
    if (ul) ul.innerHTML = listaSitios();
    document.querySelectorAll("[data-campo]").forEach((el) => { el.innerHTML = mostrarValor(R[el.dataset.campo], "en trámite"); });
    const lic = document.querySelector('[data-enlace="licencia"]');
    lic.href = R.licencia.url; lic.textContent = R.licencia.sigla;
  }

  async function iniciar() {
    try {
      [R, A] = await Promise.all([leer("datos/revista.json", true), leer("datos/articulos.json", true)]);
      try { D = await leer("datos/docentes.json", true); } catch (_) { D = null; }
    } catch (e) {
      app.innerHTML = `<section class="vista"><h1>No se pudieron cargar los datos</h1>
        <p>Si abriste el archivo index.html con doble clic, el navegador bloquea la lectura de los datos. Ábrelo con un servidor local (ver el paso a paso) o desde GitHub Pages.</p>
        <p class="aviso">${esc(e.message)}</p></section>`;
      return;
    }
    A.sort((x, y) => y.anio - x.anio);
    rellenarPie();
    iniciarEstadisticas();
    const total = document.getElementById("visitas-total");
    if (total) {
      if (GC.codigo) { total.hidden = false; total.querySelector("b").dataset.cifra = "TOTAL"; pintarCifras(total); }
    }
    addEventListener("hashchange", mostrar);
    mostrar();
  }
  iniciar();
})();
