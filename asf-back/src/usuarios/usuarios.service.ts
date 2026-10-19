import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { dados } from '../supabase/resultado.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AlterarUsuarioDto,
  ConviteCriadoDto,
  ConviteDto,
  EuDto,
  Papel,
  UsuarioDto,
} from './usuarios.dto.js';

const FUNCAO_ADMIN = 'admin-usuarios';

@Injectable()
export class UsuariosService {
  constructor(private readonly supabase: SupabaseService) {}

  // Quem entrou. A situação vem do banco (minha_situacao_acesso): sem convite
  // ou desativado = 403; admin/coordenação sem MFA = 403 'mfa_obrigatorio',
  // para o front levar à tela do autenticador. Quem decide é a RLS; aqui só
  // se escolhe a mensagem.
  async eu(usuario: UsuarioAutenticado): Promise<EuDto> {
    const sb = this.supabase.para(usuario);
    const situacao = dados(
      await sb.rpc('minha_situacao_acesso').maybeSingle<{
        papel: Papel;
        ativo: boolean;
        exige_mfa: boolean;
        mfa_ok: boolean;
      }>(),
    );
    if (!situacao?.ativo) {
      throw new ForbiddenException(
        'Sua conta não tem acesso ativo. Fale com a coordenação.',
      );
    }
    if (situacao.exige_mfa && !situacao.mfa_ok) {
      throw new ForbiddenException({
        message: 'Confirme o código do aplicativo autenticador para continuar.',
        codigo: 'mfa_obrigatorio',
      });
    }

    const linha = dados(
      await sb
        .from('usuarios')
        .select('user_id, nome, papel')
        .eq('user_id', usuario.id)
        .maybeSingle(),
    );
    if (!linha) {
      throw new ForbiddenException(
        'Sua conta não tem acesso ativo. Fale com a coordenação.',
      );
    }
    return { id: linha.user_id, nome: linha.nome, papel: linha.papel };
  }

  async listar(usuario: UsuarioAutenticado): Promise<UsuarioDto[]> {
    const linhas = dados(
      await this.supabase
        .para(usuario)
        .from('usuarios')
        .select('user_id, nome, papel, ativo, criado_em')
        .order('nome'),
    );
    return linhas ?? [];
  }

  // Convidar mexe no Supabase Auth, então passa pela Edge Function (a única
  // com service_role). Ela confere que quem chamou é admin ativo.
  async convidar(
    usuario: UsuarioAutenticado,
    convite: ConviteDto,
  ): Promise<ConviteCriadoDto> {
    return this.chamarAdmin(this.supabase.para(usuario), {
      acao: 'convidar',
      email: convite.email,
      nome: convite.nome,
      papel: convite.papel,
    });
  }

  async alterar(
    usuario: UsuarioAutenticado,
    id: string,
    alteracao: AlterarUsuarioDto,
  ): Promise<UsuarioDto> {
    const { ativo, ...campos } = alteracao;
    if (ativo === undefined && Object.keys(campos).length === 0) {
      throw new BadRequestException('Nada para alterar.');
    }
    const sb = this.supabase.para(usuario);

    // Nome e papel: update direto; a RLS só deixa admin.
    if (Object.keys(campos).length > 0) {
      const linha = dados(
        await sb
          .from('usuarios')
          .update(campos)
          .eq('user_id', id)
          .select('user_id')
          .maybeSingle(),
      );
      if (!linha) throw new NotFoundException('Usuário não encontrado.');
    }

    // Ativar/desativar também bloqueia ou libera o login no Auth: Edge Function.
    if (ativo !== undefined) {
      await this.chamarAdmin(sb, { acao: 'definir_ativo', user_id: id, ativo });
    }

    const atual = dados(
      await sb
        .from('usuarios')
        .select('user_id, nome, papel, ativo, criado_em')
        .eq('user_id', id)
        .maybeSingle(),
    );
    if (!atual) throw new NotFoundException('Usuário não encontrado.');
    return atual;
  }

  private async chamarAdmin<T>(
    sb: SupabaseClient,
    corpo: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await sb.functions.invoke<T>(FUNCAO_ADMIN, {
      body: corpo,
    });
    if (!error) return data as T;

    if (error instanceof FunctionsHttpError) {
      const resposta = error.context as Response;
      let mensagem = 'Não foi possível concluir a operação.';
      try {
        const json = (await resposta.json()) as { mensagem?: unknown };
        if (typeof json.mensagem === 'string') mensagem = json.mensagem;
      } catch {
        // corpo não é JSON; fica a mensagem genérica
      }
      throw new HttpException({ message: mensagem }, resposta.status);
    }
    if (
      error instanceof FunctionsFetchError ||
      error instanceof FunctionsRelayError
    ) {
      throw new ServiceUnavailableException(
        'Serviço temporariamente indisponível. Tente de novo em instantes.',
      );
    }
    throw error;
  }
}
