'use client';

import { useActionState, useRef, useState } from 'react';
import { ORIGEM } from '@/lib/rotulos';
import type { Animal, Clinica } from '@/lib/tipos';
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
}: {
  local: string;
  setLocal: (l: string) => void;
  clinicas: Clinica[];
  clinicaAtual?: string;
}) {
  return (
    <>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rotulo-campo">Onde está</legend>
        <div className="linha">
          {(['sede', 'clinica'] as const).map((l) => (
            <label key={l} className="opcao">
              <input type="radio" name="local" value={l} checked={local === l} onChange={() => setLocal(l)} />
              {l === 'sede' ? 'Sede' : 'Clínica'}
            </label>
          ))}
          <span className="opcao" aria-disabled="true" data-em-breve>
            Lar temporário <span className="selo">em breve</span>
          </span>
        </div>
      </fieldset>
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

export function FormsSituacao({ animal, hoje, clinicas }: { animal: Animal; hoje: string; clinicas: Clinica[] }) {
  const registrar = registrarMovimentacao.bind(null, animal.id);
  const [mudanca, enviarMudanca, mudando] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [obito, enviarObito, registrandoObito] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [volta, enviarVolta, voltando] = useActionState<EstadoAcao, FormData>(registrar, {});
  const [local, setLocal] = useState<string>(animal.local ?? 'sede');
  const dialogoObito = useRef<HTMLDialogElement>(null);

  if (animal.situacao === 'obito') {
    return <p className="ajuda">Óbito é a situação final. O histórico continua disponível abaixo.</p>;
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
        <CamposLocal local={local} setLocal={setLocal} clinicas={clinicas} />
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
        <CamposLocal local={local} setLocal={setLocal} clinicas={clinicas} clinicaAtual={animal.clinica?.id} />
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
    </div>
  );
}
