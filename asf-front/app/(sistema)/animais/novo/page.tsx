import type { Metadata } from 'next';
import Link from 'next/link';
import { api, chamar, obterEu } from '@/lib/api';
import { hojeIso } from '@/lib/formato';
import { FormCadastro } from './form-cadastro';

export const metadata: Metadata = { title: 'Cadastrar animal' };

export default async function NovoAnimal() {
  const cliente = await api();
  const [clinicas, eu] = await Promise.all([chamar(cliente.GET('/clinicas')), obterEu()]);
  const clinico = eu.ok && ['admin', 'coordenacao', 'veterinario'].includes(eu.dados.papel);

  return (
    <div className="pilha" data-e="5">
      <div className="pilha" data-e="2">
        <Link href="/animais">Voltar para animais</Link>
        <h1>Cadastrar animal</h1>
        <p className="ajuda">O número é gerado na hora de salvar.</p>
      </div>
      <FormCadastro hoje={hojeIso()} clinicas={clinicas.ok ? clinicas.dados : []} clinico={clinico} />
    </div>
  );
}
