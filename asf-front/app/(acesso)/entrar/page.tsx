import type { Metadata } from 'next';
import { FormEntrar } from './form-entrar';

export const metadata: Metadata = { title: 'Entrar' };

const AVISOS: Record<string, string> = {
  expirou: 'Sua sessão expirou. Entre de novo.',
  saiu: 'Você saiu do sistema.',
};

export default async function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  const { volta, motivo } = await searchParams;
  const aviso = typeof motivo === 'string' ? AVISOS[motivo] : undefined;
  return (
    <>
      <h1>Entrar</h1>
      {aviso && (
        <p className="aviso" data-tipo="info" role="status">
          {aviso}
        </p>
      )}
      <FormEntrar volta={typeof volta === 'string' ? volta : ''} />
    </>
  );
}
