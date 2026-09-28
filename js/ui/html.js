// Construção de HTML com escape automático. Tudo o que é interpolado com html`...`
// é escapado, excepto o que já vier de html`...` ou de seguro(). Assim, um nome de produto
// ou de loja escrito pelo utilizador nunca é interpretado como código.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

class HtmlSeguro {
  constructor(texto) {
    this.texto = texto;
  }

  toString() {
    return this.texto;
  }
}

export function escapar(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/** Marca um texto como HTML de confiança. Usar só com texto escrito no código, nunca com dados. */
export function seguro(texto) {
  return new HtmlSeguro(texto);
}

function converter(valor) {
  if (valor === null || valor === undefined || valor === false) return '';
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(converter).join('');
  return escapar(valor);
}

export function html(partes, ...valores) {
  let resultado = partes[0];
  valores.forEach((valor, i) => {
    resultado += converter(valor) + partes[i + 1];
  });
  return new HtmlSeguro(resultado);
}

/** Substitui o conteúdo de um elemento. */
export function montar(elemento, conteudo) {
  elemento.innerHTML = converter(conteudo);
}
