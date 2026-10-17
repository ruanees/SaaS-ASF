// Atalhos para os tipos gerados do OpenAPI (types/api.d.ts, não editar à mão).
import type { components } from '@/types/api';

export type Esquemas = components['schemas'];
export type Eu = Esquemas['EuDto'];
export type Usuario = Esquemas['UsuarioDto'];
export type Papel = Eu['papel'];
export type Sessao = Esquemas['SessaoDto'];
