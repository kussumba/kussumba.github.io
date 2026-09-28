// Ícones desenhados para a KUSSUMBA, em SVG, com a cor do texto à volta (currentColor).

import { seguro, escapar } from './html.js';

const TRACOS = {
  mes: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  lista: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><circle cx="5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
  comprar: '<path d="M3 4.5h2.3l2.1 10.4a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.1"/><circle cx="9.5" cy="19.8" r="1.3"/><circle cx="16.8" cy="19.8" r="1.3"/>',
  relatorio: '<path d="M4 20h16M7.5 16.5V11M12 16.5V6.5M16.5 16.5v-4"/>',
  aviso: '<path d="M10.3 4.6 2.9 17.4A2 2 0 0 0 4.6 20.4h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none"/>',
  positivo: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  voltar: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  seguinte: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  editar: '<path d="M14.5 5.5l4 4M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19 4 20Z"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  apagarTecla: '<path d="M9 5.5h10.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9L3 12l6-6.5Z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
};

// Ícones dos produtos, desenhados para o quadrado bege do catálogo (tela 2).
const PRODUTOS = {
  saco: '<path d="M9 3.5h6M9.8 6.5h4.4"/><path d="M9.2 3.5 9.8 6.5M14.8 3.5l-.6 3"/><path d="M9.8 6.5C6.6 8.6 4.8 11.6 4.8 15c0 3.4 2.9 5.5 7.2 5.5s7.2-2.1 7.2-5.5c0-3.4-1.8-6.4-5-8.5"/>',
  garrafa: '<path d="M10 2.8h4v3.4l1.6 2.6v10.9a1.5 1.5 0 0 1-1.5 1.5H9.9a1.5 1.5 0 0 1-1.5-1.5V8.8L10 6.2V2.8Z"/><path d="M8.4 12h7.2M8.4 16.5h7.2"/>',
  lata: '<ellipse cx="12" cy="5.8" rx="6" ry="2.3"/><path d="M6 5.8v12.4c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3V5.8"/><path d="M6 10.2c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3"/>',
  caixa: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  ovos: '<path d="M3.5 14.5h17l-1.8 5H5.3l-1.8-5Z"/><path d="M8.5 14.5c-2 0-3-1.6-3-3.6 0-2.4 1.4-4.9 3-4.9s3 2.5 3 4.9c0 2-1 3.6-3 3.6ZM15.5 14.5c-2 0-3-1.6-3-3.6 0-2.4 1.4-4.9 3-4.9s3 2.5 3 4.9c0 2-1 3.6-3 3.6Z"/>',
  frango: '<path d="M14.2 3.5c3.4 0 6.3 2.7 6.3 6.1 0 3.8-3.3 6.4-7 5.8l-3.9 3.9"/><path d="M13.5 15.4c-2.4-.6-4.1-2.7-4.1-5.2 0-3.7 2.1-6.7 4.8-6.7"/><circle cx="7.6" cy="19.4" r="1.6"/><circle cx="5.2" cy="17" r="1.6"/>',
  carne: '<path d="M5.4 8.6C7.6 4.4 14.8 3.4 18 6.6c3 3 2.2 8.6-1.8 11-3.6 2.2-8.4 2.2-10.8-.8-1.8-2.4-1.6-5.6 0-8.2Z"/><circle cx="14" cy="11" r="2.2"/>',
  peixe: '<path d="M2.8 12c3-4 7.2-5.6 11.2-4.6 2.8.7 4.4 2.5 5 4.6-.6 2.1-2.2 3.9-5 4.6-4 1-8.2-.6-11.2-4.6Z"/><path d="m19 12 2.5-3.2v6.4L19 12Z"/><circle cx="7.4" cy="11.2" r=".9" fill="currentColor" stroke="none"/>',
  legume: '<path d="M12 7.2c4.3 0 7.5 3 7.5 6.8s-3.2 6.5-7.5 6.5-7.5-2.7-7.5-6.5 3.2-6.8 7.5-6.8Z"/><path d="M12 7.2c0-2.1 1.1-3.5 3.2-4M12 7.2C10.5 5.6 8.6 5.2 7 5.6"/>',
  rolo: '<ellipse cx="9" cy="7" rx="4.2" ry="2.2"/><ellipse cx="9" cy="7" rx="1.3" ry=".7"/><path d="M4.8 7v10.2c0 1.2 1.9 2.2 4.2 2.2h11V9.2"/><path d="M13.2 7v5"/>',
  sabonete: '<rect x="3.5" y="10" width="17" height="9" rx="3.2"/><circle cx="9" cy="6" r="1.5"/><circle cx="14.2" cy="4.8" r="2"/>',
  tubo: '<path d="M3.5 9.5h11.5l3.5 1.5v2l-3.5 1.5H3.5v-5Z"/><path d="M15 9.5v5M18.5 11h2v2h-2M6 9.5v5"/>',
  botija: '<path d="M10 3h4v3h-4z"/><rect x="5.5" y="6" width="13" height="15" rx="4.5"/><path d="M5.5 11.5h13"/>',
  generico: '<path d="M5.2 8h13.6l-1.1 12H6.3L5.2 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
};

function svg(tracos, rotulo, espessura) {
  const acessibilidade = rotulo ? `role="img" aria-label="${escapar(rotulo)}"` : 'aria-hidden="true" focusable="false"';
  return seguro(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round" ${acessibilidade}>${tracos}</svg>`,
  );
}

export function icone(nome, rotulo = null) {
  const tracos = TRACOS[nome];
  if (!tracos) throw new Error(`Ícone desconhecido: ${nome}`);
  return svg(tracos, rotulo, 1.8);
}

/** Ícone de produto; os produtos criados pelo utilizador usam o saco de compras. */
export function iconeProduto(nome) {
  return svg(PRODUTOS[nome] ?? PRODUTOS.generico, null, 1.5);
}

export const ICONES_PRODUTO = Object.keys(PRODUTOS);
