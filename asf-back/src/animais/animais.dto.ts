import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Listas fechadas: espelham os enums do banco (migração 005).
export const ESPECIES = ['cao', 'gato'] as const;
export const SEXOS = ['macho', 'femea', 'nao_identificado'] as const;
export const PORTES = ['pequeno', 'medio', 'grande'] as const;
export const ORIGENS = [
  'resgate',
  'castracao',
  'comunitario',
  'outra',
] as const;
export const SITUACOES = [
  'em_acolhimento',
  'adotado',
  'devolvido_comunidade',
  'transferido',
  'obito',
] as const;
export const LOCAIS = ['sede', 'lar_temporario', 'clinica'] as const;
export const PRECISOES = ['exata', 'aproximada'] as const;

export type Especie = (typeof ESPECIES)[number];
export type Sexo = (typeof SEXOS)[number];
export type Porte = (typeof PORTES)[number];
export type Origem = (typeof ORIGENS)[number];
export type Situacao = (typeof SITUACOES)[number];
export type Local = (typeof LOCAIS)[number];

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATA = { strict: true } as const;
const MSG_DATA = { message: 'Data inválida (use AAAA-MM-DD).' };

// Respostas -------------------------------------------------------------------

export class ClinicaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
  @ApiProperty() ativo: boolean;
}

export class PessoaDaMovimentacaoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
}

export class AnimalResumoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2026-0042' }) numero: string;
  @ApiProperty({ type: String, nullable: true }) nome: string | null;
  @ApiProperty({ enum: ESPECIES }) especie: Especie;
  @ApiProperty({ enum: SEXOS }) sexo: Sexo;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  nascimento_estimado: string | null;
  @ApiProperty({ enum: PRECISOES, nullable: true })
  idade_precisao: (typeof PRECISOES)[number] | null;
  @ApiProperty({ enum: PORTES, nullable: true }) porte: Porte | null;
  @ApiProperty({ enum: SITUACOES }) situacao: Situacao;
  @ApiProperty({ enum: LOCAIS, nullable: true }) local: Local | null;
  @ApiProperty() disponivel_adocao: boolean;
  @ApiProperty({ type: String, format: 'date' }) data_entrada: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL assinada da foto principal (vale 5 min)',
  })
  foto_url: string | null;

  // Estado de saúde calculado no banco (view animal_saude), para os selos.
  @ApiProperty({
    enum: ['nao_vacinado', 'vencida', 'vence_em_breve', 'vacinado'],
    nullable: true,
  })
  vacinacao_status:
    'nao_vacinado' | 'vencida' | 'vence_em_breve' | 'vacinado' | null;
  @ApiProperty({
    enum: ['castrado', 'agendada', 'nao_castrado'],
    nullable: true,
  })
  castracao_status: 'castrado' | 'agendada' | 'nao_castrado' | null;
  @ApiProperty({ type: Boolean, nullable: true }) em_tratamento: boolean | null;
  @ApiProperty({
    type: Boolean,
    nullable: true,
    description: 'Selo de alerta (brandbook, seção 03)',
  })
  leishmaniose_reagente: boolean | null;
}

export class ListaAnimaisDto {
  @ApiProperty({ type: [AnimalResumoDto] }) itens: AnimalResumoDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() por_pagina: number;
}

export class AnimalDto extends AnimalResumoDto {
  @ApiProperty({ enum: ORIGENS }) origem: Origem;
  @ApiProperty({ type: String, nullable: true }) origem_detalhe: string | null;
  @ApiProperty({ type: String, nullable: true }) observacoes: string | null;
  @ApiProperty({ type: ClinicaDto, nullable: true }) clinica: ClinicaDto | null;
  @ApiProperty({
    type: PessoaDaMovimentacaoDto,
    nullable: true,
    description: 'Lar temporário onde o animal está agora',
  })
  responsavel: PessoaDaMovimentacaoDto | null;
  @ApiProperty({ type: String, nullable: true }) microchip: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Condição de saúde na entrada',
  })
  condicao_entrada: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  microchip_data: string | null;
  @ApiProperty({ format: 'date-time' }) criado_em: string;
  @ApiProperty({ format: 'date-time' }) atualizado_em: string;
}

export class MovimentacaoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['entrada', 'mudanca', 'reentrada', 'devolucao'] })
  tipo: 'entrada' | 'mudanca' | 'reentrada' | 'devolucao';
  @ApiProperty({ enum: ORIGENS, nullable: true }) origem: Origem | null;
  @ApiProperty({ enum: SITUACOES }) situacao: Situacao;
  @ApiProperty({ enum: LOCAIS, nullable: true }) local: Local | null;
  @ApiProperty() disponivel_adocao: boolean;
  @ApiProperty({ type: String, nullable: true }) clinica: string | null;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ type: String, nullable: true }) motivo: string | null;
  @ApiProperty({
    type: PessoaDaMovimentacaoDto,
    nullable: true,
    description: 'Lar temporário ou adotante',
  })
  pessoa: PessoaDaMovimentacaoDto | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Entidade da transferência ou bairro da devolução à comunidade',
  })
  destino: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Nome de quem registrou',
  })
  autor: string | null;
  @ApiProperty({ format: 'date-time' }) criado_em: string;
}

export class DuplicadoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() numero: string;
  @ApiProperty({ type: String, nullable: true }) nome: string | null;
  @ApiProperty({ enum: SEXOS }) sexo: Sexo;
  @ApiProperty({ enum: SITUACOES }) situacao: Situacao;
  @ApiProperty({ type: String, format: 'date' }) data_entrada: string;
}

export class FotoAssinadaDto {
  @ApiProperty({ description: 'Caminho decidido pelo servidor' })
  caminho: string;
  @ApiProperty({ description: 'URL assinada para o envio (PUT com o arquivo)' })
  url: string;
}

export class FotoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() caminho: string;
  @ApiProperty({ type: String, nullable: true }) url: string | null;
}

// Entradas ---------------------------------------------------------------------

export class FiltroAnimaisDto {
  @ApiPropertyOptional({ enum: ESPECIES })
  @IsOptional()
  @IsIn(ESPECIES)
  especie?: Especie;

  @ApiPropertyOptional({ enum: SEXOS })
  @IsOptional()
  @IsIn(SEXOS)
  sexo?: Sexo;

  @ApiPropertyOptional({ enum: PORTES })
  @IsOptional()
  @IsIn(PORTES)
  porte?: Porte;

  @ApiPropertyOptional({ enum: SITUACOES })
  @IsOptional()
  @IsIn(SITUACOES)
  situacao?: Situacao;

  @ApiPropertyOptional({ enum: LOCAIS })
  @IsOptional()
  @IsIn(LOCAIS)
  local?: Local;

  @ApiPropertyOptional({ enum: ['sim', 'nao'] })
  @IsOptional()
  @IsIn(['sim', 'nao'])
  disponivel?: 'sim' | 'nao';

  @ApiPropertyOptional({ description: 'Número ou nome' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  // Filtros de saúde: os mesmos recortes dos indicadores (Fase 5).
  @ApiPropertyOptional({
    enum: ['em_dia', 'pendente'],
    description: 'Pendente = nunca vacinado ou com vacina vencida',
  })
  @IsOptional()
  @IsIn(['em_dia', 'pendente'])
  vacinacao?: 'em_dia' | 'pendente';

  @ApiPropertyOptional({ enum: ['castrado', 'nao_castrado', 'agendada'] })
  @IsOptional()
  @IsIn(['castrado', 'nao_castrado', 'agendada'])
  castracao?: 'castrado' | 'nao_castrado' | 'agendada';

  @ApiPropertyOptional({ enum: ['sim'], description: 'Só em tratamento' })
  @IsOptional()
  @IsIn(['sim'])
  tratamento?: 'sim';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  por_pagina?: number;
}

export class DuplicadosQueryDto {
  @ApiProperty()
  @Transform(aparar)
  @IsString()
  @Length(1, 80)
  nome: string;

  @ApiProperty({ enum: ESPECIES })
  @IsIn(ESPECIES)
  especie: Especie;

  @ApiProperty({ enum: SEXOS })
  @IsIn(SEXOS)
  sexo: Sexo;
}

export class CriarAnimalDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(80, { message: 'Nome com no máximo 80 caracteres.' })
  nome?: string;

  @ApiProperty({ enum: ESPECIES })
  @IsIn(ESPECIES, { message: 'Escolha a espécie.' })
  especie: Especie;

  @ApiProperty({ enum: SEXOS })
  @IsIn(SEXOS, { message: 'Escolha o sexo.' })
  sexo: Sexo;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  nascimento_estimado?: string;

  @ApiPropertyOptional({ enum: PRECISOES })
  @IsOptional()
  @IsIn(PRECISOES)
  idade_precisao?: (typeof PRECISOES)[number];

  @ApiPropertyOptional({ enum: PORTES })
  @IsOptional()
  @IsIn(PORTES)
  porte?: Porte;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data de entrada do animal.' })
  data_entrada: string;

  @ApiProperty({ enum: ORIGENS })
  @IsIn(ORIGENS, { message: 'Escolha a origem.' })
  origem: Origem;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(200)
  origem_detalhe?: string;

  @ApiProperty({ enum: LOCAIS })
  @IsIn(LOCAIS, { message: 'Informe onde o animal está.' })
  local: Local;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disponivel_adocao?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Clínica inválida.' })
  clinica_id?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

// Campo a campo: só os dados cadastrais. Situação e local mudam por movimentação.
// null limpa o campo (quando o banco permite).
export class AlterarAnimalDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(80, { message: 'Nome com no máximo 80 caracteres.' })
  nome?: string | null;

  @ApiPropertyOptional({ enum: ESPECIES })
  @IsOptional()
  @IsIn(ESPECIES)
  especie?: Especie;

  @ApiPropertyOptional({ enum: SEXOS })
  @IsOptional()
  @IsIn(SEXOS)
  sexo?: Sexo;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  nascimento_estimado?: string | null;

  @ApiPropertyOptional({ enum: PRECISOES, nullable: true })
  @IsOptional()
  @IsIn(PRECISOES)
  idade_precisao?: (typeof PRECISOES)[number] | null;

  @ApiPropertyOptional({ enum: PORTES, nullable: true })
  @IsOptional()
  @IsIn(PORTES)
  porte?: Porte | null;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  data_entrada?: string;

  @ApiPropertyOptional({ enum: ORIGENS })
  @IsOptional()
  @IsIn(ORIGENS)
  origem?: Origem;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(200)
  origem_detalhe?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '9 a 20 letras ou números',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/s/g, '').toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[0-9A-Z]{9,20}$/, {
    message: 'Microchip com 9 a 20 letras ou números.',
  })
  microchip?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  microchip_data?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  condicao_entrada?: string | null;
}

export class NovaMovimentacaoDto {
  @ApiProperty({ enum: SITUACOES })
  @IsIn(SITUACOES, { message: 'Situação inválida.' })
  situacao: Situacao;

  @ApiPropertyOptional({ enum: LOCAIS })
  @IsOptional()
  @IsIn(LOCAIS)
  local?: Local;

  @ApiProperty()
  @IsBoolean()
  disponivel_adocao: boolean;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @ApiPropertyOptional({ enum: ['mudanca', 'reentrada'], default: 'mudanca' })
  @IsOptional()
  @IsIn(['mudanca', 'reentrada'])
  tipo?: 'mudanca' | 'reentrada';

  @ApiPropertyOptional({
    enum: ORIGENS,
    description: 'Obrigatória na reentrada',
  })
  @IsOptional()
  @IsIn(ORIGENS)
  origem?: Origem;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Clínica inválida.' })
  clinica_id?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Pessoa do lar temporário (obrigatória no lar temporário)',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Escolha a pessoa do lar temporário.' })
  pessoa_id?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Entidade (transferência, obrigatória) ou bairro (devolução à comunidade)',
  })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(200)
  destino?: string;
}

export const FOTO_TAMANHO_MAXIMO = 5 * 1024 * 1024;

// A foto é refeita no aparelho (canvas) antes do envio, o que remove o EXIF
// com o GPS. WebP quando o navegador gera; JPEG no Safari, que não gera WebP.
export const TIPOS_FOTO = ['image/webp', 'image/jpeg'] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

export class AssinarFotoDto {
  @ApiProperty({ enum: TIPOS_FOTO })
  @IsIn(TIPOS_FOTO, {
    message: 'A foto precisa ser preparada no aparelho antes do envio.',
  })
  tipo: TipoFoto;

  @ApiProperty({ description: 'Tamanho em bytes (até 5 MB)' })
  @IsInt()
  @Min(1)
  @Max(FOTO_TAMANHO_MAXIMO, { message: 'A foto pode ter no máximo 5 MB.' })
  tamanho: number;
}

export class RegistrarFotoDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  caminho: string;
}

export class CriarClinicaDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Nome da clínica com 1 a 120 caracteres.' })
  nome: string;
}
