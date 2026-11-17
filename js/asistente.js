/* =====================================================================
   LEHES · asistente de búsqueda ("Pregúntale a LEHES")
   ---------------------------------------------------------------------
   Ventana de conversación que responde con los textos publicados en la
   revista: busca en todos los artículos y muestra los pasajes donde
   aparece el tema, con el enlace a la sección exacta. También orienta
   sobre cómo publicar, citar, suscribirse o escribirnos.
   No inventa respuestas: solo muestra lo que está en la revista.
   ===================================================================== */
(function () {
  "use strict";
  const B = window.LEHESBuscador;
  if (!B || document.getElementById("asistente")) return;
  const base = document.body.dataset.raiz || "";
  const esc = B.esc;
  const ir = (h) => base + "#" + h;
  const enlace = (id, ancla) => (window.LEHES_EMBEBIDO ? `#articulo-${id}` : `${base}articulo/${id}/`) + (ancla && !window.LEHES_EMBEBIDO ? `#${ancla}` : "");
  const contar = (path, title) => { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title }); } catch (_) {} };

  /* Preguntas frecuentes: palabras que las activan y respuesta */
  const GUIAS = [
    { claves: ["publicar", "enviar", "postular", "someter", "normas", "convocatoria", "autores", "manuscrito", "requisitos", "plantilla"],
      r: () => `Para publicar en LEHES revisa las normas, la plantilla (Word o LaTeX) y el proceso de evaluación en <a href="${ir("envios")}">Publicar en LEHES</a>. Si te queda una duda, <a href="${ir("contacto")}">escríbenos</a>.` },
    { claves: ["citar", "cita", "cito", "citas", "apa", "referenciar", "bibtex", "ris", "zotero", "mendeley"],
      r: () => `Cada artículo trae la cita en formato APA lista para copiar (botón <b>Copiar cita</b>) y los archivos BibTeX y RIS para Zotero o Mendeley. Abre el artículo desde el <a href="${ir("archivo")}">Archivo</a> y busca el recuadro «Cómo citar».` },
    { claves: ["contacto", "contactar", "correo", "email", "escribir", "sugerencia", "sugerencias", "comentario", "comentarios", "queja", "mensaje", "whatsapp"],
      r: () => `Puedes dejarnos un comentario, una sugerencia o una pregunta en <a href="${ir("contacto")}">Contacto</a>. El mensaje llega al correo de la revista y te respondemos a la dirección que nos dejes.` },
    { claves: ["suscribir", "suscribirme", "suscripcion", "boletin", "avisos", "notificaciones", "novedades"],
      r: () => `En <a href="${ir("suscribirse")}">Suscribirme</a> puedes recibir un aviso cada vez que salga un número nuevo.` },
    { claves: ["pdf", "descargar", "descarga", "impresa", "imprimir", "completa", "revista completa"],
      r: () => `La edición impresa completa está en <a href="${ir("numero-actual")}">Número actual</a>: puedes hojearla en el navegador o descargarla. Cada artículo tiene además su propio PDF.` },
    { claves: ["comite", "editor", "editorial", "evaluadores", "pares"],
      r: () => `Los nombres del equipo editorial y de los comités están en <a href="${ir("comite")}">Comité editorial</a>.` },
    { claves: ["maestros", "docentes", "profesores", "nucleo", "nucleos"],
      r: () => `En <a href="${ir("docentes")}">Nuestros maestros</a> están los docentes de la Escuela Normal Superior Oiba, organizados por núcleos.` },
    { claves: ["lehes", "acerca", "quienes", "significa", "mision", "proposito", "enso", "normal"],
      r: () => `LEHES significa <b>Leer, Escribir, Hablar &amp; Escuchar</b>. Es la revista académica de la Escuela Normal Superior Oiba, donde maestros y maestros en formación comparten sus investigaciones. Más en <a href="${ir("acerca")}">Acerca de</a>.` },
  ];
  const SALUDOS = ["hola", "buenas", "buenos", "buen", "saludos", "hey", "gracias"];

  /* ---------- interfaz ---------- */
  const caja = document.createElement("div");
  caja.id = "asistente";
  caja.innerHTML = `
    <button class="asis-boton" type="button" aria-expanded="false" aria-controls="asis-panel">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      <span>Pregúntale a LEHES</span>
    </button>
    <section class="asis-panel" id="asis-panel" role="dialog" aria-label="Pregúntale a LEHES" hidden>
      <header>
        <img src="${base}img/logo-lehes.png" alt="" width="40" height="27">
        <div><b>Pregúntale a LEHES</b><small>Busco en todo lo que ha publicado la revista</small></div>
        <button class="asis-cerrar" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="asis-hilo" aria-live="polite"></div>
      <div class="asis-sugerencias"></div>
      <form class="asis-form">
        <label class="visualmente-oculto" for="asis-entrada">Escribe un tema o una pregunta</label>
        <input id="asis-entrada" type="text" autocomplete="off" maxlength="200" placeholder="Ej.: gamificación en primaria">
        <button class="btn" type="submit" aria-label="Buscar"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </form>
    </section>`;
  document.body.appendChild(caja);
  const boton = caja.querySelector(".asis-boton"), panel = caja.querySelector(".asis-panel");
  const hilo = caja.querySelector(".asis-hilo"), entrada = caja.querySelector("#asis-entrada"), sug = caja.querySelector(".asis-sugerencias");

  const decir = (html, quien = "lehes") => {
    const d = document.createElement("div");
    d.className = "asis-msj " + quien;
    d.innerHTML = html;
    hilo.appendChild(d);
    hilo.scrollTop = hilo.scrollHeight;
    return d;
  };
  let saludado = false;
  function abrir(v) {
    panel.hidden = !v;
    boton.setAttribute("aria-expanded", String(v));
    caja.classList.toggle("abierto", v);
    if (v) {
      B.cargar(base).catch(() => {});
      if (!saludado) {
        saludado = true;
        decir("¡Hola! Escríbeme un tema, un concepto o una pregunta y te muestro en qué artículos de la revista aparece y en qué parte. También puedo orientarte sobre cómo publicar, citar o escribirnos.");
        sug.innerHTML = ["Gamificación", "Lúdica en matemáticas", "Enseñanza del inglés", "¿Cómo publico?", "¿Cómo cito un artículo?"]
          .map((t) => `<button type="button">${esc(t)}</button>`).join("");
      }
      setTimeout(() => entrada.focus(), 50);
    }
  }
  boton.addEventListener("click", () => abrir(panel.hidden));
  caja.querySelector(".asis-cerrar").addEventListener("click", () => { abrir(false); boton.focus(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { abrir(false); boton.focus(); } });
  sug.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) preguntar(b.textContent); });
  caja.querySelector(".asis-form").addEventListener("submit", (e) => { e.preventDefault(); preguntar(entrada.value); });

  async function preguntar(texto) {
    texto = String(texto || "").trim();
    if (!texto) return;
    entrada.value = "";
    sug.innerHTML = "";
    decir(esc(texto), "persona");
    const pensando = decir('<span class="asis-puntos"><i></i><i></i><i></i></span>');
    contar("/asistente", "Consulta al asistente");
    const n = B.normal(texto);
    const pal = n.split(/[^a-z0-9]+/).filter(Boolean);
    // "publico", "publicar" y "publicación" activan la misma guía (se comparan las primeras letras)
    const coincide = (p, c) => p === c || (c.length >= 5 && p.length >= 4 && p.slice(0, 5) === c.slice(0, 5));
    const guia = GUIAS.find((g) => g.claves.some((c) => (c.includes(" ") ? n.includes(c) : pal.some((p) => coincide(p, c)))));
    const contenido = B.palabras(texto).filter((p) => !SALUDOS.includes(p) && !(guia && guia.claves.some((c) => coincide(p, c))) &&
      !["como", "puedo", "donde", "quiero", "necesito", "busco", "articulo", "articulos", "revista", "hay", "sobre", "tema", "temas", "algo", "informacion"].includes(p));
    let html = "";
    if (guia) html += `<p>${guia.r()}</p>`;
    if (!guia && pal.every((p) => SALUDOS.includes(p))) {
      pensando.innerHTML = "¡Hola! ¿Sobre qué tema quieres buscar? Puedes escribir, por ejemplo, «motivación», «multiplicación» o «inglés en primaria».";
      return;
    }
    if (contenido.length) {
      try { await B.cargar(base); } catch (_) { pensando.innerHTML = "No pude abrir el índice de la revista. Revisa tu conexión e inténtalo de nuevo."; return; }
      const r = B.buscar(contenido.join(" "), { max: 3, pasajes: 2 });
      if (r.length) {
        html += `<p>${guia ? "Además, encontré esto en la revista:" : r.length === 1 ? "Encontré este artículo:" : `Encontré ${r.length === 3 ? "estos artículos (los más cercanos primero)" : "estos artículos"}:`}</p>`;
        html += r.map(({ articulo: a, pasajes }) => `
          <div class="asis-res">
            <a class="asis-tit" href="${esc(enlace(a.id))}">${esc(a.titulo)}</a>
            <small>${esc(a.autores.join(", "))} · ${esc(a.numero)} (${a.anio})</small>
            ${pasajes.map((p) => `<a class="asis-pasaje" href="${esc(enlace(a.id, p.ancla))}"><span>${esc(p.seccion)}</span>${p.html}</a>`).join("")}
          </div>`).join("");
        html += `<p class="asis-mas"><a href="${base}?q=${encodeURIComponent(contenido.join(" "))}#buscar">Ver todos los resultados</a></p>`;
      } else if (!guia) {
        html += `<p>No encontré «${esc(texto)}» en los artículos publicados hasta ahora. Prueba con otra palabra o un sinónimo, o mira el <a href="${ir("archivo")}">Archivo</a> completo.</p>
                 <p>Si te interesa que la revista trate ese tema, <a href="${ir("contacto")}">cuéntanos</a>.</p>`;
      }
    }
    if (!html) html = `<p>Cuéntame un poco más: ¿qué tema quieres buscar en la revista?</p>`;
    pensando.innerHTML = html;
    hilo.scrollTop = pensando.offsetTop - 8;
  }

  window.LEHESAsistente = { abrir: () => abrir(true), preguntar: (t) => { abrir(true); preguntar(t); } };
})();
