import { Module } from '@nestjs/common';
import { AnimaisController } from './animais.controller.js';
import { AnimaisService } from './animais.service.js';
import { ClinicasController } from './clinicas.controller.js';

@Module({
  controllers: [AnimaisController, ClinicasController],
  providers: [AnimaisService],
})
export class AnimaisModule {}
