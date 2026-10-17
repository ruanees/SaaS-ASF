import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SITUACOES, type Situacao } from '../animais/animais.dto.js';
import { PeriodoDto } from './indicadores.dto.js';

export const SECOES = [
  'animais',
  'vacinacao',
  'castracao',
  'adocoes',
  'movimentacoes',
] as const;
export type Secao = (typeof SECOES)[number];

export class RelatorioQueryDto extends PeriodoDto {
  @ApiPropertyOptional({
    enum: SITUACOES,
    description: 'Animais e movimentações',
  })
  @IsOptional()
  @IsIn(SITUACOES)
  situacao?: Situacao;

  @ApiPropertyOptional({
    enum: ['adocao', 'devolucao'],
    description: 'Adoções: conta pela data da adoção ou da devolução',
  })
  @IsOptional()
  @IsIn(['adocao', 'devolucao'])
  evento?: 'adocao' | 'devolucao';
}

export class QuadroDto {
  @ApiProperty() rotulo: string;
  @ApiProperty() valor: number;
}

export class ColunaDto {
  @ApiProperty() chave: string;
  @ApiProperty() rotulo: string;
}

// Saída única do ReportBuilderService: tela, CSV e impressão percorrem a mesma.
// Nenhum relatório leva dado pessoal (nome de adotante, contato).
export class RelatorioDto {
  @ApiProperty({ enum: SECOES }) secao: Secao;
  @ApiProperty() titulo: string;
  @ApiProperty() descricao: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) de:
    string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) ate:
    string | null;
  @ApiProperty({ type: [QuadroDto] }) quadros: QuadroDto[];
  @ApiProperty({ type: [ColunaDto] }) colunas: ColunaDto[];
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: { type: 'string', nullable: true },
    },
  })
  linhas: Record<string, string | null>[];
}
