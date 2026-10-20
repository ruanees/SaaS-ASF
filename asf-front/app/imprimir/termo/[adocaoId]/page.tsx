import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, chamar, obterEu } from '@/lib/api';
import { formatarCpf, idade, somarDias } from '@/lib/formato';
import { AVISO_PRIVACIDADE } from '@/lib/rotulos';
import { BotaoImprimir } from '../../[id]/botao-imprimir';

export const metadata: Metadata = { title: 'Termo de adoção' };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Marca de múltipla escolha do termo: (X) ou ( ). */
const marca = (sim: boolean) => (sim ? '(X)' : '(  )');

// Termo de responsabilidade da associação (modelo de 2026), preenchido com os
// dados do sistema. As cláusulas são as do documento da associação, sem
// mudança. Abrir esta página lê o contato do adotante: fica na auditoria.
export default async function TermoAdocao({ params }: PageProps<'/imprimir/termo/[adocaoId]'>) {
  const { adocaoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(adocaoId)) notFound();

  const eu = await obterEu();
  if (eu.ok && eu.dados.papel !== 'admin' && eu.dados.papel !== 'coordenacao') {
    return (
      <main className="impressao pilha">
        <p>Só a administração e a coordenação geram o termo de adoção.</p>
      </main>
    );
  }

  const cliente = await api();
  const adocao = await chamar(cliente.GET('/adocoes/{adocaoId}', { params: { path: { adocaoId } } }));
  if (!adocao.ok && adocao.falha.status === 404) notFound();
  if (!adocao.ok) {
    return (
      <main className="impressao pilha">
        <p className="aviso" data-tipo="erro" role="alert">
          {adocao.falha.mensagem}
        </p>
      </main>
    );
  }
  const ad = adocao.dados;
  const [animal, saude, contato] = await Promise.all([
    chamar(cliente.GET('/animais/{id}', { params: { path: { id: ad.animal.id } } })),
    chamar(cliente.GET('/animais/{id}/saude', { params: { path: { id: ad.animal.id } } })),
    chamar(cliente.GET('/pessoas/{id}/contato', { params: { path: { id: ad.pessoa.id } } })),
  ]);
  const erro = [animal, saude, contato].find((r) => !r.ok);
  if (erro && !erro.ok) {
    return (
      <main className="impressao pilha">
        <p className="aviso" data-tipo="erro" role="alert">
          {erro.falha.mensagem}
        </p>
        <div>
          <Link className="botao" href={`/imprimir/termo/${adocaoId}`}>
            Tentar de novo
          </Link>
        </div>
      </main>
    );
  }
  if (!animal.ok || !saude.ok || !contato.ok) return null;

  const a = animal.dados;
  const c = contato.dados;
  const dia = ad.data_adocao;
  const tresMesesAntes = somarDias(dia, -90);
  const vermifugado = saude.dados.vermifugacoes.some((v) => v.data >= tresMesesAntes && v.data <= dia);
  const vacinas = [...new Set(saude.dados.vacinacoes.filter((v) => v.data <= dia).map((v) => v.vacina))];
  const linha = (valor: string | null | undefined) => valor?.trim() || '______________________';

  return (
    <main className="impressao pilha termo" data-e="3">
      <div className="linha nao-imprimir" data-separar>
        <Link href={`/animais/${a.id}?aba=adocao`}>Voltar para a ficha</Link>
        <BotaoImprimir />
      </div>
      <p className="ajuda nao-imprimir">
        Confira os dados antes de imprimir. O que estiver em branco é preenchido à mão, na hora da assinatura.
      </p>

      <header className="termo-cabecalho">
        {/* eslint-disable-next-line @next/next/no-img-element -- selo da associação, imagem estática */}
        <img src="/marca/selo-288.png" width={84} height={84} alt="Selo da Associação São Francisco Defensora dos Animais" />
        <h1>ADOÇÃO · TERMO DE RESPONSABILIDADE</h1>
      </header>

      <section className="pilha" data-e="1">
        <p>
          <b>Nome do adotante:</b> {linha(ad.pessoa.nome)}
        </p>
        <p>
          <b>Identidade:</b> {linha(c.rg)} &nbsp; <b>CPF:</b> {linha(c.cpf ? formatarCpf(c.cpf) : null)}
        </p>
        <p>
          <b>Endereço residencial (com bairro e cidade/UF):</b> {linha(c.endereco)}
        </p>
        <p>
          <b>Profissão:</b> {linha(c.profissao)} &nbsp; <b>Fone/Cel:</b> {linha(c.telefone)}
        </p>
      </section>

      <section className="pilha" data-e="1">
        <p>
          <b>Nome do animal:</b> {linha(a.nome ?? a.numero)} ({a.numero}) &nbsp; {marca(a.especie === 'cao')} cão {marca(a.especie === 'gato')}{' '}
          gato &nbsp; <b>Sexo:</b> {marca(a.sexo === 'macho')} macho {marca(a.sexo === 'femea')} fêmea
        </p>
        <p>
          <b>Idade:</b> {a.nascimento_estimado ? idade(a.nascimento_estimado, a.idade_precisao, dia) : '______'} &nbsp; <b>Raça:</b>{' '}
          {linha(a.raca)} &nbsp; (  ) puro (  ) mestiço &nbsp; <b>Cor da pelagem:</b> {linha(a.pelagem)}
        </p>
        <p>
          <b>Porte:</b> (  ) mini {marca(a.porte === 'pequeno')} pequeno {marca(a.porte === 'medio')} médio {marca(a.porte === 'grande')}{' '}
          grande (  ) gigante &nbsp; <b>Castrado?</b> {marca(a.castracao_status === 'castrado')} sim{' '}
          {marca(a.castracao_status !== 'castrado')} não
        </p>
        <p>
          <b>Vermifugado nos últimos 3 meses?</b> {marca(vermifugado)} sim {marca(!vermifugado)} não (  ) sem informação
        </p>
        <p>
          <b>Vacinado?</b> {marca(vacinas.length > 0)} sim. Quais? {vacinas.length > 0 ? vacinas.join(', ') : '______________'}{' '}
          {marca(vacinas.length === 0)} não (  ) sem informação
        </p>
        <p>
          <b>Endereço onde ficará o animal:</b> (  ) o mesmo acima (  ) outro: Qual? ______________________________
        </p>
        <p>
          <b>Nome do doador:</b> Associação São Francisco Defensora dos Animais
        </p>
      </section>

      <section className="pilha termo-clausulas" data-e="2">
        <p>
          Ao adotar o animal acima descrito declaro-me apto para assumir a guarda e a responsabilidade sobre este animal, eximindo a
          Associação São Francisco Defensora dos Animais de toda e qualquer responsabilidade por quaisquer atos praticados pelo animal a
          partir desta data.
        </p>
        <p>
          Declaro ainda estar ciente de todos os cuidados que este animal exige no que se refere à sua guarda e manutenção, além de
          conhecer todos os riscos inerentes à espécie e raça no convívio com humanos, estando apto a guardá-lo e vigiá-lo,
          comprometendo-me a proporcionar boas condições de alojamento e alimentação, assim como, espaço físico que possibilite o animal
          se exercitar. Responsabilizo-me por preservar a saúde e integridade do animal e a submetê-lo aos cuidados médico-veterinários
          sempre que necessário para este fim.
        </p>
        <p>
          Declaro ainda estar ciente que a castração prometida pela Associação São Francisco Defensora dos Animais é somente para as
          fêmeas, no tempo oportuno e no local e clínica indicada pela mesma.
        </p>
        <p>
          Declaro, também, estar ciente de que a Associação se responsabiliza unicamente pelos custos do procedimento cirúrgico de
          castração, não estando inclusos medicação pós-operatória, roupa cirúrgica, despesas com translado/transporte do animal, exames
          complementares ou quaisquer outros custos não expressamente mencionados neste termo.
        </p>
        <p>
          Declaro estar ciente de que a castração da fêmea custeada pela Associação São Francisco é obrigatória, comprometendo-me a levar
          o animal para o procedimento dentro do prazo estipulado, sob pena de descumprimento do termo de adoção, aplicação das medidas
          cabíveis e possível perda da guarda do animal.
        </p>
        <p>
          Comprometo-me ainda, a dar continuidade ao protocolo vacinal, garantindo todas as doses necessárias e reforços anuais, zelando
          pela saúde e bem-estar do animal.
        </p>
        <p>Comprometo-me a não transmitir a posse deste animal a outrem sem o conhecimento do doador.</p>
        <p>Comprometo-me também, a permitir o acesso do doador ao local onde se encontra o animal para averiguação de suas condições.</p>
        <p>
          Tenho conhecimento de que caso seja constatado por parte do doador situação inadequada para o bem estar do animal, perderei a
          sua guarda.
        </p>
        <p>
          Comprometo-me ainda a castrar o animal adotado em caso de macho, contribuindo assim, para o controle da população de animais
          domésticos.
        </p>
        <p>Comprometo-me a cumprir toda a legislação vigente, municipal, estadual e federal, relativa à posse de animais.</p>
        <p>
          Declaro-me assim, ciente das normas acima, as quais aceito, assinando o presente Termo de Responsabilidade, assumindo plenamente
          os deveres que dele constam, bem como outros relacionados à posse responsável e que não estejam incluídos neste Termo.
        </p>
      </section>

      <section className="termo-assinaturas">
        <div>
          <span className="termo-linha" />
          Representante legal da ONG
        </div>
        <div>
          <span className="termo-linha" />
          Adotante
        </div>
      </section>

      <p>
        Granja, {Number(dia.slice(8, 10))} de {MESES[Number(dia.slice(5, 7)) - 1]} de {dia.slice(0, 4)}.
      </p>

      <p className="termo-aviso">
        <b>Abandonar ou maltratar animais é crime!</b> Pena: 3 meses a 1 ano de detenção e multa (Lei 9605/98)
      </p>

      <p className="termo-privacidade">
        <b>Privacidade.</b> {AVISO_PRIVACIDADE}
      </p>
      <p className="termo-privacidade">Instagram: @associacaosaofrancisco_</p>
    </main>
  );
}
