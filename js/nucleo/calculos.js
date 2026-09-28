// Regras de cálculo da KUSSUMBA (prompt mestre, §43).
// Todas as telas usam estas funções. Nenhuma tela faz contas por conta própria.
// Quando falta um dado ou haveria divisão por zero, as funções devolvem null em vez de inventar um valor.

function numero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/** Saldo = plafond − gasto real. */
export function saldo(plafond, gastoReal) {
  if (!numero(plafond) || !numero(gastoReal)) return null;
  return plafond - gastoReal;
}

/** Percentagem utilizada = gasto real / plafond × 100. */
export function percentagemUtilizada(gastoReal, plafond) {
  if (!numero(gastoReal) || !numero(plafond) || plafond <= 0) return null;
  return (gastoReal / plafond) * 100;
}

/** Preço total de uma linha = quantidade × preço unitário, arredondado ao Kz. */
export function precoTotal(quantidade, precoUnitario) {
  if (!numero(quantidade) || !numero(precoUnitario) || quantidade <= 0) return null;
  return Math.round(quantidade * precoUnitario);
}

/** Preço unitário = preço total / quantidade. */
export function precoUnitario(total, quantidade) {
  if (!numero(total) || !numero(quantidade) || quantidade <= 0) return null;
  return total / quantidade;
}

/**
 * Total previsto = Σ quantidade × preço unitário previsto.
 * As linhas sem preço previsto não entram na soma e são contadas à parte,
 * para a interface poder avisar que o total está incompleto.
 */
export function totalPrevisto(linhas) {
  let total = 0;
  let semPreco = 0;
  for (const l of linhas) {
    const t = precoTotal(l.quantidade, l.precoUnitario);
    if (t === null) semPreco += 1;
    else total += t;
  }
  return { total, semPreco };
}

/** Total real = Σ preço efectivamente pago em cada linha. */
export function totalReal(linhas) {
  return linhas.reduce((soma, l) => soma + (numero(l.precoReal) ? l.precoReal : 0), 0);
}

/** Diferença = total real − total previsto. Positiva quando se pagou mais do que o previsto. */
export function diferenca(real, previsto) {
  if (!numero(real) || !numero(previsto)) return null;
  return real - previsto;
}

/** Variação de preço = (actual − anterior) / anterior × 100. Sem preço anterior, não há variação. */
export function variacaoPercentual(actual, anterior) {
  if (!numero(actual) || !numero(anterior) || anterior <= 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

/** Média diária = total gasto / dias decorridos. */
export function mediaDiaria(gastoReal, diasDecorridos) {
  if (!numero(gastoReal) || !numero(diasDecorridos) || diasDecorridos <= 0) return null;
  return gastoReal / diasDecorridos;
}

/** Previsão mensal = média diária × dias do mês. */
export function previsaoMensal(media, diasDoMes) {
  if (!numero(media) || !numero(diasDoMes) || diasDoMes <= 0) return null;
  return Math.round(media * diasDoMes);
}

/**
 * Previsão das compras restantes = saldo actual − total previsto do que falta comprar.
 * Resultado negativo: falta dinheiro para cumprir a lista.
 */
export function coberturaDaLista(saldoActual, pendentePrevisto) {
  if (!numero(saldoActual) || !numero(pendentePrevisto)) return null;
  return saldoActual - pendentePrevisto;
}

/**
 * Preço médio ponderado por unidade de base: Σ preço pago / Σ quantidade.
 * Evita que uma compra pequena pese tanto como uma grande.
 */
export function precoMedioPonderado(registos) {
  let pago = 0;
  let quantidade = 0;
  for (const r of registos) {
    if (!numero(r.precoTotal) || !numero(r.quantidadeBase) || r.quantidadeBase <= 0) continue;
    pago += r.precoTotal;
    quantidade += r.quantidadeBase;
  }
  return quantidade > 0 ? pago / quantidade : null;
}

/**
 * Cabaz habitual: quanto custa o mesmo conjunto de produtos, nas mesmas quantidades,
 * aos preços de cada mês. Recebe pares { quantidade, precoActual, precoAnterior }
 * com a quantidade na unidade de base e os preços por unidade de base.
 */
export function cabaz(pares) {
  let actual = 0;
  let anterior = 0;
  for (const p of pares) {
    if (!numero(p.quantidade) || !numero(p.precoActual) || !numero(p.precoAnterior)) continue;
    actual += p.quantidade * p.precoActual;
    anterior += p.quantidade * p.precoAnterior;
  }
  if (anterior <= 0) return null;
  return {
    actual: Math.round(actual),
    anterior: Math.round(anterior),
    variacao: variacaoPercentual(actual, anterior),
  };
}

/** Plafond ajustado à variação do cabaz, arredondado a múltiplos de 500 Kz. */
export function sugestaoPlafond(plafond, variacao, multiplo = 500) {
  if (!numero(plafond) || !numero(variacao) || plafond <= 0) return null;
  return Math.round((plafond * (1 + variacao / 100)) / multiplo) * multiplo;
}

/** Percentagem limitada entre 0 e 100, para larguras de barras. */
export function limitarPercentagem(valor) {
  if (!numero(valor)) return 0;
  return Math.min(100, Math.max(0, valor));
}
