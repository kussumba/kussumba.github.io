// Tela Lista (prompt mestre, §9, §11, §13, §14; tela de referência 3).

import { html, montar } from '../html.js';
import { icone, iconeProduto } from '../icones.js';
import {
  alerta, abrirFolha, campoKz, ligarCamposKz, lerCampoKz, mostrarErroCampo,
  seletorQuantidade, ligarSeletorQuantidade, executar, mostrarAviso, tratarErro, confirmar,
} from '../componentes.js';
import { pareceEngano } from '../../nucleo/alertas.js';
import { formatarKz, formatarPercentagem, formatarNumero } from '../../nucleo/formatos.js';
import { formatarQuantidade, formatarPrecoUnitario, paraBase } from '../../nucleo/unidades.js';
import { precoTotal, precoUnitario } from '../../nucleo/calculos.js';
import { formatarDataCurta, nomeMes, partesIdMes } from '../../nucleo/datas.js';
import { CATEGORIAS } from '../../dados/catalogo-inicial.js';
import { obterLista, actualizarItem, removerDaLista, adicionarSugeridos } from '../../servicos/lista.js';
import { painelMes } from '../../servicos/relatorio.js';
import { detalheProduto } from '../../servicos/produtos.js';
import { ErroKussumba } from '../../servicos/comum.js';
import { ROTULOS } from '../../nucleo/estados.js';

export const titulo = 'Lista';
export const separador = 'lista';
export const precisaMesAberto = true;

function artigos(n) {
  return `${formatarNumero(n)} ${n === 1 ? 'artigo' : 'artigos'}`;
}

/** Totais da lista e comparação com o saldo (§9). */
function cartaoResumo(resumo, painel) {
  const { saldo } = painel.orcamento;
  const cobertura = painel.lista.cobertura;
  let resultado = '';
  if (!resumo.pendentes) {
    resultado = html`<p class="lista-resumo__resultado positivo">${icone('positivo')}<span>Já compraste tudo o que estava na lista.</span></p>`;
  } else if (resumo.pendentePrevisto > 0) {
    resultado = cobertura < 0
      ? html`<p class="lista-resumo__resultado subida">${icone('aviso')}<span>Faltam <strong>${formatarKz(-cobertura)}</strong></span></p>`
      : html`<p class="lista-resumo__resultado positivo">${icone('positivo')}<span>Sobram <strong>${formatarKz(cobertura)}</strong> depois da lista</span></p>`;
  }
  return html`<section class="cartao lista-resumo" aria-label="Resumo da lista">
    <div class="lista-resumo__topo">
      <div>
        <p class="lista-resumo__rotulo">Total previsto</p>
        <p class="lista-resumo__valor">${formatarKz(resumo.totalPrevisto)}</p>
      </div>
      <div class="lista-resumo__direita">
        <p class="lista-resumo__rotulo">Artigos</p>
        <p class="lista-resumo__valor">${formatarNumero(resumo.artigos)}</p>
      </div>
    </div>
    <hr class="divisor">
    <dl class="pares">
      ${resumo.comprados
        ? html`<div class="par"><dt>Por comprar · ${artigos(resumo.pendentes)}</dt><dd>${formatarKz(resumo.pendentePrevisto)}</dd></div>`
        : ''}
      <div class="par"><dt>Saldo disponível</dt><dd>${formatarKz(saldo)}</dd></div>
    </dl>
    ${resultado}
    ${resumo.semPreco
      ? html`<p class="nota lista-resumo__nota">${resumo.semPreco === 1 ? '1 artigo ainda sem preço previsto.' : `${resumo.semPreco} artigos ainda sem preço previsto.`} Toca num artigo para indicar o preço.</p>`
      : ''}
  </section>`;
}

function linhaArtigo(item) {
  const quantidade = formatarQuantidade(item.quantidadePrevista, item.unidade, item.unidadeTexto);
  if (item.comprado) {
    return html`<li><div class="linha linha--comprada">
      <span class="linha__texto">
        <span class="linha__titulo">${icone('check')}${item.nome}</span>
        <span class="linha__meta">${quantidade} · comprado</span>
      </span>
      <span class="linha__valor">${item.precoTotalPrevisto === null ? '' : formatarKz(item.precoTotalPrevisto)}</span>
    </div></li>`;
  }
  return html`<li><button type="button" class="linha" data-item="${item.id}">
    <span class="linha__texto">
      <span class="linha__titulo">${item.nome}</span>
      <span class="linha__meta">${quantidade}</span>
    </span>
    ${item.precoTotalPrevisto === null
      ? html`<span class="linha__valor linha__valor--vazio">Sem preço</span>`
      : html`<span class="linha__valor">${formatarKz(item.precoTotalPrevisto)}
          <small>${formatarPrecoUnitario(item.precoUnitarioBasePrevisto, item.unidadeBase)}</small></span>`}
  </button></li>`;
}

/** Cartão de produto (§11): último preço, preço médio e variação, quando há histórico. */
function historicoDoProduto(preco) {
  if (!preco) return html`<p class="nota">Ainda não compraste este produto. O preço previsto é uma estimativa tua.</p>`;
  const { ultimo, medio, variacao, unidadeBase } = preco;
  return html`<dl class="pares produto-historico">
    <div class="par"><dt>Última compra · ${formatarDataCurta(ultimo.data)}</dt><dd>${formatarKz(ultimo.precoTotal)}</dd></div>
    <div class="par"><dt>${formatarQuantidade(ultimo.quantidade, ultimo.unidade, ultimo.unidadeTexto)} · ${ultimo.estabelecimento}</dt>
      <dd>${formatarPrecoUnitario(ultimo.precoUnitarioBase, unidadeBase)}${variacao === null ? ''
        : html` <span class="${variacao > 0 ? 'subida' : variacao < 0 ? 'descida' : ''}">${formatarPercentagem(variacao, { sinal: true })}</span>`}</dd></div>
    ${preco.registos > 1 ? html`<div class="par"><dt>Preço médio</dt><dd>${formatarPrecoUnitario(medio, unidadeBase)}</dd></div>` : ''}
  </dl>`;
}

async function abrirEdicao(item, redesenhar) {
  const { preco } = await detalheProduto(item.produtoId);
  const categoria = CATEGORIAS.find((c) => c.id === item.categoria)?.nome ?? '';
  const folha = abrirFolha(html`
    <form novalidate>
      <div class="folha__cabecalho">
        <span class="icone-produto">${iconeProduto(item.icone)}</span>
        <div>
          <h2>${item.nome}</h2>
          <p class="nota">${categoria}</p>
        </div>
        <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="campo">
        <span class="campo__rotulo" id="qtd-rotulo">Quantidade</span>
        ${seletorQuantidade({ id: 'qtd', quantidade: item.quantidadePrevista, unidade: item.unidade, unidadeTexto: item.unidadeTexto })}
      </div>
      ${campoKz({ id: 'preco-previsto', rotulo: 'Preço previsto para esta quantidade', valor: item.precoTotalPrevisto })}
      <p class="nota folha__unitario" data-unitario></p>
      ${historicoDoProduto(preco)}
      <div class="folha__accoes">
        <button type="submit" class="botao botao--primario">Guardar</button>
        <button type="button" class="botao botao--texto botao--texto-perigo" data-retirar>Retirar da lista</button>
      </div>
    </form>`, { rotulo: `Editar ${item.nome}` });

  ligarCamposKz(folha);
  const campoPreco = folha.querySelector('#preco-previsto');
  const unitario = folha.querySelector('[data-unitario]');
  let quantidade = item.quantidadePrevista;
  // O preço unitário mantém-se quando a quantidade muda; o total acompanha (§13).
  let precoPorUnidade = item.precoUnitarioPrevisto;

  const mostrarUnitario = () => {
    const total = lerCampoKz(campoPreco);
    const porBase = total ? precoUnitario(total, paraBase(quantidade, item.unidade)) : null;
    unitario.textContent = porBase === null ? '' : formatarPrecoUnitario(porBase, item.unidadeBase);
  };
  mostrarUnitario();

  ligarSeletorQuantidade(folha.querySelector('[data-quantidade]'), (nova) => {
    quantidade = nova;
    if (precoPorUnidade !== null) {
      // Não dispara "input": o preço unitário fica o mesmo e não deriva com os arredondamentos.
      campoPreco.value = formatarNumero(precoTotal(quantidade, precoPorUnidade));
    }
    mostrarUnitario();
  });
  campoPreco.addEventListener('input', () => {
    const total = lerCampoKz(campoPreco);
    precoPorUnidade = total ? precoUnitario(total, quantidade) : null;
    mostrarUnitario();
  });

  folha.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    executar(folha.querySelector('button[type="submit"]'), async () => {
      const total = lerCampoKz(campoPreco) || null;
      const porBase = total ? precoUnitario(total, paraBase(quantidade, item.unidade)) : null;
      if (preco && preco.unidadeBase === item.unidadeBase && pareceEngano(porBase, preco.ultimo.precoUnitarioBase) && !(await confirmar({
        titulo: 'Confirmas este preço?',
        texto: `Dá ${formatarPrecoUnitario(porBase, item.unidadeBase)}; na última compra pagaste ${formatarPrecoUnitario(preco.ultimo.precoUnitarioBase, item.unidadeBase)}.`,
        confirmar: 'Sim, está certo',
        cancelar: 'Corrigir',
      }))) return;
      try {
        await actualizarItem(item.id, { quantidade, precoTotalPrevisto: total });
      } catch (erro) {
        if (erro instanceof ErroKussumba && /preço/i.test(erro.message)) {
          mostrarErroCampo(campoPreco, erro.message);
          return;
        }
        throw erro;
      }
      folha.close();
      redesenhar();
    });
  });
  folha.querySelector('[data-retirar]').addEventListener('click', (e) => {
    executar(e.currentTarget, async () => {
      await removerDaLista(item.id);
      folha.close();
      mostrarAviso(`${item.nome} saiu da lista.`);
      redesenhar();
    });
  });
}

export async function desenhar(raiz, { contexto, redesenhar }) {
  const mesId = contexto.mesAberto.id;
  const [{ mes, itens, resumo }, painel] = await Promise.all([obterLista(mesId), painelMes(mesId)]);
  const nome = nomeMes(mes.mes);
  const copiadaDe = mes.listaCopiadaDe ? nomeMes(partesIdMes(mes.listaCopiadaDe).mes) : null;
  const pendentes = itens.filter((i) => !i.comprado);
  const comprados = itens.filter((i) => i.comprado);

  montar(raiz, html`
    <header class="cabecalho">
      <h1 tabindex="-1">Lista de ${nome}</h1>
      ${copiadaDe || resumo.comprados
        ? html`<div class="cabecalho__etiquetas">
            ${copiadaDe ? html`<p class="etiqueta cabecalho__etiqueta">Copiada de ${copiadaDe}</p>` : ''}
            ${resumo.comprados ? html`<p class="etiqueta etiqueta--neutra">${ROTULOS.lista[resumo.estado]}</p>` : ''}
          </div>`
        : ''}
    </header>
    ${itens.length
      ? html`
        ${cartaoResumo(resumo, painel)}
        ${painel.alertaLista ? alerta(painel.alertaLista) : ''}
        <ul class="linhas lista-artigos" aria-label="Artigos da lista">
          ${pendentes.map(linhaArtigo)}
          ${comprados.map(linhaArtigo)}
        </ul>`
      : html`<div class="cartao lista-vazia">
          <p>A lista de ${nome} ainda está vazia.</p>
          <button type="button" class="botao botao--secundario" data-accao="sugeridos">Começar com produtos sugeridos</button>
        </div>`}
    <a class="botao botao--tracejado lista-adicionar" href="#/catalogo">${icone('mais')}Adicionar artigos do catálogo</a>`);

  raiz.addEventListener('click', (e) => {
    const linha = e.target.closest('[data-item]');
    if (linha) {
      const item = itens.find((i) => i.id === linha.dataset.item);
      abrirEdicao(item, redesenhar).catch(tratarErro);
      return;
    }
    const sugeridos = e.target.closest('[data-accao="sugeridos"]');
    if (sugeridos) {
      executar(sugeridos, async () => {
        const n = await adicionarSugeridos(mesId);
        mostrarAviso(n === 1 ? '1 produto adicionado à lista.' : `${n} produtos adicionados à lista.`);
        redesenhar();
      });
    }
  });
}

