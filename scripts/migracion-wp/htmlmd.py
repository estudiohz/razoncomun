# -*- coding: utf-8 -*-
"""
Conversor HTML -> markdown (dialecto del blog de Razón Común).

El cuerpo de los artículos del blog se guarda en `articles.body` como markdown
y se renderiza con `apps/web/src/lib/blog/markdown.ts` (renderizador propio, sin
dependencias). Ese renderizador cubre: h2/h3, párrafos, listas (ul/ol),
blockquote, imágenes `![pie](url)`, negrita/cursiva, enlaces, código en línea,
regla horizontal `---`, tablas GFM `| a | b |` y el bloque `:::dato`.

Este módulo convierte el HTML de WordPress a ESE dialecto, y de paso limpia la
basura de IA que traen algunos posts (divs `model-response-message-content` /
`markdown-main-panel`, atributos `data-path-to-node`). Sin dependencias externas
(solo stdlib) para que el script de migración sea reejecutable en la Ola 5.
"""
from __future__ import annotations
import re
from html import unescape
from html.parser import HTMLParser

VOID = {"br", "hr", "img", "input", "meta", "link", "col", "source", "wbr"}
# Contenedores "transparentes": no emiten nada propio, solo sus hijos. Aquí
# caen los <div> basura de la IA.
DROP_KEEP_CHILDREN = {"div", "span", "section", "article", "main", "header",
                      "footer", "figure", "picture", "tbody"}
# Se descartan por completo (contenido y todo): embeds/scripts se tratan aparte.
DROP_WHOLE = {"script", "style", "noscript", "svg"}


class _Node:
    __slots__ = ("tag", "attrs", "children")

    def __init__(self, tag, attrs=None):
        self.tag = tag
        self.attrs = dict(attrs or {})
        self.children = []  # lista de _Node | str


class _TreeBuilder(HTMLParser):
    """Construye un árbol tolerante a etiquetas mal cerradas."""

    # etiquetas que auto-cierran una anterior igual/relacionada
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = _Node("#root")
        self.stack = [self.root]

    def _top(self):
        return self.stack[-1]

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        # cierre implícito de <p>, <li>, <td>/<th>, <tr>, <option>
        if tag in ("p", "li", "tr", "td", "th") :
            self._autoclose(tag)
        node = _Node(tag, attrs)
        self._top().children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        node = _Node(tag, attrs)
        self._top().children.append(node)

    def _autoclose(self, tag):
        # cierra el bloque abierto del mismo tipo (p tras p, li tras li, etc.)
        block_siblings = {
            "p": {"p"},
            "li": {"li"},
            "tr": {"tr"},
            "td": {"td", "th"},
            "th": {"td", "th"},
        }[tag]
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag in block_siblings:
                del self.stack[i:]
                return
            # no cruzar límites de bloque contenedor
            if self.stack[i].tag in ("ul", "ol", "table", "thead", "tbody", "blockquote"):
                return

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self._top().children.append(data)


# ---------------------------------------------------------------------------
# Conversión del árbol a markdown
# ---------------------------------------------------------------------------

def _clean_inline(text: str) -> str:
    # colapsa espacios (pero conserva el contenido); markdown reflowa párrafos
    return re.sub(r"[ \t\r\n]+", " ", text)


def _escape_md(text: str) -> str:
    # Evita que caracteres del texto se interpreten como marcas markdown al
    # renderizar. El renderizador re-escapa HTML, así que aquí solo protegemos
    # los metacaracteres del propio markdown que aparezcan en texto plano.
    return text.replace("|", "\\|")


class _Converter:
    def __init__(self, image_rewriter=None, link_rewriter=None):
        self.image_rewriter = image_rewriter or (lambda u: u)
        self.link_rewriter = link_rewriter or (lambda u: u)
        self.blocks: list[str] = []
        self.embeds: list[str] = []  # urls de embeds encontrados (yt/insta/iframe)

    # --- inline ---
    def inline(self, node) -> str:
        if isinstance(node, str):
            return _escape_md(_clean_inline(node))
        tag = node.tag
        if tag in ("strong", "b"):
            inner = self._inline_children(node).strip()
            return f"**{inner}**" if inner else ""
        if tag in ("em", "i"):
            inner = self._inline_children(node).strip()
            return f"*{inner}*" if inner else ""
        if tag == "code":
            return f"`{self._text_only(node).strip()}`"
        if tag == "a":
            href = self.link_rewriter(node.attrs.get("href", "").strip())
            inner = self._inline_children(node).strip()
            if not inner:
                inner = href
            if not href or href.startswith("#"):
                return inner
            return f"[{inner}]({href})"
        if tag == "br":
            return " "
        if tag == "iframe":
            src = node.attrs.get("src", "").strip()
            if src.startswith("//"):
                src = "https:" + src
            if not src:
                return ""
            self.embeds.append(src)
            title = _clean_inline(node.attrs.get("title", "")).strip() or "Ver contenido incrustado"
            return f"[{title}]({self.link_rewriter(src)})"
        if tag == "img":
            return self._img_inline(node)
        if tag in ("sup", "sub", "u", "mark", "small", "abbr", "cite", "q", "font"):
            return self._inline_children(node)
        # cualquier otra inline: pasa hijos
        return self._inline_children(node)

    def _inline_children(self, node) -> str:
        return "".join(self.inline(c) for c in node.children)

    def _text_only(self, node) -> str:
        out = []
        for c in node.children:
            if isinstance(c, str):
                out.append(c)
            else:
                out.append(self._text_only(c))
        return _clean_inline("".join(out))

    def _img_inline(self, node) -> str:
        src = self.image_rewriter(node.attrs.get("src", "").strip())
        alt = _clean_inline(node.attrs.get("alt", "")).strip()
        if not src:
            return ""
        return f"![{alt}]({src})"

    # --- bloques ---
    def block_children(self, node):
        for c in node.children:
            self.block(c)

    def block(self, node):
        if isinstance(node, str):
            if node.strip():
                self._emit_para_text(node)
            return
        tag = node.tag
        if tag in DROP_WHOLE:
            return
        if tag == "iframe":
            src = node.attrs.get("src", "").strip()
            if src:
                if src.startswith("//"):
                    src = "https:" + src
                self.embeds.append(src)
                self.blocks.append(f"[Ver contenido incrustado]({self.link_rewriter(src)})")
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            inner = self._inline_children(node).strip()
            # Quita negrita envolvente redundante (WP marca en negrita títulos enteros).
            m = re.fullmatch(r"\*\*(.+)\*\*", inner)
            if m:
                inner = m.group(1).strip()
            if inner:  # descarta encabezados vacíos (<h2></h2>, solo imagen, etc.)
                prefijo = "## " if tag in ("h1", "h2") else "### "
                self.blocks.append(prefijo + inner)
            return
        if tag == "p":
            self._emit_para(node)
            return
        if tag == "hr":
            self.blocks.append("---")
            return
        if tag == "ul":
            self._emit_list(node, ordered=False)
            return
        if tag == "ol":
            self._emit_list(node, ordered=True)
            return
        if tag == "blockquote":
            inner = []
            for c in node.children:
                if isinstance(c, str):
                    if c.strip():
                        inner.append(_escape_md(_clean_inline(c)).strip())
                elif c.tag == "p":
                    inner.append(self._inline_children(c).strip())
                else:
                    inner.append(self.inline(c).strip())
            text = " ".join(x for x in inner if x)
            if text:
                self.blocks.append("> " + text)
            return
        if tag == "figure":
            # figura: imagen + figcaption como pie
            img = _find(node, "img")
            cap = _find(node, "figcaption")
            if img is not None:
                src = self.image_rewriter(img.attrs.get("src", "").strip())
                caption = ""
                if cap is not None:
                    caption = self._inline_children(cap).strip()
                if not caption:
                    caption = _clean_inline(img.attrs.get("alt", "")).strip()
                if src:
                    self.blocks.append(f"![{caption}]({src})")
                return
            self.block_children(node)
            return
        if tag == "img":
            src = self.image_rewriter(node.attrs.get("src", "").strip())
            alt = _clean_inline(node.attrs.get("alt", "")).strip()
            if src:
                self.blocks.append(f"![{alt}]({src})")
            return
        if tag == "table":
            self._emit_table(node)
            return
        if tag in DROP_KEEP_CHILDREN:
            self.block_children(node)
            return
        if tag in ("strong", "b", "em", "i", "a", "code", "span"):
            # inline suelto a nivel bloque -> párrafo
            txt = self.inline(node).strip()
            if txt:
                self.blocks.append(txt)
            return
        # desconocido: intenta bloque de hijos
        self.block_children(node)

    def _emit_para(self, node):
        txt = self._inline_children(node).strip()
        # un <p> que solo contiene una imagen ya se habrá vuelto ![](), ok
        if txt:
            self.blocks.append(txt)

    def _emit_para_text(self, text):
        txt = _escape_md(_clean_inline(text)).strip()
        if txt:
            self.blocks.append(txt)

    def _emit_list(self, node, ordered):
        lines = []
        n = 0
        for c in node.children:
            if isinstance(c, str):
                continue
            if c.tag != "li":
                continue
            n += 1
            content = self._li_inline(c).strip()
            prefix = f"{n}. " if ordered else "- "
            lines.append(prefix + content)
        if lines:
            self.blocks.append("\n".join(lines))

    def _li_inline(self, li):
        # texto del li (aplana <p> internos y sub-listas simples a una línea)
        parts = []
        for c in li.children:
            if isinstance(c, str):
                parts.append(_escape_md(_clean_inline(c)))
            elif c.tag in ("ul", "ol"):
                # sublista: la aplana separando con " · " para no perder items
                sub = []
                for gc in c.children:
                    if not isinstance(gc, str) and gc.tag == "li":
                        sub.append(self._li_inline(gc).strip())
                if sub:
                    parts.append(" — " + "; ".join(sub))
            elif c.tag == "p":
                parts.append(self._inline_children(c))
            else:
                parts.append(self.inline(c))
        return _clean_inline("".join(parts))

    def _emit_table(self, node):
        rows = []
        for tr in _find_all(node, "tr"):
            cells = []
            for cell in tr.children:
                if isinstance(cell, str):
                    continue
                if cell.tag in ("td", "th"):
                    cells.append(self._inline_children(cell).strip().replace("\n", " "))
            if cells:
                rows.append(cells)
        if not rows:
            return
        ncol = max(len(r) for r in rows)
        rows = [r + [""] * (ncol - len(r)) for r in rows]
        out = []
        out.append("| " + " | ".join(rows[0]) + " |")
        out.append("| " + " | ".join(["---"] * ncol) + " |")
        for r in rows[1:]:
            out.append("| " + " | ".join(r) + " |")
        self.blocks.append("\n".join(out))


def _find(node, tag):
    for c in node.children:
        if isinstance(c, str):
            continue
        if c.tag == tag:
            return c
        got = _find(c, tag)
        if got is not None:
            return got
    return None


def _find_all(node, tag, out=None):
    if out is None:
        out = []
    for c in node.children:
        if isinstance(c, str):
            continue
        if c.tag == tag:
            out.append(c)
        else:
            _find_all(c, tag, out)
    return out


def html_a_markdown(html: str, image_rewriter=None, link_rewriter=None):
    """Devuelve (markdown, embeds). `image_rewriter`/`link_rewriter` transforman URLs."""
    tb = _TreeBuilder()
    tb.feed(html or "")
    tb.close()
    conv = _Converter(image_rewriter=image_rewriter, link_rewriter=link_rewriter)
    conv.block_children(tb.root)
    # junta bloques con línea en blanco; normaliza espacios
    md = "\n\n".join(b.strip() for b in conv.blocks if b.strip())
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md, conv.embeds
