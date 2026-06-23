import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { NoticeType } from '../../domain/notices/notice-rules';
import { Channel } from '../notifications/notification.adapter';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES_WITH_TENANT } from '../rbac/roles';
import { CreateNoticeDto, SendNoticeDto } from './notices.dto';
import { NoticesService } from './notices.service';

@ApiTags('Notices')
@ApiBearerAuth()
@Controller()
export class NoticesController {
  constructor(
    private readonly svc: NoticesService,
    private readonly access: AccessService,
  ) {}

  @Post('notices')
  @ApiOperation({ summary: 'Draft a typed legal notice (computes its statutory notice window)' })
  async create(@Body() dto: CreateNoticeDto, @CurrentUser() user: AuthUser) {
    const { landlordId } = await this.access.assertTenancyAccess(user.userId, dto.tenancyId, MANAGE_ROLES);
    return this.svc.create(landlordId, { ...dto, type: dto.type as NoticeType }, user.userId);
  }

  @Post('notices/:id/send')
  @ApiOperation({ summary: 'Send a notice (enforces notice period, logs to evidence, dispatches)' })
  async send(@Param('id') id: string, @Body() dto: SendNoticeDto, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForNotice(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, MANAGE_ROLES);
    return this.svc.send(id, (dto.channel ?? 'EMAIL') as Channel, user.userId);
  }

  @Get('tenancies/:tenancyId/notices')
  async list(@Param('tenancyId') tenancyId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.listForTenancy(tenancyId);
  }

  @Get('notices/:id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const tenancyId = await this.svc.tenancyIdForNotice(id);
    await this.access.assertTenancyAccess(user.userId, tenancyId, READ_ROLES_WITH_TENANT);
    return this.svc.getNotice(id);
  }
}
