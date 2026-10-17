// Nomes das listas fechadas como aparecem na tela, e a cor de cada selo
// (brandbook, seção 03). A cor nunca aparece sem o nome.
import type { BaseLegal, Esquemas, Vinculo } from './tipos';

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

// Saúde (brandbook, seção 03 · Status de saúde) ------------------------------
export type StatusVacinacao = Esquemas['EstadoSaudeDto']['vacinacao_status'];
export type StatusCastracao = Esquemas['EstadoSaudeDto']['castracao_status'];

export const VACINACAO: Record<StatusVacinacao, { rotulo: string; cor?: string }> = {
  vacinado: { rotulo: 'Vacinado', cor: 'verde' },
  vence_em_breve: { rotulo: 'Vacina vence em breve', cor: 'amarelo' },
  vencida: { rotulo: 'Vacina vencida', cor: 'vermelho' },
  nao_vacinado: { rotulo: 'Não vacinado' },
};

export const CASTRACAO: Record<StatusCastracao, { rotulo: string; cor?: string }> = {
  castrado: { rotulo: 'Castrado', cor: 'verde' },
  agendada: { rotulo: 'Castração agendada', cor: 'azul' },
  nao_castrado: { rotulo: 'Não castrado' },
};

// Prontuário -----------------------------------------------------------------
export type TipoAtendimento = Esquemas['AtendimentoDto']['tipo'];
export type ResultadoExame = NonNullable<Esquemas['AtendimentoDto']['exame']>['resultado'];

export const TIPO_ATENDIMENTO: Record<TipoAtendimento, string> = {
  consulta: 'Consulta',
  retorno: 'Retorno',
  exame: 'Exame',
  teste: 'Teste',
  tratamento: 'Tratamento',
  internacao: 'Internação',
  vacina: 'Vacina',
  vermifugacao: 'Vermifugação',
  antiparasitario: 'Antipulgas e carrapatos',
  castracao: 'Castração',
  obito: 'Óbito',
};

// Brandbook, seção 03 · Exames e testes.
export const RESULTADO: Record<ResultadoExame, { rotulo: string; cor?: string }> = {
  aguardando: { rotulo: 'Aguardando resultado', cor: 'amarelo' },
  nao_reagente: { rotulo: 'Não reagente', cor: 'verde' },
  normal: { rotulo: 'Normal', cor: 'verde' },
  reagente: { rotulo: 'Reagente', cor: 'vermelho' },
  alterado: { rotulo: 'Alterado', cor: 'laranja' },
  inconclusivo: { rotulo: 'Inconclusivo' },
  ver_laudo: { rotulo: 'Ver laudo' },
};

// Atalhos de exames e testes (plano, Fase 3; 4DX pedido pela associação).
export const EXAMES_COMUNS = [
  'Hemograma',
  'Bioquímico (fígado e rins)',
  'Leishmaniose (calazar)',
  '4DX',
  'FIV/FeLV',
  'Cinomose',
  'Parvovirose',
] as const;

// Pessoas (Fase 4; ADR 0006, 0007 e 0010) -------------------------------------
export const VINCULO: Record<Vinculo, string> = {
  adotante: 'Adotante',
  lar_temporario: 'Lar temporário',
};

// Bases legais da seção 04 do plano. Texto provisório até a revisão jurídica.
export const BASE_LEGAL: Record<BaseLegal, { rotulo: string; ajuda: string }> = {
  execucao_contrato: { rotulo: 'Execução de contrato', ajuda: 'O termo de adoção.' },
  acordo_voluntariado: { rotulo: 'Acordo de voluntariado', ajuda: 'O acordo com quem é lar temporário.' },
  consentimento: { rotulo: 'Consentimento', ajuda: 'A pessoa autorizou por escrito.' },
  legitimo_interesse: { rotulo: 'Legítimo interesse', ajuda: 'Só com orientação da assessoria jurídica.' },
};

/** Base legal sugerida para cada vínculo (a pessoa pode trocar). */
export const BASE_SUGERIDA: Record<Vinculo, BaseLegal> = {
  adotante: 'execucao_contrato',
  lar_temporario: 'acordo_voluntariado',
};

// Aviso curto de privacidade (docs/lgpd/politica-de-privacidade.md). Provisório
// até a associação indicar o encarregado e revisar o texto (ADR 0010).
export const AVISO_PRIVACIDADE =
  'Os dados servem só para acompanhar a adoção ou o lar temporário e falar com a pessoa sobre o animal. ' +
  'Só a coordenação da associação vê telefone, e-mail e endereço. Guardamos por 60 meses depois do fim do ' +
  'vínculo e depois anonimizamos. Para ver, corrigir ou pedir a anonimização dos dados, a pessoa fala com a ' +
  'coordenação da associação.';
