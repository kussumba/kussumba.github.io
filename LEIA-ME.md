# KUSSUMBA

*A tua comadre nas compras de casa.*

Aplicação para gerir as compras da casa: plafond do mês, lista, registo do que se pagou, histórico de preços e fecho do mês. Funciona no telemóvel como aplicação instalada e continua a funcionar sem internet.

Endereço: <https://kussumba.github.io/>

O endereço anterior, <https://ladislaulucala-sys.github.io/kussumba/>, foi retirado: mostra apenas um aviso com a ligação para o endereço novo e não aceita utilizadores. O repositório antigo, `ladislaulucala-sys/kussumba`, está arquivado (só de leitura).

## Experimentar no computador

Na pasta do projecto:

```powershell
python servir.py
```

Abre depois <http://localhost:8080> no Chrome ou no Edge. Para ver com o tamanho de um telemóvel, carrega em F12 e depois em Ctrl+Shift+M. Para desligar o servidor, carrega em Ctrl+C.

O `servir.py` só existe para uso local. Corrige um problema do servidor de testes do Python no Windows, que envia os ficheiros `.js` com o tipo errado. Só aceita ligações deste computador e só serve os ficheiros da aplicação e dos testes.

## Instalar no Android

1. Abre o endereço no **Chrome** do telemóvel.
2. Toca no menu ⋮ e escolhe **Instalar aplicação**. Nalgumas versões chama-se **Adicionar ao ecrã principal**.
3. A KUSSUMBA aparece no ecrã principal com o ícone da quinda e abre em ecrã inteiro, sem a barra do navegador.

Depois da primeira abertura com internet, funciona sem ligação.

## Onde ficam os dados

Os dados ficam só no telefone, no armazenamento do Chrome. Não há conta nem servidor, e nada é enviado para fora.

- **Desinstalar a aplicação ou limpar os dados do Chrome apaga tudo.** Por isso existe a **Cópia de segurança**, no fundo da tela Mês: guarda um ficheiro com todos os dados, para repor noutro telefone ou depois de limpar o navegador. Nas boas-vindas há a opção de repor uma cópia.
- Cada telefone tem os seus próprios dados. Ainda não há sincronização entre telefones.
- No modo anónimo do navegador, os dados apagam-se ao fechar a janela. Se o navegador bloquear o armazenamento de todo, a aplicação avisa e explica o que fazer.

## Publicar uma versão nova

A aplicação é publicada no GitHub Pages da organização `kussumba`, no repositório `kussumba/kussumba.github.io`, a partir do ramo `gh-pages`, que só contém os ficheiros da aplicação. O ramo `main` guarda o projecto inteiro, com testes e documentação. No computador, esse repositório chama-se `origin`.

1. Em `sw.js`, muda o valor de `VERSAO`, por exemplo de `kussumba-2026-09-28-6` para `kussumba-2026-10-02-1`. Sem esta mudança, os telefones continuam a usar a versão antiga guardada.
2. Se acrescentaste ficheiros, junta-os também à lista `FICHEIROS` do mesmo `sw.js`.
3. Faz o registo e envia o `main`:

   ```powershell
   git add -A
   git commit -m "Descrição da alteração"
   git push origin main
   ```

4. Publica:

   ```powershell
   python publicar.py
   ```

O `publicar.py` recusa publicar se houver alterações por registar, se o `main` não estiver enviado ou se a `VERSAO` for igual à publicada. Os telefones descarregam a versão nova em segundo plano e recarregam uma vez sozinhos. Os dados mantêm-se.

## Segurança

- A página só aceita scripts e estilos dos próprios ficheiros (política de segurança do conteúdo) e só escreve HTML através de uma única função que escapa tudo o que vem de dados (Trusted Types).
- Os ficheiros de cópia de segurança são tratados como não fiáveis: tamanho limitado, cada campo validado, campos desconhecidos descartados.
- Os ramos `main` e `gh-pages` não aceitam reescrita do histórico nem eliminação.
- Quem controla a conta GitHub controla o código que chega aos telefones: a conta deve ter a verificação em dois passos activa.
- A KUSSUMBA tem um domínio só dela (`kussumba.github.io`). Tudo o que for publicado com GitHub Pages na organização `kussumba` partilha esse domínio e poderia ler os dados da aplicação no navegador: não publiques lá outros projectos.

## Testes

Os testes de cálculos, dados e serviços correm no navegador e não precisam de nada instalado. Com o `servir.py` a correr, abre <http://localhost:8080/testes/>.

Os testes automáticos pela interface usam o Edge através do Playwright, numa versão fixa:

```powershell
pip install -r testes/requisitos.txt
```

Não descarrega navegadores; usa o Edge que já está no Windows. Depois:

| Comando | O que verifica |
| --- | --- |
| `python testes/correr.py` | Cálculos, formatos, dados, serviços e cópia de segurança (71 testes) |
| `python testes/percurso.py` | Primeira utilização, tela Mês, plafond, sem internet, instalação, computador e ecrã estreito |
| `python testes/ciclo.py` | Agosto, Setembro e Outubro completos pela interface |
| `python testes/estados.py` | Estados vazios e fechados, meses saltados, erros, nomes com código, datas, valores estranhos e cópia de segurança |
| `python testes/acessibilidade.py` | Regras WCAG 2.1 AA em todas as telas (precisa de internet na primeira vez; verifica a impressão digital do axe-core) |

## Organização do código

| Pasta | Conteúdo |
| --- | --- |
| `js/nucleo` | Cálculos (§43), formatos em Kz, unidades, datas, alertas e estados. Não toca em dados nem no ecrã. |
| `js/dados` | Base de dados local (IndexedDB), migrações e catálogo inicial. |
| `js/servicos` | Regras de negócio: meses, lista, compras, histórico de preços, relatório e cópia de segurança. |
| `js/ui` | Telas, componentes, ícones e navegação. As telas não fazem contas; mostram o que os serviços calculam. |
| `css` | Cores e medidas das telas de referência, componentes e telas. |

A estrutura já prevê o que o prompt mestre deixa para depois: a leitura de talões (as compras têm um campo `origem`) e a sincronização (identificadores universais e datas de alteração em todos os registos). O cabaz habitual também já é calculado.
