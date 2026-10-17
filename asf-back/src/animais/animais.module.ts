import { Module } from '@nestjs/common';
import { SaudeAnimalModule } from '../saude-animal/saude.module.js';
import { AnimaisController } from './animais.controller.js';
import { AnimaisService } from './animais.service.js';
import { ClinicasController } from './clinicas.controller.js';

@Module({
  imports: [SaudeAnimalModule],
  controllers: [AnimaisController, ClinicasController],
  providers: [AnimaisService],
})
export class AnimaisModule {}
