-- 011 — Fase 5: indicadores e relatórios.
-- Dicionário de indicadores do plano (Fase 5). As regras são a proposta do
-- plano; a associação ainda vai confirmar (pergunta 23 do questionário).
--
-- Uma fonte só: a lista de animais, os indicadores e os relatórios leem a mesma
-- view `animais_lista`. Assim o número do painel e a lista que ele abre usam a
-- mesma regra (armadilha da Fase 5).

create view public.animais_lista with (security_invoker = true) as
select
  an.id, an.numero, an.nome, an.especie, an.sexo, an.nascimento_estimado, an.idade_precisao, an.porte,
  an.situacao, an.local, an.disponivel_adocao, an.data_entrada, an.microchip, an.criado_em,
  s.vacina_pendente, s.vacinacao_status, s.proxima_vacina,
  s.castracao_status, s.castracao_agendada_para,
  s.em_tratamento
from public.animais an
join public.animal_saude s on s.animal_id = an.id
where an.excluido_em is null;

revoke all on public.animais_lista from anon, authenticated;
grant select on public.animais_lista to authenticated;

-- Os onze números do painel numa chamada. Estado atual ("sob cuidado agora" =
-- em acolhimento) e eventos do período (adoções, devoluções, devolução à
-- comunidade). Roda com a permissão de quem chama (RLS vale).
create function public.indicadores(p_de date default null, p_ate date default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_ate date := coalesce(p_ate, app.hoje());
  v_de date := coalesce(p_de, date_trunc('year', coalesce(p_ate, app.hoje()))::date);
  r jsonb;
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if v_de > v_ate then
    raise exception 'O início do período não pode ser depois do fim.';
  end if;

  with a as (select * from public.animais_lista),
  c as (select * from a where situacao = 'em_acolhimento')
  select jsonb_build_object(
    'de', v_de,
    'ate', v_ate,
    'total', (select count(*) from a),
    'sob_cuidado', (select count(*) from c),
    'caes', (select count(*) from a where especie = 'cao'),
    'caes_sob_cuidado', (select count(*) from c where especie = 'cao'),
    'gatos', (select count(*) from a where especie = 'gato'),
    'gatos_sob_cuidado', (select count(*) from c where especie = 'gato'),
    'machos', (select count(*) from a where sexo = 'macho'),
    'machos_sob_cuidado', (select count(*) from c where sexo = 'macho'),
    'femeas', (select count(*) from a where sexo = 'femea'),
    'femeas_sob_cuidado', (select count(*) from c where sexo = 'femea'),
    'vacinados', (select count(*) from c where not vacina_pendente),
    'vacinacao_pendente', (select count(*) from c where vacina_pendente),
    'castrados', (select count(*) from c where castracao_status = 'castrado'),
    'nao_castrados', (select count(*) from c where castracao_status = 'nao_castrado'),
    'castracao_agendada', (select count(*) from c where castracao_status = 'agendada'),
    'disponiveis', (select count(*) from c where disponivel_adocao),
    'na_sede', (select count(*) from c where local = 'sede'),
    'em_lar_temporario', (select count(*) from c where local = 'lar_temporario'),
    'em_tratamento', (select count(*) from c where em_tratamento),
    'adocoes', (
      select count(*) from public.adocoes ad join public.animais an on an.id = ad.animal_id
      where an.excluido_em is null and ad.data_adocao between v_de and v_ate),
    'devolucoes', (
      select count(*) from public.adocoes ad join public.animais an on an.id = ad.animal_id
      where an.excluido_em is null and ad.data_devolucao between v_de and v_ate),
    'devolvidos_comunidade', (
      select count(*) from public.movimentacoes m join public.animais an on an.id = m.animal_id
      where an.excluido_em is null and m.situacao = 'devolvido_comunidade' and m.data between v_de and v_ate)
  ) into r;
  return r;
end
$$;

-- Série mensal para os gráficos: entradas (entrada e reentrada), adoções e
-- devoluções à comunidade em cada mês do período.
create function public.indicadores_mensais(p_de date, p_ate date)
returns table (mes date, entradas int, adocoes int, devolvidos_comunidade int)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select app.papel()) is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'Período inválido.';
  end if;
  if p_ate > p_de + interval '5 years' then
    raise exception 'O período pode ter no máximo 5 anos.';
  end if;
  return query
  with meses as (
    select generate_series(date_trunc('month', p_de), date_trunc('month', p_ate), interval '1 month')::date as mes
  )
  select
    ms.mes,
    (select count(*)::int from public.movimentacoes m join public.animais an on an.id = m.animal_id
      where an.excluido_em is null and m.tipo in ('entrada', 'reentrada')
        and m.data between greatest(ms.mes, p_de) and least((ms.mes + interval '1 month - 1 day')::date, p_ate)),
    (select count(*)::int from public.adocoes ad join public.animais an on an.id = ad.animal_id
      where an.excluido_em is null
        and ad.data_adocao between greatest(ms.mes, p_de) and least((ms.mes + interval '1 month - 1 day')::date, p_ate)),
    (select count(*)::int from public.movimentacoes m join public.animais an on an.id = m.animal_id
      where an.excluido_em is null and m.situacao = 'devolvido_comunidade'
        and m.data between greatest(ms.mes, p_de) and least((ms.mes + interval '1 month - 1 day')::date, p_ate))
  from meses ms
  order by ms.mes;
end
$$;

-- Exportação de relatório fica na auditoria (sem conteúdo, só que houve).
create function public.registrar_exportacao(p_relatorio text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_relatorio is null or p_relatorio !~ '^[a-z_]{1,40}$' then
    raise exception 'Relatório inválido.';
  end if;
  perform app.registrar_acesso('relatorio_' || p_relatorio, null, 'exportacao');
end
$$;

revoke all on function
  public.indicadores(date, date),
  public.indicadores_mensais(date, date),
  public.registrar_exportacao(text)
from public, anon;
grant execute on function
  public.indicadores(date, date),
  public.indicadores_mensais(date, date),
  public.registrar_exportacao(text)
to authenticated;
