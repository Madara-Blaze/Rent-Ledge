import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import {
  ApplyLateFeeDto,
  CreateRentInvoiceDto,
  InvoiceDto,
  InvoicePreviewDto,
  LateFeeResultDto,
} from './invoicing.dto';
import { InvoicingService } from './invoicing.service';

@ApiTags('Invoicing')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicingController {
  constructor(
    private readonly svc: InvoicingService,
    private readonly access: AccessService,
  ) {}

  @Post('preview')
  @ApiOperation({ summary: 'Dry-run a rent invoice (escalation + proration breakdown), no writes' })
  async preview(@Body() dto: CreateRentInvoiceDto, @CurrentUser() user: AuthUser): Promise<InvoicePreviewDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.preview(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Issue a rent invoice and post it to the ledger' })
  async create(@Body() dto: CreateRentInvoiceDto, @CurrentUser() user: AuthUser): Promise<InvoiceDto> {
    await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.createRentInvoice(dto);
  }

  @Post('late-fee')
  @ApiOperation({ summary: 'Apply a policy-driven late fee to an overdue invoice' })
  async applyLateFee(@Body() dto: ApplyLateFeeDto, @CurrentUser() user: AuthUser): Promise<LateFeeResultDto> {
    const tenancyId = await this.svc.tenancyIdForInvoice(dto.invoiceId);
    await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.applyLateFee(dto);
  }
}
