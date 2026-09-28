// Erros e validações partilhados pelos serviços.

/** Erro com uma mensagem pronta a mostrar ao utilizador. */
export class ErroKussumba extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroKussumba';
  }
}

const MAXIMO_KZ = 100_000_000_000;

/** Valor em Kz: inteiro, maior do que zero. */
export function validarKz(valor, mensagem) {
  if (!Number.isSafeInteger(valor) || valor <= 0 || valor > MAXIMO_KZ) throw new ErroKussumba(mensagem);
  return valor;
}

export function validarQuantidade(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) {
    throw new ErroKussumba('Indica uma quantidade maior do que zero.');
  }
  return Math.round(valor * 1000) / 1000;
}

export function validarTexto(valor, mensagemVazio, maximo = 60) {
  const texto = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) throw new ErroKussumba(mensagemVazio);
  if (texto.length > maximo) throw new ErroKussumba(`Usa no máximo ${maximo} caracteres.`);
  return texto;
}

export function exigirMesAberto(mes) {
  if (!mes) throw new ErroKussumba('Este mês não existe.');
  if (mes.estado === 'fechado') throw new ErroKussumba('Este mês já está fechado e não pode ser alterado.');
  return mes;
}
