// Tela Cópia de segurança (prompt mestre, §33; auditoria SEC-003).

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import { executar, mostrarAviso } from '../componentes.js';
import { formatarDataLonga } from '../../nucleo/datas.js';
import { guardarCopia, reporDeFicheiro } from '../copia.js';

export const titulo = 'Cópia de segurança';
export const separador = 'mes';
export const precisaMesAberto = false;

export async function desenhar(raiz, { contexto, navegar, redesenhar }) {
  const ultima = contexto.utilizador.ultimaCopiaEm;
  montar(raiz, html`
    <div class="topo-voltar"><a class="botao-voltar" href="#/mes" aria-label="Voltar ao mês">${icone('voltar')}</a></div>
    <header class="cabecalho"><h1 tabindex="-1">Cópia de segurança</h1></header>

    <section class="cartao copia" aria-labelledby="guardar-titulo">
      <h2 id="guardar-titulo">Guardar uma cópia</h2>
      <p class="nota">Um ficheiro com todos os teus dados: meses, listas, compras e preços. Os dados só existem neste telefone; se limpares o navegador ou mudares de telefone, é esta cópia que os recupera.</p>
      <p class="nota">Guarda o ficheiro fora do telefone, por exemplo no teu email ou no Google Drive.</p>
      <p class="copia__ultima">${ultima ? `Última cópia: ${formatarDataLonga(ultima.slice(0, 10))}.` : 'Ainda não guardaste nenhuma cópia.'}</p>
      <button type="button" class="botao botao--primario" data-accao="guardar">Guardar cópia</button>
    </section>

    <section class="cartao copia" aria-labelledby="repor-titulo">
      <h2 id="repor-titulo">Repor a partir de uma cópia</h2>
      <p class="nota">Substitui todos os dados deste telefone pelos do ficheiro. Serve para mudar de telefone.</p>
      <label class="botao botao--secundario copia__escolher">
        Escolher ficheiro
        <input type="file" accept=".json,application/json" hidden>
      </label>
    </section>`);

  raiz.querySelector('[data-accao="guardar"]').addEventListener('click', (e) => {
    executar(e.currentTarget, async () => {
      await guardarCopia();
      mostrarAviso('Cópia guardada na pasta de transferências.');
      redesenhar();
    });
  });

  const escolher = raiz.querySelector('input[type="file"]');
  escolher.addEventListener('change', () => {
    const ficheiro = escolher.files[0];
    // Limpa a escolha já, para o mesmo ficheiro poder ser escolhido outra vez se algo falhar.
    escolher.value = '';
    executar(null, async () => {
      const reposta = await reporDeFicheiro(ficheiro, { substituir: true });
      if (!reposta) return;
      mostrarAviso('Cópia reposta.');
      navegar('mes');
    });
  });
}
