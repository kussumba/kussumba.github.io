// Guardar e repor a cópia de segurança a partir da interface (auditoria SEC-003).

import { confirmar } from './componentes.js';
import { formatarNumero } from '../nucleo/formatos.js';
import { dataISO, formatarDataLonga } from '../nucleo/datas.js';
import { exportarCopia, registarCopiaFeita, lerCopia, reporCopia, TAMANHO_MAXIMO } from '../servicos/copia.js';
import { ErroKussumba } from '../servicos/comum.js';

/** Descarrega a cópia para a pasta de transferências do telefone. */
export async function guardarCopia() {
  const texto = await exportarCopia();
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const ligacao = document.createElement('a');
  ligacao.href = url;
  ligacao.download = `kussumba-copia-${dataISO()}.json`;
  document.body.append(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  await registarCopiaFeita();
}

function quantos(n, singular, plural) {
  return `${formatarNumero(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Lê o ficheiro escolhido, mostra o que contém e, se o utilizador confirmar, repõe-no.
 * Com substituir=true, avisa que os dados actuais deste telefone vão ser substituídos.
 * Devolve true se a cópia foi reposta.
 */
export async function reporDeFicheiro(ficheiro, { substituir }) {
  if (!ficheiro) return false;
  if (ficheiro.size > TAMANHO_MAXIMO) throw new ErroKussumba('O ficheiro é demasiado grande para ser uma cópia da KUSSUMBA.');
  const copia = lerCopia(await ficheiro.text());
  const { resumo } = copia;
  const quando = resumo.criadaEm && /^\d{4}-\d{2}-\d{2}/.test(resumo.criadaEm)
    ? ` de ${formatarDataLonga(resumo.criadaEm.slice(0, 10))}`
    : '';
  const conteudo = `Tem ${quantos(resumo.meses, 'mês', 'meses')}, ${quantos(resumo.compras, 'compra', 'compras')} e ${quantos(resumo.artigosComprados, 'artigo comprado', 'artigos comprados')}.`;
  const ok = await confirmar({
    titulo: `Repor a cópia${quando}?`,
    texto: substituir ? `${conteudo} Todos os dados que estão agora neste telefone são substituídos pelos da cópia.` : conteudo,
    confirmar: 'Repor cópia',
    cancelar: 'Cancelar',
    perigo: substituir,
  });
  if (!ok) return false;
  await reporCopia(copia);
  return true;
}
