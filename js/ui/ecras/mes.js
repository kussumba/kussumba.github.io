// Tela Mês (prompt mestre, §5 a §8 e §38). Todos os números vêm do painel calculado nos serviços.

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import { alerta, barraProgresso, pedirKz, mostrarAviso } from '../componentes.js';
import { formatarKz, formatarNumero } from '../../nucleo/formatos.js';
import { formatarDataCurta } from '../../nucleo/datas.js';
import { painelMes } from '../../servicos/relatorio.js';
import { alterarPlafond } from '../../servicos/meses.js';

export const titulo = 'Mês';
export const separador = 'mes';
export const precisaMesAberto = true;

function plural(n, singular, pluralTexto) {
  return `${formatarNumero(n)} ${n === 1 ? singular : pluralTexto}`;
}

function cartaoSaldo({ orcamento }) {
  const { saldo, gasto, plafond, larguraBarra, ultrapassado, percentagem } = orcamento;
  return html`<section class="cartao saldo" aria-labelledby="saldo-titulo">
    ${ultrapassado
      ? html`<p class="saldo__rotulo" id="saldo-titulo">Orçamento ultrapassado em</p>
        <p class="saldo__valor saldo__valor--excedido">${formatarKz(-saldo)}</p>`
      : html`<p class="saldo__rotulo" id="saldo-titulo">Sobra disponível</p>
        <p class="saldo__valor">${formatarKz(saldo)}</p>`}
    ${barraProgresso({
      largura: larguraBarra,
      excedido: ultrapassado,
      rotulo: `Plafond utilizado: ${percentagem === null ? 0 : Math.round(percentagem)}%`,
    })}
    <div class="saldo__pares">
      <div>
        <p class="saldo__par-rotulo">Gasto</p>
        <p class="saldo__par-valor">${formatarKz(gasto)}</p>
      </div>
      <button type="button" class="saldo__plafond" data-accao="plafond" aria-label="Plafond ${formatarKz(plafond)}. Alterar plafond">
        <span class="saldo__par-rotulo">Plafond ${icone('editar')}</span>
        <span class="saldo__par-valor">${formatarKz(plafond)}</span>
      </button>
    </div>
  </section>`;
}

function botaoCompras({ compraEmAndamento }) {
  if (compraEmAndamento) {
    return html`<a class="botao botao--primario" href="#/comprar">${icone('comprar')}Continuar compra em ${compraEmAndamento.estabelecimento}</a>`;
  }
  return html`<a class="botao botao--primario" href="#/comprar">${icone('mais')}Nova ida às compras</a>`;
}

/** Previsão das compras restantes (§6): saldo actual comparado com o que falta comprar na lista. */
function seccaoPrevisao({ lista, orcamento }) {
  let corpo;
  if (!lista.artigos) {
    corpo = html`<p>Ainda não tens lista para este mês.</p>
      <a class="ligacao" href="#/lista">Criar a lista</a>`;
  } else if (!lista.pendentes) {
    corpo = html`<p>Já compraste tudo o que estava na lista.</p>`;
  } else if (lista.pendentePrevisto === 0) {
    corpo = html`<p>Os artigos por comprar ainda não têm preço previsto.</p>
      <a class="ligacao" href="#/lista">Indicar preços na lista</a>`;
  } else {
    const falta = lista.cobertura < 0;
    corpo = html`<dl class="pares">
        <div class="par"><dt>Lista por comprar · ${plural(lista.pendentes, 'artigo', 'artigos')}</dt><dd>${formatarKz(lista.pendentePrevisto)}</dd></div>
        <div class="par"><dt>Saldo actual</dt><dd>${formatarKz(orcamento.saldo)}</dd></div>
      </dl>
      <hr class="divisor">
      ${falta
        ? html`<p class="previsao__resultado subida">${icone('aviso')}<span>Faltam <strong>${formatarKz(-lista.cobertura)}</strong> para cumprir a lista.</span></p>`
        : html`<p class="previsao__resultado positivo">${icone('positivo')}<span>O saldo disponível cobre as compras previstas.</span></p>`}
      ${lista.pendenteSemPreco
        ? html`<p class="nota previsao__nota">${lista.pendenteSemPreco === 1 ? '1 artigo sem preço previsto não entra nesta conta.' : `${lista.pendenteSemPreco} artigos sem preço previsto não entram nesta conta.`}</p>`
        : ''}`;
  }
  return html`<section class="seccao" aria-labelledby="previsao-titulo">
    <h2 class="seccao__titulo" id="previsao-titulo">Previsão das compras restantes</h2>
    <div class="cartao previsao">${corpo}</div>
  </section>`;
}

/** Ritmo de gastos (§7): informativo, nunca julgador. */
function seccaoRitmo({ ritmo, orcamento }) {
  let corpo;
  if (ritmo.disponivel) {
    const face = ritmo.faceAoPlafond;
    corpo = html`<dl class="pares">
        <div class="par"><dt>Média diária</dt><dd>${formatarKz(ritmo.mediaDiaria)}</dd></div>
      </dl>
      <p class="ritmo__frase">Se mantiveres este ritmo, a previsão de gasto mensal é
        <strong>${formatarKz(ritmo.previsaoMensal)}</strong>${face > 0
          ? html`, <span class="subida">${formatarKz(face)} acima do plafond</span>.`
          : html`, dentro do plafond.`}</p>
      <p class="nota">Estimativa feita com ${plural(ritmo.diasDecorridos, 'dia', 'dias')} de ${ritmo.diasNoMes}.</p>`;
  } else if (orcamento.gasto === 0) {
    corpo = html`<p class="nota">Ainda não registaste compras este mês.</p>`;
  } else if (ritmo.diasDecorridos === 0) {
    corpo = html`<p class="nota">Este mês ainda não começou no calendário.</p>`;
  } else {
    corpo = html`<p class="nota">A média diária aparece a partir do dia ${ritmo.diasMinimos} do mês, quando já há dias suficientes para uma estimativa.</p>`;
  }
  return html`<section class="seccao" aria-labelledby="ritmo-titulo">
    <h2 class="seccao__titulo" id="ritmo-titulo">Ritmo de gastos</h2>
    <div class="cartao ritmo">${corpo}</div>
  </section>`;
}

/** Idas às compras deste mês (§8). */
function seccaoCompras({ compras }) {
  return html`<section class="seccao" aria-labelledby="idas-titulo">
    <h2 class="seccao__titulo" id="idas-titulo">Idas deste mês</h2>
    ${compras.length
      ? html`<ul class="linhas linhas--separadas">
          ${compras.map((c) => html`<li>
            <a class="linha" href="${c.estado === 'em_andamento' ? '#/comprar' : `#/compra/${c.id}`}">
              <span class="linha__texto">
                <span class="linha__titulo">${c.estabelecimento}</span>
                <span class="linha__meta">${formatarDataCurta(c.data)} · ${plural(c.artigos, 'artigo', 'artigos')}</span>
                ${c.estado === 'em_andamento' ? html`<span class="etiqueta etiqueta--aviso linha__etiqueta">Em andamento</span>` : ''}
              </span>
              <span class="linha__valor">${formatarKz(c.total)}</span>
            </a>
          </li>`)}
        </ul>`
      : html`<p class="nota vazio">Ainda não há idas às compras este mês.</p>`}
  </section>`;
}

export async function desenhar(raiz, { contexto, redesenhar }) {
  const painel = await painelMes(contexto.mesAberto.id);
  // A ultrapassagem já aparece no cartão do saldo; o alerta mostra a mensagem seguinte, se houver.
  const primeiroAlerta = painel.alertas.find((a) => a.tipo !== 'orcamento_ultrapassado');

  montar(raiz, html`
    <header class="cabecalho">
      <p class="cabecalho__sobre">Mês em curso</p>
      <h1 tabindex="-1">${painel.rotulo}</h1>
    </header>
    ${cartaoSaldo(painel)}
    ${primeiroAlerta ? alerta(primeiroAlerta) : ''}
    ${botaoCompras(painel)}
    ${seccaoPrevisao(painel)}
    ${seccaoRitmo(painel)}
    ${seccaoCompras(painel)}`);

  raiz.querySelector('[data-accao="plafond"]').addEventListener('click', async () => {
    const novo = await pedirKz({
      titulo: 'Plafond do mês',
      rotulo: `Quanto tens para as compras de ${painel.rotulo}?`,
      valor: painel.orcamento.plafond,
      guardar: (valor) => alterarPlafond(painel.mes.id, valor),
    });
    if (novo !== null) {
      mostrarAviso('Plafond actualizado.');
      redesenhar();
    }
  });
}
