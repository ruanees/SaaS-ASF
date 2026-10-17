import { SetMetadata } from '@nestjs/common';

export const ROTA_PUBLICA = 'rota_publica';

// Toda rota nasce fechada pelo guard global. Abrir é explícito.
// Só `/saude` usa isto (o `/openapi.json` é servido fora dos controllers).
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);
