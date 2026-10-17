import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { SaudeController } from './saude/saude.controller.js';
import { SessaoModule } from './sessao/sessao.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [AuthModule, SupabaseModule, SessaoModule, UsuariosModule],
  controllers: [SaudeController],
})
export class AppModule {}
