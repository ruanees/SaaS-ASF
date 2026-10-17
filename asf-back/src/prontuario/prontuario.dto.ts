import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATA = { strict: true } as const;

export const TIPOS_ATENDIMENTO = [
  'consulta',
  'exame',
  'teste',
  'vacina',
  'vermifugacao',
  'castracao',
  'tratamento',
  'internacao',
  'retorno',
  'obito',
  'antiparasitario',
] as const;
export type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];

// Tipos que entram pelo formulário do prontuário (os outros têm registro próprio).
export const TIPOS_CLINICOS = [
  'consulta',
  'retorno',
  'exame',
  'teste',
  'tratamento',
  'internacao',
  'obito',
] as const;

export const RESULTADOS = [
  'aguardando',
  'reagente',
  'nao_reagente',
  'inconclusivo',
  'normal',
  'alterado',
  'ver_laudo',
] as const;
export type Resultado = (typeof RESULTADOS)[number];

// Respostas -------------------------------------------------------------------

export class ExameDetalheDto {
  @ApiProperty() nome: string;
  @ApiProperty({ type: String, nullable: true }) metodo: string | null;
  @ApiProperty({ enum: RESULTADOS }) resultado: Resultado;
  @ApiProperty({ type: String, nullable: true }) resultado_detalhe:
    string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) resultado_em:
    string | null;
  @ApiProperty() tem_laudo: boolean;
}

export class TratamentoDetalheDto {
  @ApiProperty() medicamento: string;
  @ApiProperty({ type: String, nullable: true }) dose: string | null;
  @ApiProperty({ type: String, nullable: true }) frequencia: string | null;
  @ApiProperty({ type: String, format: 'date' }) inicio: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) fim:
    string | null;
}

export class InternacaoDetalheDto {
  @ApiProperty({ type: String, format: 'date' }) entrada: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) alta:
    string | null;
}

export class DoseDetalheDto {
  @ApiProperty({ description: 'Vacina ou produto' }) nome: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) proxima_dose:
    string | null;
  @ApiProperty({ type: String, nullable: true }) lote: string | null;
}

export class AtendimentoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TIPOS_ATENDIMENTO }) tipo: TipoAtendimento;
  @ApiProperty({ type: String, format: 'date' }) data: string;
  @ApiProperty({ type: String, nullable: true }) veterinario: string | null;
  @ApiProperty({ type: String, nullable: true }) diagnostico: string | null;
  @ApiProperty({ type: String, nullable: true }) observacoes: string | null;
  @ApiProperty({ type: String, nullable: true }) clinica: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Quem registrou' })
  autor: string | null;
  @ApiProperty({ format: 'date-time' }) criado_em: string;
  @ApiPropertyOptional({ type: ExameDetalheDto }) exame?: ExameDetalheDto;
  @ApiPropertyOptional({ type: TratamentoDetalheDto })
  tratamento?: TratamentoDetalheDto;
  @ApiPropertyOptional({ type: InternacaoDetalheDto })
  internacao?: InternacaoDetalheDto;
  @ApiPropertyOptional({
    type: DoseDetalheDto,
    description: 'Vacina, vermífugo ou antipulgas',
  })
  dose?: DoseDetalheDto;
}

export class ProntuarioDto {
  @ApiProperty({ type: [AtendimentoDto] }) itens: AtendimentoDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() por_pagina: number;
}

export class LaudoAssinadoDto {
  @ApiProperty() caminho: string;
  @ApiProperty({ description: 'URL assinada para o envio (PUT com o arquivo)' })
  url: string;
}

export class LaudoUrlDto {
  @ApiProperty({ description: 'URL assinada de leitura (5 min)' }) url: string;
}

// Entradas ---------------------------------------------------------------------

export class ProntuarioQueryDto {
  @ApiPropertyOptional({ enum: TIPOS_ATENDIMENTO })
  @IsOptional()
  @IsIn(TIPOS_ATENDIMENTO)
  tipo?: TipoAtendimento;

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

export class NovoExameDto {
  @ApiProperty({ maxLength: 80, example: 'Leishmaniose (calazar)' })
  @Transform(aparar)
  @IsString()
  @Length(1, 80, { message: 'Informe qual exame ou teste foi feito.' })
  nome: string;

  @ApiPropertyOptional({ maxLength: 60, example: 'Teste rápido' })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(60)
  metodo?: string;

  @ApiPropertyOptional({ enum: RESULTADOS, default: 'aguardando' })
  @IsOptional()
  @IsIn(RESULTADOS)
  resultado?: Resultado;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resultado_detalhe?: string;
}

export class NovoTratamentoDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Informe o medicamento.' })
  medicamento: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(80)
  dose?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(80)
  frequencia?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA)
  inicio?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA)
  fim?: string;
}

export class NovaInternacaoDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA)
  entrada?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA)
  alta?: string;
}

export class NovoAtendimentoDto {
  @ApiProperty({ enum: TIPOS_CLINICOS })
  @IsIn(TIPOS_CLINICOS, { message: 'Escolha o tipo de atendimento.' })
  tipo: (typeof TIPOS_CLINICOS)[number];

  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;

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

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnostico?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @ApiPropertyOptional({
    type: NovoExameDto,
    description: 'Para exame e teste',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NovoExameDto)
  exame?: NovoExameDto;

  @ApiPropertyOptional({ type: NovoTratamentoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NovoTratamentoDto)
  tratamento?: NovoTratamentoDto;

  @ApiPropertyOptional({ type: NovaInternacaoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NovaInternacaoDto)
  internacao?: NovaInternacaoDto;
}

export class ResultadoExameDto {
  @ApiProperty({ enum: RESULTADOS.filter((r) => r !== 'aguardando') })
  @IsIn(RESULTADOS.filter((r) => r !== 'aguardando'), {
    message: 'Escolha o resultado.',
  })
  resultado: Exclude<Resultado, 'aguardando'>;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detalhe?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601(DATA)
  data?: string;
}

export class DataDto {
  @ApiProperty({ format: 'date' })
  @IsISO8601(DATA, { message: 'Informe a data.' })
  data: string;
}

export class TratamentoEntradaDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Informe o medicamento.' })
  medicamento: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  dose?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  frequencia?: string;
}

export class SaudeEntradaDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    example: 'Sarna generalizada, fígado alterado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  condicao?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Hemograma', 'Leishmaniose (calazar)', '4DX'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  exames?: string[];

  @ApiPropertyOptional({ type: TratamentoEntradaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TratamentoEntradaDto)
  tratamento?: TratamentoEntradaDto;
}

export const TIPOS_LAUDO = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class AssinarLaudoDto {
  @ApiProperty({ enum: TIPOS_LAUDO })
  @IsIn(TIPOS_LAUDO, { message: 'O laudo precisa ser PDF ou imagem.' })
  tipo: (typeof TIPOS_LAUDO)[number];

  @ApiProperty({ description: 'Tamanho em bytes (até 10 MB)' })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024, { message: 'O laudo pode ter no máximo 10 MB.' })
  tamanho: number;
}

export class RegistrarLaudoDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  caminho: string;
}
