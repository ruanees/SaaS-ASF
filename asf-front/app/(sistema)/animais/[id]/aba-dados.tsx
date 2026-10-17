'use client';

import { useRef, useState, useTransition } from 'react';
import { idade } from '@/lib/formato';
import { ORIGEM, PORTE } from '@/lib/rotulos';
import type { Animal } from '@/lib/tipos';
import type { components } from '@/types/api';
import { alterarCampos, excluirAnimal } from '../acoes';

type Alteracao = components['schemas']['AlterarAnimalDto'];

const ROTULO_CAMPO: Record<string, string> = {
  nome: 'nome',
  especie: 'espécie',
  sexo: 'sexo',
  nascimento_estimado: 'nascimento',
  idade_precisao: 'precisão da idade',
  porte: 'porte',
  data_entrada: 'data de entrada',
  origem: 'origem',
  origem_detalhe: 'detalhe da origem',
  observacoes: 'observações',
  microchip: 'microchip',
  microchip_data: 'data do microchip',
  condicao_entrada: 'condição na entrada',
};

// Cada campo salva ao sair dele, sem redesenhar a ficha. O selo de gravação
// só aparece quando uma escrita falha, e só o sucesso de outra escrita o limpa.
export function AbaDados({ animal, hoje, podeExcluir }: { animal: Animal; hoje: string; podeExcluir: boolean }) {
  const [falha, setFalha] = useState<{ campo: string; mensagem: string; repetir: () => void } | null>(null);
  const [nascimento, setNascimento] = useState(animal.nascimento_estimado ?? '');
  const [precisao, setPrecisao] = useState(animal.idade_precisao ?? 'aproximada');
  const [origem, setOrigem] = useState(animal.origem);
  const [, iniciar] = useTransition();
  const ultimo = useRef<Record<string, string>>({});

  function salvar(campos: Alteracao) {
    const chave = Object.keys(campos).join(',');
    const valor = JSON.stringify(campos);
    if (ultimo.current[chave] === valor) return; // nada mudou desde a última gravação
    iniciar(async () => {
      const r = await alterarCampos(animal.id, campos);
      if (r.erro) {
        setFalha({
          campo: ROTULO_CAMPO[Object.keys(campos)[0]] ?? 'campo',
          mensagem: r.erro,
          repetir: () => salvar(campos),
        });
      } else {
        ultimo.current[chave] = valor;
        setFalha(null);
      }
    });
  }

  const texto = (nome: keyof Alteracao, valor: string, obrigatorio = false) =>
    salvar({ [nome]: valor.trim() === '' ? (obrigatorio ? undefined : null) : valor.trim() } as Alteracao);

  return (
    <div className="pilha" data-e="5">
      {falha && (
        <div className="aviso linha" data-tipo="erro" role="alert" style={{ justifyContent: 'space-between' }}>
          <span>
            Não foi possível salvar {falha.campo}: {falha.mensagem}
          </span>
          <button type="button" className="botao" data-tipo="perigo" onClick={falha.repetir}>
            Tentar de novo
          </button>
        </div>
      )}

      <section className="cartao pilha">
        <h2>Dados do animal</h2>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="d-nome">Nome</label>
            <input id="d-nome" defaultValue={animal.nome ?? ''} maxLength={80} onBlur={(e) => texto('nome', e.target.value)} placeholder={animal.numero} />
          </div>
          <div className="campo">
            <label htmlFor="d-porte">Porte</label>
            <select id="d-porte" defaultValue={animal.porte ?? ''} onChange={(e) => salvar({ porte: (e.target.value || null) as Alteracao['porte'] })}>
              <option value="">Não informado</option>
              {Object.entries(PORTE).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-especie">Espécie</label>
            <select id="d-especie" defaultValue={animal.especie} onChange={(e) => salvar({ especie: e.target.value as Alteracao['especie'] })}>
              <option value="cao">Cão</option>
              <option value="gato">Gato</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-sexo">Sexo</label>
            <select id="d-sexo" defaultValue={animal.sexo} onChange={(e) => salvar({ sexo: e.target.value as Alteracao['sexo'] })}>
              <option value="macho">Macho</option>
              <option value="femea">Fêmea</option>
              <option value="nao_identificado">Não identificado</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-nascimento">Nascimento estimado</label>
            <input
              id="d-nascimento"
              type="date"
              max={hoje}
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              onBlur={(e) => salvar(e.target.value ? { nascimento_estimado: e.target.value, idade_precisao: precisao } : { nascimento_estimado: null })}
            />
            <span className="ajuda">{nascimento ? `Idade: ${idade(nascimento, precisao, hoje)}` : 'Idade não informada'}</span>
          </div>
          <div className="campo">
            <label htmlFor="d-precisao">Precisão da idade</label>
            <select
              id="d-precisao"
              value={precisao}
              disabled={!nascimento}
              onChange={(e) => {
                const p = e.target.value as 'exata' | 'aproximada';
                setPrecisao(p);
                salvar({ nascimento_estimado: nascimento, idade_precisao: p });
              }}
            >
              <option value="aproximada">Aproximada</option>
              <option value="exata">Exata</option>
            </select>
          </div>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>Microchip</h2>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="d-chip">Número do microchip</label>
            <input
              id="d-chip"
              inputMode="numeric"
              maxLength={30}
              defaultValue={animal.microchip ?? ''}
              placeholder="985 112 000 123 456"
              autoComplete="off"
              onBlur={(e) => salvar({ microchip: e.target.value.replace(/\s/g, '') || null })}
            />
          </div>
          <div className="campo">
            <label htmlFor="d-chip-data">Data da aplicação</label>
            <input
              id="d-chip-data"
              type="date"
              max={hoje}
              defaultValue={animal.microchip_data ?? ''}
              onBlur={(e) => salvar({ microchip_data: e.target.value || null })}
            />
          </div>
        </div>
        <p className="ajuda">Também dá para informar o microchip ao registrar a castração, na aba Saúde.</p>
      </section>

      <section className="cartao pilha">
        <h2>Primeira entrada</h2>
        <div className="grade" data-n="2">
          <div className="campo">
            <label htmlFor="d-entrada">Data de entrada</label>
            <input id="d-entrada" type="date" max={hoje} defaultValue={animal.data_entrada} onBlur={(e) => e.target.value && salvar({ data_entrada: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="d-origem">Origem</label>
            <select
              id="d-origem"
              value={origem}
              onChange={(e) => {
                const o = e.target.value as Alteracao['origem'] & string;
                setOrigem(o);
                if (o !== 'outra') salvar({ origem: o, origem_detalhe: null });
              }}
            >
              {Object.entries(ORIGEM).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        {origem === 'outra' && (
          <div className="campo">
            <label htmlFor="d-origem-detalhe">Qual foi a origem</label>
            <input
              id="d-origem-detalhe"
              defaultValue={animal.origem_detalhe ?? ''}
              maxLength={200}
              onBlur={(e) => e.target.value.trim() && salvar({ origem: 'outra', origem_detalhe: e.target.value.trim() })}
            />
          </div>
        )}
        <div className="campo">
          <label htmlFor="d-condicao">Condição na entrada</label>
          <textarea
            id="d-condicao"
            rows={2}
            maxLength={2000}
            defaultValue={animal.condicao_entrada ?? ''}
            onBlur={(e) => texto('condicao_entrada', e.target.value)}
          />
          <span className="ajuda">Como o animal chegou. Exames e tratamentos ficam no Prontuário.</span>
        </div>
        <p className="ajuda">Voltas depois da primeira entrada ficam no histórico da aba Situação.</p>
      </section>

      <section className="cartao pilha">
        <h2>Observações</h2>
        <div className="campo">
          <label htmlFor="d-obs" className="visualmente-oculto">
            Observações
          </label>
          <textarea id="d-obs" rows={4} maxLength={2000} defaultValue={animal.observacoes ?? ''} onBlur={(e) => texto('observacoes', e.target.value)} />
        </div>
      </section>

      {podeExcluir && <ExcluirAnimal id={animal.id} />}
    </div>
  );
}

function ExcluirAnimal({ id }: { id: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [erro, setErro] = useState<string>();
  const [excluindo, iniciar] = useTransition();
  return (
    <section className="pilha" data-e="2">
      <div>
        <button type="button" className="botao" data-tipo="perigo" onClick={() => dialogo.current?.showModal()}>
          Excluir animal
        </button>
      </div>
      <dialog ref={dialogo} className="cartao dialogo">
        <div className="pilha">
          <h2>Excluir este animal?</h2>
          <p>Ele sai das listas e dos indicadores. Use só para cadastro feito por engano; para óbito, registre na aba Situação.</p>
          {erro && (
            <p className="aviso" data-tipo="erro" role="alert">
              {erro}
            </p>
          )}
          <div className="linha">
            <button
              type="button"
              className="botao"
              data-tipo="perigo"
              disabled={excluindo}
              onClick={() =>
                iniciar(async () => {
                  const r = await excluirAnimal(id);
                  if (r?.erro) setErro(r.erro);
                })
              }
            >
              {excluindo ? 'Excluindo…' : 'Excluir animal'}
            </button>
            <button type="button" className="botao" data-tipo="texto" onClick={() => dialogo.current?.close()}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
