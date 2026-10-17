import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Publico } from '../comum/publico.decorator.js';
import {
  lerConfiguracao,
  VARIAVEIS,
  type NomeConfiguracao,
} from '../configuracao.js';

class ItemConfiguracao {
  @ApiProperty({ example: 'SUPABASE_URL' })
  variavel: string;

  @ApiProperty()
  existe: boolean;
}

class RespostaSaude {
  @ApiProperty({ enum: ['ok', 'incompleto'] })
  situacao: 'ok' | 'incompleto';

  @ApiProperty({ type: [ItemConfiguracao] })
  configuracoes: ItemConfiguracao[];
}

// Diagnóstico público: diz se cada configuração existe e de qual variável
// ela vem. Nunca devolve o valor.
@ApiTags('saude')
@Controller('saude')
export class SaudeController {
  @Publico()
  @Get()
  @ApiOkResponse({ type: RespostaSaude })
  ver(): RespostaSaude {
    const configuracao = lerConfiguracao();
    const configuracoes = (Object.keys(VARIAVEIS) as NomeConfiguracao[]).map(
      (nome) => ({
        variavel: VARIAVEIS[nome],
        existe: configuracao[nome] !== undefined,
      }),
    );
    return {
      situacao: configuracoes.every((c) => c.existe) ? 'ok' : 'incompleto',
      configuracoes,
    };
  }
}
