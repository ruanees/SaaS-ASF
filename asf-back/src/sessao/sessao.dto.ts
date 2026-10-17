import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Token do Turnstile. O Supabase Auth confere quando o captcha está ligado no
// projeto; até lá o campo é opcional e ignorado.
class ComCaptcha {
  @ApiPropertyOptional({ description: 'Token do Turnstile' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captcha?: string;
}

export class EntrarDto extends ComCaptcha {
  @ApiProperty({ example: 'pessoa@exemplo.org' })
  @Transform(aparar)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200, { message: 'Informe a senha.' })
  senha: string;
}

export class RecuperarDto extends ComCaptcha {
  @ApiProperty({ example: 'pessoa@exemplo.org' })
  @Transform(aparar)
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;
}

export class RenovarDto {
  @ApiProperty()
  @IsString()
  @Length(1, 2048)
  refresh_token: string;
}

export class NovaSenhaDto {
  @ApiProperty({ description: 'Ao menos 10 caracteres, com letras e números' })
  @IsString()
  @Length(10, 200, { message: 'A senha precisa ter ao menos 10 caracteres.' })
  @Matches(/(?=.*\p{L})(?=.*\d)/u, {
    message: 'A senha precisa ter letras e números.',
  })
  senha: string;
}

export class SessaoDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({
    description: 'Segundos desde 1970 (Unix) em que o access_token expira',
  })
  expires_at: number;
}
