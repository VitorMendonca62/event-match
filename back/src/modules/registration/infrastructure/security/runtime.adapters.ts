import { Injectable } from '@nestjs/common';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
@Injectable() export class SystemClockAdapter implements ClockPort { now(): Date { return new Date(); } }
@Injectable() export class UuidV7GeneratorAdapter implements IdGeneratorPort { next(): string { return Bun.randomUUIDv7(); } }
