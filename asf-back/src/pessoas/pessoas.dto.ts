import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ESPECIES, type Especie } from '../animais/animais.dto.js';

// Espelham a migração 010 (ADR 0010: bases legais da seção 04 do plano).
export const BASES_LEGAIS = [
  'execucao_contrato',
  'acordo_voluntariado',
  'consentimento',
  'legitimo_interesse',
] as const;
export type BaseLegal = (typeof BASES_LEGAIS)[number];
export const VINCULOS = ['adotante', 'lar_temporario'] as const;
export type Vinculo = (typeof VINCULOS)[number];

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Texto opcional: espaços nas pontas saem; vazio vira ausente.
const limpo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};
const simNao = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

// Respostas -------------------------------------------------------------------

export class AnimalLigadoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() numero: string;
  @ApiProperty({ type: String, nullable: true }) nome: string | null;
  @ApiProperty({ enum: ESPECIES }) especie: Especie;
}

export class PessoaResumoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
  @ApiProperty({ enum: VINCULOS, isArray: true }) vinculos: Vinculo[];
  @ApiProperty({ enum: BASES_LEGAIS }) base_legal: BaseLegal;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  anonimizado_em: string | null;
  @ApiProperty({ format: 'date-time' }) criado_em: string;
}

export class ListaPessoasDto {
  @ApiProperty({ type: [PessoaResumoDto] }) itens: PessoaResumoDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() por_pagina: number;
}

export class AdocaoDaPessoaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: AnimalLigadoDto }) animal: AnimalLigadoDto;
  @ApiProperty({ type: String, format: 'date' }) data_adocao: string;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  data_devolucao: string | null;
  @ApiProperty({ type: String, nullable: true }) motivo_devolucao:
    string | null;
}

export class PassagemLarDto {
  @ApiProperty({ type: AnimalLigadoDto }) animal: AnimalLigadoDto;
  @ApiProperty({ type: String, format: 'date', description: 'Entrada no lar' })
  data: string;
}

export class PessoaDto extends PessoaResumoDto {
  @ApiProperty({ type: [AdocaoDaPessoaDto] }) adocoes: AdocaoDaPessoaDto[];
  @ApiProperty({
    type: [AnimalLigadoDto],
    description: 'Animais no lar desta pessoa agora',
  })
  lar_atual: AnimalLigadoDto[];
  @ApiProperty({ type: [PassagemLarDto] }) lar_historico: PassagemLarDto[];
}

export class ContatoDto {
  @ApiProperty({ type: String, nullable: true }) telefone: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) endereco: string | null;
}

export class LarTemporarioDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
  @ApiProperty({ type: [AnimalLigadoDto] }) animais: AnimalLigadoDto[];
}

// Prazo de guarda (Fase 6): quem passou do prazo, para a coordenação aprovar.
export class PessoaAlemDoPrazoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
  @ApiProperty({ enum: VINCULOS, isArray: true }) vinculos: Vinculo[];
  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Último evento com a pessoa',
  })
  ultimo_evento: string;
  @ApiProperty({ type: String, format: 'date' }) venceu_em: string;
}

export class AnonimizacaoDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Preenchido quando algum termo não saiu do Storage',
  })
  aviso: string | null;
}

// Entradas ---------------------------------------------------------------------

export class FiltroPessoasDto {
  @ApiPropertyOptional({ description: 'Parte do nome', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  busca?: string;

  @ApiPropertyOptional({ enum: VINCULOS })
  @IsOptional()
  @IsIn(VINCULOS)
  vinculo?: Vinculo;

  @ApiPropertyOptional({ description: 'Inclui as anonimizadas' })
  @IsOptional()
  @Transform(simNao)
  @IsBoolean()
  anonimizadas?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  por_pagina?: number;
}

export class ContatoEntradaDto {
  @ApiPropertyOptional({ maxLength: 30, example: '(88) 90000-0000' })
  @IsOptional()
  @Transform(limpo)
  @IsString()
  @Matches(/^[0-9()+\-.\s]{8,30}$/, { message: 'Telefone inválido.' })
  telefone?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(limpo)
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({
    maxLength: 300,
    description: 'Só para adotante e lar temporário',
  })
  @IsOptional()
  @Transform(limpo)
  @IsString()
  @MaxLength(300)
  endereco?: string;
}

export class AlterarPessoaDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Informe o nome.' })
  nome: string;

  @ApiProperty({ enum: BASES_LEGAIS })
  @IsIn(BASES_LEGAIS, { message: 'Escolha a base legal.' })
  base_legal: BaseLegal;

  @ApiProperty({ enum: VINCULOS, isArray: true })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Escolha o vínculo: adotante ou lar temporário.',
  })
  @ArrayUnique()
  @IsIn(VINCULOS, { each: true })
  vinculos: Vinculo[];
}

export class NovaPessoaDto extends AlterarPessoaDto {
  @ApiPropertyOptional({ maxLength: 30, example: '(88) 90000-0000' })
  @IsOptional()
  @Transform(limpo)
  @IsString()
  @Matches(/^[0-9()+\-.\s]{8,30}$/, { message: 'Telefone inválido.' })
  telefone?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(limpo)
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(limpo)
  @IsString()
  @MaxLength(300)
  endereco?: string;
}
