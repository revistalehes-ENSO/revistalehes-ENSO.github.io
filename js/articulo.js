/* LEHES · comportamiento de las páginas de artículo (articulo/<id>/).
   Resumen/abstract, copiar cita, barra de lectura, contador de visitas y "me fue útil". */
(function () {
  "use strict";
  const id = document.body.dataset.articulo;
  const raiz = document.body.dataset.raiz || "../../";
  const vacio = (s) => !s || /^\s*\[.*\]\s*$/.test(String(s));

  // Resumen / Abstract
  document.querySelectorAll(".idiomas button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".idiomas button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.idioma; });
  }));

  // Copiar cita
  const citar = document.getElementById("btn-citar");
  if (citar) citar.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(document.getElementById("texto-cita").innerText); citar.textContent = "¡Cita copiada!"; }
    catch (_) { citar.textContent = "Selecciona el texto y cópialo"; }
    setTimeout(() => { citar.textContent = "Copiar cita"; }, 2400);
  });

  // Barra de progreso de lectura
  const barra = document.getElementById("progreso");
  const progreso = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    barra.style.width = h > 0 ? `${Math.min(100, (scrollY / h) * 100)}%` : "0";
  };
  addEventListener("scroll", progreso, { passive: true });

  // "Me fue útil" (una vez por navegador)
  const util = document.getElementById("btn-util");
  const clave = "lehes-util-" + id;
  let yaUtil = false;
  try { yaUtil = localStorage.getItem(clave) === "1"; } catch (_) {}
  const marcarUtil = () => {
    util.disabled = true; util.setAttribute("aria-pressed", "true");
    util.querySelector("span").textContent = "¡Gracias por contarnos!";
  };
  if (yaUtil) marcarUtil();

  // Contador (GoatCounter, sin cookies)
  fetch(raiz + "datos/revista.json").then((r) => r.json()).then((R) => {
    const codigo = R.estadisticas && R.estadisticas.goatcounter;
    const avisar = () => {
      const caja = document.getElementById("interaccion");
      const p = document.createElement("p");
      p.className = "aviso"; p.style.margin = "0 0 8px";
      p.textContent = "Las cifras de lecturas y descargas aparecerán cuando se active el contador de visitas.";
      caja.insertBefore(p, util);
    };
    if (vacio(codigo)) { avisar(); conectarUtil(null); return; }
    const gc = `https://${codigo.trim()}.goatcounter.com`;
    const cola = [];
    const contar = (path, title) => {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title });
      else cola.push({ path, title });
    };
    const sc = document.createElement("script");
    sc.async = true; sc.src = "https://gc.zgo.at/count.js";
    sc.dataset.goatcounter = gc + "/count";
    sc.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    sc.onload = () => cola.splice(0).forEach((x) => window.goatcounter.count(x));
    document.head.appendChild(sc);

    contar(`/articulo/${id}`, `Lectura: ${document.title}`);
    document.querySelectorAll("[data-descarga]").forEach((a) => a.addEventListener("click", () => contar(`/descarga/${id}`, `Descarga PDF: ${id}`)));
    conectarUtil(contar);

    const cifras = document.querySelector(".cifras");
    cifras.hidden = false;
    const total = document.getElementById("visitas-total");
    if (total) { total.hidden = false; total.querySelector("b").dataset.cifra = "TOTAL"; }
    document.querySelectorAll("[data-cifra]").forEach(async (el) => {
      try {
        const r = await fetch(`${gc}/counter/${encodeURIComponent(el.dataset.cifra)}.json`);
        el.textContent = r.status === 404 ? "0" : r.ok ? (await r.json()).count : "—";
      } catch (_) { el.textContent = "—"; }
    });
  }).catch(() => conectarUtil(null));

  function conectarUtil(contar) {
    if (!util || yaUtil) return;
    util.addEventListener("click", () => {
      if (contar) contar(`/util/${id}`, `Me fue útil: ${id}`);
      try { localStorage.setItem(clave, "1"); } catch (_) {}
      marcarUtil(); util.classList.add("latido");
    }, { once: true });
  }
})();
