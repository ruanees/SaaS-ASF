// Atalhos para os tipos gerados do OpenAPI (types/api.d.ts, não editar à mão).
import type { components } from '@/types/api';

export type Esquemas = components['schemas'];
export type Eu = Esquemas['EuDto'];
export type Usuario = Esquemas['UsuarioDto'];
export type Papel = Eu['papel'];
export type Sessao = Esquemas['SessaoDto'];
export type Animal = Esquemas['AnimalDto'];
export type AnimalResumo = Esquemas['AnimalResumoDto'];
export type ListaAnimais = Esquemas['ListaAnimaisDto'];
export type Movimentacao = Esquemas['MovimentacaoDto'];
export type Duplicado = Esquemas['DuplicadoDto'];
export type Clinica = Esquemas['ClinicaDto'];
export type SaudeAnimal = Esquemas['SaudeAnimalDto'];
export type EstadoSaude = Esquemas['EstadoSaudeDto'];
export type VacinaTipo = Esquemas['VacinaTipoDto'];
export type Pendencia = Esquemas['PendenciaDto'];
