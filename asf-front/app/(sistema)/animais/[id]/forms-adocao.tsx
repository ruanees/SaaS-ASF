'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { EnvioArquivo } from '@/components/envio-arquivo';
import { PessoaSeletor } from '@/components/pessoa-seletor';
import { FORMA_ACOMPANHAMENTO } from '@/lib/rotulos';
import type { Adocao, PessoaResumo } from '@/lib/tipos';
import {
  abrirTermo,
  assinarTermo,
  registrarAcompanhamento,
  registrarAdocao,
  registrarDevolucao,
  registrarTermo,
  type EstadoAcao,
} from '../acoes-adocao';

function Mensagem({ estado }: { estado: EstadoAcao }) {
  if (estado.erro) {
    return (
      <p className="aviso" data-tipo="erro" role="alert">
        {estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="aviso" data-tipo="ok" role="status">
        {estado.ok}
      </p>
    );
  }
  return null;
}

// Sem rascunho no navegador (formulário de adoção; LGPD, regra 12).
export function FormAdocao({
  animalId,
  hoje,
  minimo,
  pessoas,
  pessoaInicial,
}: {
  animalId: string;
  hoje: string;
  minimo: string;
  pessoas: PessoaResumo[];
  pessoaInicial?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(registrarAdocao.bind(null, animalId), {});
  const voltar = encodeURIComponent(`/animais/${animalId}?aba=adocao`);
  return (
    <form action={acao} className="pilha">
      <h2>Registrar adoção</h2>
      <Mensagem estado={estado} />
      {pessoas.length === 0 ? (
        <p className="ajuda">Nenhuma pessoa cadastrada ainda.</p>
      ) : (
        <PessoaSeletor id="ad-pessoa" rotulo="Adotante" pessoas={pessoas} inicial={pessoaInicial} />
      )}
      <div>
        <Link className="botao" data-tipo="texto" href={`/pessoas/nova?vinculo=adotante&voltar=${voltar}`}>
          Cadastrar adotante
        </Link>
      </div>
      <div className="campo" style={{ maxWidth: 260 }}>
        <label htmlFor="ad-data">Data da adoção</label>
        <input id="ad-data" name="data" type="date" min={minimo} max={hoje} defaultValue={hoje} required />
      </div>
      <p className="ajuda">O animal passa para adotado. O termo assinado pode ser anexado depois.</p>
      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando || pessoas.length === 0}>
          {enviando ? 'Registrando…' : 'Registrar adoção'}
        </button>
      </div>
    </form>
  );
}

export function AcoesAdocao({ animalId, adocao, hoje }: { animalId: string; adocao: Adocao; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(
    registrarDevolucao.bind(null, adocao.id, animalId),
    {},
  );
  return (
    <div className="pilha">
      <div className="pilha" data-e="2">
        <span className="rotulo">Termo de adoção assinado</span>
        <EnvioArquivo
          id={adocao.id}
          rotulo="termo"
          existe={adocao.tem_termo}
          assinar={(tipo, tamanho) => assinarTermo(adocao.id, tipo, tamanho)}
          registrar={(caminho) => registrarTermo(adocao.id, animalId, caminho)}
          abrir={() => abrirTermo(adocao.id)}
        />
      </div>
      <details>
        <summary>Registrar devolução</summary>
        <form action={acao} className="pilha" style={{ marginTop: 'var(--e-3)' }}>
          <Mensagem estado={estado} />
          <div className="campo" style={{ maxWidth: 260 }}>
            <label htmlFor="dv-data">Data da devolução</label>
            <input id="dv-data" name="data" type="date" min={adocao.data_adocao} max={hoje} defaultValue={hoje} required />
          </div>
          <div className="campo">
            <label htmlFor="dv-motivo">Motivo</label>
            <input id="dv-motivo" name="motivo" maxLength={500} required />
          </div>
          <p className="ajuda">O animal volta para a sede, ainda não disponível para adoção.</p>
          <div>
            <button className="botao" type="submit" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Registrar devolução'}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

// Acompanhamento pós-adoção: visita, fotos e vídeos por WhatsApp, ligação.
export function FormAcompanhamento({
  animalId,
  adocao,
  hoje,
}: {
  animalId: string;
  adocao: Adocao;
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(
    registrarAcompanhamento.bind(null, adocao.id, animalId),
    {},
  );
  return (
    <details>
      <summary>Registrar acompanhamento</summary>
      <form action={acao} className="pilha" style={{ marginTop: 'var(--e-3)' }}>
        <Mensagem estado={estado} />
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor={`ac-data-${adocao.id}`}>Data</label>
            <input id={`ac-data-${adocao.id}`} name="data" type="date" min={adocao.data_adocao} max={adocao.data_devolucao ?? hoje} defaultValue={adocao.data_devolucao ?? hoje} required />
          </div>
          <div className="campo">
            <label htmlFor={`ac-forma-${adocao.id}`}>Como foi</label>
            <select id={`ac-forma-${adocao.id}`} name="forma" defaultValue="whatsapp" required>
              {Object.entries(FORMA_ACOMPANHAMENTO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor={`ac-obs-${adocao.id}`}>Como está o animal</label>
          <input id={`ac-obs-${adocao.id}`} name="observacoes" maxLength={1000} placeholder="Ex.: mandou vídeo, animal bem, castração marcada" />
        </div>
        <div>
          <button className="botao" type="submit" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar acompanhamento'}
          </button>
        </div>
      </form>
    </details>
  );
}
