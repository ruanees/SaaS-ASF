import { Module } from '@nestjs/common';
import { AdocoesModule } from './adocoes/adocoes.module.js';
import { AnimaisModule } from './animais/animais.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PessoasModule } from './pessoas/pessoas.module.js';
import { ProntuarioModule } from './prontuario/prontuario.module.js';
import { SaudeAnimalModule } from './saude-animal/saude.module.js';
import { SaudeController } from './saude/saude.controller.js';
import { SessaoModule } from './sessao/sessao.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    AuthModule,
    SupabaseModule,
    SessaoModule,
    UsuariosModule,
    AnimaisModule,
    SaudeAnimalModule,
    ProntuarioModule,
    PessoasModule,
    AdocoesModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
