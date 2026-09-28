"""Auditoria de acessibilidade (WCAG 2.1 AA) de todas as telas da KUSSUMBA com o axe-core.

Uso:  python testes/acessibilidade.py
Precisa de internet na primeira vez, para descarregar o axe-core (fica guardado na pasta temporária).
O axe é injectado só neste teste; a aplicação não carrega nada de fora.
"""
import datetime
import hashlib
import pathlib
import sys
import tempfile
import threading
import urllib.request

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from servir import criar_servidor  # noqa: E402

# Versão fixa e impressão digital conhecida (auditoria SEC-012): um ficheiro diferente é recusado.
AXE_URL = "https://cdn.jsdelivr.net/npm/axe-core@4.13.0/axe.min.js"
AXE_SHA256 = "c24f097bd2f451d4f933e8bc7d8d539f8672a2ebcb5cc9f9f3eec8ca9470a0c1"
AXE = pathlib.Path(tempfile.gettempdir()) / "kussumba-axe-4.13.0.min.js"

SEMEAR = """
async () => {
  const Meses = await import('/js/servicos/meses.js');
  const Lista = await import('/js/servicos/lista.js');
  const Compras = await import('/js/servicos/compras.js');
  const mes = await Meses.configurarInicio({ plafond: 250000 });
  for (const [id, qtd, preco] of [['cat-arroz', 25, 32000], ['cat-oleo', 5, 9500], ['cat-acucar', 10, 11000], ['cat-feijao', 5, null]]) {
    const item = await Lista.adicionarProduto(mes.id, id, qtd);
    if (preco) await Lista.definirPrecoPrevisto(item.id, preco);
  }
  const { itens } = await Lista.obterLista(mes.id);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo', data: '2026-09-02' });
  await Compras.registarArtigo({ compraId: compra.id, itemListaId: itens[0].id, quantidade: 25, precoReal: 33000 });
  await Compras.registarArtigo({ compraId: compra.id, produtoId: 'cat-sal', quantidade: 1, precoReal: 400 });
  await Compras.concluirCompra(compra.id);
  return compra.id;
}
"""


def main():
    def impressao(caminho):
        return hashlib.sha256(caminho.read_bytes()).hexdigest() if caminho.exists() else None

    if impressao(AXE) != AXE_SHA256:
        urllib.request.urlretrieve(AXE_URL, AXE)
    if impressao(AXE) != AXE_SHA256:
        AXE.unlink(missing_ok=True)
        sys.exit("O axe-core descarregado não corresponde à versão esperada. Auditoria cancelada.")
    axe = AXE.read_text(encoding="utf-8")

    servidor = criar_servidor(0)
    porta = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f"http://localhost:{porta}/"
    problemas = {}

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(channel="msedge")
        contexto = navegador.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                         locale="pt-AO", bypass_csp=True)
        contexto.clock.set_fixed_time(datetime.datetime(2026, 9, 18, 10, 0))
        pagina = contexto.new_page()

        def auditar(nome):
            pagina.wait_for_timeout(250)
            if not pagina.evaluate("typeof axe !== 'undefined'"):
                pagina.add_script_tag(content=axe)
            resultado = pagina.evaluate("""async () => {
                const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
                return r.violations.map(v => ({ id: v.id, impacto: v.impact, ajuda: v.help,
                  alvos: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n').slice(1, 2).join(' ')) }));
            }""")
            problemas[nome] = resultado
            print(("OK    " if not resultado else "FALHA ") + nome + ("" if not resultado else f" ({len(resultado)} regras)"))
            for v in resultado:
                print(f"      [{v['impacto']}] {v['id']}: {v['ajuda']}")
                for alvo in v["alvos"]:
                    print(f"         {alvo}")

        pagina.goto(base)
        expect(pagina.locator("h1")).to_have_text("Bem-vinda à KUSSUMBA")
        auditar("boas-vindas")
        pagina.locator("#plafond").press_sequentially("250000")
        pagina.get_by_role("button", name="Continuar").click()
        expect(pagina.locator("h1")).to_have_text("Queres criar a tua primeira lista?")
        auditar("primeira lista")

        # Recomeça com dados de exemplo
        pagina.evaluate("""() => new Promise((r) => {
            const pedido = indexedDB.deleteDatabase('kussumba');
            pedido.onsuccess = pedido.onerror = pedido.onblocked = () => r(true);
        })""")
        pagina.goto(base + "#/boas-vindas")
        pagina.reload()
        compra_id = pagina.evaluate(SEMEAR)
        pagina.goto(base + "#/mes")
        pagina.reload()
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        auditar("mês")
        pagina.locator("[data-accao=plafond]").click()
        auditar("diálogo do plafond")
        pagina.keyboard.press("Escape")

        pagina.goto(base + "#/lista")
        expect(pagina.locator("h1")).to_have_text("Lista de Setembro")
        auditar("lista")
        pagina.locator(".lista-artigos .linha", has_text="Óleo").click()
        expect(pagina.locator("dialog.folha")).to_be_visible()
        auditar("folha de edição da lista")
        pagina.keyboard.press("Escape")

        pagina.goto(base + "#/catalogo")
        expect(pagina.locator("h1")).to_have_text("O que vais comprar?")
        auditar("catálogo")
        pagina.locator("[data-novo-produto]").click()
        auditar("folha de novo produto")
        pagina.keyboard.press("Escape")

        pagina.goto(base + "#/comprar")
        expect(pagina.locator("h1")).to_have_text("Nova ida às compras")
        auditar("comprar: início")
        pagina.locator("#loja").fill("Mercado do 30")
        pagina.get_by_role("button", name="Começar a registar").click()
        expect(pagina.locator("h1")).to_have_text("Mercado do 30")
        pagina.locator('.tecla[data-tecla="9"]').click()
        auditar("comprar: registo")
        pagina.locator("[data-accao=quantidade]").click()
        auditar("folha da quantidade")
        pagina.keyboard.press("Escape")
        pagina.get_by_role("button", name="Cancelar compra").click()
        auditar("diálogo de confirmação")
        pagina.locator("dialog.dialogo").get_by_role("button", name="Cancelar compra").click()
        expect(pagina.locator(".saldo__valor")).to_be_visible()

        pagina.goto(base + f"#/compra/{compra_id}/concluida")
        expect(pagina.locator("h1")).to_have_text("Grossista Kikolo")
        auditar("detalhe da compra")

        pagina.goto(base + "#/relatorio")
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        auditar("relatório")
        pagina.get_by_role("button", name="Fechar mês e começar Outubro").click()
        pagina.locator("dialog.dialogo").get_by_role("button", name="Fechar mês").click()
        expect(pagina.locator("h1")).to_have_text("Outubro 2026")
        auditar("novo mês")
        pagina.locator("[data-mostrar-artigos]").click()
        auditar("novo mês com artigos à vista")

        navegador.close()
    servidor.shutdown()

    total = sum(len(v) for v in problemas.values())
    print(f"\n{total} problemas de acessibilidade." if total else "\nNenhum problema de acessibilidade encontrado.")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
