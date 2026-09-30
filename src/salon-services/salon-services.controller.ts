import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SalonServicesService } from './salon-services.service';

@Controller('services')
@UseGuards(PermissionsGuard)
export class SalonServicesController {
  constructor(private readonly salonServicesService: SalonServicesService) {}

  @Get()
  @Permissions(PERMISSIONS.SERVICES_LIST)
  listServices(@Query('category') category?: string) {
    return this.salonServicesService.listActive(category?.trim() || undefined);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SERVICES_LIST)
  getServiceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salonServicesService.getActiveById(id);
  }
}
