'use client';

import { useActionState, useState, useTransition } from 'react';
import { fd } from '@/lib/formato';
import type { Clinica, EstadoSaude, SaudeAnimal, VacinaTipo } from '@/lib/tipos';
import {
  castracao,
  registrarAntiparasitario,
  registrarVacina,
  registrarVermifugacao,
  sugerirProximaDose,
  type EstadoAcao,
} from '../acoes-saude';

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

function SeletorClinica({ clinicas, id }: { clinicas: Clinica[]; id: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>Clínica</label>
      <select id={id} name="clinica_id" defaultValue="">
        <option value="">Não informada</option>
        {clinicas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

// Vacina: ao escolher, a próxima dose é sugerida pelo reforço do catálogo; a
// pessoa pode alterar.
export function FormVacina({
  animalId,
  hoje,
  vacinas,
  clinicas,
}: {
  animalId: string;
  hoje: string;
  vacinas: VacinaTipo[];
  clinicas: Clinica[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(registrarVacina.bind(null, animalId), {});
  const [aberto, setAberto] = useState(false);
  const [vacinaId, setVacinaId] = useState('');
  const [data, setData] = useState(hoje);
  const [proxima, setProxima] = useState('');
  const vacina = vacinas.find((v) => v.id === vacinaId);
  const [sugerindo, iniciarSugestao] = useTransition();

  // O banco conta as doses que o animal já tomou: 1ª e 2ª sugerem o intervalo
  // inicial (21 dias), a 3ª sugere o reforço anual.
  function sugerir(id: string, aplicacao: string) {
    if (!id || !aplicacao) return setProxima('');
    iniciarSugestao(async () => {
      setProxima((await sugerirProximaDose(animalId, 'vacina', aplicacao, { vacina_tipo_id: id })) ?? '');
    });
  }

  if (vacinas.length === 0) {
    return (
      <p className="ajuda">
        O catálogo de vacinas ainda está vazio. A administração ou a coordenação cadastra em Configurações.
      </p>
    );
  }

  if (!aberto) {
    return (
      <div className="pilha" data-e="2">
        <Mensagem estado={estado} />
        <div>
          <button type="button" className="botao" onClick={() => setAberto(true)}>
            Registrar vacina
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={acao} className="pilha">
      <h3>Registrar vacina</h3>
      <Mensagem estado={estado} />
      <input type="hidden" name="vacina_nome" value={vacina?.nome ?? ''} />
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="v-vacina">Vacina</label>
          <select
            id="v-vacina"
            name="vacina_tipo_id"
            value={vacinaId}
            onChange={(e) => {
              setVacinaId(e.target.value);
              sugerir(e.target.value, data);
            }}
            required
          >
            <option value="">Escolha</option>
            {vacinas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="v-data">Aplicação</label>
          <input
            id="v-data"
            name="data"
            type="date"
            max={hoje}
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              sugerir(vacinaId, e.target.value);
            }}
            required
          />
          <span className="ajuda">Pode ser antes da entrada (carteirinha de origem).</span>
        </div>
        <div className="campo">
          <label htmlFor="v-proxima">Próxima dose</label>
          <input id="v-proxima" name="proxima_dose" type="date" min={data} value={proxima} onChange={(e) => setProxima(e.target.value)} />
          <span className="ajuda">
            {sugerindo
              ? 'Calculando a sugestão…'
              : vacina && vacina.doses_iniciais > 1
                ? `Sugerida pelo protocolo: ${vacina.doses_iniciais} doses a cada ${vacina.intervalo_inicial_dias} dias, depois reforço.`
                : vacina?.reforco_dias
                  ? `Sugerida pelo reforço de ${vacina.reforco_dias} dias.`
                  : 'Deixe em branco se não houver reforço.'}
          </span>
        </div>
      </div>
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="v-lote">Lote</label>
          <input id="v-lote" name="lote" maxLength={60} autoComplete="off" />
        </div>
        <SeletorClinica clinicas={clinicas} id="v-clinica" />
        <div className="campo">
          <label htmlFor="v-vet">Veterinário (nome e CRMV)</label>
          <input id="v-vet" name="veterinario" maxLength={160} />
        </div>
      </div>
      <div className="linha">
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar vacina'}
        </button>
        <button type="button" className="botao" data-tipo="texto" onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>
    </form>
  );
}

export function FormVermifugacao({ animalId, hoje }: { animalId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(registrarVermifugacao.bind(null, animalId), {});
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [proxima, setProxima] = useState('');
  const [sugerindo, iniciarSugestao] = useTransition();

  // Filhote na primeira vez: série de 3 dias e repete em 15 dias. Adulto: 6 meses.
  function sugerir(aplicacao: string) {
    if (!aplicacao) return setProxima('');
    iniciarSugestao(async () => setProxima((await sugerirProximaDose(animalId, 'vermifugacao', aplicacao)) ?? ''));
  }
  function abrir() {
    setAberto(true);
    sugerir(data);
  }
  if (!aberto) {
    return (
      <div className="pilha" data-e="2">
        <Mensagem estado={estado} />
        <div>
          <button type="button" className="botao" onClick={abrir}>
            Registrar vermifugação
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={acao} className="pilha">
      <h3>Registrar vermifugação</h3>
      <Mensagem estado={estado} />
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="vm-produto">Vermífugo</label>
          <input id="vm-produto" name="produto" maxLength={80} required />
        </div>
        <div className="campo">
          <label htmlFor="vm-data">Data</label>
          <input
            id="vm-data"
            name="data"
            type="date"
            max={hoje}
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              sugerir(e.target.value);
            }}
            required
          />
          <span className="ajuda">Filhote: registre a série de 3 dias uma vez, no primeiro dia.</span>
        </div>
        <div className="campo">
          <label htmlFor="vm-proxima">Próxima dose</label>
          <input id="vm-proxima" name="proxima_dose" type="date" min={data} value={proxima} onChange={(e) => setProxima(e.target.value)} />
          <span className="ajuda">{sugerindo ? 'Calculando a sugestão…' : 'Filhote na primeira vez: 15 dias. Adulto: 6 meses.'}</span>
        </div>
      </div>
      <div className="linha">
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar vermifugação'}
        </button>
        <button type="button" className="botao" data-tipo="texto" onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>
    </form>
  );
}

export function FormCastracao({
  animalId,
  hoje,
  estado,
  castracoes,
  clinicas,
  podeAgendar,
}: {
  animalId: string;
  hoje: string;
  estado: EstadoSaude;
  castracoes: SaudeAnimal['castracoes'];
  clinicas: Clinica[];
  podeAgendar: boolean;
}) {
  const [resultado, acao, enviando] = useActionState<EstadoAcao, FormData>(castracao.bind(null, animalId), {});
  const [modo, setModo] = useState<'' | 'agendar' | 'realizar'>('');
  const realizada = castracoes.find((c) => c.status === 'realizada');
  const agendada = castracoes.find((c) => c.status === 'agendada');

  if (realizada) {
    return (
      <div className="pilha" data-e="2">
        <Mensagem estado={resultado} />
        <p>
          <b>Castrado.</b>{' '}
          {realizada.anterior_a_entrada
            ? 'O animal já chegou castrado.'
            : `Cirurgia em ${fd(realizada.data_realizada)}${realizada.clinica ? `, ${realizada.clinica}` : ''}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="pilha">
      <Mensagem estado={resultado} />
      {agendada ? (
        <p>
          <b>Castração agendada</b> para {fd(agendada.data_agendada)}
          {agendada.clinica ? `, ${agendada.clinica}` : ''}.
        </p>
      ) : (
        <p>{estado.castracao_status === 'nao_castrado' ? 'Não castrado.' : ''}</p>
      )}

      {(modo === '' || (modo === 'agendar' && agendada)) && (
        <div className="linha">
          {!agendada && podeAgendar && (
            <button type="button" className="botao" onClick={() => setModo('agendar')}>
              Agendar castração
            </button>
          )}
          <button type="button" className="botao" onClick={() => setModo('realizar')}>
            {agendada ? 'Registrar castração realizada' : 'Registrar castração'}
          </button>
          {agendada && (
            <form action={acao}>
              <input type="hidden" name="acao" value="cancelar" />
              <input type="hidden" name="castracao_id" value={agendada.id} />
              <button type="submit" className="botao" data-tipo="texto" disabled={enviando}>
                Cancelar agendamento
              </button>
            </form>
          )}
          {!agendada && (
            <form action={acao}>
              <input type="hidden" name="acao" value="anterior" />
              <button type="submit" className="botao" data-tipo="texto" disabled={enviando}>
                Já chegou castrado
              </button>
            </form>
          )}
        </div>
      )}

      {modo !== '' && !(modo === 'agendar' && agendada) && (
        <form action={acao} className="pilha">
          <h3>{modo === 'agendar' ? 'Agendar castração' : 'Registrar castração'}</h3>
          <input type="hidden" name="acao" value={modo} />
          <div className="grade" data-n="3">
            <div className="campo">
              <label htmlFor="c-data">{modo === 'agendar' ? 'Data marcada' : 'Data da cirurgia'}</label>
              <input
                id="c-data"
                name="data"
                type="date"
                min={modo === 'agendar' ? hoje : undefined}
                max={modo === 'realizar' ? hoje : undefined}
                defaultValue={modo === 'realizar' ? hoje : ''}
                required
              />
            </div>
            <SeletorClinica clinicas={clinicas} id="c-clinica" />
            {modo === 'realizar' && (
              <div className="campo">
                <label htmlFor="c-vet">Veterinário (nome e CRMV)</label>
                <input id="c-vet" name="veterinario" maxLength={160} />
              </div>
            )}
          </div>
          {modo === 'realizar' && (
            <div className="campo" style={{ maxWidth: 320 }}>
              <label htmlFor="c-chip">Microchip aplicado (opcional)</label>
              <input id="c-chip" name="microchip" inputMode="numeric" maxLength={30} placeholder="985 112 000 123 456" autoComplete="off" />
              <span className="ajuda">Fica gravado na ficha do animal.</span>
            </div>
          )}
          <div className="linha">
            <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
              {enviando ? 'Salvando…' : modo === 'agendar' ? 'Agendar castração' : 'Registrar castração'}
            </button>
            <button type="button" className="botao" data-tipo="texto" onClick={() => setModo('')}>
              Fechar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Antiparasitário externo: Simparic (a cada 6 meses nos abrigados e na
// admissão de novo resgatado) e Bravecto (só em cadela parida).
export function FormAntiparasitario({ animalId, hoje }: { animalId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(registrarAntiparasitario.bind(null, animalId), {});
  const [aberto, setAberto] = useState(false);
  const [produto, setProduto] = useState('Simparic');
  const [data, setData] = useState(hoje);
  const [proxima, setProxima] = useState('');
  const [sugerindo, iniciarSugestao] = useTransition();

  function sugerir(p: string, aplicacao: string) {
    if (!p.trim() || !aplicacao) return setProxima('');
    iniciarSugestao(async () => setProxima((await sugerirProximaDose(animalId, 'antiparasitario', aplicacao, { produto: p })) ?? ''));
  }

  if (!aberto) {
    return (
      <div className="pilha" data-e="2">
        <Mensagem estado={estado} />
        <div>
          <button
            type="button"
            className="botao"
            onClick={() => {
              setAberto(true);
              sugerir(produto, data);
            }}
          >
            Registrar antipulgas e carrapatos
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={acao} className="pilha">
      <h3>Registrar antipulgas e carrapatos</h3>
      <Mensagem estado={estado} />
      <div className="grade" data-n="3">
        <div className="campo">
          <label htmlFor="ap-produto">Produto</label>
          <input
            id="ap-produto"
            name="produto"
            list="ap-produtos"
            maxLength={80}
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            onBlur={() => sugerir(produto, data)}
            required
          />
          <datalist id="ap-produtos">
            <option value="Simparic" />
            <option value="Bravecto" />
          </datalist>
        </div>
        <div className="campo">
          <label htmlFor="ap-data">Data</label>
          <input
            id="ap-data"
            name="data"
            type="date"
            max={hoje}
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              sugerir(produto, e.target.value);
            }}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="ap-proxima">Próxima aplicação</label>
          <input id="ap-proxima" name="proxima_dose" type="date" min={data} value={proxima} onChange={(e) => setProxima(e.target.value)} />
          <span className="ajuda">{sugerindo ? 'Calculando a sugestão…' : 'Simparic: 6 meses. Bravecto (cadela parida): sem repetição.'}</span>
        </div>
      </div>
      <div className="linha">
        <button className="botao" data-tipo="principal" type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar aplicação'}
        </button>
        <button type="button" className="botao" data-tipo="texto" onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>
    </form>
  );
}
