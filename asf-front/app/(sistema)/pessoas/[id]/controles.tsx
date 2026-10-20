'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState, useTransition } from 'react';
import { formatarCpf } from '@/lib/formato';
import type { Contato } from '@/lib/tipos';
import { alterarContato, anonimizarPessoa, exportarDados, verContato, type EstadoAcao } from '../acoes';

// Contato: só aparece quando alguém pede, e cada pedido fica na auditoria.
export function ContatoPessoa({ id, pedeEndereco }: { id: string; pedeEndereco: boolean }) {
  const [contato, setContato] = useState<Contato>();
  const [erro, setErro] = useState<string>();
  const [carregando, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [estado, acao, salvando] = useActionState<EstadoAcao, FormData>(async (anterior, form) => {
    const r = await alterarContato(id, anterior, form);
    if (r.ok) {
      setContato({
        telefone: (form.get('telefone') as string).trim() || null,
        email: (form.get('email') as string).trim() || null,
        endereco: ((form.get('endereco') as string | null) ?? '').trim() || null,
        cpf: ((form.get('cpf') as string | null) ?? '').replace(/\D/g, '') || null,
        rg: ((form.get('rg') as string | null) ?? '').trim() || null,
        profissao: ((form.get('profissao') as string | null) ?? '').trim() || null,
      });
      setEditando(false);
    }
    return r;
  }, {});

  if (!contato) {
    return (
      <div className="pilha" data-e="2">
        {erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {erro}
          </p>
        )}
        <div>
          <button
            type="button"
            className="botao"
            disabled={carregando}
            onClick={() =>
              iniciar(async () => {
                const r = await verContato(id);
                if (r.contato) setContato(r.contato);
                else setErro(r.erro);
              })
            }
          >
            {carregando ? 'Abrindo…' : 'Ver contato'}
          </button>
        </div>
        <p className="ajuda">Abrir o contato fica registrado na auditoria.</p>
      </div>
    );
  }

  if (editando) {
    return (
      <form action={acao} className="pilha">
        {estado.erro && (
          <p className="aviso" data-tipo="erro" role="alert">
            {estado.erro}
          </p>
        )}
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="c-telefone">Telefone</label>
            <input id="c-telefone" name="telefone" type="tel" maxLength={30} defaultValue={contato.telefone ?? ''} />
          </div>
          <div className="campo">
            <label htmlFor="c-email">E-mail</label>
            <input id="c-email" name="email" type="email" maxLength={160} defaultValue={contato.email ?? ''} />
          </div>
        </div>
        {pedeEndereco && (
          <>
            <div className="campo">
              <label htmlFor="c-endereco">Endereço</label>
              <input id="c-endereco" name="endereco" maxLength={300} defaultValue={contato.endereco ?? ''} />
            </div>
            <div className="grade" data-n="3">
              <div className="campo">
                <label htmlFor="c-cpf">CPF</label>
                <input id="c-cpf" name="cpf" inputMode="numeric" maxLength={14} defaultValue={formatarCpf(contato.cpf)} />
              </div>
              <div className="campo">
                <label htmlFor="c-rg">Identidade (RG)</label>
                <input id="c-rg" name="rg" maxLength={30} defaultValue={contato.rg ?? ''} />
              </div>
              <div className="campo">
                <label htmlFor="c-profissao">Profissão</label>
                <input id="c-profissao" name="profissao" maxLength={80} defaultValue={contato.profissao ?? ''} />
              </div>
            </div>
          </>
        )}
        <div className="linha">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar contato'}
          </button>
          <button type="button" className="botao" data-tipo="texto" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="pilha" data-e="2">
      {estado.ok && (
        <p className="aviso" data-tipo="ok" role="status">
          {estado.ok}
        </p>
      )}
      <dl className="dados-impressao">
        <dt>Telefone</dt>
        <dd>{contato.telefone ?? 'não informado'}</dd>
        <dt>E-mail</dt>
        <dd>{contato.email ?? 'não informado'}</dd>
        {pedeEndereco && (
          <>
            <dt>Endereço</dt>
            <dd>{contato.endereco ?? 'não informado'}</dd>
            <dt>CPF</dt>
            <dd>{contato.cpf ? formatarCpf(contato.cpf) : 'não informado'}</dd>
            <dt>Identidade (RG)</dt>
            <dd>{contato.rg ?? 'não informado'}</dd>
            <dt>Profissão</dt>
            <dd>{contato.profissao ?? 'não informada'}</dd>
          </>
        )}
      </dl>
      <div className="linha">
        <button type="button" className="botao" onClick={() => setEditando(true)}>
          Corrigir contato
        </button>
        <button type="button" className="botao" data-tipo="texto" onClick={() => setContato(undefined)}>
          Esconder
        </button>
      </div>
    </div>
  );
}

// Direito de acesso do titular: baixa um JSON com tudo o que existe sobre a pessoa.
export function ExportarDados({ id }: { id: string }) {
  const [erro, setErro] = useState<string>();
  const [exportando, iniciar] = useTransition();
  return (
    <div className="pilha" data-e="2">
      <div>
        <button
          type="button"
          className="botao"
          disabled={exportando}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const r = await exportarDados(id);
              if (!r.json) {
                setErro(r.erro);
                return;
              }
              const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `dados-pessoa-${id.slice(0, 8)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          {exportando ? 'Preparando…' : 'Exportar dados da pessoa'}
        </button>
      </div>
      {erro && (
        <p className="aviso" data-tipo="erro" role="alert">
          {erro}
        </p>
      )}
      <p className="ajuda">Para atender um pedido da própria pessoa. A exportação fica registrada na auditoria.</p>
    </div>
  );
}

export function Anonimizar({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [confirmacao, setConfirmacao] = useState('');
  const [anonimizando, iniciar] = useTransition();

  return (
    <div className="pilha" data-e="2">
      {aviso && (
        <p className="aviso" data-tipo="info" role="status">
          {aviso}
        </p>
      )}
      <div>
        <button type="button" className="botao" data-tipo="perigo" onClick={() => dialogo.current?.showModal()}>
          Anonimizar pessoa
        </button>
      </div>
      <dialog ref={dialogo} className="cartao dialogo">
        <div className="pilha">
          <h2>Anonimizar {nome}?</h2>
          <p>
            O contato é apagado, o nome vira “Pessoa anonimizada” e o termo de adoção sai do armazenamento. As adoções
            continuam no histórico dos animais. Não dá para desfazer.
          </p>
          {erro && (
            <p className="aviso" data-tipo="erro" role="alert">
              {erro}
            </p>
          )}
          <div className="campo">
            <label htmlFor="an-confirma">Para confirmar, digite ANONIMIZAR</label>
            <input id="an-confirma" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          </div>
          <div className="linha">
            <button
              type="button"
              className="botao"
              data-tipo="perigo"
              disabled={confirmacao.trim().toUpperCase() !== 'ANONIMIZAR' || anonimizando}
              onClick={() =>
                iniciar(async () => {
                  setErro(undefined);
                  const r = await anonimizarPessoa(id);
                  if (r.erro) {
                    setErro(r.erro);
                    return;
                  }
                  dialogo.current?.close();
                  setAviso(r.aviso ?? 'Pessoa anonimizada.');
                  router.refresh();
                })
              }
            >
              {anonimizando ? 'Anonimizando…' : 'Anonimizar'}
            </button>
            <button type="button" className="botao" data-tipo="texto" onClick={() => dialogo.current?.close()}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
