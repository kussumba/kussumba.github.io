// Formatação e leitura de valores para a interface.
// Os valores em Kz são sempre inteiros. As quantidades podem ter casas decimais.

export const ESPACO = ' '; // espaço inseparável: separa milhares e antecede "Kz"
export const MENOS = '−';

function agruparMilhares(digitos) {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACO);
}

function valido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/** 1280 → "1 280"; 2.5 → "2,5". Retira os zeros finais das casas decimais. */
export function formatarNumero(valor, casasMax = 0) {
  if (!valido(valor)) return '';
  const factor = 10 ** casasMax;
  const absoluto = Math.round(Math.abs(valor) * factor) / factor;
  const [inteira, decimal = ''] = absoluto.toFixed(casasMax).split('.');
  const decimalLimpa = decimal.replace(/0+$/, '');
  const negativo = valor < 0 && absoluto !== 0;
  return (negativo ? MENOS : '') + agruparMilhares(inteira) + (decimalLimpa ? ',' + decimalLimpa : '');
}

/** 250000 → "250 000 Kz". */
export function formatarKz(valor) {
  if (!valido(valor)) return '';
  return formatarNumero(Math.round(valor)) + ESPACO + 'Kz';
}

/** 500 → "+500 Kz"; -500 → "−500 Kz"; 0 → "0 Kz". */
export function formatarKzComSinal(valor) {
  if (!valido(valor)) return '';
  const arredondado = Math.round(valor);
  return (arredondado > 0 ? '+' : '') + formatarKz(arredondado);
}

/**
 * Percentagem com uma casa decimal no máximo: 6.666 → "6,7%".
 * Com sinal: "+6,7%", "−8,3%", e "0%" quando não há variação.
 */
export function formatarPercentagem(valor, { sinal = false, casas = 1 } = {}) {
  if (!valido(valor)) return '';
  const texto = formatarNumero(Math.abs(valor), casas);
  const arredondado = Number(Math.abs(valor).toFixed(casas));
  if (arredondado === 0) return '0%';
  if (sinal) return (valor > 0 ? '+' : MENOS) + texto + '%';
  return (valor < 0 ? MENOS : '') + texto + '%';
}

/** Lê um valor em Kz escrito pelo utilizador ("250 000", "250000") e devolve um inteiro ou null. */
export function lerKz(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  const valor = Number(digitos);
  return Number.isSafeInteger(valor) ? valor : null;
}

/** Lê uma quantidade ("2,5", "2.5", "10") e devolve um número ou null. */
export function lerDecimal(texto) {
  const limpo = String(texto ?? '').replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

/** Formata os dígitos enquanto o utilizador escreve: "250000" → "250 000". */
export function formatarDigitacaoKz(texto, maxDigitos = 12) {
  const digitos = String(texto ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigitos);
  return agruparMilhares(digitos);
}
