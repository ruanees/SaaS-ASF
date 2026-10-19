import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

const DATA = { strict: true } as const;
const MSG_DATA = { message: 'Data inválida (use AAAA-MM-DD).' };

export const OPERACOES = [
  'insert',
  'update',
  'delete',
  'leitura_sensivel',
  'exportacao',
] as const;
export type Operacao = (typeof OPERACOES)[number];

// Grupos da tela: o que o admin costuma procurar.
export const GRUPOS = ['acessos', 'exportacoes', 'alteracoes'] as const;
export type Grupo = (typeof GRUPOS)[number];

export class FiltroAuditoriaDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  de?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  ate?: string;

  @ApiPropertyOptional({
    enum: GRUPOS,
    description:
      'acessos = leitura de contato; exportacoes = dados do titular e relatórios; alteracoes = inclusões, mudanças e exclusões',
  })
  @IsOptional()
  @IsIn(GRUPOS)
  grupo?: Grupo;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  por_pagina?: number;
}

// A auditoria guarda quais campos mudaram, nunca os valores (ADR 0007).
export class RegistroAuditoriaDto {
  @ApiProperty() id: number;
  @ApiProperty({ format: 'date-time' }) em: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Nome de quem fez (nulo: rotina ou sistema)',
  })
  usuario: string | null;
  @ApiProperty() tabela: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  registro_id: string | null;
  @ApiProperty({ enum: OPERACOES }) operacao: Operacao;
  @ApiProperty({ type: [String], nullable: true }) campos_alterados:
    string[] | null;
}

export class ListaAuditoriaDto {
  @ApiProperty({ type: [RegistroAuditoriaDto] }) itens: RegistroAuditoriaDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() por_pagina: number;
}
