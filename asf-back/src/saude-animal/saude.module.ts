import { Module } from '@nestjs/common';
import { SaudeAnimalController } from './saude.controller.js';
import { SaudeAnimalService } from './saude.service.js';

@Module({
  controllers: [SaudeAnimalController],
  providers: [SaudeAnimalService],
  exports: [SaudeAnimalService],
})
export class SaudeAnimalModule {}
