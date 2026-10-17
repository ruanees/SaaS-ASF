-- 007 — Novo tipo de atendimento: antiparasitário externo (Simparic, Bravecto).
-- Em migração própria: um valor novo de enum só pode ser usado depois que a
-- transação que o criou terminar.
alter type public.tipo_atendimento add value if not exists 'antiparasitario';
