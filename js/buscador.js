/* =====================================================================
   LEHES · buscador de la revista
   ---------------------------------------------------------------------
   Busca en el texto completo de todos los artículos publicados
   (título, resumen, palabras clave, cada sección y las referencias).
   Funciona dentro del navegador: no envía las búsquedas a ningún
   servidor y no necesita claves ni pagos. El índice lo genera
   herramientas/generar.py en datos/busqueda.json.
   ===================================================================== */
(function () {
  "use strict";

  const VACIAS = new Set(("a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estas este esto estos fue fueron ha han hay la las le les lo los mas me mi muy no nos o otra otras otro otros para pero poco por que quien se segun ser si sin sobre son su sus tambien tan te tiene tienen todo todos tras tu un una unas uno unos y ya yo " +
    "the of and to in on for with is are by an or as at be from this that").split(" "));

  const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Raíz sencilla en español: "estrategias", "estrategia" y "estratégico" se encuentran entre sí.
  const raiz = (p) => {
    if (p.length <= 4) return p;
    for (const suf of ["amientos", "imientos", "amiento", "imiento", "aciones", "iciones", "acion", "icion", "mente", "idades", "idad", "ivas", "ivos", "iva", "ivo",
                       "ales", "ores", "ados", "idos", "adas", "idas", "ado", "ido", "ada", "ida", "es", "as", "os", "s", "a", "o", "e"]) {
      if (p.endsWith(suf) && p.length - suf.length >= 4) return p.slice(0, -suf.length);
    }
    return p;
  };
  const palabras = (s) => normal(s).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 1 && !VACIAS.has(p));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let datos = null;     // contenido de busqueda.json
  let promesa = null;

  // Prepara cada bloque de texto una sola vez: lista de raíces para comparar rápido.
  function preparar(j) {
    j.articulos.forEach((a) => {
      a._campos = {
        titulo: palabras(a.titulo + " " + (a.titulo_ingles || "")).map(raiz),
        clave: palabras((a.palabras_clave || []).join(" ") + " " + (a.keywords || []).join(" ")).map(raiz),
        autores: palabras(a.autores.join(" ")).map(raiz),
      };
      a.bloques.forEach((b) => { b._r = palabras(b.t).map(raiz); b._h = palabras(b.s).map(raiz); b._n = normal(b.t); });
    });
    return j;
  }

  function cargar(base) {
    if (datos) return Promise.resolve(datos);
    if (promesa) return promesa;
    const emb = window.LEHES_EMBEBIDO;
    promesa = (emb && emb["datos/busqueda.json"] ? Promise.resolve(JSON.parse(emb["datos/busqueda.json"]))
      : fetch((base || "") + "datos/busqueda.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }))
      .then((j) => (datos = preparar(j)));
    return promesa;
  }

  const cuenta = (lista, t) => { let n = 0; for (const x of lista) if (x === t || (t.length >= 5 && x.startsWith(t))) n++; return n; };

  // Fragmento de ~260 caracteres alrededor de la primera coincidencia, con las palabras resaltadas.
  function fragmento(texto, terminos, largo = 260) {
    const n = normal(texto);
    let pos = -1;
    for (const t of terminos) { const i = n.search(new RegExp("\\b" + t)); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
    let ini = Math.max(0, pos - 70);
    if (ini > 0) { const sp = texto.indexOf(" ", ini); ini = sp > 0 && sp - ini < 20 ? sp + 1 : ini; }
    let fin = Math.min(texto.length, ini + largo);
    if (fin < texto.length) { const sp = texto.lastIndexOf(" ", fin); if (sp > ini + 120) fin = sp; }
    const trozo = texto.slice(ini, fin);
    // resaltar sobre el texto original, comparando sin tildes
    const nt = normal(trozo);
    const marcas = [];
    terminos.forEach((t) => { const re = new RegExp("\\b" + t + "[a-z0-9ñ]*", "g"); let m; while ((m = re.exec(nt))) marcas.push([m.index, m.index + m[0].length]); });
    marcas.sort((x, y) => x[0] - y[0]);
    let html = "", k = 0;
    for (const [a, b] of marcas) { if (a < k) continue; html += esc(trozo.slice(k, a)) + "<mark>" + esc(trozo.slice(a, b)) + "</mark>"; k = b; }
    html += esc(trozo.slice(k));
    return (ini > 0 ? "… " : "") + html + (fin < texto.length ? " …" : "");
  }

  /* Devuelve los artículos ordenados por relevancia, cada uno con sus mejores pasajes.
     opciones: { max: artículos, pasajes: por artículo, referencias: incluir la lista de referencias } */
  function buscar(consulta, opciones = {}) {
    if (!datos) return [];
    const crudos = palabras(consulta);
    const terminos = [...new Set(crudos.map(raiz))];
    if (!terminos.length) return [];
    const frase = normal(consulta).trim();
    const res = [];
    for (const a of datos.articulos) {
      let base = 0, cubiertos = new Set();
      for (const t of terminos) {
        const p = cuenta(a._campos.titulo, t) * 10 + cuenta(a._campos.clave, t) * 8 + cuenta(a._campos.autores, t) * 12;
        if (p) { base += p; cubiertos.add(t); }
      }
      const pasajes = [];
      for (const b of a.bloques) {
        if (b.ref && !opciones.referencias) continue;
        let p = 0, aqui = 0;
        for (const t of terminos) {
          const c = cuenta(b._r, t) + cuenta(b._h, t) * 3;
          if (c) { p += Math.min(c, 4) * (b.ref ? 0.3 : 1) * (b.k === "resumen" ? 2 : 1); aqui++; cubiertos.add(t); }
        }
        if (!p) continue;
        if (aqui === terminos.length && terminos.length > 1) p *= 1.8;            // todas las palabras juntas
        if (frase.length > 6 && b._n.includes(frase)) p *= 2.5;                     // la frase exacta
        pasajes.push({ p, b });
      }
      pasajes.sort((x, y) => y.p - x.p);
      const cuerpo = pasajes.slice(0, 6).reduce((s, x) => s + x.p, 0);
      let total = base + cuerpo;
      if (!total) continue;
      total *= 0.5 + cubiertos.size / terminos.length;                             // premia cubrir toda la consulta
      res.push({
        articulo: a, puntaje: total,
        pasajes: pasajes.slice(0, opciones.pasajes || 3).map(({ b }) => ({ seccion: b.s, ancla: b.a, html: fragmento(b.t, crudos.map(raiz)), ref: !!b.ref })),
      });
    }
    res.sort((x, y) => y.puntaje - x.puntaje);
    return res.slice(0, opciones.max || 20);
  }

  window.LEHESBuscador = { cargar, buscar, normal, palabras, esc };
})();
