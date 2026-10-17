import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { SaudeController } from './saude/saude.controller.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [SaudeController],
})
export class AppModule {}
