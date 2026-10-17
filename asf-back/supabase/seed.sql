-- Dados fictícios para o banco LOCAL (supabase db reset). Nunca roda em produção.
-- Um usuário de cada papel. Senha de todos, só para uso local: asfLocal2026
-- Nomes e e-mails inventados (domínio .test não existe).

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('b0000000-0000-4000-8000-000000000001'::uuid, 'admin@asf.test',       'Ana Admin',          'admin'::public.papel),
      ('b0000000-0000-4000-8000-000000000002'::uuid, 'coordenacao@asf.test', 'Caio Coordenação',   'coordenacao'::public.papel),
      ('b0000000-0000-4000-8000-000000000003'::uuid, 'veterinaria@asf.test', 'Vera Veterinária',   'veterinario'::public.papel),
      ('b0000000-0000-4000-8000-000000000004'::uuid, 'voluntario@asf.test',  'Vítor Voluntário',   'voluntario'::public.papel)
    ) as t(id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email,
      extensions.crypt('asfLocal2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v.id, v.id::text, 'email',
      jsonb_build_object('sub', v.id::text, 'email', v.email, 'email_verified', true), now(), now(), now());

    insert into public.usuarios (user_id, nome, papel) values (v.id, v.nome, v.papel);
  end loop;
end
$$;
