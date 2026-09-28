// Navegação entre telas por endereço "#/tela/parametro". Funciona sem servidor e sem internet.

import { html, montar } from './html.js';
import { icone } from './icones.js';
import { tratarErro } from './componentes.js';
import { obterUtilizador, obterMesAberto } from '../servicos/meses.js';

const SEPARADORES = [
  { id: 'mes', rotulo: 'Mês' },
  { id: 'lista', rotulo: 'Lista' },
  { id: 'comprar', rotulo: 'Comprar' },
  { id: 'relatorio', rotulo: 'Relatório' },
];

let telas = {};
let raiz;
let navegacao;
let pedidoActual = 0;
let ultimaTela = null;

export function navegar(caminho) {
  const destino = `#/${caminho}`;
  if (location.hash === destino) redesenhar();
  else location.hash = destino;
}

function lerEndereco() {
  const [nome = 'mes', ...parametros] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { nome, parametros: parametros.map(decodeURIComponent) };
}

/** Decide para onde ir quando a tela pedida ainda não faz sentido. */
function guarda(nome, tela, contexto) {
  if (!contexto.utilizador) return nome === 'boas-vindas' ? null : 'boas-vindas';
  if (nome === 'boas-vindas') return 'mes';
  if (tela.precisaMesAberto && !contexto.mesAberto) return 'novo-mes';
  return null;
}

function desenharNavegacao(activo) {
  document.body.classList.toggle('com-nav', Boolean(activo));
  navegacao.hidden = !activo;
  if (!activo) return;
  montar(navegacao, html`<ul class="nav__lista">
    ${SEPARADORES.map((s) => html`<li><a class="nav__item" href="#/${s.id}"${s.id === activo ? html` aria-current="page"` : ''}>
      ${icone(s.id)}<span>${s.rotulo}</span></a></li>`)}
  </ul>`);
}

/** Volta a desenhar a tela actual (depois de gravar alguma coisa, por exemplo). */
export async function redesenhar() {
  const pedido = ++pedidoActual;
  let { nome, parametros } = lerEndereco();
  if (!telas[nome]) nome = 'mes';
  const tela = telas[nome];

  try {
    const utilizador = await obterUtilizador();
    const mesAberto = utilizador ? await obterMesAberto() : null;
    const contexto = { utilizador, mesAberto };
    const desvio = guarda(nome, tela, contexto);
    if (pedido !== pedidoActual) return;
    if (desvio) {
      location.replace(`#/${desvio}`);
      return;
    }

    // Cada desenho usa um contentor novo: os eventos da tela anterior desaparecem com ele.
    const contentor = document.createElement('div');
    contentor.className = `tela tela--${nome}`;
    // Uma tela pode devolver { separador } para mostrar ou esconder a barra inferior conforme o estado.
    const desenho = await tela.desenhar(contentor, { parametros, contexto, navegar, redesenhar });
    if (pedido !== pedidoActual) return;

    raiz.replaceChildren(contentor);
    desenharNavegacao(desenho && 'separador' in desenho ? desenho.separador : tela.separador ?? null);
    document.title = tela.titulo ? `${tela.titulo} · KUSSUMBA` : 'KUSSUMBA';

    // Ao mudar de tela, o leitor de ecrã começa pelo título e a página volta ao topo.
    if (ultimaTela !== location.hash) {
      ultimaTela = location.hash;
      window.scrollTo(0, 0);
      contentor.querySelector('h1')?.focus({ preventScroll: true });
    }
  } catch (erro) {
    if (pedido !== pedidoActual) return;
    const semArmazenamento = erro?.name === 'ErroArmazenamento';
    // Sem armazenamento, a própria tela explica o problema; nos outros casos o aviso diz o que falhou.
    if (!semArmazenamento) tratarErro(erro);
    montar(raiz, html`<div class="falha">
      <h1 tabindex="-1">${semArmazenamento ? 'Não é possível guardar dados' : 'Esta tela não abriu'}</h1>
      <p class="nota">${semArmazenamento ? erro.message : 'Os teus dados continuam guardados. Tenta abrir outra vez.'}</p>
      <button type="button" class="botao botao--primario" data-tentar>Tentar outra vez</button>
    </div>`);
    raiz.querySelector('[data-tentar]').addEventListener('click', () => redesenhar());
  }
}

export function iniciarNavegacao(definicoes, { elementoRaiz, elementoNavegacao }) {
  telas = definicoes;
  raiz = elementoRaiz;
  navegacao = elementoNavegacao;
  window.addEventListener('hashchange', redesenhar);
  redesenhar();
}
