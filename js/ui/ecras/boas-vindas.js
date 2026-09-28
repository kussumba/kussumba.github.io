// Primeira utilização (prompt mestre, §45): pergunta apenas o plafond mensal.

import { html, montar } from '../html.js';
import { campoKz, ligarCamposKz, lerCampoKz, mostrarErroCampo, executar, mostrarAviso } from '../componentes.js';
import { reporDeFicheiro } from '../copia.js';
import { configurarInicio } from '../../servicos/meses.js';
import { ErroKussumba } from '../../servicos/comum.js';
import { pedirArmazenamentoPersistente } from '../../dados/db.js';

export const titulo = 'Bem-vinda';

export async function desenhar(raiz, { navegar }) {
  montar(raiz, html`
    <section class="entrada">
      <div class="entrada__marca">
        <img src="icones/favicon.svg" alt="" width="64" height="64">
        <p class="entrada__nome">KUSSUMBA</p>
      </div>
      <h1 tabindex="-1">Bem-vinda à KUSSUMBA</h1>
      <p class="entrada__slogan">A tua comadre nas compras de casa.</p>

      <form class="entrada__form" novalidate>
        ${campoKz({
          id: 'plafond',
          rotulo: 'Qual é o teu plafond mensal para compras?',
          ajuda: 'O valor que reservas por mês para as compras de casa. Podes mudá-lo depois.',
        })}
        <button type="submit" class="botao botao--primario">Continuar</button>
      </form>
      <label class="ligacao entrada__repor">
        Já usaste a KUSSUMBA noutro telefone? Repor uma cópia
        <input type="file" accept=".json,application/json" hidden>
      </label>
    </section>`);

  ligarCamposKz(raiz);
  const input = raiz.querySelector('#plafond');
  const form = raiz.querySelector('form');

  const ficheiroCopia = raiz.querySelector('input[type="file"]');
  ficheiroCopia.addEventListener('change', () => {
    const ficheiro = ficheiroCopia.files[0];
    ficheiroCopia.value = '';
    executar(null, async () => {
      if (!(await reporDeFicheiro(ficheiro, { substituir: false }))) return;
      pedirArmazenamentoPersistente();
      mostrarAviso('Cópia reposta. Bem-vinda de volta.');
      navegar('mes');
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    executar(form.querySelector('button[type="submit"]'), async () => {
      try {
        await configurarInicio({ plafond: lerCampoKz(input) });
      } catch (erro) {
        if (erro instanceof ErroKussumba) {
          mostrarErroCampo(input, erro.message);
          input.focus();
          return;
        }
        throw erro;
      }
      pedirArmazenamentoPersistente();
      navegar('primeira-lista');
    });
  });
}
