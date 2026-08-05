import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../common/decorators/user.decorator';
import type { AccessJwtPayload } from '@repo/types';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { EditUserDto } from './dto/edit-user.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { GetUserDto } from './dto/get-user.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get profile info',
    description: 'Get current user profile information',
  })
  @ApiOkResponse({
    description: 'User profile information',
    type: GetProfileDto,
    example: {
      id: 'd56fe82e-00b5-4193-a20f-dd8144f8ad89',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johny',
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'john.doe@example.com',
      verified: true,
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @Get('/profile')
  async getProfile(@User() user: AccessJwtPayload) {
    return await this.usersService.getProfile(user.sub);
  }

  @ApiOperation({
    summary: 'Get user info',
    description: 'Get user profile information by id',
  })
  @ApiOkResponse({
    description: 'User profile information',
    type: GetUserDto,
    example: {
      id: 'd56fe82e-00b5-4193-a20f-dd8144f8ad89',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johny',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the User',
  })
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return await this.usersService.getUserById(id);
  }

  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a new user avatar',
    description: 'Upload a new avatar for the current user',
  })
  @ApiOkResponse({
    description: 'Profile picture uploaded successfully',
    type: MessageResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The avatar image of the user',
        },
      },
      required: ['file'],
    },
  })
  @Put()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 * 10 },
    }), // 10MB
  )
  async uploadProfilePicture(
    @User() user: AccessJwtPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'image/jpeg|image/png|image/webp',
          errorMessage:
            'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 10,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfilePicture(user.sub, file);
  }

  @ApiOperation({
    summary: 'Edit profile info',
    description: 'Edit current user profile information',
  })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    type: MessageResponseDto,
  })
  @ApiBody({
    type: EditUserDto,
  })
  @Patch()
  async editProfile(@User() user: AccessJwtPayload, @Body() data: EditUserDto) {
    return await this.usersService.editProfile(user.sub, data);
  }

  @ApiOperation({
    summary: 'Delete account',
    description: 'Deletes current user account',
  })
  @ApiOkResponse({
    description: 'Profile deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @Delete()
  async deleteProfile(@User() user: AccessJwtPayload) {
    return await this.usersService.deleteProfile(user.sub);
  }
}
