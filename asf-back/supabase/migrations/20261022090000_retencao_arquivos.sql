-- 013 — Fase 6: prazo de guarda das pessoas e arquivos soltos.
--
-- Prazo de guarda (plano, seção 04, regra 8): a lista é calculada a cada
-- abertura, como as pendências; ninguém é anonimizado sozinho. A coordenação
-- abre a pessoa e anonimiza (função da Fase 4). O prazo vem de
-- configuracoes.retencao_pessoas_meses (padrão 60, provisório; ADR 0010).
--
-- Fim do vínculo, até a associação responder a pergunta 15 (acompanhamento):
-- o último evento com a pessoa (cadastro, adoção, devolução ou movimentação de
-- lar temporário). Quem está com um animal em lar temporário agora nunca entra.

create function public.pessoas_alem_do_prazo()
returns table (id uuid, nome text, vinculos public.vinculo_pessoa[], ultimo_evento date, venceu_em date)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.exigir_coordenacao('Só a administração e a coordenação veem o prazo de guarda.');
  return query
  with conf as (select c.retencao_pessoas_meses as meses from public.configuracoes c),
  ultimo as (
    select p.id, p.nome, p.vinculos,
      greatest(
        app.hoje_em(p.criado_em),
        (select max(greatest(a.data_adocao, coalesce(a.data_devolucao, a.data_adocao)))
           from public.adocoes a where a.pessoa_id = p.id),
        (select max(m.data) from public.movimentacoes m where m.pessoa_id = p.id)
      ) as evento
    from public.pessoas p
    where p.anonimizado_em is null
      and not exists (select 1 from public.animais an where an.pessoa_id = p.id and an.excluido_em is null)
  )
  select u.id, u.nome, u.vinculos, u.evento, (u.evento + make_interval(months => conf.meses))::date
  from ultimo u cross join conf
  where (u.evento + make_interval(months => conf.meses))::date <= app.hoje()
  order by u.evento, u.nome;
end
$$;

-- Arquivos soltos: enviados ao Storage e nunca ligados a um registro (envio
-- interrompido, laudo ou termo trocado). Só caminhos (uuid), sem dado pessoal.
-- Um dia de folga para não pegar um envio que ainda está terminando.
create function public.arquivos_soltos()
returns table (balde text, caminho text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select app.tem_papel(array['admin']::public.papel[])) then
    raise exception 'Só a administração vê os arquivos soltos.' using errcode = '42501';
  end if;
  return query
  select o.bucket_id, o.name, o.created_at
  from storage.objects o
  where o.created_at < now() - interval '1 day'
    and (
      (o.bucket_id = 'fotos-animais' and not exists (select 1 from public.animal_fotos f where f.caminho = o.name))
      or (o.bucket_id = 'laudos' and not exists (select 1 from public.exames e where e.laudo_caminho = o.name))
      or (o.bucket_id = 'termos' and not exists (select 1 from public.adocoes a where a.termo_caminho = o.name))
    )
  order by o.created_at;
end
$$;

revoke all on function public.pessoas_alem_do_prazo(), public.arquivos_soltos() from public, anon;
grant execute on function public.pessoas_alem_do_prazo(), public.arquivos_soltos() to authenticated;

-- O admin apaga foto e laudo soltos; o que está ligado a um registro, nem ele.
create policy fotos_animais_apagar_soltas on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos-animais'
    and (select app.tem_papel(array['admin']::public.papel[]))
    and not exists (select 1 from public.animal_fotos f where f.caminho = name)
  );
create policy laudos_apagar_soltos on storage.objects for delete to authenticated
  using (
    bucket_id = 'laudos'
    and (select app.tem_papel(array['admin']::public.papel[]))
    and not exists (select 1 from public.exames e where e.laudo_caminho = name)
  );
