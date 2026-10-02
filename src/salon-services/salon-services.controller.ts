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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { ToggleServiceStatusDto } from './dto/toggle-service-status.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SalonServicesService } from './salon-services.service';

@Controller('services')
@UseGuards(PermissionsGuard)
export class SalonServicesController {
  constructor(private readonly salonServicesService: SalonServicesService) {}

  @Post()
  @Permissions(PERMISSIONS.SERVICES_CREATE)
  create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.salonServicesService.create(createServiceDto, actor.id);
  }

  @Get()
  @Permissions(PERMISSIONS.SERVICES_LIST)
  findAll(@Query() query: QueryServicesDto) {
    return this.salonServicesService.findAll(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SERVICES_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salonServicesService.findOne(id);
  }

  @Patch(':id/status')
  @Permissions(PERMISSIONS.SERVICES_UPDATE)
  toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() toggleServiceStatusDto: ToggleServiceStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.salonServicesService.toggleStatus(
      id,
      toggleServiceStatusDto,
      actor.id,
    );
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SERVICES_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.salonServicesService.update(
      id,
      updateServiceDto,
      actor.id,
    );
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SERVICES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.salonServicesService.remove(id, actor.id);
  }
}
