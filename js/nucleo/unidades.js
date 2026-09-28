// Unidades de medida e conversão para a unidade de base.
// Dois preços só se comparam quando têm a mesma unidade de base (g e kg sim; kg e pacote não).

import { formatarNumero, ESPACO } from './formatos.js';

export const UNIDADES = [
  { id: 'kg', singular: 'kg', plural: 'kg', base: 'kg', factor: 1, passo: 1, decimal: true },
  { id: 'g', singular: 'g', plural: 'g', base: 'kg', factor: 0.001, passo: 100, decimal: false },
  { id: 'L', singular: 'L', plural: 'L', base: 'L', factor: 1, passo: 1, decimal: true },
  { id: 'ml', singular: 'ml', plural: 'ml', base: 'L', factor: 0.001, passo: 100, decimal: false },
  { id: 'unidade', singular: 'unidade', plural: 'unidades', base: 'unidade', factor: 1, passo: 1, decimal: false },
  { id: 'pacote', singular: 'pacote', plural: 'pacotes', base: 'pacote', factor: 1, passo: 1, decimal: false },
  { id: 'caixa', singular: 'caixa', plural: 'caixas', base: 'caixa', factor: 1, passo: 1, decimal: false },
  { id: 'cartao', singular: 'cartão', plural: 'cartões', base: 'cartao', factor: 1, passo: 1, decimal: false },
  { id: 'saco', singular: 'saco', plural: 'sacos', base: 'saco', factor: 1, passo: 1, decimal: false },
  { id: 'lata', singular: 'lata', plural: 'latas', base: 'lata', factor: 1, passo: 1, decimal: false },
  { id: 'garrafa', singular: 'garrafa', plural: 'garrafas', base: 'garrafa', factor: 1, passo: 1, decimal: false },
  { id: 'outro', singular: 'outro', plural: 'outros', base: 'outro', factor: 1, passo: 1, decimal: true },
];

const POR_ID = new Map(UNIDADES.map((u) => [u.id, u]));

// Rótulo curto usado em "Kz/kg", "Kz/un.".
const ROTULO_POR_UNIDADE = { unidade: 'un.', cartao: 'cartão' };

export function unidade(id) {
  const u = POR_ID.get(id);
  if (!u) throw new Error(`Unidade desconhecida: ${id}`);
  return u;
}

export function unidadeValida(id) {
  return POR_ID.has(id);
}

/**
 * Unidade de base usada para comparar preços.
 * Para "outro", o texto livre escolhido pelo utilizador faz parte da base,
 * para que "molho" e "kit" nunca se comparem entre si.
 */
export function unidadeBase(id, texto = null) {
  const u = unidade(id);
  if (u.id === 'outro') return 'outro:' + String(texto ?? '').trim().toLowerCase();
  return u.base;
}

/** Converte uma quantidade para a unidade de base: 500 g → 0,5 kg. */
export function paraBase(quantidade, id) {
  return quantidade * unidade(id).factor;
}

export function saoComparaveis(a, b) {
  return a === b;
}

/** Nome da unidade de acordo com a quantidade: "1 lata", "2 latas", "25 kg". */
export function rotuloUnidade(id, quantidade, texto = null) {
  const u = unidade(id);
  if (u.id === 'outro' && texto) return texto;
  return quantidade === 1 ? u.singular : u.plural;
}

/** "25 kg", "2,5 kg", "3 pacotes". */
export function formatarQuantidade(quantidade, id, texto = null) {
  return formatarNumero(quantidade, 3) + ESPACO + rotuloUnidade(id, quantidade, texto);
}

/** Rótulo para preço por unidade de base: "kg", "L", "un.", "pacote". */
export function rotuloPorUnidade(base) {
  if (base.startsWith('outro:')) return base.slice(6) || 'un.';
  return ROTULO_POR_UNIDADE[base] ?? base;
}

/** "1 280 Kz/kg". Valores abaixo de 10 Kz mostram casas decimais para não aparecerem como zero. */
export function formatarPrecoUnitario(valor, base) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '';
  const casas = Math.abs(valor) < 10 ? 2 : 0;
  return formatarNumero(valor, casas) + ESPACO + 'Kz/' + rotuloPorUnidade(base);
}

/** Próxima quantidade ao carregar em "+" ou "−". Nunca desce a zero. */
export function passoQuantidade(quantidade, id, direccao) {
  const { passo } = unidade(id);
  const nova = Math.round((quantidade + direccao * passo) * 1000) / 1000;
  if (nova <= 0) return quantidade;
  return nova;
}

export function aceitaDecimais(id) {
  return unidade(id).decimal;
}
