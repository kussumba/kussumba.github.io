// Depois do plafond (prompt mestre, §45 e §46): criar a primeira lista.

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import { executar, mostrarAviso } from '../componentes.js';
import { adicionarSugeridos } from '../../servicos/lista.js';

export const titulo = 'Primeira lista';
export const precisaMesAberto = true;

export async function desenhar(raiz, { contexto, navegar }) {
  montar(raiz, html`
    <section class="entrada entrada--escolha">
      <h1 tabindex="-1">Queres criar a tua primeira lista?</h1>
      <p class="entrada__slogan">Começa pelos produtos básicos ou escolhe no catálogo. Podes mudar tudo depois.</p>

      <div class="opcoes">
        <button type="button" class="opcao" data-accao="sugeridos">
          <span class="opcao__texto">
            <span class="opcao__titulo">Começar com produtos sugeridos</span>
            <span class="opcao__meta">Arroz, óleo, açúcar, feijão, fuba e outros básicos da casa</span>
          </span>
          ${icone('seguinte')}
        </button>
        <button type="button" class="opcao" data-accao="catalogo">
          <span class="opcao__texto">
            <span class="opcao__titulo">Adicionar produtos</span>
            <span class="opcao__meta">Escolhes no catálogo só o que precisas</span>
          </span>
          ${icone('seguinte')}
        </button>
      </div>

      <button type="button" class="botao botao--texto entrada__depois" data-accao="depois">Agora não</button>
    </section>`);

  raiz.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-accao]');
    if (!botao) return;
    const accao = botao.dataset.accao;
    if (accao === 'catalogo') navegar('catalogo');
    if (accao === 'depois') navegar('mes');
    if (accao === 'sugeridos') {
      executar(botao, async () => {
        const n = await adicionarSugeridos(contexto.mesAberto.id);
        mostrarAviso(n === 1 ? '1 produto adicionado à lista.' : `${n} produtos adicionados à lista.`);
        navegar('lista');
      });
    }
  });
}
