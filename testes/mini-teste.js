// Executor de testes mínimo, sem dependências. Corre no navegador.

const registados = [];

export function teste(nome, funcao) {
  registados.push({ nome, funcao });
}

function mostrar(valor) {
  return typeof valor === 'string' ? JSON.stringify(valor) : JSON.stringify(valor) ?? String(valor);
}

export function igual(obtido, esperado, mensagem = '') {
  if (!Object.is(obtido, esperado)) {
    throw new Error(`${mensagem ? mensagem + ': ' : ''}esperado ${mostrar(esperado)}, obtido ${mostrar(obtido)}`);
  }
}

export function igualProfundo(obtido, esperado, mensagem = '') {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${mensagem ? mensagem + ': ' : ''}esperado ${b}, obtido ${a}`);
}

export function aproximado(obtido, esperado, tolerancia = 1e-9, mensagem = '') {
  if (typeof obtido !== 'number' || Math.abs(obtido - esperado) > tolerancia) {
    throw new Error(`${mensagem ? mensagem + ': ' : ''}esperado ≈${esperado}, obtido ${mostrar(obtido)}`);
  }
}

export function verdade(condicao, mensagem = 'condição falsa') {
  if (!condicao) throw new Error(mensagem);
}

/** Espera que a função falhe e, opcionalmente, que a mensagem contenha um texto. */
export async function falha(funcao, textoContido = '') {
  try {
    await funcao();
  } catch (erro) {
    if (textoContido && !String(erro.message).includes(textoContido)) {
      throw new Error(`falhou com "${erro.message}", esperava conter "${textoContido}"`);
    }
    return erro;
  }
  throw new Error('esperava uma falha, mas a operação foi aceite');
}

/**
 * Escreve o texto como a interface o mostra: o espaço a seguir a um algarismo
 * ("250 000 Kz", "25 kg") passa a inseparável e o "-" antes de um número passa a sinal de menos.
 */
export function ui(texto) {
  return texto.replace(/(\d) /g, '$1 ').replace(/(^|[^\w])-(?=\d)/g, '$1−');
}

export async function correr(lista) {
  const resultados = [];
  for (const { nome, funcao } of registados) {
    try {
      await funcao();
      resultados.push({ nome, passou: true });
    } catch (erro) {
      resultados.push({ nome, passou: false, erro: String(erro?.stack || erro) });
    }
  }
  const falhados = resultados.filter((r) => !r.passou);
  if (lista) {
    for (const r of resultados) {
      const li = document.createElement('li');
      li.textContent = (r.passou ? 'OK   ' : 'FALHA ') + r.nome + (r.erro ? '\n      ' + r.erro.split('\n')[0] : '');
      li.style.color = r.passou ? '#1E6B52' : '#8A3B12';
      li.style.whiteSpace = 'pre-wrap';
      lista.append(li);
    }
  }
  const resumo = { total: resultados.length, passou: resultados.length - falhados.length, falhou: falhados.length, resultados };
  window.__resultados = resumo;
  return resumo;
}
