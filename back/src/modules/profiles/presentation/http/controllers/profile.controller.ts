/** @format */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  CreatedResponseDto,
  OkResponseDto,
} from '../../../../../shared/presentation/http/api-response.dto';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { BFF_TOKEN_HEADER } from '../../../../../shared/presentation/http/bff-headers';
import {
  GetOwnProfile,
  PreviewOwnProfile,
  UpdateOwnProfile,
} from '../../../application/use-cases/profile.use-cases';
import {
  CreateProfilePhotoUpload,
  FinalizeProfilePhotoUpload,
  RemoveProfilePhoto,
} from '../../../application/use-cases/profile-media.use-cases';
import { OriginFingerprint } from '../../../../../shared/presentation/http/bff-headers';
import {
  ProfileBffGuard,
  ProfileMediaGuard,
  ProfileReadGuard,
  ProfileWriteGuard,
} from '../profile-auth.guard';
import { ProfileErrorFilter } from '../profile-error.filter';
import { ProfileAccountId } from '../profile-principal.decorator';
import { UpdateProfileDto } from '../dto/profile-request.dto';
import {
  InternalOwnProfileEnvelopeDto,
  OwnProfileEnvelopeDto,
  ProfilePreviewEnvelopeDto,
} from '../dto/profile-response.dto';
import {
  FinalizeProfilePhotoDto,
  ProfilePhotoRevisionDto,
  SignedProfilePhotoUploadGrantEnvelopeDto,
} from '../dto/profile-media.dto';
import { IdentityAccessErrorFilter } from '../../../../identity-access/presentation/http/identity-access-error.filter';

@ApiTags('profiles')
@ApiHeader({ name: BFF_TOKEN_HEADER, required: true })
@ApiBearerAuth('authenticated-session')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiNotFoundResponse()
@ApiServiceUnavailableResponse()
@UseGuards(ProfileBffGuard)
@UseFilters(ProfileErrorFilter, IdentityAccessErrorFilter)
@Controller(`${API_V1_PREFIX}/profiles`)
export class ProfileController {
  constructor(
    private readonly getOwn: GetOwnProfile,
    private readonly updateOwn: UpdateOwnProfile,
    private readonly previewOwn: PreviewOwnProfile,
    private readonly createUpload: CreateProfilePhotoUpload,
    private readonly finalizeUpload: FinalizeProfilePhotoUpload,
    private readonly removePhoto: RemoveProfilePhoto,
  ) {}

  @Get('me')
  @UseGuards(ProfileReadGuard)
  @ApiOperation({ summary: 'Read the authenticated account profile and completion' })
  @ApiOkResponse({ type: InternalOwnProfileEnvelopeDto })
  async me(@ProfileAccountId() accountId: string) {
    return new OkResponseDto(await this.getOwn.execute(accountId), 'Profile loaded.');
  }

  @Put('me')
  @UseGuards(ProfileWriteGuard)
  @ApiOperation({ summary: 'Atomically update the authenticated account profile' })
  @ApiOkResponse({ type: OwnProfileEnvelopeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  async update(@ProfileAccountId() accountId: string, @Body() body: UpdateProfileDto) {
    return new OkResponseDto(
      await this.updateOwn.execute({ accountId, ...body }),
      'Profile saved.',
    );
  }

  @Get('me/preview')
  @UseGuards(ProfileReadGuard)
  @ApiOperation({ summary: 'Project the own profile for the authenticated audience' })
  @ApiOkResponse({ type: ProfilePreviewEnvelopeDto })
  async preview(@ProfileAccountId() accountId: string) {
    return new OkResponseDto(
      await this.previewOwn.execute(accountId),
      'Profile preview loaded.',
    );
  }

  @Post('me/photo/uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ProfileMediaGuard, ProfileWriteGuard)
  @ApiOperation({ summary: 'Create a short-lived signed direct-upload grant' })
  @ApiCreatedResponse({ type: SignedProfilePhotoUploadGrantEnvelopeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiTooManyRequestsResponse()
  async photoUpload(
    @ProfileAccountId() accountId: string,
    @OriginFingerprint() origin: Buffer,
    @Body() body: ProfilePhotoRevisionDto,
  ) {
    return new CreatedResponseDto(
      await this.createUpload.execute({
        accountId,
        originSubject: origin.toString('base64url'),
        revision: body.revision,
      }),
      'Photo upload granted.',
    );
  }

  @Post('me/photo/uploads/:uploadId/finalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProfileMediaGuard, ProfileWriteGuard)
  @ApiOperation({ summary: 'Verify and activate a directly uploaded profile photo' })
  @ApiOkResponse({ type: InternalOwnProfileEnvelopeDto })
  @ApiGoneResponse()
  @ApiUnprocessableEntityResponse()
  @ApiConflictResponse()
  async finalizePhoto(
    @ProfileAccountId() accountId: string,
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) uploadId: string,
    @Body() body: FinalizeProfilePhotoDto,
  ) {
    await this.finalizeUpload.execute({
      accountId,
      uploadId,
      revision: body.revision,
      providerResponse: { ...body.providerResponse },
    });
    return new OkResponseDto(await this.getOwn.execute(accountId), 'Photo activated.');
  }

  @Delete('me/photo')
  @UseGuards(ProfileMediaGuard, ProfileWriteGuard)
  @ApiOperation({ summary: 'Remove the authenticated account primary photo' })
  @ApiOkResponse({ type: InternalOwnProfileEnvelopeDto })
  @ApiConflictResponse()
  async deletePhoto(
    @ProfileAccountId() accountId: string,
    @Body() body: ProfilePhotoRevisionDto,
  ) {
    await this.removePhoto.execute({ accountId, revision: body.revision });
    return new OkResponseDto(await this.getOwn.execute(accountId), 'Photo removed.');
  }
}
