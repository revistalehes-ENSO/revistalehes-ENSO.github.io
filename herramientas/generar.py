#!/usr/bin/env python3
"""
LEHES · generador de páginas para buscadores
=============================================
Crea, a partir de datos/articulos.json y datos/revista.json:

  articulo/<id>/index.html   Página propia de cada artículo, con los metadatos que leen
                             Google, Google Académico, Zotero, Mendeley, WhatsApp y Facebook.
  articulo/<id>/cita.bib     Cita en BibTeX.
  articulo/<id>/cita.ris     Cita en RIS (Zotero, Mendeley, EndNote).
  img/compartir/<id>.png     Imagen que aparece al compartir el artículo en redes.
  sitemap.xml, robots.txt    Mapa del sitio para los buscadores.
  feed.xml                   Canal Atom con los artículos (para lectores de noticias).

Uso:   python herramientas/generar.py
Necesita:  pip install markdown pillow
En GitHub se ejecuta solo, cada vez que se suben cambios (.github/workflows/publicar.yml).
"""
import datetime as dt
import html
import json
import pathlib
import re
import unicodedata

import markdown

RAIZ = pathlib.Path(__file__).resolve().parent.parent
R = json.loads((RAIZ / "datos/revista.json").read_text(encoding="utf-8"))
A = json.loads((RAIZ / "datos/articulos.json").read_text(encoding="utf-8"))
_dp = RAIZ / "datos/docentes.json"
D = json.loads(_dp.read_text(encoding="utf-8")) if _dp.exists() else {"nucleos": [], "personas": []}
SIGLA = R.get("sigla_institucion", "ENSO")
INSTITUCION_LD = {"@type": "EducationalOrganization", "name": R["institucion"],
                  "alternateName": [SIGLA, "Normal Superior Oiba", "Escuela Normal Oiba"],
                  "address": {"@type": "PostalAddress", "addressLocality": "Oiba", "addressRegion": "Santander", "addressCountry": "CO"}}
BASE = R.get("url_sitio", "").rstrip("/")
REVISTA = "LEHES. Revista Leer, Escribir, Hablar & Escuchar"
HOY = dt.date.today().isoformat()

e = lambda s: html.escape(str(s or ""), quote=True)
vacio = lambda s: not s or re.fullmatch(r"\s*\[.*\]\s*", str(s)) is not None


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def numero(id_):
    return next(n for n in R["numeros"] if n["id"] == id_)


def seccion(id_):
    return next((s for s in R["secciones"] if s["id"] == id_), R["secciones"][0])


def paginas(a):
    p = re.split(r"[–\-]", a.get("paginas", ""))
    return (p[0].strip(), p[-1].strip()) if len(p) == 2 else (a.get("paginas", ""), "")


def nombre_partes(autor, apa):
    """Separa apellidos y nombres usando la forma APA ("Apellido Apellido, I. I.")."""
    apellidos = apa.split(",")[0].strip() if apa else autor["nombre"].split()[-1]
    nombres = autor["nombre"].replace(apellidos, "").strip() or autor["nombre"]
    return apellidos, nombres


def autores_apa_lista(a):
    partes = [x.strip() for x in re.split(r"\s*(?:,\s*&|&|;)\s*", a.get("autores_apa", "")) if x.strip()]
    return partes if len(partes) == len(a["autores"]) else [a.get("autores_apa", "")] * len(a["autores"])


def sin_tilde(t):
    return unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().lower().strip()


def perfiles():
    """Personas publicables (con autorización y que no son tarjetas de ejemplo)."""
    return [p for p in D.get("personas", []) if p.get("autoriza_publicacion") and not p.get("ejemplo") and not vacio(p.get("nombre"))]


def perfil_de(nombre):
    return next((p for p in perfiles() if sin_tilde(p["nombre"]) == sin_tilde(nombre)), None)


def nombre_autor(au):
    p = perfil_de(au["nombre"])
    return f'<a class="a-perfil" href="../../docente/{e(p["id"])}/">{e(au["nombre"])}</a>' if p else e(au["nombre"])


def cita_apa(a):
    n = numero(a["numero"])
    doi = f" https://doi.org/{e(a['doi'])}" if a.get("doi") else ""
    return (f"{e(a['autores_apa'])} ({a['anio']}). {e(a['titulo'])}. <i>{e(REVISTA)}</i>, "
            f"<i>{n['volumen']}</i>({n['numero']}), {e(a['paginas'])}.{doi}")


# ---------------------------------------------------------------- Markdown → HTML
def cuerpo_html(a):
    md = (RAIZ / a["texto"]).read_text(encoding="utf-8")
    h = markdown.markdown(md, extensions=["tables", "sane_lists"])
    indice = []

    def poner_id(m):
        texto = re.sub(r"<[^>]+>", "", m.group(2))
        ident = slug(html.unescape(texto))
        if m.group(1) == "2":
            indice.append((ident, texto))
        return f'<h{m.group(1)} id="{ident}">{m.group(2)}</h{m.group(1)}>'

    h = re.sub(r"<h([234])>(.*?)</h\1>", poner_id, h)
    h = re.sub(r"<table>", '<div class="tabla"><table>', h).replace("</table>", "</table></div>")
    h = re.sub(r'(src|href)="(?!https?:|mailto:|#|/)([^"]+)"', r'\1="../../\2"', h)
    h = h.replace("<img ", '<img loading="lazy" ')
    return h, indice


# ---------------------------------------------------------------- Imagen para compartir
def imagen_compartir(a):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None
    F = RAIZ / "herramientas/fuentes"
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), "#1a1b41")
    d = ImageDraw.Draw(im)
    for i, c in enumerate(["#2b6497", "#2f8f46", "#fbaf00", "#b3191f"]):
        d.rectangle([i * W // 4, H - 18, (i + 1) * W // 4, H], fill=c)
    logo = Image.open(RAIZ / "img/logo-lehes@2x.png").convert("RGBA")
    logo.thumbnail((190, 130))
    marco = Image.new("RGBA", (logo.width + 8, logo.height + 8), (255, 255, 255, 70))
    im.paste(marco, (68, 56), marco)
    im.paste(logo, (72, 60), logo)
    f_tit = lambda t: ImageFont.truetype(str(F / "texgyreadventor-bold.otf"), t)
    f_txt = lambda t: ImageFont.truetype(str(F / "EBGaramond-Italic.otf"), t)
    f_peq = ImageFont.truetype(str(F / "texgyreadventor-regular.otf"), 24)
    n = numero(a["numero"])
    d.text((290, 78), "Revista LEHES", font=f_tit(34), fill="#ffffff")
    d.text((290, 124), f"Vol. {n['volumen']} · Núm. {n['numero']} · {n['fecha']}", font=f_peq, fill="#c9cbe0")
    for tam in (60, 54, 48, 42, 38):
        palabras, lineas, actual = a["titulo"].split(), [], ""
        for p in palabras:
            prueba = (actual + " " + p).strip()
            if d.textlength(prueba, font=f_tit(tam)) > W - 144:
                lineas.append(actual); actual = p
            else:
                actual = prueba
        lineas.append(actual)
        if len(lineas) * tam * 1.18 <= 300:
            break
    y = 230
    for l in lineas:
        d.text((72, y), l, font=f_tit(tam), fill="#ffffff"); y += int(tam * 1.18)
    autores = ", ".join(x["nombre"] for x in a["autores"])
    d.text((72, min(y + 22, H - 90)), autores, font=f_txt(38), fill="#fbaf00")
    destino = RAIZ / "img/compartir" / f"{a['id']}.png"
    destino.parent.mkdir(parents=True, exist_ok=True)
    im.save(destino, optimize=True)
    return f"img/compartir/{a['id']}.png"


def portada_compartir():
    """Imagen genérica para compartir la portada de la revista."""
    falso = {"id": "portada", "numero": R["numero_actual"], "titulo": R.get("lema", "Revista LEHES"),
             "autores": [{"nombre": R["institucion"]}]}
    return imagen_compartir(falso)


# ---------------------------------------------------------------- Citas descargables
def bibtex(a):
    n = numero(a["numero"]); p1, p2 = paginas(a)
    apas = autores_apa_lista(a)
    autores = " and ".join("{}, {}".format(*nombre_partes(x, apa)) for x, apa in zip(a["autores"], apas))
    clave = "lehes{}{}".format(a["anio"], slug(nombre_partes(a["autores"][0], apas[0])[0]).replace("-", ""))
    campos = {
        "author": autores, "title": a["titulo"], "journal": REVISTA.replace("&", r"\&"),
        "year": a["anio"], "volume": n["volumen"], "number": n["numero"],
        "pages": f"{p1}--{p2}" if p2 else p1, "url": f"{BASE}/articulo/{a['id']}/",
        "langid": "spanish", "keywords": ", ".join(a.get("palabras_clave", [])),
    }
    if a.get("doi"): campos["doi"] = a["doi"]
    if not vacio(R.get("issn")): campos["issn"] = R["issn"]
    return "@article{" + clave + ",\n" + ",\n".join(f"  {k} = {{{v}}}" for k, v in campos.items()) + "\n}\n"


def ris(a):
    n = numero(a["numero"]); p1, p2 = paginas(a)
    l = ["TY  - JOUR"]
    for x, apa in zip(a["autores"], autores_apa_lista(a)):
        l.append("AU  - {}, {}".format(*nombre_partes(x, apa)))
    l += [f"TI  - {a['titulo']}", f"T2  - {REVISTA}", f"PY  - {a['anio']}", f"DA  - {n.get('fecha_iso', a['anio'])}",
          f"VL  - {n['volumen']}", f"IS  - {n['numero']}", f"SP  - {p1}"]
    if p2: l.append(f"EP  - {p2}")
    l += [f"UR  - {BASE}/articulo/{a['id']}/", f"L1  - {BASE}/{a['pdf']}", f"AB  - {a['resumen']}", "LA  - es",
          f"PB  - {R['institucion']}"]
    l += [f"KW  - {k}" for k in a.get("palabras_clave", [])]
    if a.get("doi"): l.append(f"DO  - {a['doi']}")
    if not vacio(R.get("issn")): l.append(f"SN  - {R['issn']}")
    l.append("ER  - ")
    return "\r\n".join(l) + "\r\n"


# ---------------------------------------------------------------- Página del artículo
NAV = [("inicio", "Inicio"), ("numero-actual", "Número actual"), ("secciones", "Secciones"), ("archivo", "Archivo"),
       ("docentes", "Nuestros maestros"), ("envios", "Publicar"), ("comite", "Comité editorial"), ("acerca", "Acerca de")]


def pagina_articulo(a, cuerpo, indice, img_compartir):
    n = numero(a["numero"]); s = seccion(a["seccion"]); p1, p2 = paginas(a)
    url = f"{BASE}/articulo/{a['id']}/"
    fecha_iso = n.get("fecha_iso", str(a["anio"]))
    desc = a["resumen"] if len(a["resumen"]) < 300 else a["resumen"][:297].rsplit(" ", 1)[0] + "…"
    meta = [
        f'<meta name="citation_title" content="{e(a["titulo"])}">',
        *[x for au in a["autores"] for x in (
            f'<meta name="citation_author" content="{e(au["nombre"])}">',
            f'<meta name="citation_author_institution" content="{e(au.get("filiacion") or R["institucion"])}">',
            *( [f'<meta name="citation_author_orcid" content="https://orcid.org/{e(au["orcid"])}">'] if au.get("orcid") else [] ),
        )],
        f'<meta name="citation_publication_date" content="{fecha_iso.replace("-", "/")}">',
        f'<meta name="citation_journal_title" content="{e(REVISTA)}">',
        f'<meta name="citation_journal_abbrev" content="Rev. LEHES">',
        f'<meta name="citation_publisher" content="{e(R["institucion"])}">',
        f'<meta name="citation_volume" content="{n["volumen"]}">',
        f'<meta name="citation_issue" content="{n["numero"]}">',
        f'<meta name="citation_firstpage" content="{e(p1)}">',
        *([f'<meta name="citation_lastpage" content="{e(p2)}">'] if p2 else []),
        f'<meta name="citation_language" content="es">',
        f'<meta name="citation_keywords" content="{e("; ".join(a.get("palabras_clave", [])))}">',
        f'<meta name="citation_abstract_html_url" content="{url}">',
        f'<meta name="citation_pdf_url" content="{BASE}/{e(a["pdf"])}">',
        *([f'<meta name="citation_issn" content="{e(R["issn"])}">'] if not vacio(R.get("issn")) else []),
        *([f'<meta name="citation_doi" content="{e(a["doi"])}">'] if a.get("doi") else []),
        f'<meta name="DC.title" content="{e(a["titulo"])}">',
        *[f'<meta name="DC.creator" content="{e(au["nombre"])}">' for au in a["autores"]],
        f'<meta name="DC.date" content="{fecha_iso}">',
        f'<meta name="DC.language" content="es">',
        f'<meta name="DC.rights" content="{e(R["licencia"]["url"])}">',
    ]
    ld = {
        "@context": "https://schema.org", "@type": "ScholarlyArticle", "headline": a["titulo"],
        "alternativeHeadline": a.get("titulo_ingles", ""), "abstract": a["resumen"], "inLanguage": "es",
        "datePublished": fecha_iso, "url": url, "keywords": a.get("palabras_clave", []),
        "author": [{"@type": "Person", "name": au["nombre"],
                    **({"url": f"{BASE}/docente/{perfil_de(au['nombre'])['id']}/"} if perfil_de(au["nombre"]) else {}),
                    **({"sameAs": f"https://orcid.org/{au['orcid']}"} if au.get("orcid") else {}),
                    "affiliation": INSTITUCION_LD}
                   for au in a["autores"]],
        "isPartOf": {"@type": "PublicationIssue", "issueNumber": str(n["numero"]),
                     "isPartOf": {"@type": "PublicationVolume", "volumeNumber": str(n["volumen"]),
                                  "isPartOf": {"@type": "Periodical", "name": REVISTA,
                                               "publisher": INSTITUCION_LD}}},
        "pageStart": p1, **({"pageEnd": p2} if p2 else {}), "license": R["licencia"]["url"],
        "encoding": {"@type": "MediaObject", "contentUrl": f"{BASE}/{a['pdf']}", "encodingFormat": "application/pdf"},
        **({"image": f"{BASE}/{img_compartir}"} if img_compartir else {}),
    }
    og_img = f'<meta property="og:image" content="{BASE}/{img_compartir}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' if img_compartir else ""
    autores_html = "".join(
        f'<div class="autor"><span class="avatar" aria-hidden="true">{e("".join(p[0] for p in au["nombre"].split()[:2]).upper())}</span>'
        f'<span><b>{nombre_autor(au)}</b>'
        + (f'<a href="https://orcid.org/{e(au["orcid"])}" rel="noopener"><span class="orcid" aria-hidden="true"></span>ORCID {e(au["orcid"])}</a>' if au.get("orcid") else "")
        + "</span></div>" for au in a["autores"])
    indice_html = "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in indice)
    fechas = a.get("fechas", {})
    correo = a["autores"][0].get("correo")
    color = f"--c: var(--color-{s['verbo']}); --t: var(--texto-sobre-{s['verbo']});"
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(a["titulo"])} · Revista LEHES · {e(SIGLA)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" type="application/atom+xml" title="Revista LEHES" href="../../feed.xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Revista LEHES">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="{e(a["titulo"])}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
{og_img}
<meta name="twitter:card" content="summary_large_image">
{chr(10).join(meta)}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="icon" href="../../img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Caveat:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../css/colores.css">
<link rel="stylesheet" href="../../css/estilos.css">
</head>
<body data-articulo="{e(a["id"])}" data-raiz="../../">
<a class="saltar" href="#contenido">Saltar al contenido</a>
<div class="progreso" id="progreso" aria-hidden="true"></div>
<header class="cabecera">
  <div class="envoltura barra">
    <a class="marca" href="../../#inicio" aria-label="LEHES, ir al inicio">
      <img src="../../img/logo-lehes@2x.png" alt="Logotipo de LEHES" width="78" height="53">
      <span class="marca-texto"><b>Revista LEHES</b><small>Leer, Escribir, Hablar &amp; Escuchar</small></span>
    </a>
    <div class="barra-der">
      <img class="escudo" src="../../img/escudo-enso.png" alt="Escudo de la Escuela Normal Superior Oiba" width="44" height="45">
      <a class="btn" href="../../#suscribirse">Suscribirme</a>
    </div>
  </div>
  <nav class="envoltura pestanas" aria-label="Secciones de la revista">
    {"".join(f'<a href="../../#{k}"' + (' aria-current="page"' if k == "archivo" else "") + f'>{t}</a>' for k, t in NAV)}
  </nav>
</header>
<main id="contenido" class="envoltura" tabindex="-1">
<article class="vista">
  <nav class="migas meta" aria-label="Ubicación"><a href="../../#archivo">Archivo</a> › Vol. {n["volumen"]}, Núm. {n["numero"]} › {e(s["nombre"])}</nav>
  <div class="cabeza-articulo">
    <span class="chip" style="{color}">{e(a.get("tipo", s["nombre"]))}</span>
    <h1>{e(a["titulo"])}</h1>
    <p class="titulo-ingles" lang="en">{e(a.get("titulo_ingles", ""))}</p>
    <div class="autores">{autores_html}</div>
  </div>
  <div class="articulo">
    <div class="cuerpo">
      <div class="resumen">
        <div class="idiomas" role="group" aria-label="Idioma del resumen">
          <button type="button" data-idioma="es" aria-pressed="true">RESUMEN</button>
          <button type="button" data-idioma="en" aria-pressed="false">ABSTRACT</button>
        </div>
        <div data-panel="es"><p>{e(a["resumen"])}</p><p class="palabras"><b>Palabras clave:</b> {e(", ".join(a.get("palabras_clave", [])))}.</p></div>
        <div data-panel="en" lang="en" hidden><p>{e(a.get("abstract", ""))}</p><p class="palabras"><b>Keywords:</b> {e(", ".join(a.get("keywords", [])))}.</p></div>
      </div>
      <div id="texto-articulo">{cuerpo}</div>
      <h2 id="pdf-completo">Versión en PDF</h2>
      <iframe class="visor" src="../../{e(a["pdf"])}#view=FitH" title="PDF del artículo" loading="lazy"></iframe>
    </div>
    <aside class="ficha" aria-label="Ficha del artículo">
      <div class="caja">
        <h3>Descargar</h3>
        <a class="btn" href="../../{e(a["pdf"])}" download data-descarga>PDF maquetado</a>
      </div>
      <div class="caja interaccion" id="interaccion">
        <h3>Lectores de este artículo</h3>
        <div class="cifras" hidden>
          <div><b data-cifra="/articulo/{e(a["id"])}">…</b><span>lecturas</span></div>
          <div><b data-cifra="/descarga/{e(a["id"])}">…</b><span>descargas</span></div>
          <div><b data-cifra="/util/{e(a["id"])}">…</b><span>le fue útil</span></div>
        </div>
        <button class="btn claro util" type="button" id="btn-util" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>
          <span>Este artículo me fue útil</span></button>
      </div>
      <div class="caja">
        <h3>Cómo citar (APA 7)</h3>
        <div class="cita" id="texto-cita">{cita_apa(a)}</div>
        <button class="btn claro" type="button" id="btn-citar">Copiar cita</button>
        <p class="aviso exportar">Llevar a tu gestor de referencias: <a href="cita.bib" download>BibTeX</a> · <a href="cita.ris" download>RIS</a> (Zotero, Mendeley, EndNote)</p>
      </div>
      <div class="caja">
        <h3>Datos del artículo</h3>
        <dl>
          <dt>Número</dt><dd>Vol. {n["volumen"]}, Núm. {n["numero"]} ({e(n["fecha"])})</dd>
          <dt>Páginas</dt><dd>{e(a["paginas"])}</dd>
          {"".join(f"<dt>{k.capitalize()}</dt><dd>{e(v)}</dd>" for k, v in fechas.items())}
          {f'<dt>DOI</dt><dd><a href="https://doi.org/{e(a["doi"])}">{e(a["doi"])}</a></dd>' if a.get("doi") else ""}
        </dl>
      </div>
      {f'<div class="caja indice"><h3>En este artículo</h3><ol>{indice_html}</ol></div>' if indice else ""}
      <div class="caja">
        <h3>Licencia</h3>
        <div class="cc" aria-hidden="true"><span>CC</span><span>BY</span><span>NC</span><span>ND</span></div>
        <p style="margin:0">Este artículo se publica bajo licencia <a href="{e(R["licencia"]["url"])}" rel="license noopener">{e(R["licencia"]["sigla"])}</a>: se puede compartir citando a su autor, sin fines comerciales y sin modificarlo.</p>
      </div>
      {f'<div class="caja"><h3>Correspondencia</h3><p style="margin:0">{e(a["autores"][0]["nombre"])}, {e(R["ciudad"])}.<br><a href="mailto:{e(correo)}">{e(correo)}</a></p></div>' if correo else ""}
    </aside>
  </div>
</article>
</main>
<footer class="pie">
  <div class="pie-franja" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="envoltura pie-rejilla">
    <div><img src="../../img/logo-lehes.png" alt="" width="64" height="44"><p><b>Revista LEHES</b><br>{e(R["nombre_largo"])}</p></div>
    <div><p>{e(R["institucion"])}<br>{e(R["ciudad"])}<br>ISSN: {"en trámite" if vacio(R.get("issn")) else e(R["issn"])}</p></div>
    <div><p>Los contenidos se publican bajo licencia<br><a href="{e(R["licencia"]["url"])}" rel="license">{e(R["licencia"]["sigla"])}</a>.</p>
      <p id="visitas-total" class="visitas" hidden><b>…</b> visitas a LEHES</p></div>
  </div>
</footer>
<script src="../../js/articulo.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------- Perfiles de los maestros
def cabecera(raiz, actual, titulo, desc, url, extra_head=""):
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="Revista LEHES">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
{"" if "og:image" in extra_head else f'<meta property="og:image" content="{BASE}/img/compartir/portada.png">'}
{extra_head}
<link rel="icon" href="{raiz}img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Caveat:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{raiz}css/colores.css">
<link rel="stylesheet" href="{raiz}css/estilos.css">
</head>
<body data-raiz="{raiz}">
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera">
  <div class="envoltura barra">
    <a class="marca" href="{raiz}#inicio" aria-label="LEHES, ir al inicio">
      <img src="{raiz}img/logo-lehes@2x.png" alt="Logotipo de LEHES" width="78" height="53">
      <span class="marca-texto"><b>Revista LEHES</b><small>Leer, Escribir, Hablar &amp; Escuchar</small></span>
    </a>
    <div class="barra-der">
      <img class="escudo" src="{raiz}img/escudo-enso.png" alt="Escudo de la Escuela Normal Superior Oiba" width="44" height="45">
      <a class="btn" href="{raiz}#suscribirse">Suscribirme</a>
    </div>
  </div>
  <nav class="envoltura pestanas" aria-label="Secciones de la revista">
    {"".join(f'<a href="{raiz}#{k}"' + (' aria-current="page"' if k == actual else "") + f'>{t}</a>' for k, t in NAV)}
  </nav>
</header>
<main id="contenido" class="envoltura" tabindex="-1">
"""


def pie(raiz):
    return f"""</main>
<footer class="pie">
  <div class="pie-franja" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="envoltura pie-rejilla">
    <div><img src="{raiz}img/logo-lehes.png" alt="" width="64" height="44"><p><b>Revista LEHES</b><br>{e(R["nombre_largo"])}</p></div>
    <div><p>{e(R["institucion"])} ({e(SIGLA)})<br>{e(R["ciudad"])}</p></div>
    <div><p>Los contenidos se publican bajo licencia<br><a href="{e(R["licencia"]["url"])}" rel="license">{e(R["licencia"]["sigla"])}</a>.</p></div>
  </div>
</footer>
</body>
</html>
"""


def nucleo(id_):
    return next((n for n in D.get("nucleos", []) if n["id"] == id_), {"id": id_, "nombre": "", "color": "tinta-suave", "descripcion": ""})


def retrato(p, raiz, clase="retrato"):
    n = nucleo(p.get("nucleo"))
    if p.get("foto") and not vacio(p["foto"]):
        return f'<img class="{clase}" src="{raiz}{e(p["foto"])}" alt="Retrato de {e(p["nombre"])}" style="--c: var(--{n["color"]})">'
    ini = "".join(x[0] for x in p["nombre"].split()[:2]).upper()
    return f'<span class="{clase} avatar-grande" style="--c: var(--{n["color"]})" aria-hidden="true">{e(ini)}</span>'


def enlazar(t):
    return re.sub(r"(https?://[^\s<]+[^\s<.,;])", r'<a href="\1" rel="noopener">\1</a>', e(t))


def enlaces_perfil(enl):
    pares = [("https://orcid.org/" + enl["orcid"] if enl.get("orcid") else "", "ORCID"),
             (enl.get("cvlac", ""), "CvLAC (Minciencias)"), (enl.get("scholar", ""), "Google Académico")]
    return '<p class="enlaces-perfil">' + " · ".join('<a href="{}" rel="noopener me">{}</a>'.format(e(u), t) for u, t in pares if u) + "</p>"


def pagina_docente(p):
    raiz = "../../"; n = nucleo(p.get("nucleo"))
    url = f"{BASE}/docente/{p['id']}/"
    cargo = "" if vacio(p.get("cargo")) else p["cargo"]
    formacion = [f for f in p.get("formacion", []) if not vacio(f)]
    pubs = [x for x in p.get("publicaciones", []) if not vacio(x)]
    suyos = [a for a in A if any(sin_tilde(x["nombre"]) == sin_tilde(p["nombre"]) for x in a["autores"])]
    anios = "" if vacio(p.get("anios_experiencia")) else str(p["anios_experiencia"])
    titulo = f"{p['nombre']} · {cargo or 'Docente'} · {R['institucion']} ({SIGLA})"
    desc = (f"{p['nombre']}, {(cargo or 'docente').lower()} de la {R['institucion']} ({SIGLA}), Oiba, Santander. "
            + (f"{n['nombre']}. " if n.get("nombre") else "") + (f"Formación: {'; '.join(formacion)}." if formacion else ""))[:300]
    enl = p.get("enlaces", {}) or {}
    same = [x for x in [f"https://orcid.org/{enl['orcid']}" if enl.get("orcid") else "", enl.get("cvlac", ""), enl.get("scholar", "")] if x]
    ld = {"@context": "https://schema.org", "@type": "Person", "name": p["nombre"], "url": url,
          "jobTitle": cargo or "Docente", "worksFor": INSTITUCION_LD,
          **({"hasCredential": [{"@type": "EducationalOccupationalCredential", "name": f} for f in formacion]} if formacion else {}),
          **({"sameAs": same} if same else {}),
          **({"image": f"{BASE}/{p['foto']}"} if p.get("foto") and not vacio(p["foto"]) else {})}
    robots = "" if p.get("aparecer_en_buscadores", True) else '<meta name="robots" content="noindex">'
    foto_og = f'\n<meta property="og:image" content="{BASE}/{e(p["foto"])}">' if p.get("foto") and not vacio(p["foto"]) else ""
    extra = f'{robots}{foto_og}\n<meta property="og:type" content="profile">\n<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>'
    color_chip = "var(--azul-noche)" if n["color"] == "color-hablar" else "#fff"
    cajas = f'<div class="caja"><h3>Formación</h3>' + (f'<ul>{"".join(f"<li>{e(f)}</li>" for f in formacion)}</ul>' if formacion else '<p class="por-llenar">Por completar</p>') + "</div>"
    if not vacio(p.get("investigacion")) or pubs or not vacio(p.get("otros_cargos")) or same:
        cajas += ('<div class="caja"><h3>Trayectoria en investigación</h3>'
                  + ("" if vacio(p.get("investigacion")) else f"<p>{e(p['investigacion'])}</p>")
                  + (f'<h4 class="sub-caja">Publicaciones</h4><ul class="pubs">{"".join(f"<li>{enlazar(x)}</li>" for x in pubs)}</ul>' if pubs else "")
                  + ("" if vacio(p.get("otros_cargos")) else f'<p class="aviso">{e(p["otros_cargos"])}</p>')
                  + (enlaces_perfil(enl) if same else "")
                  + "</div>")
    if not vacio(p.get("hobbies")):
        cajas += f'<div class="caja"><h3>Fuera del aula</h3><p>{e(p["hobbies"])}</p></div>'
    if suyos:
        items = "".join('<li><a href="{}articulo/{}/">{}</a></li>'.format(raiz, e(a["id"]), e(a["titulo"])) for a in suyos)
        cajas += f'<div class="caja"><h3>Publicado en LEHES</h3><ul>{items}</ul></div>'
    cuerpo = f"""<section class="vista perfil" style="--c: var(--{n['color']})">
  <nav class="migas meta" aria-label="Ubicación"><a href="{raiz}maestros/">Nuestros maestros</a> › {e(n.get('nombre', ''))}</nav>
  <div class="perfil-cabeza">
    {retrato(p, raiz, "retrato retrato-grande")}
    <div>
      {f'<span class="chip" style="--c: var(--{n["color"]}); --t: {color_chip}">{e(n["nombre"])}</span>' if n.get("nombre") else ""}
      <h1>{e(p['nombre'])}</h1>
      <p class="lead" style="margin:0">{e(cargo)}{'' if vacio(p.get('aula')) else ' · ' + e(p['aula'])} · {e(R['institucion'])} ({e(SIGLA)})</p>
      {f'<span class="anios"><b>{e(anios)}</b> años enseñando</span>' if anios else ''}
      {'' if vacio(p.get('frase')) else f'<p class="frase-grande">«{e(p["frase"])}»</p>'}
    </div>
  </div>
  <div class="perfil-rejilla">{cajas}</div>
</section>
"""
    return cabecera(raiz, "docentes", titulo, desc, url, extra) + cuerpo + pie(raiz)


def pagina_maestros():
    raiz = "../"; url = f"{BASE}/maestros/"
    gente = [p for p in perfiles() if p.get("aparecer_en_buscadores", True)]   # solo quienes aceptan aparecer en buscadores
    bloques = ""
    for n in D.get("nucleos", []):
        g = [p for p in gente if p.get("nucleo") == n["id"]]
        if not g:
            continue
        tarjetas = "".join(
            f'<a class="docente" href="{raiz}docente/{e(p["id"])}/" style="--c: var(--{n["color"]})">{retrato(p, raiz)}'
            f'<span class="docente-texto"><b>{e(p["nombre"])}</b><span class="cargo-d">{e(p.get("cargo", ""))}</span>'
            + ("" if vacio(p.get("anios_experiencia")) else f'<span class="anios"><b>{e(p["anios_experiencia"])}</b> años enseñando</span>')
            + "</span></a>" for p in g)
        bloques += (f'<section class="nucleo" style="--c: var(--{n["color"]})"><h2><span class="punto" aria-hidden="true"></span>{e(n["nombre"])}</h2>'
                    f'<p class="nucleo-desc">{e(n["descripcion"])}</p><div class="rejilla-docentes">{tarjetas}</div></section>')
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": f"Maestros de la {R['institucion']} ({SIGLA})",
          "url": url, "about": INSTITUCION_LD,
          "hasPart": [{"@type": "Person", "name": p["nombre"], "url": f"{BASE}/docente/{p['id']}/"} for p in gente]}
    titulo = f"Nuestros maestros · {R['institucion']} ({SIGLA}) · Revista LEHES"
    desc = f"Equipo directivo y docentes de la {R['institucion']} ({SIGLA}), Oiba, Santander: formación, trayectoria en investigación y experiencia."
    cuerpo = f"""<section class="vista">
  <p class="mano">Quienes enseñan, también investigan</p>
  <h1>Nuestros maestros</h1>
  <p class="lead">El equipo directivo y docente de la {e(R['institucion'])} ({e(SIGLA)}), en Oiba, Santander. Cada perfil cuenta su formación y su recorrido en la investigación.</p>
  {bloques}
  <p><a class="btn claro" href="{raiz}#docentes">Ver a todo el equipo de la {e(SIGLA)}</a></p>
  <p class="aviso">Los perfiles se publican con autorización de cada persona, según la Ley 1581 de 2012 de protección de datos personales.</p>
</section>
"""
    return cabecera(raiz, "docentes", titulo, desc, url, f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>') + cuerpo + pie(raiz)


# ---------------------------------------------------------------- Archivos para buscadores
def sitemap():
    urls = [(f"{BASE}/", HOY, "weekly", "1.0")]
    for a in A:
        urls.append((f"{BASE}/articulo/{a['id']}/", numero(a["numero"]).get("fecha_iso", HOY), "monthly", "0.8"))
        urls.append((f"{BASE}/{a['pdf']}", numero(a["numero"]).get("fecha_iso", HOY), "yearly", "0.6"))
    urls.append((f"{BASE}/maestros/", HOY, "monthly", "0.7"))
    for p in perfiles():
        if p.get("aparecer_en_buscadores", True):
            urls.append((f"{BASE}/docente/{p['id']}/", HOY, "monthly", "0.5"))
    filas = "".join(f"  <url><loc>{e(u)}</loc><lastmod>{m}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n"
                    for u, m, c, p in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{filas}</urlset>\n'


def feed():
    entradas = ""
    for a in A:
        f = numero(a["numero"]).get("fecha_iso", HOY)
        entradas += f"""  <entry>
    <title>{e(a["titulo"])}</title>
    <link href="{BASE}/articulo/{a["id"]}/"/>
    <id>{BASE}/articulo/{a["id"]}/</id>
    <updated>{f}T00:00:00Z</updated>
    {"".join(f"<author><name>{e(x['nombre'])}</name></author>" for x in a["autores"])}
    <summary>{e(a["resumen"])}</summary>
  </entry>
"""
    return f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">
  <title>Revista LEHES</title>
  <subtitle>{e(R["nombre_largo"])} · {e(R["institucion"])}</subtitle>
  <link href="{BASE}/"/>
  <link rel="self" href="{BASE}/feed.xml"/>
  <id>{BASE}/</id>
  <updated>{HOY}T00:00:00Z</updated>
{entradas}</feed>
"""


def principal():
    if not BASE or vacio(BASE):
        raise SystemExit("Falta 'url_sitio' en datos/revista.json")
    for a in A:
        cuerpo, indice = cuerpo_html(a)
        img = imagen_compartir(a)
        carpeta = RAIZ / "articulo" / a["id"]
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "index.html").write_text(pagina_articulo(a, cuerpo, indice, img), encoding="utf-8")
        (carpeta / "cita.bib").write_text(bibtex(a), encoding="utf-8")
        (carpeta / "cita.ris").write_text(ris(a), encoding="utf-8")
        print("  artículo:", a["id"])
    for p in perfiles():
        carpeta = RAIZ / "docente" / p["id"]
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "index.html").write_text(pagina_docente(p), encoding="utf-8")
    (RAIZ / "maestros").mkdir(exist_ok=True)
    (RAIZ / "maestros/index.html").write_text(pagina_maestros(), encoding="utf-8")
    print(f"  perfiles: {len(perfiles())} y el directorio maestros/")
    (RAIZ / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (RAIZ / "feed.xml").write_text(feed(), encoding="utf-8")
    # Metadatos de la portada (index.html), entre las marcas SEO
    ld = {"@context": "https://schema.org", "@type": "Periodical", "name": REVISTA, "alternateName": "Revista LEHES",
          "url": f"{BASE}/", "inLanguage": "es", "isAccessibleForFree": True, "license": R["licencia"]["url"],
          "publisher": INSTITUCION_LD,
          **({"issn": R["issn"]} if not vacio(R.get("issn")) else {}),
          "hasPart": [{"@type": "ScholarlyArticle", "headline": a["titulo"], "url": f"{BASE}/articulo/{a['id']}/"} for a in A]}
    bloque = (f'<!--SEO:INICIO-->\n<link rel="canonical" href="{BASE}/">\n'
              f'<link rel="alternate" type="application/atom+xml" title="Revista LEHES" href="feed.xml">\n'
              f'<meta property="og:url" content="{BASE}/">\n<meta property="og:type" content="website">\n'
              f'<meta property="og:image" content="{BASE}/img/compartir/portada.png">\n<meta name="twitter:card" content="summary_large_image">\n'
              f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n'
              + "".join(f'<link rel="prefetch" href="articulo/{a["id"]}/">\n' for a in A[:3]) + '<!--SEO:FIN-->')
    ix = RAIZ / "index.html"
    t = ix.read_text(encoding="utf-8")
    t = re.sub(r"<!--SEO:INICIO-->.*?<!--SEO:FIN-->", lambda m: bloque, t, flags=re.S)
    ix.write_text(t, encoding="utf-8")
    portada_compartir()
    (RAIZ / "404.html").write_text(f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página no encontrada · Revista LEHES</title><meta name="robots" content="noindex">
<link rel="icon" href="{BASE}/img/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;600;700&family=EB+Garamond&family=Caveat:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{BASE}/css/colores.css"><link rel="stylesheet" href="{BASE}/css/estilos.css"></head>
<body><main class="envoltura" style="min-height:80vh;display:grid;place-items:center;text-align:center">
<div class="vista"><img src="{BASE}/img/logo-lehes@2x.png" alt="LEHES" width="140">
<p class="mano" style="margin-top:20px">Esta página se perdió entre los libros</p>
<h1>No encontramos lo que buscabas</h1>
<p class="lead" style="margin:0 auto 22px">Puede que el enlace haya cambiado. Desde la portada encontrarás todos los artículos de la revista.</p>
<a class="btn" href="{BASE}/">Ir a la portada</a> <a class="btn claro" href="{BASE}/#archivo">Ver el archivo</a></div></main></body></html>
""", encoding="utf-8")
    (RAIZ / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    print(f"Listo: {len(A)} artículos, sitemap.xml, feed.xml y robots.txt para {BASE}")


if __name__ == "__main__":
    principal()
