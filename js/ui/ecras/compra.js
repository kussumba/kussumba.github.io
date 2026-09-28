// Detalhe de uma ida às compras (prompt mestre, §8 e §23).

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import {
  alerta, abrirFolha, campoKz, ligarCamposKz, lerCampoKz, mostrarErroCampo,
  seletorQuantidade, ligarSeletorQuantidade, executar, mostrarAviso, confirmar,
} from '../componentes.js';
import { formatarKz, formatarKzComSinal, formatarNumero, formatarPercentagem } from '../../nucleo/formatos.js';
import { formatarQuantidade, formatarPrecoUnitario } from '../../nucleo/unidades.js';
import { formatarDataLonga } from '../../nucleo/datas.js';
import { alertaFimCompra, motivoPrecoEstranho } from '../../nucleo/alertas.js';
import { ROTULOS } from '../../nucleo/estados.js';
import { detalheCompra, corrigirArtigo, simularArtigo } from '../../servicos/compras.js';
import { ErroKussumba } from '../../servicos/comum.js';

export const titulo = 'Compra';
export const separador = 'mes';
export const precisaMesAberto = false;

function artigos(n) {
  return `${formatarNumero(n)} ${n === 1 ? 'artigo' : 'artigos'}`;
}

function cartaoTotais(r) {
  return html`<section class="cartao" aria-label="Totais da compra">
    <dl class="pares">
      <div class="par"><dt>Total previsto</dt><dd>${formatarKz(r.previsto)}</dd></div>
      <div class="par"><dt>Total real</dt><dd>${formatarKz(r.real)}</dd></div>
      ${r.diferenca === null
        ? ''
        : html`<div class="par"><dt>Diferença</dt><dd class="${r.diferenca > 0 ? 'subida' : r.diferenca < 0 ? 'positivo' : ''}">${formatarKzComSinal(r.diferenca)}</dd></div>`}
    </dl>
    ${r.semPrevisao.artigos
      ? html`<p class="nota compra-totais__nota">Inclui ${formatarKz(r.semPrevisao.total)} de ${artigos(r.semPrevisao.artigos)} sem preço previsto.</p>`
      : ''}
  </section>`;
}

function linhaArtigo(i, editavel) {
  const meta = [formatarQuantidade(i.quantidade, i.unidade, i.unidadeTexto), formatarPrecoUnitario(i.precoUnitarioBase, i.unidadeBase)];
  if (i.variacao !== null) meta.push(`${formatarPercentagem(i.variacao, { sinal: true })} face à última compra`);
  if (i.corrigidoEm) meta.push('corrigido');
  const conteudo = html`
    <span class="linha__texto">
      <span class="linha__titulo">${i.nome}</span>
      <span class="linha__meta">${meta.join(' · ')}</span>
    </span>
    <span class="linha__valor">${formatarKz(i.precoReal)}
      <small>${i.precoPrevisto === null ? 'sem previsão' : `previsto ${formatarKz(i.precoPrevisto)}`}</small>
    </span>`;
  return editavel
    ? html`<li><button type="button" class="linha" data-item="${i.id}">${conteudo}</button></li>`
    : html`<li><div class="linha">${conteudo}</div></li>`;
}

function abrirCorreccao(item, plafond, redesenhar) {
  const folha = abrirFolha(html`
    <form novalidate>
      <div class="folha__cabecalho">
        <div><h2>${item.nome}</h2><p class="nota">Corrigir um valor mal escrito. O histórico de preços fica com a correcção.</p></div>
        <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="campo"><span class="campo__rotulo">Quantidade</span>
        ${seletorQuantidade({ id: 'qtd-corrigir', quantidade: item.quantidade, unidade: item.unidade, unidadeTexto: item.unidadeTexto })}</div>
      ${campoKz({ id: 'preco-corrigir', rotulo: 'Preço pago', valor: item.precoReal })}
      <div class="folha__accoes"><button type="submit" class="botao botao--primario">Guardar correcção</button></div>
    </form>`, { rotulo: `Corrigir ${item.nome}` });
  ligarCamposKz(folha);
  const seletor = ligarSeletorQuantidade(folha.querySelector('[data-quantidade]'));
  const preco = folha.querySelector('#preco-corrigir');
  folha.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    executar(folha.querySelector('button[type="submit"]'), async () => {
      const pago = lerCampoKz(preco);
      const quantidade = seletor.valor();
      const contas = simularArtigo({ ...item, quantidade, precoReal: pago, anterior: item.anterior });
      const motivo = motivoPrecoEstranho({
        precoReal: pago,
        plafond,
        precoUnitarioBase: contas.precoUnitarioBase,
        anteriorUnitarioBase: item.anterior?.precoUnitarioBase ?? null,
        previsto: contas.previsto,
      });
      if (motivo && !(await confirmar({
        titulo: 'Confirmas este preço?',
        texto: `${formatarKz(pago)} por ${item.nome} ${motivo}. Confirma que não é engano de digitação.`,
        confirmar: 'Sim, está certo',
        cancelar: 'Corrigir',
      }))) return;
      try {
        await corrigirArtigo(item.id, { quantidade, precoReal: pago });
      } catch (erro) {
        if (erro instanceof ErroKussumba && /preço/i.test(erro.message)) {
          mostrarErroCampo(preco, erro.message);
          return;
        }
        throw erro;
      }
      folha.close();
      mostrarAviso('Correcção guardada.');
      redesenhar();
    });
  });
}

export async function desenhar(raiz, { parametros, redesenhar }) {
  const [compraId, marca] = parametros;
  const d = await detalheCompra(compraId);
  const concluida = d.compra.estado === 'concluida';
  const editavel = concluida && d.mes.estado !== 'fechado';
  const fim = marca === 'concluida' && concluida ? alertaFimCompra({ diferenca: d.resumo.diferenca }) : null;

  montar(raiz, html`
    <div class="topo-voltar"><a class="botao-voltar" href="#/mes" aria-label="Voltar ao mês">${icone('voltar')}</a></div>
    <header class="cabecalho">
      <p class="cabecalho__sobre">${ROTULOS.compra[d.compra.estado]}</p>
      <h1 tabindex="-1">${d.compra.estabelecimento}</h1>
      <p class="nota">${formatarDataLonga(d.compra.data)} · ${artigos(d.itens.length)}</p>
    </header>
    ${fim ? alerta(fim) : ''}
    ${d.itens.length ? cartaoTotais(d.resumo) : ''}
    <section class="seccao" aria-labelledby="artigos-titulo">
      <h2 class="seccao__titulo" id="artigos-titulo">Artigos</h2>
      ${d.itens.length
        ? html`<ul class="linhas">${d.itens.map((i) => linhaArtigo(i, editavel))}</ul>`
        : html`<p class="nota">Ainda não há artigos registados nesta compra.</p>`}
      ${editavel && d.itens.length ? html`<p class="nota compra-detalhe__ajuda">Toca num artigo para corrigir um valor mal escrito.</p>` : ''}
    </section>
    ${concluida ? '' : html`<a class="botao botao--primario compra-detalhe__continuar" href="#/comprar">Continuar a registar</a>`}`);

  raiz.addEventListener('click', (e) => {
    const linha = e.target.closest('[data-item]');
    if (linha) abrirCorreccao(d.itens.find((i) => i.id === linha.dataset.item), d.mes.plafond, redesenhar);
  });
}
