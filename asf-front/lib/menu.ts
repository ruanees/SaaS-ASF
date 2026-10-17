// O menu é dado (regra 13). Barra do computador, barra do celular e folha do
// celular saem desta lista. Item sem tela pronta fica com `emBreve` e aparece
// apagado, nunca como link para uma rota que não existe (regra 12).

import type { Papel } from './tipos';

export interface ItemMenu {
  rotulo: string;
  rota: string;
  fase: number;
  emBreve?: boolean;
  /** Só aparece para estes papéis. Conveniência: quem corta o dado é a RLS. */
  papeis?: Papel[];
  /** Fica na barra do celular (até 3; o 4º espaço é "Mais"). */
  celular?: boolean;
}

export const MENU: ItemMenu[] = [
  { rotulo: 'Início', rota: '/', fase: 0, celular: true },
  { rotulo: 'Animais', rota: '/animais', fase: 1, celular: true },
  { rotulo: 'Pendências', rota: '/pendencias', fase: 2, celular: true },
  { rotulo: 'Pessoas', rota: '/pessoas', fase: 4 },
  { rotulo: 'Adoções', rota: '/adocoes', fase: 4 },
  { rotulo: 'Relatórios', rota: '/relatorios', fase: 5, emBreve: true },
  { rotulo: 'Configurações', rota: '/configuracoes', fase: 0, papeis: ['admin', 'coordenacao'] },
  { rotulo: 'Auditoria', rota: '/auditoria', fase: 6, emBreve: true, papeis: ['admin'] },
];

export function menuPara(papel: Papel): ItemMenu[] {
  return MENU.filter((item) => !item.papeis || item.papeis.includes(papel));
}

export function itemAtivo(rota: string, caminho: string): boolean {
  return rota === '/' ? caminho === '/' : caminho === rota || caminho.startsWith(`${rota}/`);
}
