import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, OWNER_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { AddendumDto, ComplianceDto, CreateAgreementDto, SignAgreementDto } from './agreements.dto';
import { AgreementsService } from './agreements.service';

@ApiTags('Agreements')
@ApiBearerAuth()
@Controller()
export class AgreementsController {
  constructor(
    private readonly svc: AgreementsService,
    private readonly access: AccessService,
  ) {}

  @Post('agreements')
  @ApiOperation({ summary: 'Create an agreement from a template (renders v1, sets stamp/registration flags)' })
  async create(@Body() dto: CreateAgreementDto, @CurrentUser() user: AuthUser) {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.createFromTemplate(landlordId, dto, user.userId);
  }

  @Get('tenancies/:tenancyId/agreements')
  async list(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.listForTenancy(tenancyId);
  }

  @Get('agreements/:id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForAgreement(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.getAgreement(id);
  }

  @Post('agreements/:id/send')
  @ApiOperation({ summary: 'Send a draft agreement out for signature' })
  async send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForAgreement(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.sendForSignature(id, user.userId);
  }

  @Post('agreements/:id/sign')
  @ApiOperation({ summary: 'e-Sign the current version; locks the document once landlord + tenant sign' })
  async sign(
    @Param('id') id: string,
    @Body() dto: SignAgreementDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-forwarded-for') ip?: string,
  ) {
    const tenancyId = await this.svc.tenancyIdForAgreement(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.sign(id, dto, user.userId, ip);
  }

  @Post('agreements/:id/addendum')
  @ApiOperation({ summary: 'Create a linked addendum (new version); supersedes the original' })
  async addendum(@Param('id') id: string, @Body() dto: AddendumDto, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForAgreement(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, OWNER_ROLES);
    return this.svc.createAddendum(id, dto, user.userId);
  }

  @Post('agreements/:id/compliance')
  @ApiOperation({ summary: 'Update stamp-duty / registration / Rent-Authority status' })
  async compliance(@Param('id') id: string, @Body() dto: ComplianceDto, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForAgreement(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.updateCompliance(id, dto, user.userId);
  }
}
