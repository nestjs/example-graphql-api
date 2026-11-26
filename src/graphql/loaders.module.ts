import { Module } from '@nestjs/common';
import { Loaders } from './loaders.js';

@Module({
  providers: [Loaders],
  exports: [Loaders],
})
export class LoadersModule {}
