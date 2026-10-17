import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UsuarioAutenticado } from '../auth/usuario.js';
import { exigir, lerConfiguracao } from '../configuracao.js';

// Cliente por requisição, com a chave pública e o JWT de quem chamou.
// Assim toda leitura e escrita passa pela RLS como aquela pessoa.
// Nunca usar service_role aqui (ADR 0002): ela só existe na Edge Function.
@Injectable()
export class SupabaseService {
  para(usuario: UsuarioAutenticado): SupabaseClient {
    return this.criar({ Authorization: `Bearer ${usuario.token}` });
  }

  // Cliente sem sessão, só para as rotas de entrar e recuperar senha.
  anonimo(): SupabaseClient {
    return this.criar({});
  }

  private criar(cabecalhos: Record<string, string>): SupabaseClient {
    const configuracao = lerConfiguracao();
    return createClient(
      exigir(configuracao, 'supabaseUrl'),
      exigir(configuracao, 'supabaseChavePublica'),
      {
        global: { headers: cabecalhos },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
}
