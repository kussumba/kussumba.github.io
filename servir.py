"""Servidor local para experimentar a KUSSUMBA no computador.

Uso:  python servir.py        (abre em http://localhost:8080)
      python servir.py 9000   (outra porta)

O servidor de testes do Python, no Windows, pode enviar ficheiros .js com o tipo errado,
o que impede o navegador de os carregar. Este script corrige os tipos.

Só aceita ligações deste computador e só serve os ficheiros da aplicação e dos testes:
nada de listagens de pastas nem de ficheiros escondidos como o .git (auditoria SEC-013).
"""
import functools
import http.server
import pathlib
import posixpath
import sys
import urllib.parse

PASTA = pathlib.Path(__file__).resolve().parent

TIPOS = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
}

FICHEIROS_NA_RAIZ = {"", "index.html", "manifest.webmanifest", "sw.js"}
PASTAS_PERMITIDAS = ("css/", "js/", "fontes/", "icones/", "testes/")


def caminho_permitido(caminho_pedido):
    """Decide se um caminho do endereço pode ser servido."""
    caminho = urllib.parse.unquote(urllib.parse.urlsplit(caminho_pedido).path)
    normalizado = posixpath.normpath("/" + caminho).lstrip("/")
    if normalizado == ".":
        normalizado = ""
    if any(parte.startswith(".") for parte in normalizado.split("/") if parte):
        return False
    return normalizado in FICHEIROS_NA_RAIZ or normalizado.startswith(PASTAS_PERMITIDAS) or normalizado + "/" in PASTAS_PERMITIDAS


class Pedido(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TIPOS}

    def send_head(self):
        if not caminho_permitido(self.path):
            self.send_error(404, "Não encontrado")
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, "Não encontrado")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def log_message(self, formato, *args):
        pass


class Servidor(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # O navegador fecha ligações a meio (por exemplo, ao pedir favicon.ico). Não é um erro da aplicação.
        erro = sys.exc_info()[1]
        if isinstance(erro, (ConnectionError, FileNotFoundError)):
            return
        super().handle_error(request, client_address)


def criar_servidor(porta=8080):
    gestor = functools.partial(Pedido, directory=str(PASTA))
    return Servidor(("127.0.0.1", porta), gestor)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    servidor = criar_servidor(porta)
    print(f"KUSSUMBA em http://localhost:{porta}  (Ctrl+C para parar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
