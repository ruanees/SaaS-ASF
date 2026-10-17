import { Module } from '@nestjs/common';
import { ProntuarioController } from './prontuario.controller.js';
import { ProntuarioService } from './prontuario.service.js';

@Module({
  controllers: [ProntuarioController],
  providers: [ProntuarioService],
})
export class ProntuarioModule {}
