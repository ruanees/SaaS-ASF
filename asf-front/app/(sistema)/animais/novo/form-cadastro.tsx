'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { nascimentoEstimado } from '@/lib/formato';
import { EXAMES_COMUNS, ORIGEM, PORTE, SEXO, SITUACAO } from '@/lib/rotulos';
import type { Clinica, Duplicado } from '@/lib/tipos';
import { cadastrarAnimal, procurarDuplicados, type EstadoAcao } from '../acoes';

// Rascunho no aparelho: conexão ruim não apaga o que foi digitado.
// (Permitido aqui; nunca nos formulários de pessoa e adoção.)
const CHAVE_RASCUNHO = 'asf-rascunho-animal';
const UNIDADES = { semanas: 'semanas', meses: 'meses', anos: 'anos' } as const;

type Valores = Record<string, string>;

function lerRascunho(): Valores {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) ?? '{}') as Valores;
  } catch {
    return {};
  }
}

export function FormCadastro({ hoje, clinicas, clinico }: { hoje: string; clinicas: Clinica[]; clinico: boolean }) {
  const inicial: Valores = { data_entrada: hoje, local: 'sede', unidade: 'anos' };
  const [v, setV] = useState<Valores>(inicial);
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(cadastrarAnimal, {});
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  const [conferindo, iniciarConferencia] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const confirmado = useRef(false);

  // Restaura o rascunho depois de montar (no servidor não existe localStorage).
  useEffect(() => {
    const r = lerRascunho();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restauração única do rascunho do aparelho
    if (Object.keys(r).length > 0) setV((atual) => ({ ...atual, ...r }));
  }, []);

  function mudar(nome: string, valor: string) {
    setV((atual) => {
      const novo = { ...atual, [nome]: valor };
      try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(novo));
      } catch {
        // sem armazenamento: segue sem rascunho
      }
      return novo;
    });
    if (['nome', 'especie', 'sexo'].includes(nome)) setDuplicados(null);
  }

  const exames = (v.exames ?? '').split('|').filter(Boolean);
  function alternarExame(nome: string) {
    mudar('exames', (exames.includes(nome) ? exames.filter((e) => e !== nome) : [...exames, nome]).join('|'));
  }

  const quantidade = Number(v.quantidade);
  const nascimento =
    v.quantidade && quantidade > 0
      ? nascimentoEstimado(quantidade, (v.unidade ?? 'anos') as keyof typeof UNIDADES, hoje)
      : '';

  // Antes de salvar, procura animal parecido (mesmo nome, espécie e sexo).
  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (confirmado.current || !v.nome?.trim() || !v.especie || !v.sexo) {
      try {
        localStorage.removeItem(CHAVE_RASCUNHO);
      } catch {}
      return; // segue o envio normal para a server action
    }
    e.preventDefault();
    iniciarConferencia(async () => {
      const achados = await procurarDuplicados(v.nome, v.especie, v.sexo);
      if (achados.length === 0) {
        confirmado.current = true;
        form.current?.requestSubmit();
      } else {
        setDuplicados(achados);
      }
    });
  }

  const radio = (nome: string, opcoes: Record<string, string>, rotulo: string) => (
    <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="rotulo-campo">{rotulo}</legend>
      <div className="linha">
        {Object.entries(opcoes).map(([valor, texto]) => (
          <label key={valor} className="opcao">
            <input type="radio" name={nome} value={valor} checked={v[nome] === valor} onChange={() => mudar(nome, valor)} required />
            {texto}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form ref={form} action={acao} onSubmit={aoEnviar} className="pilha" data-e="5" noValidate>
      {estado.erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <section className="cartao pilha">
        <h2>Quem é</h2>
        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" value={v.nome ?? ''} onChange={(e) => mudar('nome', e.target.value)} maxLength={80} autoComplete="off" />
          <span className="ajuda">Sem nome, o animal é chamado pelo número.</span>
        </div>
        {radio('especie', { cao: 'Cão', gato: 'Gato' }, 'Espécie')}
        {radio('sexo', { macho: 'Macho', femea: 'Fêmea', nao_identificado: 'Não identificado' }, 'Sexo')}
        <div className="grade" data-n="3">
          <div className="campo">
            <label htmlFor="quantidade">Idade hoje (aproximada)</label>
            <input id="quantidade" type="number" inputMode="numeric" min={1} max={300} value={v.quantidade ?? ''} onChange={(e) => mudar('quantidade', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="unidade">Em</label>
            <select id="unidade" value={v.unidade ?? 'anos'} onChange={(e) => mudar('unidade', e.target.value)}>
              {Object.entries(UNIDADES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="porte">Porte</label>
            <select id="porte" name="porte" value={v.porte ?? ''} onChange={(e) => mudar('porte', e.target.value)}>
              <option value="">Não informado</option>
              {Object.entries(PORTE).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <input type="hidden" name="nascimento_estimado" value={nascimento} />
        <input type="hidden" name="idade_precisao" value={nascimento ? 'aproximada' : ''} />
      </section>

      <section className="cartao pilha">
        <h2>Entrada</h2>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="data_entrada">Data de entrada</label>
            <input id="data_entrada" name="data_entrada" type="date" max={hoje} value={v.data_entrada ?? hoje} onChange={(e) => mudar('data_entrada', e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="origem">Origem</label>
            <select id="origem" name="origem" value={v.origem ?? ''} onChange={(e) => mudar('origem', e.target.value)} required>
              <option value="">Escolha</option>
              {Object.entries(ORIGEM).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        {v.origem === 'outra' && (
          <div className="campo">
            <label htmlFor="origem_detalhe">Qual foi a origem</label>
            <input id="origem_detalhe" name="origem_detalhe" value={v.origem_detalhe ?? ''} onChange={(e) => mudar('origem_detalhe', e.target.value)} maxLength={200} required />
          </div>
        )}
      </section>

      <section className="cartao pilha">
        <h2>Onde está agora</h2>
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="rotulo-campo">Local</legend>
          <div className="linha">
            {(['sede', 'clinica'] as const).map((l) => (
              <label key={l} className="opcao">
                <input type="radio" name="local" value={l} checked={v.local === l} onChange={() => mudar('local', l)} />
                {l === 'sede' ? 'Sede' : 'Clínica'}
              </label>
            ))}
            <span className="opcao" aria-disabled="true" data-em-breve>
              Lar temporário <span className="selo">em breve</span>
            </span>
          </div>
        </fieldset>
        {v.local === 'clinica' && (
          <div className="campo">
            <label htmlFor="clinica_id">Clínica</label>
            <select id="clinica_id" name="clinica_id" value={v.clinica_id ?? ''} onChange={(e) => mudar('clinica_id', e.target.value)}>
              <option value="">Não informada</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {clinicas.length === 0 && <span className="ajuda">Nenhuma clínica cadastrada. A administração cadastra em Configurações.</span>}
          </div>
        )}
        <label className="opcao">
          <input type="checkbox" name="disponivel_adocao" value="sim" checked={v.disponivel_adocao === 'sim'} onChange={(e) => mudar('disponivel_adocao', e.target.checked ? 'sim' : '')} />
          Disponível para adoção
        </label>
        <div className="campo">
          <label htmlFor="observacoes">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={3} maxLength={2000} value={v.observacoes ?? ''} onChange={(e) => mudar('observacoes', e.target.value)} />
        </div>
      </section>

      <section className="cartao pilha">
        <h2>Saúde na entrada</h2>
        <div className="campo">
          <label htmlFor="condicao_entrada">Como chegou</label>
          <textarea
            id="condicao_entrada"
            name="condicao_entrada"
            rows={2}
            maxLength={2000}
            placeholder="Ex.: sarna generalizada, magro, ferida na pata"
            value={v.condicao_entrada ?? ''}
            onChange={(e) => mudar('condicao_entrada', e.target.value)}
          />
        </div>
        {clinico ? (
          <>
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="rotulo-campo">Exames pedidos</legend>
              <div className="linha">
                {EXAMES_COMUNS.map((n) => (
                  <label key={n} className="opcao">
                    <input type="checkbox" name="exames" value={n} checked={exames.includes(n)} onChange={() => alternarExame(n)} />
                    {n}
                  </label>
                ))}
              </div>
              <span className="ajuda">Entram no prontuário aguardando resultado.</span>
            </fieldset>
            <div className="grade" data-n="3">
              <div className="campo">
                <label htmlFor="medicamento">Medicamento iniciado</label>
                <input id="medicamento" name="medicamento" maxLength={120} value={v.medicamento ?? ''} onChange={(e) => mudar('medicamento', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="dose">Dose</label>
                <input id="dose" name="dose" maxLength={80} value={v.dose ?? ''} onChange={(e) => mudar('dose', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="frequencia">Frequência</label>
                <input id="frequencia" name="frequencia" maxLength={80} value={v.frequencia ?? ''} onChange={(e) => mudar('frequencia', e.target.value)} />
              </div>
            </div>
          </>
        ) : (
          <p className="ajuda">Exames e tratamentos são registrados depois, no prontuário, pela equipe clínica.</p>
        )}
      </section>

      {duplicados && duplicados.length > 0 && (
        <section className="cartao pilha" aria-live="polite">
          <h2>Este animal já pode estar cadastrado</h2>
          <p>Antes de criar um cadastro novo, confira se é um destes. Se for, registre a volta dele na ficha (reentrada).</p>
          <ul className="pilha" data-e="2" style={{ margin: 0, paddingLeft: 'var(--e-4)' }}>
            {duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/animais/${d.id}`} target="_blank">
                  {d.nome ?? d.numero} · {d.numero}
                </Link>{' '}
                <span className="ajuda">
                  {SEXO[d.sexo]} · {SITUACAO[d.situacao].rotulo}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <button
              type="button"
              className="botao"
              onClick={() => {
                confirmado.current = true;
                form.current?.requestSubmit();
              }}
            >
              Não é nenhum destes. Cadastrar
            </button>
          </div>
        </section>
      )}

      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando || conferindo}>
          {enviando ? 'Salvando…' : conferindo ? 'Conferindo cadastro…' : 'Cadastrar animal'}
        </button>
      </div>
    </form>
  );
}
