import { ApiProperty } from '@nestjs/swagger';

export class ArquivoSoltoDto {
  @ApiProperty({ enum: ['fotos-animais', 'laudos', 'termos'] }) balde: string;
  @ApiProperty({ description: 'Caminho no Storage (só ids, sem dado pessoal)' })
  caminho: string;
  @ApiProperty({ format: 'date-time' }) criado_em: string;
}

export class LimpezaDto {
  @ApiProperty() apagados: number;
  @ApiProperty({ description: 'O que não saiu (tente de novo)' })
  restantes: number;
}
