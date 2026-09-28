"""Percurso automático pela KUSSUMBA num telemóvel simulado (Edge, 390 x 844).

Uso:  python testes/percurso.py [pasta-para-capturas]
Verifica a primeira utilização, a tela Mês com os números das telas de referência,
a alteração do plafond, o orçamento ultrapassado, ecrãs estreitos e o funcionamento sem internet.
"""
import datetime
import pathlib
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from servir import criar_servidor  # noqa: E402

CAPTURAS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent / "capturas"
CAPTURAS.mkdir(parents=True, exist_ok=True)
NBSP = " "
HOJE = datetime.datetime(2026, 9, 18, 10, 0)

falhas = []
erros_consola = []


def verificar(condicao, descricao):
    print(("OK    " if condicao else "FALHA ") + descricao)
    if not condicao:
        falhas.append(descricao)


def kz(texto):
    return texto.replace(" ", NBSP)


def novo_contexto(navegador, largura=390, altura=844):
    contexto = navegador.new_context(
        viewport={"width": largura, "height": altura},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        locale="pt-AO",
    )
    contexto.clock.set_fixed_time(HOJE)
    pagina = contexto.new_page()
    pagina.on("console", lambda m: m.type == "error" and erros_consola.append(m.text))
    pagina.on("pageerror", lambda e: erros_consola.append(str(e)))
    return contexto, pagina


# Cria, pelos serviços, o estado das telas de referência: três idas às compras e a lista de Setembro.
SEMEAR_SETEMBRO = """
async () => {
  const Meses = await import('/js/servicos/meses.js');
  const Lista = await import('/js/servicos/lista.js');
  const Compras = await import('/js/servicos/compras.js');
  const mes = await Meses.configurarInicio({ plafond: 250000 });
  const lista = [['cat-arroz', 25, 32000], ['cat-oleo', 5, 9500], ['cat-acucar', 10, 11000], ['cat-feijao', 5, 7500],
                 ['cat-fuba', 10, 8000], ['cat-sabao-po', 3, 6800], ['cat-leite-po', 2, 18000]];
  for (const [id, qtd, preco] of lista) {
    const item = await Lista.adicionarProduto(mes.id, id, qtd);
    await Lista.definirPrecoPrevisto(item.id, preco);
  }
  const idas = [
    ['Grossista Kikolo', '2026-09-02', [['cat-frango', 10, 32000], ['cat-carne', 5, 30000], ['cat-peixe', 5, 22500],
      ['cat-ovos', 2, 9000], ['cat-massa', 10, 12000], ['cat-papel-higienico', 3, 13500], ['cat-detergente', 2, 9900]]],
    ['Cantina do bairro', '2026-09-09', [['cat-tomate', 2, 3000], ['cat-cebola', 2, 2800], ['cat-batata', 3, 4500],
      ['cat-sal', 1, 500], ['cat-sabonete', 4, 10500]]],
    ['Mercado do 30', '2026-09-16', [['cat-sumo', 2, 3000], ['cat-agua', 6, 3600], ['cat-refrigerante', 6, 4800],
      ['cat-lixivia', 1, 1200], ['cat-pasta-dentes', 2, 3400], ['cat-farinha-trigo', 2, 2600], ['cat-gas', 1, 9000],
      ['cat-cebola', 1, 1400], ['cat-batata', 2, 3200]]],
  ];
  for (const [loja, data, artigos] of idas) {
    const compra = await Compras.iniciarCompra({ estabelecimento: loja, data });
    for (const [produtoId, quantidade, precoReal] of artigos) {
      await Compras.registarArtigo({ compraId: compra.id, produtoId, quantidade, precoReal });
    }
    await Compras.concluirCompra(compra.id);
  }
  return mes.id;
}
"""


def main():
    servidor = criar_servidor(0)
    porta = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f"http://localhost:{porta}/"

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(channel="msedge")

        # 1. Primeira utilização
        contexto, pagina = novo_contexto(navegador)
        pagina.goto(base)
        pagina.wait_for_url("**/#/boas-vindas")
        expect(pagina.locator("h1")).to_have_text("Bem-vinda à KUSSUMBA")
        verificar(pagina.locator("nav#navegacao").is_hidden(), "sem barra inferior nas boas-vindas")
        pagina.screenshot(path=CAPTURAS / "01-boas-vindas.png")

        pagina.locator("#plafond").click()
        pagina.locator("#plafond").press_sequentially("abc")
        pagina.locator("button[type=submit]").click()
        verificar(pagina.locator("#plafond-erro").is_visible(), "plafond vazio mostra erro")
        pagina.locator("#plafond").press_sequentially("250000")
        verificar(pagina.locator("#plafond").input_value() == kz("250 000"), "o campo formata 250 000 enquanto se escreve")
        pagina.screenshot(path=CAPTURAS / "02-plafond.png")
        pagina.locator("button[type=submit]").click()
        pagina.wait_for_url("**/#/primeira-lista")
        expect(pagina.locator("h1")).to_have_text("Queres criar a tua primeira lista?")
        pagina.screenshot(path=CAPTURAS / "03-primeira-lista.png")

        pagina.get_by_role("button", name="Começar com produtos sugeridos").click()
        pagina.wait_for_url("**/#/lista")
        expect(pagina.locator("#avisos")).to_contain_text("10 produtos adicionados à lista.")

        pagina.goto(base + "#/mes")
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("250 000 Kz"))
        expect(pagina.locator(".previsao")).to_contain_text("ainda não têm preço previsto")
        expect(pagina.locator(".ritmo")).to_contain_text("Ainda não registaste compras")
        verificar(pagina.locator(".nav__item[aria-current=page]").inner_text().strip() == "Mês", "separador Mês activo")
        pagina.screenshot(path=CAPTURAS / "04-mes-vazio.png", full_page=True)

        # Recarregar mantém os dados (persistência local).
        pagina.reload()
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        verificar(pagina.url.endswith("#/mes"), "depois de recarregar continua no mês, sem voltar às boas-vindas")
        contexto.close()

        # 2. Tela Mês com o estado das telas de referência
        contexto, pagina = novo_contexto(navegador)
        pagina.goto(base + "#/boas-vindas")
        expect(pagina.locator("h1")).to_have_text("Bem-vinda à KUSSUMBA")
        pagina.evaluate(SEMEAR_SETEMBRO)
        pagina.goto(base + "#/mes")
        pagina.reload()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("67 600 Kz"))
        texto = pagina.locator(".saldo").inner_text()
        verificar(kz("182 400 Kz") in texto and kz("250 000 Kz") in texto, "gasto 182 400 Kz e plafond 250 000 Kz")
        verificar(pagina.locator(".progresso").get_attribute("aria-valuenow") == "73", "barra de progresso a 73%")
        expect(pagina.locator(".alerta").first).to_have_text("Já usaste 73% do plafond e faltam 12 dias para o fim do mês.")
        expect(pagina.locator(".previsao")).to_contain_text(kz("Faltam 25 200 Kz para cumprir a lista."))
        expect(pagina.locator(".previsao")).to_contain_text(kz("92 800 Kz"))
        expect(pagina.locator(".ritmo")).to_contain_text(kz("10 133 Kz"))
        expect(pagina.locator(".ritmo")).to_contain_text(kz("304 000 Kz"))
        expect(pagina.locator(".ritmo")).to_contain_text(kz("54 000 Kz acima do plafond"))
        idas = pagina.locator("#idas-titulo + ul .linha")
        verificar(idas.count() == 3, "três idas às compras")
        verificar("Mercado do 30" in idas.nth(0).inner_text(), "a ida mais recente aparece primeiro")
        verificar("02 Set · 7 artigos" in idas.nth(2).inner_text() and kz("128 900 Kz") in idas.nth(2).inner_text(),
                  "Grossista Kikolo, 02 Set, 7 artigos, 128 900 Kz")
        pagina.screenshot(path=CAPTURAS / "05-mes.png")
        pagina.screenshot(path=CAPTURAS / "05-mes-completa.png", full_page=True)

        # Alterar o plafond
        pagina.locator("[data-accao=plafond]").click()
        dialogo = pagina.locator("dialog")
        expect(dialogo).to_be_visible()
        campo = dialogo.locator("input")
        campo.fill("")
        campo.press_sequentially("300000")
        pagina.screenshot(path=CAPTURAS / "06-alterar-plafond.png")
        dialogo.get_by_role("button", name="Guardar").click()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("117 600 Kz"))
        verificar(pagina.locator("dialog").count() == 0, "o diálogo fecha depois de guardar")

        # Orçamento ultrapassado
        pagina.locator("[data-accao=plafond]").click()
        campo = pagina.locator("dialog input")
        campo.fill("")
        campo.press_sequentially("150000")
        pagina.locator("dialog").get_by_role("button", name="Guardar").click()
        expect(pagina.locator(".saldo__rotulo")).to_have_text("Orçamento ultrapassado em")
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("32 400 Kz"))
        verificar(pagina.locator(".progresso--excedido").count() == 1, "barra em cor de alerta quando ultrapassa")
        pagina.screenshot(path=CAPTURAS / "07-ultrapassado.png")

        # Os separadores levam às telas certas
        for nome, titulo in [("Lista", "Lista de Setembro"), ("Comprar", "Nova ida às compras"), ("Relatório", "Setembro 2026")]:
            pagina.locator(".nav__item", has_text=nome).click()
            expect(pagina.locator("h1")).to_have_text(titulo)
        pagina.locator(".nav__item", has_text="Mês").click()
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")

        # 3. Funcionamento sem internet: o service worker guarda a aplicação; os dados estão no telefone.
        pagina.evaluate("navigator.serviceWorker.ready.then(() => true)")
        pagina.reload()
        pagina.wait_for_function("navigator.serviceWorker.controller !== null")
        servidor.shutdown()
        servidor.server_close()
        pagina.reload()
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("32 400 Kz"))
        verificar(True, "abre sem servidor nem internet, com os dados guardados")
        for nome, titulo in [("Lista", "Lista de Setembro"), ("Comprar", "Nova ida às compras"), ("Relatório", "Setembro 2026")]:
            pagina.locator(".nav__item", has_text=nome).click()
            expect(pagina.locator("h1")).to_have_text(titulo)
        pagina.goto(base + "#/catalogo")
        pagina.locator(".produto__tocar", has_text="Massa").click()
        expect(pagina.locator(".produto--na-lista", has_text="Massa")).to_have_count(1)
        pagina.goto(base + "#/lista")
        expect(pagina.locator(".lista-artigos")).to_contain_text("Massa")
        verificar(True, "sem internet, todas as telas abrem e as alterações ficam gravadas")
        contexto.close()

        # 4. Instalação: o Edge só avalia fora do modo anónimo, por isso usa um perfil temporário normal.
        servidor_inst = criar_servidor(0)
        threading.Thread(target=servidor_inst.serve_forever, daemon=True).start()
        with tempfile.TemporaryDirectory() as perfil:
            normal = pw.chromium.launch_persistent_context(perfil, channel="msedge", viewport={"width": 390, "height": 844})
            pag = normal.new_page()
            pag.goto(f"http://localhost:{servidor_inst.server_address[1]}/")
            pag.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true)")
            pag.evaluate("navigator.serviceWorker.ready.then(() => true)")
            pag.reload()
            pag.wait_for_function("navigator.serviceWorker.controller !== null")
            cdp = normal.new_cdp_session(pag)
            instalacao = cdp.send("Page.getInstallabilityErrors")["installabilityErrors"]
            manifesto = cdp.send("Page.getAppManifest")
            verificar(not instalacao, f"o Edge considera a aplicação instalável {instalacao or ''}")
            verificar(not manifesto.get("errors"), f"manifesto sem erros {manifesto.get('errors') or ''}")
            normal.close()
        servidor_inst.shutdown()

        # 5. Computador: a aplicação fica centrada, com a largura de um telemóvel.
        servidor_pc = criar_servidor(0)
        threading.Thread(target=servidor_pc.serve_forever, daemon=True).start()
        contexto, pagina = novo_contexto(navegador, largura=1280, altura=800)
        base_pc = f"http://localhost:{servidor_pc.server_address[1]}/"
        pagina.goto(base_pc + "#/boas-vindas")
        expect(pagina.locator("h1")).to_have_text("Bem-vinda à KUSSUMBA")
        pagina.evaluate(SEMEAR_SETEMBRO)
        pagina.goto(base_pc + "#/mes")
        pagina.reload()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("67 600 Kz"))
        caixa = pagina.locator("#app").bounding_box()
        verificar(caixa["width"] <= 480 and abs(caixa["x"] - (1280 - caixa["width"]) / 2) < 2, "no computador fica centrada com 480 px")
        pagina.screenshot(path=CAPTURAS / "09-computador.png")
        contexto.close()
        servidor_pc.shutdown()

        # 6. Ecrã estreito (320 px): nada sai para os lados.
        servidor2 = criar_servidor(porta)
        threading.Thread(target=servidor2.serve_forever, daemon=True).start()
        contexto, pagina = novo_contexto(navegador, largura=320, altura=640)
        pagina.goto(base + "#/boas-vindas")
        expect(pagina.locator("h1")).to_have_text("Bem-vinda à KUSSUMBA")
        pagina.evaluate(SEMEAR_SETEMBRO)
        pagina.goto(base + "#/mes")
        pagina.reload()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("67 600 Kz"))
        largura = pagina.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        verificar(largura[0] <= largura[1], f"sem deslocamento horizontal a 320 px ({largura[0]} <= {largura[1]})")
        pagina.screenshot(path=CAPTURAS / "08-mes-320.png", full_page=True)

        # Áreas de toque: botões e ligações com pelo menos 44 px de altura.
        pequenos = pagina.evaluate("""() => [...document.querySelectorAll('a, button')]
            .filter(e => e.offsetParent !== null)
            .map(e => [e.textContent.trim().slice(0, 30), Math.round(e.getBoundingClientRect().height)])
            .filter(([, h]) => h < 44)""")
        verificar(not pequenos, f"áreas de toque com pelo menos 44 px {pequenos if pequenos else ''}")
        contexto.close()
        servidor2.shutdown()
        navegador.close()

    for e in erros_consola:
        print("ERRO NA CONSOLA:", e)
    print(f"\n{len(falhas)} falhas." if falhas or erros_consola else "\nPercurso completo sem falhas.")
    sys.exit(1 if falhas or erros_consola else 0)


if __name__ == "__main__":
    main()
