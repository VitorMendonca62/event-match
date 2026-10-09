import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';

import { CreatedResponseDto, OkResponseDto } from '../../../../../shared/presentation/http/api-response.dto';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BFF_TOKEN_HEADER } from '../../../../../shared/presentation/http/bff-headers';
import { IdentityAccessErrorFilter } from '../../../../identity-access/presentation/http/identity-access-error.filter';
import { CreateEventDraft, GetEventDraft, PreviewEventDraft, PublishEvent, UpdateEventDraft } from '../../../application/use-cases/event.use-cases';
import { EventErrorFilter } from '../event-error.filter';
import { EventAccountId } from '../event-principal.decorator';
import { EventsBffGuard, EventsCapabilityGuard } from '../events-auth.guard';
import { CreateEventDraftDto, PublishEventDto, UpdateEventDraftDto } from '../dto/event-request.dto';
import { CreatedEventOwnerDraftEnvelopeDto, EventOwnerDraftEnvelopeDto, PublicEventPreviewEnvelopeDto } from '../dto/event-response.dto';

@ApiTags('events')
@ApiHeader({ name: BFF_TOKEN_HEADER, required: true })
@ApiBearerAuth('authenticated-session')
@ApiNotFoundResponse()
@ApiForbiddenResponse()
@ApiServiceUnavailableResponse()
@UseGuards(EventsBffGuard)
@UseFilters(EventErrorFilter, IdentityAccessErrorFilter)
@Controller(`${API_V1_PREFIX}/events`)
export class EventsController {
  constructor(private readonly createDraft: CreateEventDraft, private readonly getDraft: GetEventDraft, private readonly updateDraft: UpdateEventDraft, private readonly previewDraft: PreviewEventDraft, private readonly publishEvent: PublishEvent) {}

  @Post('drafts')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventsCapabilityGuard)
  @ApiOperation({ summary: 'Create an event draft for the authenticated host' })
  @ApiCreatedResponse({ type: CreatedEventOwnerDraftEnvelopeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async create(@EventAccountId() accountId: string, @Body() body: CreateEventDraftDto) {
    return new CreatedResponseDto(await this.createDraft.execute({ hostAccountId: accountId, ...body }), 'Event draft created.');
  }

  @Get('drafts/:eventId')
  @UseGuards(EventsCapabilityGuard)
  @ApiOperation({ summary: 'Recover the authenticated host event draft' })
  @ApiOkResponse({ type: EventOwnerDraftEnvelopeDto })
  async get(@EventAccountId() accountId: string, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return new OkResponseDto(await this.getDraft.execute({ hostAccountId: accountId, eventId }), 'Event draft loaded.');
  }

  @Put('drafts/:eventId')
  @UseGuards(EventsCapabilityGuard)
  @ApiOperation({ summary: 'Update an event draft with optimistic revision control' })
  @ApiOkResponse({ type: EventOwnerDraftEnvelopeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async update(@EventAccountId() accountId: string, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() body: UpdateEventDraftDto) {
    return new OkResponseDto(await this.updateDraft.execute({ hostAccountId: accountId, eventId, ...body }), 'Event draft saved.');
  }

  @Get('drafts/:eventId/preview')
  @UseGuards(EventsCapabilityGuard)
  @ApiOperation({ summary: 'Generate the public-safe preview of an event draft' })
  @ApiOkResponse({ type: PublicEventPreviewEnvelopeDto })
  @ApiUnprocessableEntityResponse()
  async preview(@EventAccountId() accountId: string, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return new OkResponseDto(await this.previewDraft.execute({ hostAccountId: accountId, eventId }), 'Event preview loaded.');
  }

  @Post('drafts/:eventId/publish')
  @UseGuards(EventsCapabilityGuard)
  @ApiOperation({ summary: 'Publish a validated event draft' })
  @ApiOkResponse({ type: EventOwnerDraftEnvelopeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async publish(@EventAccountId() accountId: string, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() body?: PublishEventDto) {
    return new OkResponseDto(await this.publishEvent.execute({ hostAccountId: accountId, eventId, revision: body?.revision }), 'Event published.');
  }
}
