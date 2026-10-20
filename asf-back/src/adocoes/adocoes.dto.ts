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
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AnimalLigadoDto } from '../pessoas/pessoas.dto.js';

const DATA = { strict: true } as const;
const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const simNao = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

// Respostas -------------------------------------------------------------------

export class PessoaLigadaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
}

export class AdocaoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: AnimalLigadoDto }) animal: AnimalLigadoDto;
  @ApiProperty({ type: PessoaLigadaDto }) pessoa: PessoaLigadaDto;
  @ApiProperty({ type: String, format: 'date' }) data_adocao: string;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  data_devolucao: string | null;
  @ApiProperty({ type: String, nullable: true }) motivo_devolucao:
    string | null;
  @ApiProperty({ description: 'Termo assinado anexado' }) tem_termo: boolean;
}

export class ListaAdocoesDto {
  @ApiProperty({ type: [AdocaoDto] }) itens: AdocaoDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() por_pagina: number;
}

export const FORMAS_ACOMPANHAMENTO = [
  'visita',
  'whatsapp',
  'ligacao',
  'outro',
] as const;
export type FormaAcompanhamento = (typeof FORMAS_ACOMPANHAMENTO)[number];

export class AcompanhamentoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ enum: FORMAS_ACOMPANHAMENTO }) forma: FormaAcompanhamento;
  @ApiProperty({ type: String, nullable: true }) observacoes: string | null;
}

export class TermoAssinadoDto {
  @ApiProperty() caminho: string;
  @ApiProperty({ description: 'URL assinada para o envio (PUT com o arquivo)' })
  url: string;
}

export class TermoUrlDto {
  @ApiProperty({ description: 'URL assinada de leitura (5 min)' }) url: string;
}

// Entradas ---------------------------------------------------------------------

export class FiltroAdocoesDto {
  @ApiPropertyOptional({ description: 'Só as adoções sem devolução' })
  @IsOptional()
  @Transform(simNao)
  @IsBoolean()
  ativas?: boolean;

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

export class NovaAdocaoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Escolha o adotante.' })
  pessoa_id: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data da adoção.' })
  data: string;
}

export class DevolucaoDto {
  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data da devolução.' })
  data: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(aparar)
  @IsString()
  @Length(1, 500, { message: 'Informe o motivo da devolução.' })
  motivo: string;
}

export class NovoAcompanhamentoDto {
  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;

  @ApiProperty({ enum: FORMAS_ACOMPANHAMENTO })
  @IsIn(FORMAS_ACOMPANHAMENTO, {
    message: 'Escolha como foi o acompanhamento.',
  })
  forma: FormaAcompanhamento;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}

export const TIPOS_TERMO = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class AssinarTermoDto {
  @ApiProperty({ enum: TIPOS_TERMO })
  @IsIn(TIPOS_TERMO, { message: 'O termo precisa ser PDF ou imagem.' })
  tipo: (typeof TIPOS_TERMO)[number];

  @ApiProperty({ description: 'Tamanho em bytes (até 10 MB)' })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024, { message: 'O termo pode ter no máximo 10 MB.' })
  tamanho: number;
}

export class RegistrarTermoDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  caminho: string;
}
