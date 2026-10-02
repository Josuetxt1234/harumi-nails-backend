import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CancelAdvanceDto } from './dto/cancel-advance.dto';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { QueryAdvancesDto } from './dto/query-advances.dto';
import { AdvancesService } from './advances.service';

@Controller('advances')
@UseGuards(PermissionsGuard)
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Post()
  @Permissions(PERMISSIONS.ADVANCES_CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() createAdvanceDto: CreateAdvanceDto,
  ) {
    return this.advancesService.create(actor, createAdvanceDto);
  }

  @Get('me')
  @Permissions(PERMISSIONS.ADVANCES_READ)
  listMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryAdvancesDto,
  ) {
    return this.advancesService.findMine(actor, query);
  }

  @Get()
  @Permissions(PERMISSIONS.ADVANCES_LIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryAdvancesDto,
  ) {
    return this.advancesService.findAll(actor, query);
  }

  @Patch(':id/cancel')
  @Permissions(PERMISSIONS.ADVANCES_CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() cancelAdvanceDto: CancelAdvanceDto,
  ) {
    return this.advancesService.cancel(id, actor, cancelAdvanceDto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ADVANCES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.advancesService.remove(id);
  }
}
