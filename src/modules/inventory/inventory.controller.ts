import {
  Body,
  Controller,
  Get,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { FilterMaterialsDto } from './dto/filter-materials.dto';
import { FilterMovementsDto } from './dto/filter-movements.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('categories')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_CREATE)
  createCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.inventoryService.createCategory(actor, createCategoryDto);
  }

  @Get('categories')
  @Roles('ADMIN', 'SUPERADMIN', 'MESA')
  @Permissions(PERMISSIONS.INVENTORY_LIST)
  getCategories() {
    return this.inventoryService.getCategories();
  }

  @Post('materials')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_CREATE)
  createMaterial(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() createMaterialDto: CreateMaterialDto,
  ) {
    return this.inventoryService.createMaterial(actor, createMaterialDto);
  }

  @Get('materials')
  @Roles('ADMIN', 'SUPERADMIN', 'MESA')
  @Permissions(PERMISSIONS.INVENTORY_LIST)
  getMaterials(@Query() query: FilterMaterialsDto) {
    return this.inventoryService.getMaterials(query);
  }

  @Get('materials/low-stock')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_READ)
  getLowStockAlerts() {
    return this.inventoryService.getLowStockAlerts();
  }

  @Get('materials/:id')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_READ)
  getMaterialById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getMaterialById(id);
  }

  @Patch('materials/:id')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_UPDATE)
  updateMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() updateMaterialDto: UpdateMaterialDto,
  ) {
    return this.inventoryService.updateMaterial(id, actor, updateMaterialDto);
  }

  @Post('movements')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_UPDATE)
  registerMovement(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() createMovementDto: CreateMovementDto,
  ) {
    return this.inventoryService.registerMovement(actor, createMovementDto);
  }

  @Get('movements')
  @Roles('ADMIN', 'SUPERADMIN')
  @Permissions(PERMISSIONS.INVENTORY_READ)
  getMovementsHistory(@Query() query: FilterMovementsDto) {
    return this.inventoryService.getMovementsHistory(query);
  }
}
