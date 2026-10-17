// Nomes das listas fechadas como aparecem na tela, e a cor de cada selo
// (brandbook, seção 03). A cor nunca aparece sem o nome.
import type { Esquemas } from './tipos';

type Animal = Esquemas['AnimalDto'];
export type Especie = Animal['especie'];
export type Sexo = Animal['sexo'];
export type Porte = NonNullable<Animal['porte']>;
export type Origem = Animal['origem'];
export type Situacao = Animal['situacao'];
export type Local = NonNullable<Animal['local']>;

export const ESPECIE: Record<Especie, string> = { cao: 'cão', gato: 'gato' };

export const SEXO: Record<Sexo, string> = {
  macho: 'macho',
  femea: 'fêmea',
  nao_identificado: 'sexo não identificado',
};

export const PORTE: Record<Porte, string> = { pequeno: 'pequeno', medio: 'médio', grande: 'grande' };

export const ORIGEM: Record<Origem, string> = {
  resgate: 'Resgate',
  castracao: 'Castração',
  comunitario: 'Comunitário',
  outra: 'Outra',
};

export const SITUACAO: Record<Situacao, { rotulo: string; cor: string; descricao: string }> = {
  em_acolhimento: { rotulo: 'Em acolhimento', cor: 'neutro', descricao: 'sob cuidado da associação' },
  adotado: { rotulo: 'Adotado', cor: 'verde', descricao: 'foi para uma família' },
  devolvido_comunidade: { rotulo: 'Devolvido à comunidade', cor: 'azul', descricao: 'castrado e devolvido' },
  transferido: { rotulo: 'Transferido', cor: 'laranja', descricao: 'foi para outra entidade' },
  obito: { rotulo: 'Óbito', cor: 'cinza', descricao: 'sempre com data registrada' },
};

export const LOCAL: Record<Local, string> = {
  sede: 'Sede',
  lar_temporario: 'Lar temporário',
  clinica: 'Clínica',
};

/** Animal sem nome é chamado pelo número (brandbook, seção 05). */
export function nomeDoAnimal(a: { nome: string | null; numero: string }): string {
  return a.nome?.trim() ? a.nome : a.numero;
}
