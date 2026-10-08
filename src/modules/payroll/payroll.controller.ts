import {
  BadRequestException,
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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PAYROLL_ERROR_MESSAGES } from './constants/payroll.constants';
import { ClosePayrollDto } from './dto/close-payroll.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('preview')
  @Permissions(PERMISSIONS.PAYROLL_CREATE)
  preview(@Body() generatePayrollDto: GeneratePayrollDto) {
    return this.payrollService.calculatePreview(generatePayrollDto);
  }

  @Post('generate')
  @Permissions(PERMISSIONS.PAYROLL_CREATE)
  generate(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() generatePayrollDto: GeneratePayrollDto,
  ) {
    return this.payrollService.generate(generatePayrollDto, actor);
  }

  @Get('me')
  @Permissions(PERMISSIONS.PAYROLL_READ)
  listMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryPayrollDto,
  ) {
    return this.payrollService.findMine(actor, query);
  }

  @Get('me/:id')
  @Permissions(PERMISSIONS.PAYROLL_READ)
  findMineById(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollService.findMineById(actor, id);
  }

  @Get()
  @Permissions(PERMISSIONS.PAYROLL_LIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryPayrollDto,
  ) {
    return this.payrollService.findAll(actor, query);
  }

  @Patch(':id/close')
  @Permissions(PERMISSIONS.PAYROLL_CLOSE)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() closePayrollDto: ClosePayrollDto,
  ) {
    if (closePayrollDto.payrollId !== id) {
      throw new BadRequestException(PAYROLL_ERROR_MESSAGES.PAYROLL_ID_MISMATCH);
    }

    return this.payrollService.closePayroll(id, actor);
  }
}
