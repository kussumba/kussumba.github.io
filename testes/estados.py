"""Estados da KUSSUMBA (prompt mestre, §47) e casos de erro, pela interface.

Uso:  python testes/estados.py [pasta-para-capturas]
"""
import datetime
import pathlib
import sys
import threading

from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from servir import criar_servidor  # noqa: E402

CAPTURAS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent / "capturas"
CAPTURAS.mkdir(parents=True, exist_ok=True)
NBSP = " "

falhas = []
erros_consola = []


def verificar(condicao, descricao):
    print(("OK    " if condicao else "FALHA ") + descricao)
    if not condicao:
        falhas.append(descricao)


def kz(texto):
    return texto.replace(" ", NBSP)


def novo_contexto(navegador, quando, sem_armazenamento=False):
    contexto = navegador.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="pt-AO")
    contexto.clock.set_fixed_time(quando)
    if sem_armazenamento:
        contexto.add_init_script("Object.defineProperty(window, 'indexedDB', { value: undefined });")
    pagina = contexto.new_page()
    if not sem_armazenamento:
        pagina.on("console", lambda m: m.type == "error" and erros_consola.append(m.text))
    pagina.on("pageerror", lambda e: erros_consola.append(str(e)))
    return contexto, pagina


def comecar(pagina, base, plafond="200000"):
    pagina.goto(base)
    pagina.locator("#plafond").press_sequentially(plafond)
    pagina.get_by_role("button", name="Continuar").click()
    pagina.get_by_role("button", name="Agora não").click()
    expect(pagina.locator(".saldo__valor")).to_be_visible()


def main():
    servidor = criar_servidor(0)
    porta = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f"http://localhost:{porta}/"

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(channel="msedge")

        # 1. Mês sem lista e sem compras
        contexto, pagina = novo_contexto(navegador, datetime.datetime(2026, 9, 3, 9, 0))
        comecar(pagina, base)
        expect(pagina.locator(".previsao")).to_contain_text("Ainda não tens lista para este mês.")
        pagina.locator(".nav__item", has_text="Lista").click()
        expect(pagina.locator(".lista-vazia")).to_contain_text("A lista de Setembro ainda está vazia.")
        pagina.locator(".nav__item", has_text="Relatório").click()
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Relatório até hoje")
        expect(pagina.locator(".relatorio__nota")).to_have_text("Este mês não teve lista, por isso não há previsto para comparar.")
        expect(pagina.locator("#onde-titulo + p")).to_have_text("Ainda não há compras registadas.")
        verificar(True, "mês vazio: Mês, Lista e Relatório mostram estados vazios com indicação do que fazer")

        # 2. Comprar sem lista: só artigos fora da lista
        pagina.locator(".nav__item", has_text="Comprar").click()
        expect(pagina.locator(".comprar-inicio__lista")).to_contain_text("Não há artigos por comprar na lista")
        pagina.locator("#loja").fill("Cantina do bairro")
        pagina.get_by_role("button", name="Começar a registar").click()
        expect(pagina.locator(".compra-fim")).to_contain_text("A lista deste mês está vazia")
        verificar(pagina.get_by_role("button", name="Concluir compra").is_disabled(), "sem artigos, não se pode concluir a compra")
        pagina.get_by_role("button", name="Artigo fora da lista").click()
        pagina.locator("dialog.folha .linha", has_text="Ovos").click()
        expect(pagina.locator("[data-accao=quantidade]")).to_contain_text(kz("1 cartão"))
        pagina.locator('.tecla[data-tecla="3"]').click()
        pagina.locator('.tecla[data-tecla="000"]').click()
        expect(pagina.locator("[data-contas]")).to_have_text(kz("Sem preço previsto · agora 3 000 Kz/cartão"))
        pagina.locator("[data-accao=guardar]").click()
        expect(pagina.locator(".compra-progresso")).to_have_text("1 artigo registado")

        # 3. Fechar o mês com uma compra por concluir não é possível
        pagina.goto(base + "#/relatorio")
        pagina.get_by_role("button", name="Fechar mês e começar Outubro").click()
        dialogo = pagina.locator("dialog.dialogo")
        verificar(dialogo.locator("[data-resposta=nao]").evaluate("e => e === document.activeElement"),
                  "o diálogo de fecho começa com o foco em 'Ainda não'")
        pagina.keyboard.press("Enter")
        expect(dialogo).to_have_count(0)
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Relatório até hoje")
        verificar(True, "Enter no diálogo de fecho não fecha o mês")
        pagina.get_by_role("button", name="Fechar mês e começar Outubro").click()
        pagina.locator("dialog.dialogo").get_by_role("button", name="Fechar mês").click()
        expect(pagina.locator("#avisos")).to_contain_text("Há uma compra por concluir em Cantina do bairro")
        verificar(True, "não fecha o mês com uma compra em andamento")
        pagina.goto(base + "#/comprar")
        pagina.get_by_role("button", name="Concluir compra").click()
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Compra concluída")

        # 4. O calendário passa para Outubro com Setembro ainda aberto
        contexto.clock.set_fixed_time(datetime.datetime(2026, 10, 2, 9, 0))
        pagina.goto(base + "#/mes")
        pagina.reload()
        expect(pagina.locator(".alerta").first).to_have_text("Setembro já terminou. Quando quiseres, fecha o mês no Relatório.")
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        pagina.locator(".nav__item", has_text="Relatório").click()
        expect(pagina.locator(".cabecalho__sobre")).to_have_text("Fecho do mês")
        pagina.screenshot(path=CAPTURAS / "20-mes-terminado.png")

        # 5. Entre o fecho e o mês seguinte
        pagina.get_by_role("button", name="Fechar mês e começar Outubro").click()
        pagina.locator("dialog.dialogo").get_by_role("button", name="Fechar mês").click()
        expect(pagina.locator("h1")).to_have_text("Outubro 2026")
        verificar(pagina.locator("input[name=lista][value=copiar]").count() == 0,
                  "sem lista no mês anterior, só aparece 'Começar lista vazia'")
        expect(pagina.locator(".novo-mes__nota")).to_have_text(kz("Setembro fechou com 197 000 Kz de sobra."))
        pagina.goto(base + "#/relatorio")
        expect(pagina.locator("h1")).to_have_text("Setembro 2026")
        expect(pagina.locator(".tela--relatorio .etiqueta")).to_have_text("Mês fechado")
        expect(pagina.get_by_role("link", name="Começar Outubro")).to_be_visible()
        pagina.screenshot(path=CAPTURAS / "21-mes-fechado.png")
        for rota in ["mes", "lista", "comprar"]:
            pagina.goto(base + "#/" + rota)
            expect(pagina.locator("h1")).to_have_text("Outubro 2026")
        verificar(True, "sem mês aberto, Mês, Lista e Comprar levam ao Novo mês")
        contexto.close()

        # 6. Meses sem uso: fechar Setembro em Dezembro começa Dezembro
        contexto, pagina = novo_contexto(navegador, datetime.datetime(2026, 9, 10, 9, 0))
        comecar(pagina, base)
        contexto.clock.set_fixed_time(datetime.datetime(2026, 12, 5, 9, 0))
        pagina.goto(base + "#/relatorio")
        pagina.reload()
        pagina.get_by_role("button", name="Fechar mês e começar Dezembro").click()
        pagina.locator("dialog.dialogo").get_by_role("button", name="Fechar mês").click()
        expect(pagina.locator("h1")).to_have_text("Dezembro 2026")
        pagina.get_by_role("button", name="Criar mês").click()
        expect(pagina.locator("h1")).to_have_text("Lista de Dezembro")
        verificar(True, "depois de meses sem uso, o mês novo é o do calendário")
        contexto.close()

        # 7. Um nome com código aparece como texto e nunca é executado
        contexto, pagina = novo_contexto(navegador, datetime.datetime(2026, 9, 10, 9, 0))
        comecar(pagina, base)
        nome = '<img src=x onerror=window.__a=1>Kit'
        pagina.goto(base + "#/catalogo")
        pagina.locator("[data-novo-produto]").click()
        pagina.locator("#np-nome").fill(nome)
        pagina.get_by_role("button", name="Criar e pôr na lista").click()
        expect(pagina.locator(".produto--na-lista .produto__nome")).to_have_text(nome)
        pagina.goto(base + "#/comprar")
        pagina.locator("#loja").fill('<script>window.__a=1</script>Loja')
        pagina.get_by_role("button", name="Começar a registar").click()
        expect(pagina.locator("h1")).to_have_text('<script>window.__a=1</script>Loja')
        expect(pagina.locator("#artigo-nome")).to_have_text(nome)
        verificar(pagina.evaluate("window.__a === undefined") and pagina.locator("img[src=x]").count() == 0,
                  "nomes com código aparecem como texto e não são executados")
        contexto.close()

        # 8. Navegador que não deixa guardar dados
        contexto, pagina = novo_contexto(navegador, datetime.datetime(2026, 9, 10, 9, 0), sem_armazenamento=True)
        pagina.goto(base)
        expect(pagina.locator("h1")).to_have_text("Não é possível guardar dados")
        expect(pagina.locator(".falha .nota")).to_contain_text("Abre-a no Chrome, fora do modo anónimo")
        pagina.screenshot(path=CAPTURAS / "22-sem-armazenamento.png")
        verificar(True, "sem armazenamento, explica o problema em vez de falhar em silêncio")
        contexto.close()

        navegador.close()
    servidor.shutdown()

    for e in erros_consola:
        print("ERRO NA CONSOLA:", e)
    print(f"\n{len(falhas)} falhas." if falhas or erros_consola else "\nEstados verificados sem falhas.")
    sys.exit(1 if falhas or erros_consola else 0)


if __name__ == "__main__":
    main()
