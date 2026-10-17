'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState } from 'react';
import { EXAMES_COMUNS, RESULTADO } from '@/lib/rotulos';
import type { Atendimento, Clinica } from '@/lib/tipos';
import {
  abrirLaudo,
  assinarLaudo,
  encerrar,
  registrarAtendimento,
  registrarLaudo,
  registrarResultado,
  type EstadoAcao,
} from '../acoes-prontuario';

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

const TIPOS = [
  ['consulta', 'Consulta'],
  ['retorno', 'Retorno'],
  ['exame', 'Exame'],
  ['teste', 'Teste'],
  ['tratamento', 'Tratamento'],
  ['internacao', 'Internação'],
  ['obito', 'Óbito'],
] as const;

const TESTES = ['Leishmaniose (calazar)', '4DX', 'FIV/FeLV', 'Cinomose', 'Parvovirose'];
const METODOS = ['Teste rápido', 'ELISA', 'RIFI', 'PCR'];

// Formulário único: os campos mudam conforme o tipo escolhido.
export function FormAtendimento({ animalId, hoje, clinicas }: { animalId: string; hoje: string; clinicas: Clinica[] }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(registrarAtendimento.bind(null, animalId), {});
  const [tipo, setTipo] = useState<string>('consulta');
  const [exame, setExame] = useState('');
  const atalhos = tipo === 'teste' ? TESTES : EXAMES_COMUNS.filter((e) => !TESTES.includes(e));

  return (
    <form action={acao} className="pilha">
      <h2>Registrar atendimento</h2>
      <Mensagem estado={estado} />
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="at-tipo">Tipo</label>
          <select id="at-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="at-data">{tipo === 'internacao' ? 'Entrada' : tipo === 'tratamento' ? 'Início' : 'Data'}</label>
          <input id="at-data" name="data" type="date" max={hoje} defaultValue={hoje} required />
        </div>
        <div className="campo">
          <label htmlFor="at-clinica">Clínica</label>
          <select id="at-clinica" name="clinica_id" defaultValue="">
            <option value="">Não informada</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(tipo === 'exame' || tipo === 'teste') && (
        <div className="pilha" data-e="2">
          <div className="linha" style={{ gap: 'var(--e-2)' }}>
            {atalhos.map((n) => (
              <button key={n} type="button" className="selo" data-contorno={exame === n ? undefined : ''} onClick={() => setExame(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="grade" data-n="3">
            <div className="campo">
              <label htmlFor="at-exame">{tipo === 'teste' ? 'Teste' : 'Exame'}</label>
              <input id="at-exame" name="exame_nome" value={exame} onChange={(e) => setExame(e.target.value)} maxLength={80} required />
            </div>
            <div className="campo">
              <label htmlFor="at-metodo">Método</label>
              <input id="at-metodo" name="exame_metodo" list="at-metodos" maxLength={60} />
              <datalist id="at-metodos">
                {METODOS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="campo">
              <label htmlFor="at-resultado">Resultado</label>
              <select id="at-resultado" name="exame_resultado" defaultValue="aguardando">
                {Object.entries(RESULTADO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="at-exame-detalhe">Detalhe do resultado</label>
            <input id="at-exame-detalhe" name="exame_detalhe" maxLength={2000} placeholder="Ex.: plaquetas baixas, ALT alta" />
          </div>
        </div>
      )}

      {tipo === 'tratamento' && (
        <div className="grade" data-n="4">
          <div className="campo">
            <label htmlFor="at-med">Medicamento</label>
            <input id="at-med" name="medicamento" maxLength={120} required />
          </div>
          <div className="campo">
            <label htmlFor="at-dose">Dose</label>
            <input id="at-dose" name="dose" maxLength={80} />
          </div>
          <div className="campo">
            <label htmlFor="at-freq">Frequência</label>
            <input id="at-freq" name="frequencia" maxLength={80} placeholder="12/12 h por 7 dias" />
          </div>
          <div className="campo">
            <label htmlFor="at-fim">Fim (se já terminou)</label>
            <input id="at-fim" name="fim" type="date" max={hoje} />
          </div>
        </div>
      )}

      {tipo === 'internacao' && (
        <div className="campo" style={{ maxWidth: 260 }}>
          <label htmlFor="at-alta">Alta (se já teve)</label>
          <input id="at-alta" name="alta" type="date" max={hoje} />
        </div>
      )}

      {tipo === 'obito' && (
        <p className="aviso" data-tipo="info">
          Óbito é a situação final: o animal passa para óbito e não pode mais ser movido.
        </p>
      )}

      <div className="grade" data-n="2">
        <div className="campo">
          <label htmlFor="at-vet">Veterinário (nome e CRMV)</label>
          <input id="at-vet" name="veterinario" maxLength={160} />
        </div>
        <div className="campo">
          <label htmlFor="at-diag">{tipo === 'obito' ? 'Causa' : 'Diagnóstico ou queixa'}</label>
          <input id="at-diag" name="diagnostico" maxLength={4000} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="at-obs">Observações</label>
        <textarea id="at-obs" name="observacoes" rows={2} maxLength={2000} />
      </div>
      <div>
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : tipo === 'obito' ? 'Registrar óbito' : 'Registrar atendimento'}
        </button>
      </div>
    </form>
  );
}

// Ações de um item da linha do tempo: resultado pendente, fim de tratamento,
// alta e laudo.
export function AcoesItem({ animalId, atendimento, hoje }: { animalId: string; atendimento: Atendimento; hoje: string }) {
  const id = atendimento.id;
  const [resultado, enviarResultado, salvandoResultado] = useActionState<EstadoAcao, FormData>(
    registrarResultado.bind(null, id, animalId),
    {},
  );
  const [fim, enviarFim, salvandoFim] = useActionState<EstadoAcao, FormData>(encerrar.bind(null, 'fim-tratamento', id, animalId), {});
  const [alta, enviarAlta, salvandoAlta] = useActionState<EstadoAcao, FormData>(encerrar.bind(null, 'alta', id, animalId), {});

  return (
    <span className="pilha" data-e="2">
      {atendimento.exame?.resultado === 'aguardando' && (
        <form action={enviarResultado} className="linha" style={{ alignItems: 'flex-end' }}>
          <Mensagem estado={resultado} />
          <div className="campo">
            <label htmlFor={`r-${id}`}>Resultado</label>
            <select id={`r-${id}`} name="resultado" defaultValue="">
              <option value="">Escolha</option>
              {Object.entries(RESULTADO)
                .filter(([v]) => v !== 'aguardando')
                .map(([v, r]) => (
                  <option key={v} value={v}>
                    {r.rotulo}
                  </option>
                ))}
            </select>
          </div>
          <div className="campo" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={`rd-${id}`}>Detalhe</label>
            <input id={`rd-${id}`} name="detalhe" maxLength={2000} />
          </div>
          <input type="hidden" name="data" value={hoje} />
          <button className="botao" type="submit" disabled={salvandoResultado}>
            Registrar resultado
          </button>
        </form>
      )}
      {atendimento.tratamento && !atendimento.tratamento.fim && (
        <form action={enviarFim} className="linha" style={{ alignItems: 'flex-end' }}>
          <Mensagem estado={fim} />
          <div className="campo">
            <label htmlFor={`f-${id}`}>Fim do tratamento</label>
            <input id={`f-${id}`} name="data" type="date" max={hoje} min={atendimento.tratamento.inicio} defaultValue={hoje} />
          </div>
          <button className="botao" type="submit" disabled={salvandoFim}>
            Encerrar tratamento
          </button>
        </form>
      )}
      {atendimento.internacao && !atendimento.internacao.alta && (
        <form action={enviarAlta} className="linha" style={{ alignItems: 'flex-end' }}>
          <Mensagem estado={alta} />
          <div className="campo">
            <label htmlFor={`a-${id}`}>Data da alta</label>
            <input id={`a-${id}`} name="data" type="date" max={hoje} min={atendimento.internacao.entrada} defaultValue={hoje} />
          </div>
          <button className="botao" type="submit" disabled={salvandoAlta}>
            Registrar alta
          </button>
        </form>
      )}
      {atendimento.exame && <Laudo animalId={animalId} atendimentoId={id} temLaudo={atendimento.exame.tem_laudo} />}
    </span>
  );
}

function Laudo({ animalId, atendimentoId, temLaudo }: { animalId: string; atendimentoId: string; temLaudo: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'abrindo'>('parado');
  const [erro, setErro] = useState<string>();

  async function enviar(arquivo: File) {
    setErro(undefined);
    const tipo = arquivo.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(tipo)) {
      setErro('O laudo precisa ser PDF ou imagem.');
      return;
    }
    setEstado('enviando');
    try {
      const assinada = await assinarLaudo(atendimentoId, tipo, arquivo.size);
      if (assinada.erro || !assinada.url || !assinada.caminho) throw new Error(assinada.erro ?? 'Não foi possível enviar.');
      const r = await fetch(assinada.url, { method: 'PUT', headers: { 'Content-Type': tipo }, body: arquivo });
      if (!r.ok) throw new Error('Sem conexão. O laudo não foi enviado; tente de novo.');
      const registro = await registrarLaudo(atendimentoId, animalId, assinada.caminho);
      if (registro.erro) throw new Error(registro.erro);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message === 'Failed to fetch' ? 'Sem conexão. O laudo não foi enviado; tente de novo.' : (e as Error).message);
    } finally {
      setEstado('parado');
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function abrir() {
    setErro(undefined);
    setEstado('abrindo');
    const r = await abrirLaudo(atendimentoId);
    setEstado('parado');
    if (r.url) window.open(r.url, '_blank', 'noopener');
    else setErro(r.erro);
  }

  return (
    <span className="linha" style={{ gap: 'var(--e-2)' }}>
      {temLaudo && (
        <button type="button" className="botao" data-tipo="texto" onClick={abrir} disabled={estado !== 'parado'}>
          {estado === 'abrindo' ? 'Abrindo…' : 'Abrir laudo'}
        </button>
      )}
      <input
        ref={entrada}
        id={`laudo-${atendimentoId}`}
        type="file"
        accept="application/pdf,image/*"
        className="visualmente-oculto"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />
      <label htmlFor={`laudo-${atendimentoId}`} className="botao" data-tipo="texto" aria-disabled={estado !== 'parado'}>
        {estado === 'enviando' ? 'Enviando laudo…' : temLaudo ? 'Trocar laudo' : 'Anexar laudo'}
      </label>
      {erro && (
        <span className="aviso" data-tipo="erro" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}
