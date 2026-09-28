"""Servidor local para experimentar a KUSSUMBA no computador.

Uso:  python servir.py        (abre em http://localhost:8080)
      python servir.py 9000   (outra porta)

O servidor de testes do Python, no Windows, pode enviar ficheiros .js com o tipo errado,
o que impede o navegador de os carregar. Este script corrige os tipos.
"""
import functools
import http.server
import pathlib
import sys

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


class Pedido(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TIPOS}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
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
