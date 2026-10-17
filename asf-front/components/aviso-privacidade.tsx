import { AVISO_PRIVACIDADE } from '@/lib/rotulos';

/** Aviso curto de privacidade: no cadastro de pessoa e no termo de adoção (LGPD, regra 3). */
export function AvisoPrivacidade() {
  return (
    <aside className="aviso" data-tipo="info" aria-label="Aviso de privacidade">
      <b>Privacidade.</b> {AVISO_PRIVACIDADE}
    </aside>
  );
}
