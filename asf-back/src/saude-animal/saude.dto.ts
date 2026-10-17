import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
  ValidateIf,
} from 'class-validator';
import { ESPECIES, type Especie } from '../animais/animais.dto.js';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATA = { strict: true } as const;

export const STATUS_VACINACAO = [
  'nao_vacinado',
  'vencida',
  'vence_em_breve',
  'vacinado',
] as const;
export const STATUS_CASTRACAO = [
  'castrado',
  'agendada',
  'nao_castrado',
] as const;
export type StatusVacinacao = (typeof STATUS_VACINACAO)[number];
export type StatusCastracao = (typeof STATUS_CASTRACAO)[number];

export const TIPOS_PENDENCIA = [
  'vacina',
  'vermifugacao',
  'antiparasitario',
  'castracao',
  'castracao_prioridade',
] as const;

// Respostas -------------------------------------------------------------------

export class VacinaTipoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nome: string;
  @ApiProperty({ enum: ESPECIES }) especie: Especie;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Dias até o reforço (sugere a próxima dose)',
  })
  reforco_dias: number | null;
  @ApiProperty({ description: 'Doses da primeira vacinação (ex.: 3)' })
  doses_iniciais: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Dias entre as doses iniciais (ex.: 21)',
  })
  intervalo_inicial_dias: number | null;
  @ApiProperty() ativo: boolean;
}

export class EstadoSaudeDto {
  @ApiProperty({ description: 'Tem ao menos uma vacinação' }) vacinado: boolean;
  @ApiProperty({ description: 'Nunca vacinado ou alguma dose vencida' })
  vacina_pendente: boolean;
  @ApiProperty({ enum: STATUS_VACINACAO }) vacinacao_status: StatusVacinacao;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  proxima_vacina: string | null;
  @ApiProperty({ enum: STATUS_CASTRACAO }) castracao_status: StatusCastracao;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  castracao_agendada_para: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  ultima_vermifugacao: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  proxima_vermifugacao: string | null;
  @ApiProperty() vermifugacao_vencida: boolean;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  proximo_antiparasitario: string | null;
  @ApiProperty() antiparasitario_vencido: boolean;
}

export class VacinacaoDto {
  @ApiProperty({ format: 'uuid' }) atendimento_id: string;
  @ApiProperty() vacina: string;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) proxima_dose:
    string | null;
  @ApiProperty({ type: String, nullable: true }) lote: string | null;
  @ApiProperty({ type: String, nullable: true }) clinica: string | null;
  @ApiProperty({ type: String, nullable: true }) veterinario: string | null;
}

export class VermifugacaoDto {
  @ApiProperty({ format: 'uuid' }) atendimento_id: string;
  @ApiProperty() produto: string;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) proxima_dose:
    string | null;
}

export class AntiparasitarioDto {
  @ApiProperty({ format: 'uuid' }) atendimento_id: string;
  @ApiProperty() produto: string;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) proxima_dose:
    string | null;
}

export class SugestaoDto {
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Próxima dose sugerida (pode ser alterada)',
  })
  proxima_dose: string | null;
}

export class CastracaoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['agendada', 'realizada', 'cancelada'] }) status:
    'agendada' | 'realizada' | 'cancelada';
  @ApiProperty({ type: String, format: 'date', nullable: true }) data_agendada:
    string | null;
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Data da cirurgia',
  })
  data_realizada: string | null;
  @ApiProperty({ description: 'Já chegou castrado' })
  anterior_a_entrada: boolean;
  @ApiProperty({ type: String, nullable: true }) clinica: string | null;
  @ApiProperty({ type: String, nullable: true }) motivo_cancelamento:
    string | null;
}

export class SaudeAnimalDto {
  @ApiProperty({ type: EstadoSaudeDto }) estado: EstadoSaudeDto;
  @ApiProperty({ type: [VacinacaoDto] }) vacinacoes: VacinacaoDto[];
  @ApiProperty({ type: [VermifugacaoDto] }) vermifugacoes: VermifugacaoDto[];
  @ApiProperty({ type: [AntiparasitarioDto] })
  antiparasitarios: AntiparasitarioDto[];
  @ApiProperty({ type: [CastracaoDto] }) castracoes: CastracaoDto[];
}

export class PendenciaDto {
  @ApiProperty({ enum: TIPOS_PENDENCIA })
  tipo: (typeof TIPOS_PENDENCIA)[number];
  @ApiProperty({ format: 'uuid' }) animal_id: string;
  @ApiProperty() numero: string;
  @ApiProperty({ type: String, nullable: true }) nome: string | null;
  @ApiProperty({ enum: ESPECIES }) especie: Especie;
  @ApiProperty({ description: 'Vacina, vermífugo ou "Castração agendada"' })
  descricao: string;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ description: 'Data já passou' }) vencida: boolean;
}

// Entradas ---------------------------------------------------------------------

export class FiltroVacinasTiposDto {
  @ApiPropertyOptional({ enum: ESPECIES })
  @IsOptional()
  @IsIn(ESPECIES)
  especie?: Especie;

  @ApiPropertyOptional({ enum: ['sim'], description: 'Inclui as desativadas' })
  @IsOptional()
  @IsIn(['sim'])
  todas?: 'sim';
}

export class CriarVacinaTipoDto {
  @ApiProperty({ maxLength: 60 })
  @Transform(aparar)
  @IsString()
  @Length(1, 60, { message: 'Nome da vacina com 1 a 60 caracteres.' })
  nome: string;

  @ApiProperty({ enum: ESPECIES })
  @IsIn(ESPECIES, { message: 'Escolha a espécie.' })
  especie: Especie;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt({ message: 'Reforço em dias inteiros.' })
  @Min(1)
  @Max(3650)
  reforco_dias?: number | null;

  @ApiPropertyOptional({
    default: 1,
    description: 'Doses da primeira vacinação',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  doses_iniciais?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Dias entre as doses iniciais',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  intervalo_inicial_dias?: number | null;
}

export class AlterarVacinaTipoDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @Length(1, 60)
  nome?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  reforco_dias?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  doses_iniciais?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  intervalo_inicial_dias?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

class ComAtendimento {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Clínica inválida.' })
  clinica_id?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Nome e CRMV' })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(160)
  veterinario?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

export class NovaVacinacaoDto extends ComAtendimento {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Escolha a vacina.' })
  vacina_tipo_id: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data da aplicação.' })
  data: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, { message: 'Data da próxima dose inválida.' })
  proxima_dose?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(60)
  lote?: string;
}

export class NovaVermifugacaoDto {
  @ApiProperty({ maxLength: 80 })
  @Transform(aparar)
  @IsString()
  @Length(1, 80, { message: 'Informe o vermífugo usado.' })
  produto: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, { message: 'Data da próxima dose inválida.' })
  proxima_dose?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

export class NovaCastracaoDto extends ComAtendimento {
  @ApiProperty({
    enum: ['agendar', 'realizar', 'anterior'],
    description: 'anterior = já chegou castrado',
  })
  @IsIn(['agendar', 'realizar', 'anterior'])
  acao: 'agendar' | 'realizar' | 'anterior';

  @ApiPropertyOptional({
    format: 'date',
    description: 'Obrigatória para agendar e realizar',
  })
  @ValidateIf((o: NovaCastracaoDto) => o.acao !== 'anterior')
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description: 'Microchip aplicado na cirurgia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  microchip?: string;
}

export class AlterarCastracaoDto extends ComAtendimento {
  @ApiProperty({ enum: ['realizar', 'cancelar'] })
  @IsIn(['realizar', 'cancelar'])
  acao: 'realizar' | 'cancelar';

  @ApiPropertyOptional({
    format: 'date',
    description: 'Obrigatória para realizar',
  })
  @ValidateIf((o: AlterarCastracaoDto) => o.acao === 'realizar')
  @IsISO8601(DATA, { message: 'Informe a data da castração.' })
  data?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description: 'Microchip aplicado na cirurgia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  microchip?: string;
}

export class NovoAntiparasitarioDto {
  @ApiProperty({ maxLength: 80, example: 'Simparic' })
  @Transform(aparar)
  @IsString()
  @Length(1, 80, { message: 'Informe o produto usado.' })
  produto: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA, { message: 'Data da próxima dose inválida.' })
  proxima_dose?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

export class SugestaoQueryDto {
  @ApiProperty({ enum: ['vacina', 'vermifugacao', 'antiparasitario'] })
  @IsIn(['vacina', 'vermifugacao', 'antiparasitario'])
  tipo: 'vacina' | 'vermifugacao' | 'antiparasitario';

  @ApiProperty({ format: 'date', description: 'Data da aplicação' })
  @IsISO8601(DATA, { message: 'Data inválida.' })
  data: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obrigatório para vacina',
  })
  @ValidateIf((o: SugestaoQueryDto) => o.tipo === 'vacina')
  @IsUUID('all', { message: 'Escolha a vacina.' })
  vacina_tipo_id?: string;

  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Produto (antiparasitário)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  produto?: string;
}
