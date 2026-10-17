import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

const DATA = { strict: true } as const;
const MSG_DATA = { message: 'Data inválida (use AAAA-MM-DD).' };

export class PeriodoDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Início (padrão: 1º de janeiro)',
  })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  de?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Fim (padrão: hoje)' })
  @IsOptional()
  @IsISO8601(DATA, MSG_DATA)
  ate?: string;
}

// Dicionário de indicadores (plano, Fase 5). "Sob cuidado" = em acolhimento.
export class IndicadoresDto {
  @ApiProperty({ type: String, format: 'date' }) de: string;
  @ApiProperty({ type: String, format: 'date' }) ate: string;
  @ApiProperty({ description: 'Todos os animais não excluídos, desde sempre' })
  total: number;
  @ApiProperty({ description: 'Em acolhimento agora' }) sob_cuidado: number;
  @ApiProperty() caes: number;
  @ApiProperty() caes_sob_cuidado: number;
  @ApiProperty() gatos: number;
  @ApiProperty() gatos_sob_cuidado: number;
  @ApiProperty() machos: number;
  @ApiProperty() machos_sob_cuidado: number;
  @ApiProperty() femeas: number;
  @ApiProperty() femeas_sob_cuidado: number;
  @ApiProperty({ description: 'Sob cuidado, vacina em dia' }) vacinados: number;
  @ApiProperty({ description: 'Sob cuidado, nunca vacinado ou vencida' })
  vacinacao_pendente: number;
  @ApiProperty() castrados: number;
  @ApiProperty() nao_castrados: number;
  @ApiProperty() castracao_agendada: number;
  @ApiProperty() disponiveis: number;
  @ApiProperty() na_sede: number;
  @ApiProperty() em_lar_temporario: number;
  @ApiProperty() em_tratamento: number;
  @ApiProperty({ description: 'Adoções no período' }) adocoes: number;
  @ApiProperty({ description: 'Devoluções de adoção no período' })
  devolucoes: number;
  @ApiProperty({ description: 'Devolvidos à comunidade no período' })
  devolvidos_comunidade: number;
}

export class PontoMensalDto {
  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Primeiro dia do mês',
  })
  mes: string;
  @ApiProperty() entradas: number;
  @ApiProperty() adocoes: number;
  @ApiProperty() devolvidos_comunidade: number;
}
