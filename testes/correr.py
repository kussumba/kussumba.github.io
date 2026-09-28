"""Corre os testes automáticos da KUSSUMBA no Microsoft Edge (ou Chrome) através do Playwright.

Uso:  python testes/correr.py
Requer:  pip install playwright   (usa o Edge já instalado; não descarrega navegadores)
"""
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from servir import criar_servidor  # noqa: E402


def main():
    servidor = criar_servidor(0)
    porta = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    erros_consola = []
    with sync_playwright() as pw:
        try:
            navegador = pw.chromium.launch(channel="msedge")
        except Exception:
            navegador = pw.chromium.launch(channel="chrome")
        pagina = navegador.new_page()
        pagina.on("console", lambda m: m.type == "error" and erros_consola.append(m.text))
        pagina.on("pageerror", lambda e: erros_consola.append(str(e)))
        pagina.goto(f"http://localhost:{porta}/testes/")
        pagina.wait_for_function("window.__resultados !== undefined", timeout=60000)
        resumo = pagina.evaluate("window.__resultados")
        navegador.close()
    servidor.shutdown()

    for r in resumo["resultados"]:
        marca = "OK   " if r["passou"] else "FALHA"
        print(f"{marca} {r['nome']}")
        if not r["passou"]:
            print("      " + r["erro"].replace("\n", "\n      "))
    for e in erros_consola:
        print("ERRO NA CONSOLA:", e)
    print(f"\n{resumo['passou']} de {resumo['total']} testes passaram.")
    sys.exit(0 if resumo["falhou"] == 0 and not erros_consola else 1)


if __name__ == "__main__":
    main()
