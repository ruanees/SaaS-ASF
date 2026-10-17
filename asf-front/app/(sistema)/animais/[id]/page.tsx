import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SelosAnimal } from '@/components/selos-animal';
import { SelosSaude } from '@/components/selos-saude';
import { api, chamar, obterEu } from '@/lib/api';
import { hojeIso, idade } from '@/lib/formato';
import { ESPECIE, SEXO, nomeDoAnimal } from '@/lib/rotulos';
import { AbaDados } from './aba-dados';
import { AbaProntuario } from './aba-prontuario';
import { AbaSaude } from './aba-saude';
import { AbaSituacao } from './aba-situacao';
import { EnvioFoto } from './envio-foto';

export const metadata: Metadata = { title: 'Ficha do animal' };

const ABAS = [
  { chave: 'dados', rotulo: 'Dados' },
  { chave: 'situacao', rotulo: 'Situação' },
  { chave: 'saude', rotulo: 'Saúde' },
  { chave: 'prontuario', rotulo: 'Prontuário' },
  { chave: 'adocao', rotulo: 'Adoção', emBreve: true },
] as const;

export default async function FichaAnimal({ params, searchParams }: PageProps<'/animais/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const aba = sp.aba === 'situacao' || sp.aba === 'saude' || sp.aba === 'prontuario' ? sp.aba : 'dados';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const cliente = await api();
  const [animal, eu] = await Promise.all([
    chamar(cliente.GET('/animais/{id}', { params: { path: { id } } })),
    obterEu(),
  ]);
  if (!animal.ok && animal.falha.status === 404) notFound();
  if (!animal.ok) {
    return (
      <div className="pilha">
        <h1>Ficha do animal</h1>
        <p className="aviso" data-tipo="erro" role="alert">
          {animal.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/animais/${id}`}>
            Tentar de novo
          </Link>
        </div>
      </div>
    );
  }
  const a = animal.dados;
  const podeExcluir = eu.ok && (eu.dados.papel === 'admin' || eu.dados.papel === 'coordenacao');

  return (
    <div className="pilha" data-e="5">
      <Link href="/animais">Voltar para animais</Link>

      {sp.saude === 'falhou' && (
        <p className="aviso" data-tipo="erro" role="alert">
          O animal foi cadastrado, mas a saúde na entrada não foi registrada. Registre a condição em Dados e os exames
          em <Link href={`/animais/${a.id}?aba=prontuario`}>Prontuário</Link>.
        </p>
      )}

      {sp.novo === '1' && (
        <p className="aviso" data-tipo="ok" role="status">
          {nomeDoAnimal(a)} cadastrado com o número {a.numero}. Envie uma foto para facilitar a identificação e, se
          aplicou, registre o Simparic de admissão em <Link href={`/animais/${a.id}?aba=saude`}>Saúde</Link>.
        </p>
      )}

      <header className="cartao cabecalho-ficha">
        <EnvioFoto animalId={a.id} fotoUrl={a.foto_url} especie={ESPECIE[a.especie]} />
        <div className="pilha" data-e="2">
          <h1 className="nome-animal" style={{ fontSize: 'var(--t-titulo)' }}>
            {nomeDoAnimal(a)}
          </h1>
          <p className="ajuda">
            {[a.numero, ESPECIE[a.especie], SEXO[a.sexo], a.nascimento_estimado ? idade(a.nascimento_estimado, a.idade_precisao) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <SelosAnimal situacao={a.situacao} local={a.local} disponivel={a.disponivel_adocao} />
          <SelosSaude
            vacinacao={a.situacao === 'em_acolhimento' ? a.vacinacao_status : null}
            castracao={a.situacao === 'em_acolhimento' ? a.castracao_status : null}
            emTratamento={a.situacao === 'em_acolhimento' ? a.em_tratamento : null}
            leishmaniose={a.leishmaniose_reagente}
          />
        </div>
      </header>

      <nav className="abas" aria-label="Seções da ficha">
        {ABAS.map((t) =>
          'emBreve' in t ? (
            <span key={t.chave} className="aba" data-em-breve aria-disabled="true">
              {t.rotulo} <span className="selo">em breve</span>
            </span>
          ) : (
            <Link
              key={t.chave}
              className="aba"
              href={t.chave === 'dados' ? `/animais/${a.id}` : `/animais/${a.id}?aba=${t.chave}`}
              aria-current={aba === t.chave ? 'page' : undefined}
            >
              {t.rotulo}
            </Link>
          ),
        )}
      </nav>

      {aba === 'dados' ? (
        <AbaDados animal={a} hoje={hojeIso()} podeExcluir={podeExcluir} />
      ) : aba === 'saude' ? (
        <AbaSaude animal={a} hoje={hojeIso()} />
      ) : aba === 'prontuario' ? (
        <AbaProntuario animal={a} hoje={hojeIso()} tipo={typeof sp.tipo === 'string' ? sp.tipo : undefined} />
      ) : (
        <AbaSituacao animal={a} hoje={hojeIso()} />
      )}
    </div>
  );
}
