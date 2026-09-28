// Tela Relatório (prompt mestre, §24 a §28 e §30; tela de referência 5).

import { html, montar } from '../html.js';
import { confirmar, executar } from '../componentes.js';
import { formatarKz, formatarKzComSinal, formatarNumero, formatarPercentagem } from '../../nucleo/formatos.js';
import { formatarPrecoUnitario } from '../../nucleo/unidades.js';
import { agora, compararMeses, diasRestantes, mesDaData, nomeMes } from '../../nucleo/datas.js';
import { relatorioMes } from '../../servicos/relatorio.js';
import { mesParaRelatorio, proximoMes, fecharMes } from '../../servicos/meses.js';
import { ROTULOS } from '../../nucleo/estados.js';

export const titulo = 'Relatório';
export const separador = 'relatorio';
export const precisaMesAberto = false;

/** Variação com seta e palavra: a cor reforça, mas não é a única pista (§48). */
function variacao(v) {
  const arredondada = Number(v.toFixed(1));
  if (arredondada > 0) {
    return html`<span class="variacao subida"><span aria-hidden="true">▲</span><span class="visualmente-oculto">subiu</span> ${formatarPercentagem(v)}</span>`;
  }
  if (arredondada < 0) {
    return html`<span class="variacao descida"><span aria-hidden="true">▼</span><span class="visualmente-oculto">desceu</span> ${formatarPercentagem(-v)}</span>`;
  }
  return html`<span class="variacao igual"><span aria-hidden="true">=</span><span class="visualmente-oculto">sem variação,</span> 0%</span>`;
}

function numerosDoMes(r, fechado) {
  const rotuloSobra = r.ultrapassado ? 'Ultrapassou' : fechado ? 'Sobrou' : 'Sobra';
  return html`<div class="numeros-mes" role="group" aria-label="Resumo em Kz">
    <div class="numero-mes"><p class="numero-mes__rotulo">Plafond</p><p class="numero-mes__valor">${formatarNumero(r.plafond)}</p></div>
    <div class="numero-mes"><p class="numero-mes__rotulo">Gasto</p><p class="numero-mes__valor">${formatarNumero(r.gasto)}</p></div>
    <div class="numero-mes numero-mes--destaque${r.ultrapassado ? ' numero-mes--excedido' : ''}">
      <p class="numero-mes__rotulo">${rotuloSobra}</p><p class="numero-mes__valor">${formatarNumero(Math.abs(r.sobrou))}</p>
    </div>
  </div>
  <p class="nota numeros-mes__nota">Valores em Kz.</p>`;
}

function planeadoRealizado(r) {
  return html`<section class="seccao" aria-labelledby="planeado-titulo">
    <h2 class="seccao__titulo" id="planeado-titulo">Planeado e realizado</h2>
    <div class="cartao">
      <dl class="pares">
        <div class="par"><dt>Compras previstas</dt><dd>${formatarKz(r.previsto)}</dd></div>
        <div class="par"><dt>Compras realizadas</dt><dd>${formatarKz(r.gasto)}</dd></div>
        ${r.diferencaPrevisto === null
          ? ''
          : html`<div class="par"><dt>Diferença</dt><dd class="${r.diferencaPrevisto > 0 ? 'subida' : r.diferencaPrevisto < 0 ? 'positivo' : ''}">${formatarKzComSinal(r.diferencaPrevisto)}</dd></div>`}
      </dl>
      ${!r.artigosNaLista ? html`<p class="nota relatorio__nota">Este mês não teve lista, por isso não há previsto para comparar.</p>` : ''}
      ${r.artigosNaLista && r.previstoSemPreco
        ? html`<p class="nota relatorio__nota">${r.previstoSemPreco === 1 ? '1 artigo da lista não tinha' : `${r.previstoSemPreco} artigos da lista não tinham`} preço previsto e não entram no previsto.</p>`
        : ''}
    </div>
  </section>`;
}

function precosFaceAoAnterior(r) {
  const tituloSeccao = r.mesAnterior ? `Preços face a ${r.mesAnterior.nome} (por unidade)` : 'Preços face ao mês anterior';
  let corpo;
  if (!r.mesAnterior) corpo = html`<p class="nota">Ainda não há um mês anterior com compras para comparar.</p>`;
  else if (!r.precos.length) corpo = html`<p class="nota">Nenhum produto foi comprado nos dois meses na mesma unidade.</p>`;
  else {
    corpo = html`<ul class="linhas">${r.precos.map((p) => html`<li><div class="linha">
      <span class="linha__texto">
        <span class="linha__titulo">${p.nome}</span>
        <span class="linha__meta">${formatarPrecoUnitario(p.anterior, p.unidadeBase)} → ${formatarPrecoUnitario(p.actual, p.unidadeBase)}</span>
      </span>
      <span class="linha__valor">${variacao(p.variacao)}</span>
    </div></li>`)}</ul>`;
  }
  return html`<section class="seccao" aria-labelledby="precos-titulo">
    <h2 class="seccao__titulo" id="precos-titulo">${tituloSeccao}</h2>
    ${corpo}
  </section>`;
}

function maioresAlteracoes(r) {
  if (!r.maiorAumento && !r.maiorReducao && !r.maiorDespesa) return '';
  return html`<section class="seccao" aria-labelledby="alteracoes-titulo">
    <h2 class="seccao__titulo" id="alteracoes-titulo">Maiores alterações</h2>
    <div class="cartao">
      <dl class="pares">
        ${r.maiorAumento ? html`<div class="par"><dt>Maior aumento</dt><dd>${r.maiorAumento.nome} ${variacao(r.maiorAumento.variacao)}</dd></div>` : ''}
        ${r.maiorReducao ? html`<div class="par"><dt>Maior redução</dt><dd>${r.maiorReducao.nome} ${variacao(r.maiorReducao.variacao)}</dd></div>` : ''}
        ${r.maiorDespesa ? html`<div class="par"><dt>Maior despesa</dt><dd>${r.maiorDespesa.nome} · ${formatarKz(r.maiorDespesa.total)}</dd></div>` : ''}
      </dl>
    </div>
  </section>`;
}

function ondeGastou(r) {
  return html`<section class="seccao" aria-labelledby="onde-titulo">
    <h2 class="seccao__titulo" id="onde-titulo">Onde gastou</h2>
    ${r.ondeGastou.length
      ? html`<ul class="onde">${r.ondeGastou.map((l) => html`<li>
          <div class="onde__linha"><span>${l.estabelecimento}</span><strong>${formatarKz(l.total)}</strong></div>
          <div class="onde__barra" aria-hidden="true"><span style="width: ${l.proporcao.toFixed(1)}%"></span></div>
        </li>`)}</ul>`
      : html`<p class="nota">Ainda não há compras registadas.</p>`}
  </section>`;
}

export async function desenhar(raiz, { navegar }) {
  const mes = await mesParaRelatorio();
  const r = await relatorioMes(mes.id);
  const hoje = agora();
  const fechado = mes.estado === 'fechado';
  const terminado = compararMeses(mesDaData(hoje), mes) > 0;
  const seguinte = nomeMes(proximoMes(mes, hoje).mes);

  montar(raiz, html`
    <header class="cabecalho">
      <p class="cabecalho__sobre">${fechado || terminado ? 'Fecho do mês' : 'Relatório até hoje'}</p>
      <h1 tabindex="-1">${r.rotulo}</h1>
      ${fechado ? html`<p class="etiqueta etiqueta--neutra cabecalho__etiqueta">${ROTULOS.mes.fechado}</p>` : ''}
    </header>
    ${numerosDoMes(r, fechado)}
    ${planeadoRealizado(r)}
    ${precosFaceAoAnterior(r)}
    ${maioresAlteracoes(r)}
    ${ondeGastou(r)}
    <div class="relatorio__fim">
      ${fechado
        ? html`<p class="nota">${r.nomeMes} está fechado. Os números acima ficaram guardados no fecho.</p>
          <a class="botao botao--primario" href="#/novo-mes">Começar ${seguinte}</a>`
        : html`<button type="button" class="botao botao--secundario" data-accao="fechar">Fechar mês e começar ${seguinte}</button>`}
    </div>`);

  raiz.querySelector('[data-accao="fechar"]')?.addEventListener('click', async (e) => {
    const botao = e.currentTarget;
    const faltam = diasRestantes(mes.ano, mes.mes, hoje);
    const saldo = r.ultrapassado ? `ultrapassou o plafond em ${formatarKz(-r.sobrou)}` : `sobram ${formatarKz(r.sobrou)}`;
    const ok = await confirmar({
      titulo: `Fechar ${r.nomeMes}?`,
      texto: `Gasto ${formatarKz(r.gasto)} de ${formatarKz(r.plafond)}; ${saldo}. `
        + (faltam > 0 ? `Ainda ${faltam === 1 ? 'falta 1 dia' : `faltam ${faltam} dias`} para o fim do mês. ` : '')
        + 'Depois de fechado, o mês fica guardado como está e já não pode ser alterado. Nada é apagado.',
      confirmar: 'Fechar mês',
      cancelar: 'Ainda não',
    });
    if (!ok) return;
    await executar(botao, async () => {
      await fecharMes(mes.id);
      navegar('novo-mes');
    });
  });
}

