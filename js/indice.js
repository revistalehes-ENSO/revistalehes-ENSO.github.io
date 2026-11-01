/* LEHES · índice flotante de los artículos.
   Barra fija bajo el encabezado: muestra la sección en la que va el lector y despliega
   el índice completo. Se usa en las páginas de artículo y en la vista previa del sitio. */
(function () {
  "use strict";

  function iniciar(raiz) {
    raiz = raiz || document;
    const barra = raiz.querySelector(".barra-indice");
    const texto = raiz.querySelector("#texto-articulo");
    if (!barra || !texto || barra.dataset.listo) return;
    barra.dataset.listo = "1";

    const boton = barra.querySelector(".indice-boton");
    const panel = barra.querySelector(".indice-panel");
    const lista = panel.querySelector("ol");
    const actual = barra.querySelector(".indice-actual");
    const arriba = barra.querySelector(".indice-arriba");

    // Secciones: el resumen, cada título de nivel 2 del texto y la versión en PDF
    const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const secciones = [];
    const resumen = raiz.querySelector(".resumen");
    if (resumen) { resumen.id = resumen.id || "resumen"; secciones.push({ el: resumen, nombre: "Resumen" }); }
    texto.querySelectorAll("h2").forEach((h) => { h.id = h.id || slug(h.textContent); secciones.push({ el: h, nombre: h.textContent.trim() }); });
    const pdf = raiz.querySelector("#pdf-completo");
    if (pdf) secciones.push({ el: pdf, nombre: "Versión en PDF" });

    lista.innerHTML = secciones.map((s, i) =>
      `<li><a href="#${s.el.id}" data-i="${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span>${s.nombre.replace(/[<>&]/g, "")}</a></li>`).join("");

    // Altura del encabezado, para que la barra quede justo debajo
    const cab = document.querySelector(".cabecera");
    const medir = () => document.documentElement.style.setProperty("--alto-cabecera", (cab ? cab.offsetHeight : 0) + "px");
    medir(); addEventListener("resize", medir);

    const abrir = (si) => {
      boton.setAttribute("aria-expanded", si ? "true" : "false");
      panel.hidden = !si;
      if (si) { const a = lista.querySelector(".activo") || lista.querySelector("a"); if (a) a.focus({ preventScroll: true }); }
    };
    boton.addEventListener("click", () => abrir(panel.hidden));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { abrir(false); boton.focus(); } });
    document.addEventListener("click", (e) => { if (!panel.hidden && !barra.contains(e.target)) abrir(false); });

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const destino = (el) => el.getBoundingClientRect().top + scrollY - (cab ? cab.offsetHeight : 0) - barra.offsetHeight - 12;
    const ir = (el) => {
      scrollTo({ top: destino(el), behavior: reduce ? "auto" : "smooth" });
      // Si una imagen terminó de cargar durante el desplazamiento y movió el texto, se corrige la posición
      [700, 1400].forEach((t) => setTimeout(() => {
        const d = destino(el);
        if (Math.abs(d - scrollY) > 24) scrollTo({ top: d, behavior: "auto" });
      }, t));
    };
    lista.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-i]"); if (!a) return;
      e.preventDefault(); abrir(false); ir(secciones[+a.dataset.i].el);
    });
    if (arriba) arriba.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

    // Sección actual según el desplazamiento
    let iActual = -1;
    const marcar = () => {
      const limite = (cab ? cab.offsetHeight : 0) + barra.offsetHeight + 40;
      let i = 0;
      secciones.forEach((s, k) => { if (s.el.getBoundingClientRect().top - limite <= 0) i = k; });
      if (i === iActual) return;
      iActual = i;
      actual.textContent = secciones[i] ? secciones[i].nombre : "";
      lista.querySelectorAll("a").forEach((a) => a.classList.toggle("activo", +a.dataset.i === i));
      barra.style.setProperty("--avance", `${((i + 1) / secciones.length) * 100}%`);
    };
    let pendiente = false;
    addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(() => { marcar(); pendiente = false; }); } }, { passive: true });
    marcar();
  }

  window.LEHESIndice = { iniciar };
  if (document.body && document.body.dataset.articulo) iniciar(document);
})();
