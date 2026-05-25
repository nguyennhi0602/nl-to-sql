import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import { AppModule } from '../src/app.module';
import type { IncomingMessage, ServerResponse } from 'http';

const expressApp: Express = express();
let nestReady = false;
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: false,
    }).then(async (app) => {
      app.enableCors();
      await app.init();
      nestReady = true;
    });
  }
  return initPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!nestReady) await init();
  expressApp(req as any, res as any);
}
