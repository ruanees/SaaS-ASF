import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const PAPEIS = [
  'admin',
  'coordenacao',
  'veterinario',
  'voluntario',
] as const;
export type Papel = (typeof PAPEIS)[number];

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class EuDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: PAPEIS })
  papel: Papel;
}

export class UsuarioDto {
  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: PAPEIS })
  papel: Papel;

  @ApiProperty()
  ativo: boolean;

  @ApiProperty({ format: 'date-time' })
  criado_em: string;
}

export class ConviteDto {
  @ApiProperty({ example: 'pessoa@exemplo.org' })
  @Transform(aparar)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @ApiProperty()
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Nome precisa ter de 1 a 120 caracteres.' })
  nome: string;

  @ApiProperty({ enum: PAPEIS })
  @IsIn(PAPEIS, { message: 'Papel inválido.' })
  papel: Papel;
}

export class ConviteCriadoDto {
  @ApiProperty({ format: 'uuid' })
  user_id: string;
}

export class AlterarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @Length(1, 120, { message: 'Nome precisa ter de 1 a 120 caracteres.' })
  nome?: string;

  @ApiPropertyOptional({ enum: PAPEIS })
  @IsOptional()
  @IsIn(PAPEIS, { message: 'Papel inválido.' })
  papel?: Papel;

  @ApiPropertyOptional({
    description: 'false desativa: corta os dados e bloqueia o login',
  })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
