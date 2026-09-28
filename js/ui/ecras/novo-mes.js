// Tela Novo mês (prompt mestre, §16 e §30; tela de referência 6).

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import { campoKz, ligarCamposKz, lerCampoKz, mostrarErroCampo, executar, mostrarAviso } from '../componentes.js';
import { formatarDigitacaoKz, formatarKz, formatarNumero, formatarPercentagem } from '../../nucleo/formatos.js';
import { formatarQuantidade } from '../../nucleo/unidades.js';
import { prepararNovoMes, criarMes } from '../../servicos/meses.js';
import { ErroKussumba } from '../../servicos/comum.js';

export const titulo = 'Novo mês';
export const precisaMesAberto = false;

function artigos(n) {
  return `${formatarNumero(n)} ${n === 1 ? 'artigo' : 'artigos'}`;
}

/** Frase sobre o mês que fechou: sobra (ou excesso) e variação do cabaz habitual. */
function notaDoFecho(anterior) {
  if (anterior.sobrou === null) return null;
  const inicio = anterior.sobrou >= 0
    ? `${anterior.nome} fechou com ${formatarKz(anterior.sobrou)} de sobra`
    : `${anterior.nome} fechou ${formatarKz(-anterior.sobrou)} acima do plafond`;
  const v = anterior.variacaoCabaz;
  if (v === null) return `${inicio}.`;
  const arredondada = Number(v.toFixed(1));
  if (arredondada > 0) return `${inicio} e o cabaz ficou ${formatarPercentagem(v)} mais caro.`;
  if (arredondada < 0) return `${inicio} e o cabaz ficou ${formatarPercentagem(-v)} mais barato.`;
  return `${inicio} e o cabaz ficou ao mesmo preço.`;
}

export async function desenhar(raiz, { navegar }) {
  const p = await prepararNovoMes();
  if (p.mesAberto) {
    navegar('mes');
    return;
  }
  const { anterior, itens } = p;
  const nota = notaDoFecho(anterior);
  const sugestao = p.plafondSugerido !== null && p.plafondSugerido !== anterior.plafond ? p.plafondSugerido : null;

  montar(raiz, html`
    <div class="topo-voltar"><a class="botao-voltar" href="#/relatorio" aria-label="Voltar ao relatório">${icone('voltar')}</a></div>
    <header class="cabecalho">
      <p class="cabecalho__sobre">Novo mês</p>
      <h1 tabindex="-1">${p.rotulo}</h1>
    </header>
    ${nota ? html`<div class="alerta ${anterior.sobrou >= 0 ? 'alerta--positivo' : ''} novo-mes__nota"><p>${nota}</p></div>` : ''}
    <form class="novo-mes" novalidate>
      <div class="novo-mes__plafond">
        ${campoKz({ id: 'plafond', rotulo: 'Plafond do mês', valor: anterior.plafond })}
        ${sugestao
          ? html`<button type="button" class="sugestao" data-sugestao="${sugestao}">
              Sugestão com base ${anterior.variacaoCabaz > 0 ? 'no aumento' : 'na descida'} de preços: <strong>${formatarKz(sugestao)}</strong>
            </button>`
          : ''}
      </div>
      <fieldset class="escolha">
        <legend class="campo__rotulo">Lista de compras</legend>
        ${itens.length
          ? html`<label class="opcao-radio">
              <input type="radio" name="lista" value="copiar" checked>
              <span class="opcao-radio__texto">
                <span class="opcao__titulo">Copiar lista de ${anterior.nome}</span>
                <span class="opcao__meta">${artigos(itens.length)}, com os últimos preços pagos</span>
              </span>
            </label>
            <div class="escolha__artigos" data-bloco-artigos>
              <button type="button" class="ligacao" data-mostrar-artigos aria-expanded="false">
                Escolher artigos (<span data-contagem>${itens.length} de ${itens.length}</span>)
              </button>
              <ul class="marcar" data-marcar hidden>
                ${itens.map((i) => html`<li><label class="marcar__linha">
                  <input type="checkbox" value="${i.itemId}" checked>
                  <span class="marcar__texto">
                    <span class="marcar__nome">${i.nome}</span>
                    <span class="marcar__meta">${formatarQuantidade(i.quantidade, i.unidade, i.unidadeTexto)}${i.precoTotalPrevisto === null ? ' · sem preço' : ` · ${formatarKz(i.precoTotalPrevisto)}`}</span>
                  </span>
                </label></li>`)}
              </ul>
            </div>`
          : ''}
        <label class="opcao-radio">
          <input type="radio" name="lista" value="vazia"${itens.length ? '' : html` checked`}>
          <span class="opcao-radio__texto"><span class="opcao__titulo">Começar lista vazia</span></span>
        </label>
      </fieldset>
      <p class="campo__erro" data-erro-lista hidden></p>
      <button type="submit" class="botao botao--primario novo-mes__criar">Criar mês</button>
    </form>`);

  ligarCamposKz(raiz);
  const campoPlafond = raiz.querySelector('#plafond');
  const blocoArtigos = raiz.querySelector('[data-bloco-artigos]');
  const marcar = raiz.querySelector('[data-marcar]');
  const erroLista = raiz.querySelector('[data-erro-lista]');
  const caixas = () => [...raiz.querySelectorAll('[data-marcar] input[type="checkbox"]')];

  raiz.querySelector('[data-sugestao]')?.addEventListener('click', (e) => {
    campoPlafond.value = formatarDigitacaoKz(e.currentTarget.dataset.sugestao);
    campoPlafond.dispatchEvent(new Event('input'));
  });

  raiz.querySelector('[data-mostrar-artigos]')?.addEventListener('click', (e) => {
    marcar.hidden = !marcar.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!marcar.hidden));
  });

  raiz.querySelector('fieldset').addEventListener('change', (e) => {
    erroLista.hidden = true;
    if (e.target.name === 'lista' && blocoArtigos) blocoArtigos.hidden = e.target.value !== 'copiar';
    if (e.target.type === 'checkbox') {
      const escolhidos = caixas().filter((c) => c.checked).length;
      raiz.querySelector('[data-contagem]').textContent = `${escolhidos} de ${itens.length}`;
    }
  });

  const form = raiz.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const copiar = form.elements.lista.value === 'copiar';
    const seleccionados = caixas().filter((c) => c.checked).map((c) => c.value);
    if (copiar && !seleccionados.length) {
      erroLista.textContent = 'Escolhe pelo menos um artigo para copiar, ou começa com a lista vazia.';
      erroLista.hidden = false;
      return;
    }
    executar(form.querySelector('button[type="submit"]'), async () => {
      try {
        await criarMes({
          plafond: lerCampoKz(campoPlafond),
          copiarDe: copiar ? anterior.id : null,
          itensSeleccionados: copiar ? seleccionados : null,
        });
      } catch (erro) {
        if (erro instanceof ErroKussumba && /plafond/i.test(erro.message)) {
          mostrarErroCampo(campoPlafond, erro.message);
          campoPlafond.focus();
          return;
        }
        throw erro;
      }
      mostrarAviso(`${p.nomeMes} começou.`);
      navegar('lista');
    });
  });
}
