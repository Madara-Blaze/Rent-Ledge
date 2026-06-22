import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { CreatePolicyDto } from './policies.dto';
import { PoliciesService } from './policies.service';

@ApiTags('Admin · Jurisdiction policies')
@ApiBearerAuth()
@Controller('admin/policies')
export class PoliciesController {
  constructor(
    private readonly svc: PoliciesService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all jurisdiction policy versions (platform admin)' })
  async list(@CurrentUser() user: AuthUser) {
    await this.access.assertPlatformAdmin(user.userId);
    return this.svc.list();
  }

  @Get(':jurisdiction')
  @ApiOperation({ summary: 'All versions for a jurisdiction (platform admin)' })
  async get(@Param('jurisdiction') jurisdiction: string, @CurrentUser() user: AuthUser) {
    await this.access.assertPlatformAdmin(user.userId);
    return this.svc.getByJurisdiction(jurisdiction);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new versioned, effective-dated jurisdiction policy (platform admin)' })
  async create(@Body() dto: CreatePolicyDto, @CurrentUser() user: AuthUser) {
    await this.access.assertPlatformAdmin(user.userId);
    return this.svc.create(dto);
  }
}
