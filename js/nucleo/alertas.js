// Regras de alertas (prompt mestre, §37). Funções puras: recebem números e devolvem mensagens.
// Cada alerta traz um nível para a interface escolher a cor e o ícone:
// "perigo" (ultrapassagem), "aviso" (atenção), "positivo" (poupança) e "info".

import { formatarKz, formatarPercentagem } from './formatos.js';

/** A partir desta percentagem do plafond, a KUSSUMBA avisa que o orçamento está perto do limite. */
export const LIMIAR_PROXIMO_LIMITE = 70;

/** Subida de preço, face à compra anterior, a partir da qual a KUSSUMBA chama a atenção. */
export const LIMIAR_SUBIDA_SIGNIFICATIVA = 10;

/**
 * A média diária só serve para prever o mês depois de alguns dias.
 * Com um ou dois dias, uma única compra grande dava uma previsão sem sentido.
 */
export const DIAS_MINIMOS_RITMO = 7;

function plural(n, singular, pluralTexto) {
  return n === 1 ? singular : pluralTexto;
}

/**
 * Alertas do orçamento do mês, por ordem de prioridade.
 * A tela Mês mostra só o primeiro, para não encher a tela de avisos.
 */
export function alertasOrcamento({ plafond, gasto, percentagem, diasRestantes, previsaoMensal, diasDecorridos, mesTerminado, nomeDoMes }) {
  const alertas = [];

  if (mesTerminado) {
    alertas.push({
      tipo: 'mes_terminado',
      nivel: 'info',
      texto: `${nomeDoMes} já terminou. Quando quiseres, fecha o mês no Relatório.`,
    });
  }

  if (gasto > plafond) {
    alertas.push({
      tipo: 'orcamento_ultrapassado',
      nivel: 'perigo',
      texto: `Orçamento ultrapassado em ${formatarKz(gasto - plafond)}.`,
    });
  } else if (percentagem !== null && percentagem >= LIMIAR_PROXIMO_LIMITE && !mesTerminado) {
    const dias = diasRestantes > 0
      ? ` e ${plural(diasRestantes, 'falta', 'faltam')} ${diasRestantes} ${plural(diasRestantes, 'dia', 'dias')} para o fim do mês`
      : '';
    alertas.push({
      tipo: 'proximo_limite',
      nivel: 'aviso',
      texto: `Já usaste ${formatarPercentagem(percentagem, { casas: 0 })} do plafond${dias}.`,
    });
  }

  if (
    !mesTerminado &&
    gasto <= plafond &&
    previsaoMensal !== null &&
    diasDecorridos >= DIAS_MINIMOS_RITMO &&
    previsaoMensal > plafond
  ) {
    alertas.push({
      tipo: 'previsao_acima',
      nivel: 'aviso',
      texto: `Ao ritmo actual, o mês pode fechar ${formatarKz(previsaoMensal - plafond)} acima do plafond.`,
    });
  }

  return alertas;
}

/**
 * Um valor mais de 5 vezes acima ou abaixo da referência parece engano de digitação
 * (um "000" a mais, uma vírgula esquecida). A aplicação pede confirmação antes de gravar (SEC-007).
 */
export const FACTOR_ESTRANHO = 5;

export function pareceEngano(valor, referencia, factor = FACTOR_ESTRANHO) {
  const valido = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!valido(valor) || !valido(referencia)) return false;
  return valor > referencia * factor || valor < referencia / factor;
}

/**
 * Motivo para confirmar um preço pago antes de o gravar, ou null se parecer normal.
 * Compara com o plafond do mês, com a última compra (por unidade) e com o previsto.
 */
export function motivoPrecoEstranho({ precoReal, plafond = null, precoUnitarioBase = null, anteriorUnitarioBase = null, previsto = null }) {
  if (!precoReal) return null;
  if (plafond && precoReal > plafond) return 'é maior do que o plafond do mês inteiro';
  if (pareceEngano(precoUnitarioBase, anteriorUnitarioBase)) return 'está muito longe do preço da última compra';
  if (pareceEngano(precoReal, previsto)) return 'está muito longe do previsto';
  return null;
}

/** Lista por comprar comparada com o saldo. Devolve null quando não há nada a dizer. */
export function alertaLista({ pendente, saldo, artigosPendentes }) {
  if (!artigosPendentes || pendente <= 0) return null;
  if (pendente > saldo) {
    return {
      tipo: 'lista_acima_saldo',
      nivel: 'aviso',
      texto: 'Ei, comadre! A tua lista está acima do saldo disponível.',
    };
  }
  return null;
}

/** Variação do preço face à última compra do mesmo produto. */
export function alertaPreco({ nomeProduto, genero = null, variacao }) {
  if (variacao === null || variacao === undefined) return null;
  if (variacao >= LIMIAR_SUBIDA_SIGNIFICATIVA) {
    return {
      tipo: 'preco_subiu',
      nivel: 'aviso',
      texto: `Atenção, comadre: o preço ${artigoDe(nomeProduto, genero)} subiu ${formatarPercentagem(variacao)} desde a última compra.`,
    };
  }
  if (variacao < 0) {
    return {
      tipo: 'preco_desceu',
      nivel: 'positivo',
      texto: `O preço ${artigoDe(nomeProduto, genero)} está ${formatarPercentagem(Math.abs(variacao))} mais baixo do que na última compra.`,
    };
  }
  return null;
}

/** Mensagem no fim de uma compra, só quando há comparação possível com o previsto. */
export function alertaFimCompra({ diferenca }) {
  if (diferenca === null || diferenca === undefined) return null;
  if (diferenca < 0) {
    return { tipo: 'compra_abaixo', nivel: 'positivo', texto: 'Boa, comadre! Gastaste menos do que o previsto nesta compra.' };
  }
  if (diferenca > 0) {
    return { tipo: 'compra_acima', nivel: 'aviso', texto: `Esta compra ficou ${formatarKz(diferenca)} acima do previsto.` };
  }
  return { tipo: 'compra_igual', nivel: 'info', texto: 'Esta compra ficou exactamente no previsto.' };
}

const CONTRACCOES = { o: 'do', a: 'da', os: 'dos', as: 'das' };

// Produtos do catálogo têm género: "do óleo alimentar", "da fuba de milho", "dos ovos".
// Produtos criados pelo utilizador ficam como foram escritos: "de Coca-Cola".
function artigoDe(nome, genero) {
  const n = String(nome ?? '').trim();
  if (!n) return 'deste produto';
  const contraccao = CONTRACCOES[genero];
  return contraccao ? `${contraccao} ${n.toLowerCase()}` : `de ${n}`;
}
