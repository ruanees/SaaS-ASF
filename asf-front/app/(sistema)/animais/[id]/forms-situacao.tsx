'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { PessoaSeletor } from '@/components/pessoa-seletor';
import { ORIGEM } from '@/lib/rotulos';
import type { Animal, Clinica, PessoaResumo } from '@/lib/tipos';
import { registrarMovimentacao, type EstadoAcao } from '../acoes';

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

function CamposLocal({
  local,
  setLocal,
  clinicas,
  clinicaAtual,
  lares,
  larAtual,
  coordena,
  voltar,
}: {
  local: string;
  setLocal: (l: string) => void;
  clinicas: Clinica[];
  clinicaAtual?: string;
  lares: PessoaResumo[];
  larAtual?: string;
  coordena: boolean;
  voltar: string;
}) {
  return (
    <>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rotulo-campo">Onde está</legend>
        <div className="linha">
          {(['sede', 'lar_temporario', 'clinica'] as const).map((l) => (
            <label key={l} className="opcao">
              <input type="radio" name="local" value={l} checked={local === l} onChange={() => setLocal(l)} />
              {l === 'sede' ? 'Sede' : l === 'clinica' ? 'Clínica' : 'Lar temporário'}
            </label>
          ))}
        </div>
      </fieldset>
      {local === 'lar_temporario' && (
        <div className="pilha" data-e="2">
          {lares.length === 0 ? (
            <p className="ajuda">Nenhum lar temporário cadastrado. A coordenação cadastra em Pessoas.</p>
          ) : (
            <PessoaSeletor id="m-lar" rotulo="Pessoa do lar temporário" pessoas={lares} inicial={larAtual} />
          )}
          {coordena && (
            <div>
              <Link className="botao" data-tipo="texto" href={`/pessoas/nova?vinculo=lar_temporario&voltar=${encodeURIComponent(voltar)}`}>
                Cadastrar lar temporário
              </Link>
            </div>
          )}
        </div>
      )}
      {local === 'clinica' && (
        <div className="campo">
          <label htmlFor="m-clinica">Clínica</label>
          <select id="m-clinica" name="clinica_id" defaultValue={clinicaAtual ?? ''}>
            <option value="">Não informada</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

export function FormsSituacao({
  animal,
  hoje,
  clinicas,
  lares,
  coordena,
}: {
  animal: Animal;
  hoje: string;
  clinicas: Clinica[];
  lares: PessoaResumo[];
  coordena: boolean;
}) {
  const registrar = registrarMovimentacao.bind(null, animal.id);
  const [mudanca, enviarMudanca, mudando] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [obito, enviarObito, registrandoObito] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [volta, enviarVolta, voltando] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [saida, enviarSaida, saindo] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [destinoSaida, setDestinoSaida] = useState<'transferido' | 'devolvido_comunidade'>('transferido');
  const voltar = `/animais/${animal.id}?aba=situacao`;
  const larProps = { lares, coordena, voltar };
  const [local, setLocal] = useState<string>(animal.local ?? 'sede');
  const dialogoObito = useRef<HTMLDialogElement>(null);

  if (animal.situacao === 'obito') {
    return <p className="ajuda">Óbito é a situação final. O histórico continua disponível abaixo.</p>;
  }

  const blocoObito = (
    <div className="pilha" data-e="2">
      <div>
        <button type="button" className="botao" data-tipo="perigo" onClick={() => dialogoObito.current?.showModal()}>
          Registrar óbito
        </button>
      </div>
      <dialog ref={dialogoObito} className="cartao dialogo">
        <form action={enviarObito} className="pilha">
          <h2>Registrar óbito</h2>
          <p>Óbito é a situação final: depois dele o animal não pode ser movido.</p>
          <Mensagem estado={obito} />
          <input type="hidden" name="situacao" value="obito" />
          <div className="campo">
            <label htmlFor="o-data">Data do óbito</label>
            <input id="o-data" name="data" type="date" max={hoje} min={animal.data_entrada} defaultValue={hoje} required />
          </div>
          <div className="campo">
            <label htmlFor="o-motivo">Causa ou observação</label>
            <input id="o-motivo" name="motivo" maxLength={500} />
          </div>
          <div className="linha">
            <button className="botao" data-tipo="perigo" type="submit" disabled={registrandoObito}>
              {registrandoObito ? 'Registrando…' : 'Registrar óbito'}
            </button>
            <button type="button" className="botao" data-tipo="texto" onClick={() => dialogoObito.current?.close()}>
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );

  // Adotado: volta pela devolução (aba Adoção); o óbito dele se registra aqui,
  // porque o acompanhamento vai até o fim da vida do animal.
  if (animal.situacao === 'adotado') {
    return (
      <div className="pilha">
        <p className="ajuda">
          Animal adotado. Se voltar, registre a devolução na aba <Link href={`/animais/${animal.id}?aba=adocao`}>Adoção</Link>.
          Se morrer com o adotante, registre o óbito aqui.
        </p>
        {blocoObito}
      </div>
    );
  }

  // Saiu da associação (devolvido à comunidade ou transferido): pode voltar.
  if (animal.situacao !== 'em_acolhimento') {
    return (
      <form action={enviarVolta} className="pilha">
        <h3>Registrar reentrada</h3>
        <p className="ajuda">O animal volta com o mesmo número e o mesmo histórico.</p>
        <Mensagem estado={volta} />
        <input type="hidden" name="tipo" value="reentrada" />
        <input type="hidden" name="situacao" value="em_acolhimento" />
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="r-origem">Origem da volta</label>
            <select id="r-origem" name="origem" required defaultValue="">
              <option value="">Escolha</option>
              {Object.entries(ORIGEM).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="r-data">Data</label>
            <input id="r-data" name="data" type="date" max={hoje} defaultValue={hoje} required />
          </div>
        </div>
        <CamposLocal local={local} setLocal={setLocal} clinicas={clinicas} {...larProps} />
        <div className="campo">
          <label htmlFor="r-motivo">Motivo</label>
          <input id="r-motivo" name="motivo" maxLength={500} />
        </div>
        <div>
          <button className="botao" data-tipo="principal" type="submit" disabled={voltando}>
            {voltando ? 'Registrando…' : 'Registrar reentrada'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="pilha" data-e="5">
      <form action={enviarMudanca} className="pilha">
        <h3>Registrar mudança</h3>
        <Mensagem estado={mudanca} />
        <input type="hidden" name="situacao" value="em_acolhimento" />
        <CamposLocal
          local={local}
          setLocal={setLocal}
          clinicas={clinicas}
          clinicaAtual={animal.clinica?.id}
          larAtual={animal.responsavel?.id}
          {...larProps}
        />
        <label className="opcao">
          <input type="checkbox" name="disponivel_adocao" value="sim" defaultChecked={animal.disponivel_adocao} />
          Disponível para adoção
        </label>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="m-data">Data</label>
            <input id="m-data" name="data" type="date" max={hoje} min={animal.data_entrada} defaultValue={hoje} required />
          </div>
          <div className="campo">
            <label htmlFor="m-motivo">Motivo</label>
            <input id="m-motivo" name="motivo" maxLength={500} placeholder="Consulta, alta, cirurgia..." />
          </div>
        </div>
        <div>
          <button className="botao" data-tipo="principal" type="submit" disabled={mudando}>
            {mudando ? 'Registrando…' : 'Registrar mudança'}
          </button>
        </div>
      </form>

      <form action={enviarSaida} className="pilha">
        <h3>Registrar saída</h3>
        <p className="ajuda">
          Adoção é registrada na aba <Link href={`/animais/${animal.id}?aba=adocao`}>Adoção</Link>.
        </p>
        <Mensagem estado={saida} />
        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="rotulo-campo">Para onde foi</legend>
          <div className="linha">
            <label className="opcao">
              <input
                type="radio"
                name="situacao"
                value="transferido"
                checked={destinoSaida === 'transferido'}
                onChange={() => setDestinoSaida('transferido')}
              />
              Transferido para outra entidade
            </label>
            <label className="opcao">
              <input
                type="radio"
                name="situacao"
                value="devolvido_comunidade"
                checked={destinoSaida === 'devolvido_comunidade'}
                onChange={() => setDestinoSaida('devolvido_comunidade')}
              />
              Devolvido à comunidade
            </label>
          </div>
        </fieldset>
        {destinoSaida === 'devolvido_comunidade' && animal.castracao_status !== 'castrado' && (
          <p className="aviso" data-tipo="info">
            Devolução à comunidade exige castração realizada. Registre a castração na aba{' '}
            <Link href={`/animais/${animal.id}?aba=saude`}>Saúde</Link> antes.
          </p>
        )}
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="s-destino">{destinoSaida === 'transferido' ? 'Entidade' : 'Bairro ou rua onde foi solto'}</label>
            <input id="s-destino" name="destino" maxLength={200} required list={destinoSaida === 'transferido' ? 's-entidades' : undefined} />
            <datalist id="s-entidades">
              <option value="Ibama" />
              <option value="Instituto Pró-Silvestre" />
            </datalist>
          </div>
          <div className="campo">
            <label htmlFor="s-data">Data</label>
            <input id="s-data" name="data" type="date" max={hoje} min={animal.data_entrada} defaultValue={hoje} required />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="s-motivo">Observação</label>
          <input id="s-motivo" name="motivo" maxLength={500} />
        </div>
        <div>
          <button className="botao" type="submit" disabled={saindo}>
            {saindo ? 'Registrando…' : 'Registrar saída'}
          </button>
        </div>
      </form>

      {blocoObito}
    </div>
  );
}
