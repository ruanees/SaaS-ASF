import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// buildCommand próprio: o OpenNext roda `npm run build` por padrão. Se um dia
// o script "build" passar a chamar o OpenNext, o build entra em recursão e
// nunca termina, sem erro. Chamar o Next direto evita isso.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: 'npx next build',
};
