# KUSSUMBA

*A tua comadre nas compras de casa.*

Aplicação para gerir as compras da casa: plafond do mês, lista, registo do que se pagou, histórico de preços e fecho do mês. Funciona no telemóvel como aplicação instalada e continua a funcionar sem internet.

## Experimentar no computador

Na pasta do projecto:

```powershell
python servir.py
```

Abre depois <http://localhost:8080> no Chrome ou no Edge. Para ver com o tamanho de um telemóvel, carrega em F12 e depois em Ctrl+Shift+M.

O `servir.py` só existe para uso local. Corrige um problema do servidor de testes do Python no Windows, que envia os ficheiros `.js` com o tipo errado e impede o navegador de os abrir.

## Publicar para instalar no telemóvel

O Android só instala a aplicação e só a deixa funcionar sem internet se ela estiver num endereço **https**. A forma gratuita mais simples é o GitHub Pages:

1. Cria uma conta em <https://github.com>, se ainda não tiveres.
2. Cria um repositório novo, por exemplo `kussumba`, marcado como **Public**. O GitHub Pages gratuito só publica repositórios públicos. O código fica visível; os dados de cada pessoa nunca saem do telemóvel dela.
3. No repositório, escolhe **Add file** e depois **Upload files**. Arrasta para lá estes elementos da pasta do projecto:
   - as pastas `css`, `fontes`, `icones` e `js`;
   - os ficheiros `index.html`, `manifest.webmanifest` e `sw.js`.

   A pasta `testes` e o `servir.py` não são precisos. Confirma com **Commit changes**.
4. Vai a **Settings**, depois **Pages**. Em **Build and deployment**, escolhe **Deploy from a branch**, o ramo `main` e a pasta `/ (root)`, e carrega em **Save**.
5. Passado um ou dois minutos, a aplicação fica em `https://O-TEU-UTILIZADOR.github.io/kussumba/`.

Qualquer outro alojamento com https serve, desde que publique os mesmos ficheiros.

## Instalar no Android

1. Abre o endereço https no **Chrome** do telemóvel.
2. Toca no menu ⋮ e escolhe **Instalar aplicação**. Nalgumas versões chama-se **Adicionar ao ecrã principal**.
3. A KUSSUMBA aparece no ecrã principal com o ícone da quinda e abre em ecrã inteiro, sem a barra do navegador.

Depois da primeira abertura com internet, funciona sem ligação.

## Onde ficam os dados

Os dados ficam só no telefone, no armazenamento do Chrome. Não há conta nem servidor, e nada é enviado para fora.

Cuidados:

- **Desinstalar a aplicação ou limpar os dados do Chrome apaga tudo.** A exportação e a cópia de segurança estão previstas para uma versão seguinte (§33 do prompt mestre).
- Cada telefone tem os seus próprios dados. Ainda não há sincronização entre telefones.
- No modo anónimo do navegador, os dados apagam-se ao fechar a janela. Se o navegador bloquear o armazenamento de todo, a aplicação avisa e explica o que fazer.

## Publicar uma versão nova

1. Em `sw.js`, muda o valor de `VERSAO`, por exemplo de `kussumba-2026-09-28-5` para `kussumba-2026-10-02-1`. Sem esta mudança, os telefones continuam a usar a versão antiga guardada.
2. Se acrescentaste ficheiros, junta-os também à lista `FICHEIROS` do mesmo `sw.js`.
3. Envia os ficheiros alterados para o repositório, como no passo 3 da publicação.

Os telefones descarregam a versão nova em segundo plano e recarregam uma vez sozinhos. Os dados mantêm-se.

## Testes

Os testes de cálculos, dados e serviços correm no navegador e não precisam de nada instalado. Com o `servir.py` a correr, abre <http://localhost:8080/testes/>.

Os testes automáticos pela interface usam o Edge através do Playwright. É preciso instalá-lo uma vez:

```powershell
pip install playwright
```

Não descarrega navegadores; usa o Edge que já está no Windows. Depois:

| Comando | O que verifica |
| --- | --- |
| `python testes/correr.py` | Cálculos, formatos, dados e serviços (63 testes) |
| `python testes/percurso.py` | Primeira utilização, tela Mês, plafond, sem internet, instalação, computador e ecrã estreito |
| `python testes/ciclo.py` | Agosto, Setembro e Outubro completos pela interface |
| `python testes/estados.py` | Mês vazio, mês terminado, mês fechado, meses saltados, erros e nomes com código |
| `python testes/acessibilidade.py` | Regras WCAG 2.1 AA em todas as telas (precisa de internet na primeira vez) |

## Organização do código

| Pasta | Conteúdo |
| --- | --- |
| `js/nucleo` | Cálculos (§43), formatos em Kz, unidades, datas, alertas e estados. Não toca em dados nem no ecrã. |
| `js/dados` | Base de dados local (IndexedDB), migrações e catálogo inicial. |
| `js/servicos` | Regras de negócio: meses, lista, compras, histórico de preços e relatório. |
| `js/ui` | Telas, componentes, ícones e navegação. As telas não fazem contas; mostram o que os serviços calculam. |
| `css` | Cores e medidas das telas de referência, componentes e telas. |

A estrutura já prevê o que o prompt mestre deixa para depois: a leitura de talões (as compras têm um campo `origem`) e a sincronização (identificadores universais e datas de alteração em todos os registos). O cabaz habitual também já é calculado.
