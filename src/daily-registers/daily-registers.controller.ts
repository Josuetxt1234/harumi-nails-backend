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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  Permissions,
  PermissionsAny,
} from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateDailyRegisterDto } from './dto/create-daily-register.dto';
import { ListDailyRegistersQueryDto } from './dto/list-daily-registers-query.dto';
import { DailyRegistersService } from './daily-registers.service';

@Controller('daily-registers')
@UseGuards(PermissionsGuard)
export class DailyRegistersController {
  constructor(
    private readonly dailyRegistersService: DailyRegistersService,
  ) {}

  @Post()
  @Permissions(PERMISSIONS.DAILY_REGISTERS_CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() createDailyRegisterDto: CreateDailyRegisterDto,
  ) {
    return this.dailyRegistersService.create(actor, createDailyRegisterDto);
  }

  @Get('mesa-users')
  @Permissions(PERMISSIONS.DAILY_REGISTERS_CREATE)
  listMesaUsers() {
    return this.dailyRegistersService.listActiveMesaUsers();
  }

  @Get('today')
  @Permissions(PERMISSIONS.DAILY_REGISTERS_CREATE)
  listToday(@CurrentUser() actor: AuthenticatedUser) {
    return this.dailyRegistersService.listTodayForActor(actor);
  }

  @Get()
  @PermissionsAny(
    PERMISSIONS.DAILY_REGISTERS_LIST,
    PERMISSIONS.DAILY_REGISTERS_CREATE,
  )
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListDailyRegistersQueryDto,
  ) {
    return this.dailyRegistersService.list(actor, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.DAILY_REGISTERS_READ)
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.dailyRegistersService.getById(id);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.DAILY_REGISTERS_VOID)
  @HttpCode(HttpStatus.NO_CONTENT)
  async voidRegister(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.dailyRegistersService.voidRegister(id, actor);
  }
}
