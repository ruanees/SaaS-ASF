'use client';

import { useActionState, useState } from 'react';
import { AvisoPrivacidade } from '@/components/aviso-privacidade';
import { BASE_LEGAL, BASE_SUGERIDA, VINCULO } from '@/lib/rotulos';
import type { BaseLegal, Vinculo } from '@/lib/tipos';
import { alterarPessoa, cadastrarPessoa, type EstadoAcao } from './acoes';

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

function CamposVinculo({
  vinculos,
  setVinculos,
  base,
  setBase,
}: {
  vinculos: Vinculo[];
  setVinculos: (v: Vinculo[]) => void;
  base: BaseLegal | '';
  setBase: (b: BaseLegal) => void;
}) {
  return (
    <>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rotulo-campo">Vínculo com a associação</legend>
        <div className="linha">
          {(Object.keys(VINCULO) as Vinculo[]).map((v) => (
            <label key={v} className="opcao">
              <input
                type="checkbox"
                name="vinculos"
                value={v}
                checked={vinculos.includes(v)}
                onChange={(e) => {
                  const novo = e.target.checked ? [...vinculos, v] : vinculos.filter((x) => x !== v);
                  setVinculos(novo);
                  if (e.target.checked && !base) setBase(BASE_SUGERIDA[v]);
                }}
              />
              {VINCULO[v]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="campo">
        <label htmlFor="p-base">Base legal (LGPD)</label>
        <select id="p-base" name="base_legal" value={base} onChange={(e) => setBase(e.target.value as BaseLegal)} required>
          <option value="">Escolha</option>
          {Object.entries(BASE_LEGAL).map(([b, r]) => (
            <option key={b} value={b}>
              {r.rotulo}
            </option>
          ))}
        </select>
        <span className="ajuda">{base ? BASE_LEGAL[base].ajuda : 'Por que a associação pode guardar estes dados.'}</span>
      </div>
    </>
  );
}

// Sem rascunho no navegador: formulário de pessoa tem dado pessoal (LGPD, regra 12).
export function FormNovaPessoa({ vinculoInicial, voltar }: { vinculoInicial?: Vinculo; voltar?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(cadastrarPessoa.bind(null, voltar), {});
  const [vinculos, setVinculos] = useState<Vinculo[]>(vinculoInicial ? [vinculoInicial] : []);
  const [base, setBase] = useState<BaseLegal | ''>(vinculoInicial ? BASE_SUGERIDA[vinculoInicial] : '');
  // Campos na memória da tela (o React limpa o formulário depois da ação); nunca no navegador.
  const [v, setV] = useState<Record<string, string>>({});
  const campo = (nome: string) => ({
    name: nome,
    value: v[nome] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((atual) => ({ ...atual, [nome]: e.target.value })),
  });
  // Endereço só para quem fica com o animal (minimização).
  const pedeEndereco = vinculos.length > 0;

  return (
    <form action={acao} className="pilha" data-e="5" autoComplete="off">
      <AvisoPrivacidade />
      <Mensagem estado={estado} />
      <section className="cartao pilha">
        <h2>Quem é</h2>
        <div className="campo">
          <label htmlFor="p-nome">Nome</label>
          <input id="p-nome" {...campo('nome')} maxLength={120} required />
        </div>
        <CamposVinculo vinculos={vinculos} setVinculos={setVinculos} base={base} setBase={setBase} />
      </section>

      <section className="cartao pilha">
        <h2>Contato</h2>
        <p className="ajuda">Só a administração e a coordenação veem estes dados.</p>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="p-telefone">Telefone</label>
            <input id="p-telefone" {...campo('telefone')} type="tel" inputMode="tel" maxLength={30} placeholder="(88) 90000-0000" />
          </div>
          <div className="campo">
            <label htmlFor="p-email">E-mail</label>
            <input id="p-email" {...campo('email')} type="email" maxLength={160} />
          </div>
        </div>
        {pedeEndereco ? (
          <div className="campo">
            <label htmlFor="p-endereco">Endereço</label>
            <input id="p-endereco" {...campo('endereco')} maxLength={300} placeholder="Rua, número, bairro, cidade" />
          </div>
        ) : (
          <p className="ajuda">O endereço aparece ao escolher o vínculo.</p>
        )}
      </section>

      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Cadastrar pessoa'}
        </button>
      </div>
    </form>
  );
}

export function FormAlterarPessoa({
  id,
  nome,
  vinculos: iniciais,
  base: baseInicial,
}: {
  id: string;
  nome: string;
  vinculos: Vinculo[];
  base: BaseLegal;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(alterarPessoa.bind(null, id), {});
  const [vinculos, setVinculos] = useState<Vinculo[]>(iniciais);
  const [base, setBase] = useState<BaseLegal | ''>(baseInicial);
  return (
    <form action={acao} className="pilha">
      <h2>Dados</h2>
      <Mensagem estado={estado} />
      <div className="campo">
        <label htmlFor="pa-nome">Nome</label>
        <input id="pa-nome" name="nome" maxLength={120} defaultValue={nome} required />
      </div>
      <CamposVinculo vinculos={vinculos} setVinculos={setVinculos} base={base} setBase={setBase} />
      <div>
        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar dados'}
        </button>
      </div>
    </form>
  );
}
