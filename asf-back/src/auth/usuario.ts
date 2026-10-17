import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Quem fez a requisição, como o guard confirmou pelo JWT.
// Papel e situação (ativo) não ficam aqui: quem decide é a RLS no banco.
export interface UsuarioAutenticado {
  id: string;
  token: string;
}

export interface RequisicaoAutenticada {
  headers: Record<string, string | string[] | undefined>;
  usuario?: UsuarioAutenticado;
}

export const Usuario = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (!req.usuario) {
      // Só acontece se alguém usar @Usuario() numa rota @Publico().
      throw new Error('@Usuario() usado em rota sem autenticação');
    }
    return req.usuario;
  },
);
