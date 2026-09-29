// Arranque da KUSSUMBA.

import { iniciarNavegacao } from './ui/router.js';
import { tratarErro } from './ui/componentes.js';
import { enderecoDoServiceWorker } from './ui/html.js';
import * as boasVindas from './ui/ecras/boas-vindas.js';
import * as primeiraLista from './ui/ecras/primeira-lista.js';
import * as mes from './ui/ecras/mes.js';
import * as lista from './ui/ecras/lista.js';
import * as catalogo from './ui/ecras/catalogo.js';
import * as comprar from './ui/ecras/comprar.js';
import * as compra from './ui/ecras/compra.js';
import * as relatorio from './ui/ecras/relatorio.js';
import * as novoMes from './ui/ecras/novo-mes.js';
import * as dados from './ui/ecras/dados.js';

const telas = {
  'boas-vindas': boasVindas,
  'primeira-lista': primeiraLista,
  mes,
  lista,
  catalogo,
  comprar,
  compra,
  relatorio,
  'novo-mes': novoMes,
  dados,
};

window.addEventListener('unhandledrejection', (evento) => tratarErro(evento.reason));

iniciarNavegacao(telas, {
  elementoRaiz: document.getElementById('app'),
  elementoNavegacao: document.getElementById('navegacao'),
});

// Guarda a aplicação no telefone para abrir sem internet (§32).
// Só funciona em https ou em localhost; noutros endereços a aplicação abre na mesma, mas precisa de rede.
if ('serviceWorker' in navigator) {
  // Quando uma versão nova toma conta da página, recarrega uma vez para usar os ficheiros novos.
  // Os dados não se perdem: cada acção fica gravada no momento em que é feita.
  const jaHaviaVersao = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (jaHaviaVersao) location.reload();
  });
  navigator.serviceWorker.register(enderecoDoServiceWorker()).catch((erro) => console.warn('Sem funcionamento offline:', erro));
}
