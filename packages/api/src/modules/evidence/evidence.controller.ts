import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES } from '../rbac/roles';
import { AppendEvidenceDto, CreateDisputeDto, UpdateDisputeDto } from './evidence.dto';
import { EvidenceService } from './evidence.service';

@ApiTags('Evidence vault')
@ApiBearerAuth()
@Controller('workspaces/:landlordId')
export class EvidenceController {
  constructor(
    private readonly svc: EvidenceService,
    private readonly access: AccessService,
  ) {}

  @Post('evidence')
  @ApiOperation({ summary: 'Append a tamper-evident entry to the hash chain' })
  async append(@Param('landlordId') landlordId: string, @Body() dto: AppendEvidenceDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.append(landlordId, dto, user.userId);
  }

  @Get('evidence')
  async list(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser, @Query('disputeCaseId') disputeCaseId?: string) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.list(landlordId, disputeCaseId);
  }

  @Get('evidence/verify')
  @ApiOperation({ summary: 'Verify the integrity of the evidence chain' })
  async verify(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.verify(landlordId);
  }

  @Get('evidence/bundle')
  @ApiOperation({ summary: 'Export a chronological, hash-verified evidence bundle' })
  async bundle(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser, @Query('disputeCaseId') disputeCaseId?: string) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.bundle(landlordId, disputeCaseId);
  }

  @Post('disputes')
  @ApiOperation({ summary: 'Open a dispute case' })
  async createDispute(@Param('landlordId') landlordId: string, @Body() dto: CreateDisputeDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createDispute(landlordId, dto.title, dto.tenancyId, user.userId);
  }

  @Get('disputes')
  async listDisputes(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listDisputes(landlordId);
  }

  @Post('disputes/:disputeId')
  @ApiOperation({ summary: 'Update a dispute case (status / resolution notes)' })
  async updateDispute(
    @Param('landlordId') landlordId: string,
    @Param('disputeId') disputeId: string,
    @Body() dto: UpdateDisputeDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.updateDispute(landlordId, disputeId, dto, user.userId);
  }
}
