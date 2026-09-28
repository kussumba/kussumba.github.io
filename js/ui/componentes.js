// Componentes de interface partilhados pelas telas.

import { html, montar } from './html.js';
import { icone } from './icones.js';
import { formatarDigitacaoKz, formatarNumero, lerDecimal, lerKz } from '../nucleo/formatos.js';
import { aceitaDecimais, passoQuantidade, rotuloUnidade } from '../nucleo/unidades.js';
import { ErroKussumba } from '../servicos/comum.js';

const ICONE_DO_NIVEL = { perigo: 'aviso', aviso: 'aviso', positivo: 'positivo', info: 'info' };
const CLASSE_DO_NIVEL = { perigo: 'alerta alerta--perigo', aviso: 'alerta', positivo: 'alerta alerta--positivo', info: 'alerta alerta--info' };

/** Alerta em linha. O ícone e o texto dizem o estado; a cor só reforça (§48). */
export function alerta({ nivel, texto }) {
  return html`<div class="${CLASSE_DO_NIVEL[nivel]}">${icone(ICONE_DO_NIVEL[nivel])}<p>${texto}</p></div>`;
}

export function barraProgresso({ largura, excedido = false, rotulo }) {
  return html`<div class="progresso${excedido ? ' progresso--excedido' : ''}" role="progressbar" aria-label="${rotulo}"
    aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(largura)}"><div class="progresso__barra" data-largura="${largura.toFixed(1)}"></div></div>`;
}

// ---------- Campo de valor em Kz ----------

export function campoKz({ id, rotulo, valor = null, ajuda = null }) {
  const texto = valor ? formatarDigitacaoKz(String(valor)) : '';
  return html`<div class="campo">
    <label class="campo__rotulo" for="${id}">${rotulo}</label>
    <label class="campo-kz" for="${id}">
      <input class="campo-kz__input" id="${id}" type="text" inputmode="numeric" autocomplete="off"
        enterkeyhint="done" value="${texto}" placeholder="0"${ajuda ? html` aria-describedby="${id}-ajuda"` : ''}>
      <span class="campo-kz__moeda" aria-hidden="true">Kz</span>
    </label>
    ${ajuda ? html`<p class="nota" id="${id}-ajuda">${ajuda}</p>` : ''}
    <p class="campo__erro" id="${id}-erro" hidden></p>
  </div>`;
}

const suportaTamanhoAutomatico = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');
let tela;

// Nos navegadores sem "field-sizing", mede o texto para o "Kz" ficar colado ao número.
function ajustarLargura(input) {
  if (suportaTamanhoAutomatico) return;
  tela ??= document.createElement('canvas');
  const contexto = tela.getContext('2d');
  const estilo = getComputedStyle(input);
  contexto.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  const largura = contexto.measureText(input.value || input.placeholder).width;
  input.style.width = `${Math.ceil(largura) + 4}px`;
}

/** Formata os campos de Kz enquanto o utilizador escreve: "250000" aparece "250 000". */
export function ligarCamposKz(raiz) {
  for (const input of raiz.querySelectorAll('.campo-kz__input')) {
    ajustarLargura(input);
    input.addEventListener('input', () => {
      const formatado = formatarDigitacaoKz(input.value);
      if (formatado !== input.value) {
        input.value = formatado;
        input.setSelectionRange(formatado.length, formatado.length);
      }
      mostrarErroCampo(input, null);
      ajustarLargura(input);
    });
  }
}

export function lerCampoKz(input) {
  return lerKz(input.value);
}

export function mostrarErroCampo(input, mensagem) {
  const erro = document.getElementById(`${input.id}-erro`);
  if (!erro) return;
  erro.textContent = mensagem ?? '';
  erro.hidden = !mensagem;
  if (mensagem) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

// ---------- Quantidade: − 25 kg + (§13) ----------

/**
 * Na versão compacta (cartões do catálogo), o número só muda com − e +, que têm área de toque
 * suficiente; a quantidade exacta escreve-se na folha de edição da lista.
 */
export function seletorQuantidade({ id, quantidade, unidade, unidadeTexto = null, compacto = false }) {
  const numero = formatarNumero(quantidade, 3);
  const unidadeTextual = rotuloUnidade(unidade, quantidade, unidadeTexto);
  return html`<div class="quantidade${compacto ? ' quantidade--compacta' : ''}" data-quantidade data-id="${id}"
      data-valor="${quantidade}" data-unidade="${unidade}" data-unidade-texto="${unidadeTexto ?? ''}">
    <button type="button" class="quantidade__botao" data-passo="-1" aria-label="Diminuir quantidade">${icone('menos')}</button>
    ${compacto
      ? html`<span class="quantidade__valor" aria-live="polite">
          <span data-numero>${numero}</span><span class="quantidade__unidade">${unidadeTextual}</span>
        </span>`
      : html`<label class="quantidade__valor">
          <span class="visualmente-oculto">Quantidade</span>
          <input id="${id}" type="text" inputmode="${aceitaDecimais(unidade) ? 'decimal' : 'numeric'}"
            value="${numero}" autocomplete="off" enterkeyhint="done">
          <span class="quantidade__unidade">${unidadeTextual}</span>
        </label>`}
    <button type="button" class="quantidade__botao" data-passo="1" aria-label="Aumentar quantidade">${icone('mais')}</button>
  </div>`;
}

/**
 * Liga os botões − e + e a escrita directa da quantidade.
 * aoMudar recebe a nova quantidade sempre que ela muda e é válida.
 */
export function ligarSeletorQuantidade(elemento, aoMudar = null) {
  const input = elemento.querySelector('input');
  const numero = elemento.querySelector('[data-numero]');
  const rotulo = elemento.querySelector('.quantidade__unidade');
  const unidade = elemento.dataset.unidade;
  const texto = elemento.dataset.unidadeTexto || null;
  let valor = Number(elemento.dataset.valor);

  const aplicar = (novo) => {
    const mudou = novo !== valor;
    valor = novo;
    if (input) input.value = formatarNumero(novo, 3);
    if (numero) numero.textContent = formatarNumero(novo, 3);
    rotulo.textContent = rotuloUnidade(unidade, novo, texto);
    if (mudou) aoMudar?.(novo);
  };

  elemento.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-passo]');
    if (botao) aplicar(passoQuantidade(valor, unidade, Number(botao.dataset.passo)));
  });
  if (!input) return { valor: () => valor };

  input.addEventListener('change', () => {
    const lido = lerDecimal(input.value);
    if (lido && lido > 0 && (aceitaDecimais(unidade) || Number.isInteger(lido))) {
      aplicar(lido);
    } else {
      input.value = formatarNumero(valor, 3);
      mostrarAviso(aceitaDecimais(unidade) ? 'Indica uma quantidade maior do que zero.' : 'Esta unidade só aceita números inteiros.', { erro: true });
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  return { valor: () => valor };
}

// ---------- Avisos temporários ----------

let temporizadorAviso;

export function mostrarAviso(texto, { erro = false } = {}) {
  const zona = document.getElementById('avisos');
  const aviso = document.createElement('div');
  aviso.className = erro ? 'aviso aviso--erro' : 'aviso';
  aviso.textContent = texto;
  zona.replaceChildren(aviso);
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.remove(), erro ? 5000 : 3500);
}

/** Mostra ao utilizador os erros previstos; os imprevistos ficam registados na consola. */
export function tratarErro(erro) {
  if (erro instanceof ErroKussumba || erro?.name === 'ErroArmazenamento') {
    mostrarAviso(erro.message, { erro: true });
    return;
  }
  if (erro?.name === 'QuotaExceededError') {
    mostrarAviso('O telefone está sem espaço para guardar. Liberta algum espaço e tenta outra vez; o que já estava guardado não se perdeu.', { erro: true });
    return;
  }
  console.error(erro);
  mostrarAviso('Não foi possível concluir a operação. Tenta outra vez.', { erro: true });
}

/** Executa a acção de um botão sem permitir toques repetidos enquanto decorre. */
export async function executar(botao, accao) {
  if (botao?.disabled) return;
  if (botao) botao.disabled = true;
  try {
    await accao();
  } catch (erro) {
    tratarErro(erro);
  } finally {
    if (botao?.isConnected) botao.disabled = false;
  }
}

// ---------- Diálogos ----------

function abrirDialogo(conteudo) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'dialogo';
  montar(dialogo, conteudo);
  document.body.append(dialogo);
  dialogo.showModal();
  return dialogo;
}

/**
 * Folha que sobe do fundo do ecrã, para editar sem sair da tela.
 * Fecha ao tocar fora dela, com a tecla Esc ou com dialogo.close().
 */
export function abrirFolha(conteudo, { rotulo = null } = {}) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'folha';
  if (rotulo) dialogo.setAttribute('aria-label', rotulo);
  montar(dialogo, html`<div class="folha__corpo">${conteudo}</div>`);
  document.body.append(dialogo);
  dialogo.showModal();
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-fechar-folha]')) dialogo.close();
  });
  dialogo.addEventListener('close', () => dialogo.remove(), { once: true });
  return dialogo;
}

/** Pede confirmação antes de uma acção. Devolve true só se o utilizador confirmar. */
export function confirmar({ titulo, texto = null, confirmar: rotuloConfirmar = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
  const dialogo = abrirDialogo(html`
    <h2>${titulo}</h2>
    ${texto ? html`<p>${texto}</p>` : ''}
    <div class="dialogo__accoes">
      <button type="button" class="botao ${perigo ? 'botao--perigo' : 'botao--primario'}" data-resposta="sim">${rotuloConfirmar}</button>
      <button type="button" class="botao botao--texto" data-resposta="nao">${cancelar}</button>
    </div>`);
  // Algumas confirmações não se desfazem (fechar o mês, cancelar a compra):
  // o foco começa na opção que não altera nada, para um Enter distraído não confirmar.
  dialogo.querySelector('[data-resposta="nao"]').focus();
  return new Promise((resolve) => {
    dialogo.addEventListener('click', (e) => {
      const botao = e.target.closest('[data-resposta]');
      if (botao) dialogo.close(botao.dataset.resposta);
    });
    dialogo.addEventListener('close', () => {
      resolve(dialogo.returnValue === 'sim');
      dialogo.remove();
    }, { once: true });
  });
}

/**
 * Pede um valor em Kz num diálogo. A função guardar recebe o valor e pode lançar ErroKussumba;
 * nesse caso a mensagem aparece no próprio diálogo. Devolve o valor guardado, ou null se cancelar.
 */
export function pedirKz({ titulo, rotulo, valor = null, confirmar: rotuloConfirmar = 'Guardar', guardar }) {
  const dialogo = abrirDialogo(html`
    <form class="dialogo__form" novalidate>
      <h2>${titulo}</h2>
      ${campoKz({ id: 'dialogo-kz', rotulo, valor })}
      <div class="dialogo__accoes">
        <button type="submit" class="botao botao--primario">${rotuloConfirmar}</button>
        <button type="button" class="botao botao--texto" data-cancelar>Cancelar</button>
      </div>
    </form>`);
  ligarCamposKz(dialogo);
  const input = dialogo.querySelector('input');
  const form = dialogo.querySelector('form');
  input.focus();
  return new Promise((resolve) => {
    let resultado = null;
    dialogo.querySelector('[data-cancelar]').addEventListener('click', () => dialogo.close());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const valorLido = lerCampoKz(input);
      try {
        await guardar(valorLido);
        resultado = valorLido;
        dialogo.close();
      } catch (erro) {
        if (erro instanceof ErroKussumba) mostrarErroCampo(input, erro.message);
        else tratarErro(erro);
      }
    });
    dialogo.addEventListener('close', () => {
      resolve(resultado);
      dialogo.remove();
    }, { once: true });
  });
}
