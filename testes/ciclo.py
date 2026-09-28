"""Ciclo completo da KUSSUMBA pela interface, num telemóvel simulado (Edge, 390 x 844).

Uso:  python testes/ciclo.py [pasta-para-capturas]

Agosto: primeira utilização, catálogo, lista com preços, compra, relatório e fecho.
Setembro: lista copiada, compra com artigo fora da lista, correcção, relatório face a Agosto e fecho.
Outubro: novo mês com sugestão de plafond pelo cabaz.
Tudo é feito com toques na interface, como faria uma pessoa.
"""
import datetime
import pathlib
import re
import sys
import threading

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from servir import criar_servidor  # noqa: E402

CAPTURAS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent / "capturas"
CAPTURAS.mkdir(parents=True, exist_ok=True)
NBSP = " "
MENOS = "−"

falhas = []
erros_consola = []


def verificar(condicao, descricao):
    print(("OK    " if condicao else "FALHA ") + descricao)
    if not condicao:
        falhas.append(descricao)


def kz(texto):
    return texto.replace(" ", NBSP).replace("-", MENOS)


def captura(pagina, nome, completa=False):
    pagina.screenshot(path=CAPTURAS / f"{nome}.png", full_page=completa)


def sem_deslocamento_lateral(pagina, onde):
    larguras = pagina.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    verificar(larguras[0] <= larguras[1], f"{onde}: nada sai pelos lados ({larguras[0]} <= {larguras[1]})")


def toques_pequenos(pagina):
    return pagina.evaluate("""() => [...document.querySelectorAll('a, button, input, select, [role=button]')]
        .filter(e => e.offsetParent !== null && !e.closest('.visualmente-oculto'))
        .filter(e => e.type !== 'checkbox' && e.type !== 'radio')
        .map(e => [(e.getAttribute('aria-label') || e.textContent || e.placeholder || e.type).trim().slice(0, 30), Math.round(e.getBoundingClientRect().height)])
        .filter(([, h]) => h < 44)""")


def teclar(pagina, valor):
    for digito in str(valor):
        pagina.locator(f'.tecla[data-tecla="{digito}"]').click()


def na_folha(pagina):
    return pagina.locator("dialog.folha")


def preco_na_lista(pagina, produto, valor):
    pagina.locator(".lista-artigos .linha", has_text=produto).click()
    folha = na_folha(pagina)
    expect(folha).to_be_visible()
    campo = folha.locator("#preco-previsto")
    campo.fill("")
    campo.press_sequentially(str(valor))
    folha.get_by_role("button", name="Guardar").click()
    expect(folha).to_have_count(0)


def confirmar_dialogo(pagina, botao):
    dialogo = pagina.locator("dialog.dialogo")
    expect(dialogo).to_be_visible()
    dialogo.get_by_role("button", name=botao).click()
    expect(dialogo).to_have_count(0)


def main():
    servidor = criar_servidor(0)
    porta = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f"http://localhost:{porta}/"

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(channel="msedge")
        contexto = navegador.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1,
                                         is_mobile=True, has_touch=True, locale="pt-AO")
        contexto.clock.set_fixed_time(datetime.datetime(2026, 8, 5, 10, 0))
        pagina = contexto.new_page()
        pagina.on("console", lambda m: m.type == "error" and erros_consola.append(m.text))
        pagina.on("pageerror", lambda e: erros_consola.append(str(e)))

        # ---------- Agosto: primeira utilização ----------
        pagina.goto(base)
        pagina.locator("#plafond").press_sequentially("240000")
        pagina.get_by_role("button", name="Continuar").click()
        pagina.get_by_role("button", name="Adicionar produtos").click()
        expect(pagina.locator("h1")).to_have_text("O que vais comprar?")

        # ---------- Catálogo (tela 2) ----------
        for nome in ["Arroz", "Óleo alimentar", "Açúcar", "Feijão"]:
            pagina.locator(".produto__tocar", has_text=nome).click()
            expect(pagina.locator(".produto--na-lista", has_text=nome)).to_have_count(1)
        expect(pagina.locator(".rodape-fixo__texto")).to_contain_text("4 artigos")
        arroz = pagina.locator(".produto--na-lista", has_text="Arroz")
        arroz.get_by_role("button", name="Aumentar quantidade").click()
        expect(arroz.locator("[data-numero]")).to_have_text("26")
        arroz.get_by_role("button", name="Diminuir quantidade").click()
        expect(arroz.locator("[data-numero]")).to_have_text("25")
        pagina.locator(".produto__tocar", has_text="Sal").click()
        expect(pagina.locator(".rodape-fixo__texto")).to_contain_text("5 artigos")
        pagina.locator(".produto__tocar", has_text="Sal").click()
        expect(pagina.locator(".rodape-fixo__texto")).to_contain_text("4 artigos")
        verificar(True, "tocar outra vez num produto tira-o da lista")
        pagina.locator(".pesquisa input").fill("acucar")
        expect(pagina.locator(".produto__nome")).to_have_text(["Açúcar"])
        verificar(True, "a pesquisa encontra 'Açúcar' ao escrever 'acucar'")
        pagina.locator(".pesquisa input").fill("")
        captura(pagina, "10-catalogo")
        pequenos = toques_pequenos(pagina)
        verificar(not pequenos, f"catálogo: áreas de toque com pelo menos 44 px {pequenos or ''}")
        pagina.locator("[data-novo-produto]").click()
        folha = na_folha(pagina)
        folha.locator("#np-nome").fill("Farinha de mandioca")
        folha.locator("#np-unidade").select_option("kg")
        folha.locator("#np-quantidade").fill("5")
        captura(pagina, "11-novo-produto")
        folha.get_by_role("button", name="Criar e pôr na lista").click()
        expect(folha).to_have_count(0)
        expect(pagina.locator(".rodape-fixo__texto")).to_contain_text("5 artigos")
        expect(pagina.locator(".produto--na-lista", has_text="Farinha de mandioca")).to_have_count(1)
        sem_deslocamento_lateral(pagina, "catálogo")

        # ---------- Lista (tela 3) ----------
        pagina.get_by_role("link", name="Ver lista").click()
        expect(pagina.locator("h1")).to_have_text("Lista de Agosto")
        expect(pagina.locator(".linha__valor--vazio")).to_have_count(5)
        preco_na_lista(pagina, "Arroz", 30000)
        preco_na_lista(pagina, "Óleo alimentar", 8500)
        preco_na_lista(pagina, "Açúcar", 12000)
        preco_na_lista(pagina, "Feijão", 7500)
        resumo = pagina.locator(".lista-resumo")
        expect(resumo).to_contain_text(kz("58 000 Kz"))
        expect(resumo).to_contain_text("1 artigo ainda sem preço previsto")
        expect(pagina.locator(".lista-artigos .linha", has_text="Arroz")).to_contain_text(kz("1 200 Kz/kg"))

        # Na folha, mudar a quantidade mantém o preço por kg (§13).
        pagina.locator(".lista-artigos .linha", has_text="Arroz").click()
        folha = na_folha(pagina)
        expect(folha).to_contain_text("Ainda não compraste este produto")
        folha.get_by_role("button", name="Aumentar quantidade").click()
        expect(folha.locator("#preco-previsto")).to_have_value(kz("31 200"))
        captura(pagina, "12-lista-editar")
        folha.get_by_role("button", name="Fechar").click()
        expect(folha).to_have_count(0)
        expect(pagina.locator(".lista-artigos .linha", has_text="Arroz")).to_contain_text(kz("30 000 Kz"))
        verificar(True, "fechar a folha sem guardar não altera o artigo")
        captura(pagina, "13-lista")
        pequenos = toques_pequenos(pagina)
        verificar(not pequenos, f"lista: áreas de toque com pelo menos 44 px {pequenos or ''}")

        # ---------- Ida às compras em Agosto ----------
        pagina.locator(".nav__item", has_text="Comprar").click()
        expect(pagina.locator("h1")).to_have_text("Nova ida às compras")
        pagina.get_by_role("button", name="Começar a registar").click()
        expect(pagina.locator("#loja-erro")).to_be_visible()
        verificar(True, "sem estabelecimento não começa a compra")
        pagina.locator("#loja").fill("Grossista Kikolo")
        pagina.get_by_role("button", name="Começar a registar").click()
        expect(pagina.locator("h1")).to_have_text("Grossista Kikolo")
        verificar(pagina.locator("nav#navegacao").is_hidden(), "sem barra inferior durante o registo, como na tela 4")
        expect(pagina.locator(".compra-progresso")).to_have_text("0 de 5 artigos registados · faltam 5")
        expect(pagina.locator("#artigo-nome")).to_have_text("Arroz")
        verificar(pagina.locator("[data-accao=guardar]").is_disabled(), "Guardar fica desactivado sem preço")
        teclar(pagina, 30000)
        expect(pagina.locator("[data-contas]")).to_have_text(kz("Previsto 30 000 Kz · agora 1 200 Kz/kg"))
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Óleo alimentar")
        teclar(pagina, 8500)
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Açúcar")
        teclar(pagina, 120000)
        pagina.locator('.tecla[data-tecla="apagar"]').click()
        expect(pagina.locator("[data-valor]")).to_have_text(kz("12 000 Kz"))
        verificar(True, "a tecla de apagar corrige o último algarismo")
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Feijão")
        teclar(pagina, 7500)
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Farinha de mandioca")
        pagina.get_by_role("button", name="Não comprei aqui").click()
        expect(pagina.locator(".compra-fim")).to_contain_text("Não compraste aqui: Farinha de mandioca")
        expect(pagina.locator(".compra-totais")).to_contain_text(kz("58 000 Kz"))
        expect(pagina.locator(".compra-topo__valor")).to_have_text(kz("182 000 Kz"))
        pagina.get_by_role("button", name="Concluir compra").click()
        confirmar_dialogo(pagina, "Concluir compra")
        expect(pagina.locator("h1")).to_have_text("Grossista Kikolo")
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Compra concluída")
        expect(pagina.locator(".alerta")).to_have_text("Esta compra ficou exactamente no previsto.")
        pagina.locator(".botao-voltar").click()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("182 000 Kz"))
        expect(pagina.locator(".previsao")).to_contain_text("ainda não têm preço previsto")

        # ---------- Relatório e fecho de Agosto ----------
        contexto.clock.set_fixed_time(datetime.datetime(2026, 8, 31, 20, 0))
        pagina.locator(".nav__item", has_text="Relatório").click()
        expect(pagina.locator("h1")).to_have_text("Agosto 2026")
        expect(pagina.locator(".numeros-mes")).to_contain_text(kz("182 000"))
        expect(pagina.locator("#precos-titulo")).to_have_text("Preços face ao mês anterior")
        pagina.get_by_role("button", name="Fechar mês e começar Setembro").click()
        confirmar_dialogo(pagina, "Fechar mês")

        # ---------- Novo mês: Setembro ----------
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        expect(pagina.locator(".novo-mes__nota")).to_have_text(kz("Agosto fechou com 182 000 Kz de sobra."))
        expect(pagina.locator("#plafond")).to_have_value(kz("240 000"))
        pagina.locator("#plafond").fill("")
        pagina.locator("#plafond").press_sequentially("250000")
        pagina.locator("[data-mostrar-artigos]").click()
        pagina.locator(".marcar__linha", has_text="Farinha de mandioca").locator("input").uncheck()
        expect(pagina.locator("[data-contagem]")).to_have_text("4 de 5")
        pagina.get_by_role("button", name="Criar mês").click()
        expect(pagina.locator("h1")).to_have_text("Lista de Setembro")
        expect(pagina.locator(".cabecalho__etiqueta")).to_have_text("Copiada de Agosto")
        expect(pagina.locator(".lista-artigos .linha")).to_have_count(4)
        expect(pagina.locator(".lista-resumo")).to_contain_text(kz("58 000 Kz"))
        verificar(True, "Setembro copia os 4 artigos escolhidos, com os últimos preços pagos")

        # ---------- Ida às compras em Setembro (tela 4) ----------
        contexto.clock.set_fixed_time(datetime.datetime(2026, 9, 2, 11, 0))
        pagina.locator(".nav__item", has_text="Comprar").click()
        expect(pagina.locator(".chip", has_text="Grossista Kikolo")).to_have_count(1)
        pagina.locator("#loja").fill("Armazém do Cazenga")
        pagina.get_by_role("button", name="Começar a registar").click()
        teclar(pagina, 32000)
        expect(pagina.locator("[data-anterior]")).to_have_text(kz("Última compra: 1 200 Kz/kg · agora +6,7%"))
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Óleo alimentar")
        teclar(pagina, 9500)
        expect(pagina.locator("[data-contas]")).to_have_text(kz("Previsto 8 500 Kz · agora 1 900 Kz/L"))
        expect(pagina.locator("[data-diferenca]")).to_have_text(kz("+1 000 Kz"))
        captura(pagina, "14-comprar")
        pequenos = toques_pequenos(pagina)
        verificar(not pequenos, f"comprar: áreas de toque com pelo menos 44 px {pequenos or ''}")
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator("#avisos")).to_contain_text("Atenção, comadre: o preço do óleo alimentar subiu 11,8% desde a última compra.")

        expect(pagina.locator("#artigo-nome")).to_have_text("Açúcar")
        teclar(pagina, 11000)
        pagina.locator("[data-accao=guardar]").click()

        # Mudar a quantidade durante a compra (§22): 5 kg de feijão passam a 4 kg.
        expect(pagina.locator("#artigo-nome")).to_have_text("Feijão")
        pagina.locator("[data-accao=quantidade]").click()
        folha = na_folha(pagina)
        expect(folha).to_contain_text("Planeado: 5 kg")
        folha.get_by_role("button", name="Diminuir quantidade").click()
        folha.get_by_role("button", name="Feito").click()
        expect(pagina.locator("[data-accao=quantidade]")).to_contain_text(kz("4 kg"))
        teclar(pagina, 6000)
        expect(pagina.locator("[data-contas]")).to_have_text(kz("Previsto 6 000 Kz · agora 1 500 Kz/kg"))
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator(".compra-fim")).to_contain_text("Registaste todos os artigos da lista.")

        # Artigo fora da lista
        pagina.get_by_role("button", name="Artigo fora da lista").click()
        folha = na_folha(pagina)
        folha.locator("input[type=search]").fill("sal")
        folha.locator(".linha", has_text="Sal").first.click()
        expect(pagina.locator("#artigo-nome")).to_have_text("Sal")
        expect(pagina.locator(".artigo-actual__etiqueta")).to_have_text("Fora da lista")
        teclar(pagina, 400)
        pagina.locator("[data-accao=guardar]").click()
        totais = pagina.locator(".compra-totais")
        expect(totais).to_contain_text(kz("56 500 Kz"))
        expect(totais).to_contain_text(kz("58 900 Kz"))
        expect(totais).to_contain_text(kz("+2 000 Kz"))
        expect(totais).to_contain_text("sem preço previsto")
        expect(pagina.locator(".compra-progresso")).to_have_text("4 de 4 artigos registados · faltam 0 · 1 fora da lista")
        captura(pagina, "15-comprar-totais", completa=True)
        sem_deslocamento_lateral(pagina, "comprar")
        pagina.get_by_role("button", name="Concluir compra").click()
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Compra concluída")
        expect(pagina.locator(".alerta")).to_have_text(kz("Esta compra ficou 2 000 Kz acima do previsto."))

        # Corrigir um preço mal escrito no detalhe da compra
        pagina.locator(".linha", has_text="Sal").click()
        folha = na_folha(pagina)
        campo = folha.locator("#preco-corrigir")
        campo.fill("")
        campo.press_sequentially("450")
        folha.get_by_role("button", name="Guardar correcção").click()
        expect(pagina.locator(".linha", has_text="Sal")).to_contain_text("corrigido")
        expect(pagina.locator(".cartao").first).to_contain_text(kz("58 950 Kz"))
        captura(pagina, "16-compra-detalhe", completa=True)

        # Uma compra cancelada não deixa rasto no gasto
        pagina.locator(".nav__item", has_text="Comprar").click()
        pagina.locator("#loja").fill("Cantina do bairro")
        pagina.get_by_role("button", name="Começar a registar").click()
        pagina.get_by_role("button", name="Artigo fora da lista").click()
        na_folha(pagina).locator(".linha", has_text="Tomate").click()
        teclar(pagina, 3000)
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator(".compra-topo__valor")).to_have_text(kz("188 050 Kz"))
        pagina.get_by_role("button", name="Cancelar compra").click()
        confirmar_dialogo(pagina, "Cancelar compra")
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("191 050 Kz"))
        verificar(True, "cancelar a compra devolve o saldo e não deixa a compra no mês")

        # ---------- Relatório de Setembro (tela 5) ----------
        contexto.clock.set_fixed_time(datetime.datetime(2026, 9, 30, 20, 0))
        pagina.locator(".nav__item", has_text="Relatório").click()
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        expect(pagina.locator("#precos-titulo")).to_have_text("Preços face a Agosto (por unidade)")
        linhas = pagina.locator("#precos-titulo + ul .linha")
        expect(linhas).to_have_count(4)
        textos = [re.sub(r"\s+", " ", t.replace(NBSP, " ")) for t in linhas.all_inner_texts()]
        esperado = [("Óleo alimentar", "1 700 Kz/L → 1 900 Kz/L", "11,8%"), ("Arroz", "1 200 Kz/kg → 1 280 Kz/kg", "6,7%"),
                    ("Feijão", "1 500 Kz/kg → 1 500 Kz/kg", "0%"), ("Açúcar", "1 200 Kz/kg → 1 100 Kz/kg", "8,3%")]
        for (nome, precos, pct), texto in zip(esperado, textos):
            verificar(nome in texto and precos in texto and pct in texto, f"preço face a Agosto: {nome} {precos} {pct}")
        verificar("▲" in textos[0] and "▼" in textos[3] and "=" in textos[2], "setas de subida, descida e igual")
        expect(pagina.locator(".numeros-mes")).to_contain_text(kz("58 950"))
        expect(pagina.locator(".numeros-mes")).to_contain_text(kz("191 050"))
        expect(pagina.locator("#alteracoes-titulo + .cartao")).to_contain_text("Óleo alimentar")
        expect(pagina.locator("#alteracoes-titulo + .cartao")).to_contain_text(kz("Arroz · 32 000 Kz"))
        expect(pagina.locator(".onde")).to_contain_text("Armazém do Cazenga")
        captura(pagina, "17-relatorio")
        captura(pagina, "17-relatorio-completo", completa=True)
        sem_deslocamento_lateral(pagina, "relatório")
        pequenos = toques_pequenos(pagina)
        verificar(not pequenos, f"relatório: áreas de toque com pelo menos 44 px {pequenos or ''}")
        pagina.get_by_role("button", name="Fechar mês e começar Outubro").click()
        confirmar_dialogo(pagina, "Fechar mês")

        # ---------- Novo mês: Outubro (tela 6) ----------
        expect(pagina.locator("h1")).to_have_text("Outubro 2026")
        expect(pagina.locator(".novo-mes__nota")).to_have_text(kz("Setembro fechou com 191 050 Kz de sobra e o cabaz ficou 3,5% mais caro."))
        expect(pagina.locator(".sugestao")).to_contain_text(kz("259 000 Kz"))
        captura(pagina, "18-novo-mes")
        pequenos = toques_pequenos(pagina)
        verificar(not pequenos, f"novo mês: áreas de toque com pelo menos 44 px {pequenos or ''}")
        pagina.locator(".sugestao").click()
        expect(pagina.locator("#plafond")).to_have_value(kz("259 000"))
        pagina.get_by_role("button", name="Criar mês").click()
        expect(pagina.locator("h1")).to_have_text("Lista de Outubro")
        expect(pagina.locator(".cabecalho__etiqueta")).to_have_text("Copiada de Setembro")
        expect(pagina.locator(".lista-artigos .linha", has_text="Feijão")).to_contain_text(kz("7 500 Kz"))
        verificar(True, "Outubro copia a quantidade planeada com o último preço pago por kg")

        # O mês fechado fica guardado e só de leitura.
        pagina.goto(base + "#/relatorio")
        expect(pagina.locator("h1")).to_have_text("Outubro 2026")
        pagina.locator(".nav__item", has_text="Mês").click()
        expect(pagina.locator(".saldo__valor")).to_have_text(kz("259 000 Kz"))

        # Ecrã estreito
        pagina.set_viewport_size({"width": 320, "height": 640})
        for rota in ["catalogo", "lista", "comprar", "relatorio"]:
            pagina.goto(base + "#/" + rota)
            pagina.wait_for_timeout(150)
            sem_deslocamento_lateral(pagina, f"{rota} a 320 px")
        pagina.goto(base + "#/catalogo")
        captura(pagina, "19-catalogo-320")
        contexto.close()
        navegador.close()
    servidor.shutdown()

    for e in erros_consola:
        print("ERRO NA CONSOLA:", e)
    print(f"\n{len(falhas)} falhas." if falhas or erros_consola else "\nCiclo completo sem falhas.")
    sys.exit(1 if falhas or erros_consola else 0)


if __name__ == "__main__":
    main()
