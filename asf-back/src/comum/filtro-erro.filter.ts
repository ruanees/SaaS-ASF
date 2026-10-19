import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// Separa três casos:
// - HttpException (guard, ValidationPipe, regra do Nest): passa como está.
// - Erro do banco (tem `code` preenchido): 4xx com frase em português.
// - Falha de rede ou do Supabase fora do ar (sem `code`): 503, nunca uma
//   mensagem de permissão.
// Nada do corpo da requisição nem do detalhe do erro vai para a resposta ou
// para o log: pode conter dado pessoal.

interface ErroComCodigo {
  code?: unknown;
  message?: unknown;
}

const ERROS_DO_BANCO: Record<string, { status: number; mensagem: string }> = {
  '42501': { status: 403, mensagem: 'Você não tem permissão para esta ação.' },
  '23505': { status: 409, mensagem: 'Já existe um registro com esses dados.' },
  '23503': {
    status: 409,
    mensagem:
      'Este registro está ligado a outro que não existe ou está em uso.',
  },
  '23514': {
    status: 422,
    mensagem: 'Os dados não respeitam as regras do cadastro.',
  },
  '23502': { status: 422, mensagem: 'Falta preencher um campo obrigatório.' },
  '22P02': { status: 400, mensagem: 'Formato de dado inválido.' },
  '22007': { status: 400, mensagem: 'Data inválida.' },
  '22008': { status: 400, mensagem: 'Data inválida.' },
  PGRST116: { status: 404, mensagem: 'Registro não encontrado.' },
};

const FALHA_DE_REDE =
  'Serviço temporariamente indisponível. Tente de novo em instantes.';

export interface RespostaDeErro {
  status: number;
  // `codigo` só quando o front precisa agir de um jeito específico
  // (ex.: 'mfa_obrigatorio' leva para a tela do autenticador).
  corpo: { mensagem: string; codigo?: string };
}

export function traduzirErro(erro: unknown): RespostaDeErro {
  if (erro instanceof HttpException) {
    const resposta = erro.getResponse();
    const mensagem =
      typeof resposta === 'string'
        ? resposta
        : (juntarMensagem((resposta as { message?: unknown }).message) ??
          erro.message);
    const codigo =
      typeof resposta === 'object' &&
      typeof (resposta as { codigo?: unknown }).codigo === 'string'
        ? (resposta as { codigo: string }).codigo
        : undefined;
    return {
      status: erro.getStatus(),
      corpo: codigo ? { mensagem, codigo } : { mensagem },
    };
  }

  const { code, message } = (erro ?? {}) as ErroComCodigo;
  if (typeof code === 'string' && code !== '') {
    const conhecido = ERROS_DO_BANCO[code];
    if (conhecido)
      return {
        status: conhecido.status,
        corpo: { mensagem: conhecido.mensagem },
      };
    // `raise exception` das nossas funções no banco: a mensagem é nossa e em português.
    if (code === 'P0001' && typeof message === 'string' && message !== '') {
      return { status: 422, corpo: { mensagem: message } };
    }
    return {
      status: 400,
      corpo: { mensagem: 'Não foi possível concluir a operação.' },
    };
  }

  if (ehFalhaDeRede(erro)) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      corpo: { mensagem: FALHA_DE_REDE },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    corpo: { mensagem: 'Erro inesperado. A equipe foi avisada.' },
  };
}

function ehFalhaDeRede(erro: unknown): boolean {
  if (erro instanceof TypeError) return true; // fetch failed
  const { code, message } = (erro ?? {}) as ErroComCodigo;
  // supabase-js devolve { code: '', message: 'TypeError: fetch failed' } quando não alcança o servidor.
  return (
    code === '' ||
    (typeof message === 'string' && /fetch failed|network/i.test(message))
  );
}

function juntarMensagem(mensagem: unknown): string | undefined {
  if (Array.isArray(mensagem)) return mensagem.join('; ');
  return typeof mensagem === 'string' ? mensagem : undefined;
}

@Catch()
export class FiltroErro implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(erro: unknown, host: ArgumentsHost) {
    const { status, corpo } = traduzirErro(erro);
    if (status >= 500) {
      const { code } = (erro ?? {}) as ErroComCodigo;
      // Só o tipo e o código; a mensagem pode carregar dado vindo do banco.
      const codigo = typeof code === 'string' && code !== '' ? code : '-';
      this.log.error(
        `${status} ${(erro as Error)?.name ?? 'erro'} code=${codigo}`,
      );
    }
    const res = host.switchToHttp().getResponse<{
      status(n: number): { json(b: unknown): void };
    }>();
    res.status(status).json(corpo);
  }
}
