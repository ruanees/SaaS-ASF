// Edge Function admin: a ÚNICA parte do sistema com service_role (ADR 0002).
// Faz só o que exige o Supabase Auth administrativo:
//   - convidar: envia o convite por e-mail e cria a linha em `usuarios`
//   - definir_ativo: ativa/desativa em `usuarios` e bloqueia/libera o login
//
// Tudo que é dado de negócio é gravado com o JWT de quem chamou, para a RLS
// valer e a auditoria registrar quem fez. A service_role só toca o Auth.
// Nunca registrar e-mail, nome ou corpo da requisição em log.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const CHAVE_ANONIMA = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FRONT_URL = (Deno.env.get('ASF_FRONT_URL') ?? '').replace(/\/+$/, '');

const PAPEIS = ['admin', 'coordenacao', 'veterinario', 'voluntario'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOQUEIO = '876000h'; // ~100 anos; 'none' libera

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const erro = (status: number, mensagem: string) => responder(status, { mensagem });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  if (!SUPABASE_URL || !CHAVE_ANONIMA || !CHAVE_SERVICO) {
    console.error('admin-usuarios: configuração ausente');
    return erro(500, 'Serviço mal configurado.');
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return erro(401, 'Sessão ausente. Entre de novo.');

  const comoChamador = createClient(SUPABASE_URL, CHAVE_ANONIMA, {
    ...opcoes,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: quem, error: erroQuem } = await comoChamador.auth.getUser(token);
  if (erroQuem || !quem.user) return erro(401, 'Sessão expirada ou inválida. Entre de novo.');

  // Lido pela RLS como o próprio chamador: desativado ou sem convite não lê
  // nem a própria linha.
  const { data: eu } = await comoChamador
    .from('usuarios')
    .select('papel')
    .eq('user_id', quem.user.id)
    .maybeSingle();
  if (eu?.papel !== 'admin') return erro(403, 'Só admin pode fazer isto.');

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, 'Corpo inválido.');
  }

  const admin = createClient(SUPABASE_URL, CHAVE_SERVICO, opcoes);

  try {
    if (corpo.acao === 'convidar') return await convidar(corpo, comoChamador, admin);
    if (corpo.acao === 'definir_ativo') return await definirAtivo(corpo, comoChamador, admin, quem.user.id);
    return erro(400, 'Ação desconhecida.');
  } catch (e) {
    console.error('admin-usuarios: falha', (e as Error)?.name ?? 'erro');
    return erro(503, 'Serviço temporariamente indisponível. Tente de novo em instantes.');
  }
});

async function convidar(
  corpo: Record<string, unknown>,
  comoChamador: SupabaseClient,
  admin: SupabaseClient,
): Promise<Response> {
  const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  const papel = typeof corpo.papel === 'string' ? corpo.papel : '';
  if (!EMAIL.test(email)) return erro(400, 'E-mail inválido.');
  if (nome.length < 1 || nome.length > 120) return erro(400, 'Nome precisa ter de 1 a 120 caracteres.');
  if (!PAPEIS.includes(papel)) return erro(400, 'Papel inválido.');

  let userId: string | undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: FRONT_URL ? `${FRONT_URL}/nova-senha` : undefined,
  });

  if (!error) {
    userId = data.user?.id;
  } else if (error.code === 'email_exists' || error.status === 422) {
    // Já tinha conta no Auth: a conta ganha a linha em `usuarios` e passa a ler.
    const { data: id } = await admin.rpc('admin_id_por_email', { p_email: email });
    userId = typeof id === 'string' ? id : undefined;
  } else if (error.status === 429) {
    return erro(429, 'Muitos convites seguidos. Aguarde alguns minutos.');
  } else {
    return erro(502, 'O convite não pôde ser enviado. Tente de novo.');
  }
  if (!userId) return erro(502, 'O convite não pôde ser enviado. Tente de novo.');

  // Gravado como o admin que convidou: a auditoria registra quem foi.
  const { error: erroLinha } = await comoChamador
    .from('usuarios')
    .insert({ user_id: userId, nome, papel });
  if (erroLinha) {
    if (erroLinha.code === '23505') {
      return erro(409, 'Esta pessoa já está cadastrada. Para devolver o acesso, reative o usuário.');
    }
    return erro(400, 'Não foi possível concluir o convite.');
  }

  // Quem já tinha sido bloqueado no login volta a entrar ao ser convidado de novo.
  await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });

  return responder(201, { user_id: userId });
}

async function definirAtivo(
  corpo: Record<string, unknown>,
  comoChamador: SupabaseClient,
  admin: SupabaseClient,
  chamadorId: string,
): Promise<Response> {
  const userId = typeof corpo.user_id === 'string' ? corpo.user_id : '';
  const ativo = corpo.ativo;
  if (!UUID.test(userId)) return erro(400, 'Usuário inválido.');
  if (typeof ativo !== 'boolean') return erro(400, 'Informe ativo como verdadeiro ou falso.');

  // 1) Dados: a RLS confere ativo a cada consulta, então isto já corta o acesso.
  const { data: linha, error } = await comoChamador
    .from('usuarios')
    .update({ ativo })
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();
  if (error) {
    // Trigger app.manter_um_admin: o último admin não sai.
    if (error.code === 'P0001') return erro(422, error.message);
    return erro(400, 'Não foi possível alterar o usuário.');
  }
  if (!linha) return erro(404, 'Usuário não encontrado.');

  // 2) Login: bloqueia ou libera no Auth. Se falhar, o dado já está cortado.
  const { error: erroAuth } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ativo ? 'none' : BLOQUEIO,
  });
  if (erroAuth) {
    return erro(502, 'O acesso aos dados foi alterado, mas o bloqueio do login falhou. Tente de novo.');
  }

  return responder(200, { user_id: userId, ativo, voce_mesmo: userId === chamadorId });
}
