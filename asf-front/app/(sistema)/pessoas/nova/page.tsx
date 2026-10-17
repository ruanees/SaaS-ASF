import type { Metadata } from 'next';
import Link from 'next/link';
import { FormNovaPessoa } from '../form-pessoa';

export const metadata: Metadata = { title: 'Cadastrar pessoa' };

export default async function NovaPessoa({ searchParams }: PageProps<'/pessoas/nova'>) {
  const sp = await searchParams;
  const vinculo = sp.vinculo === 'adotante' || sp.vinculo === 'lar_temporario' ? sp.vinculo : undefined;
  const voltar = typeof sp.voltar === 'string' ? sp.voltar : undefined;

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <Link href={voltar && voltar.startsWith('/animais/') ? voltar : '/pessoas'}>Voltar</Link>
        <h1>Cadastrar pessoa</h1>
        <p className="ajuda">Só o necessário: nome, contato e, para adotante e lar temporário, o endereço.</p>
      </div>
      <FormNovaPessoa vinculoInicial={vinculo} voltar={voltar} />
    </div>
  );
}
