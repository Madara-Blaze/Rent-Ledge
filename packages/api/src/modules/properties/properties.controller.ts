import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessService } from '../rbac/access.service';
import { MANAGE_ROLES, READ_ROLES } from '../rbac/roles';
import { CreatePortfolioDto, CreatePropertyDto, CreateUnitDto } from './properties.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller()
export class PropertiesController {
  constructor(
    private readonly svc: PropertiesService,
    private readonly access: AccessService,
  ) {}

  @Post('workspaces/:landlordId/portfolios')
  @ApiOperation({ summary: 'Create a portfolio' })
  async createPortfolio(@Param('landlordId') landlordId: string, @Body() dto: CreatePortfolioDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createPortfolio(landlordId, dto.name, user.userId);
  }

  @Get('workspaces/:landlordId/portfolios')
  async listPortfolios(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listPortfolios(landlordId);
  }

  @Post('workspaces/:landlordId/properties')
  @ApiOperation({ summary: 'Create a property' })
  async createProperty(@Param('landlordId') landlordId: string, @Body() dto: CreatePropertyDto, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, MANAGE_ROLES);
    return this.svc.createProperty(landlordId, dto, user.userId);
  }

  @Get('workspaces/:landlordId/properties')
  async listProperties(@Param('landlordId') landlordId: string, @CurrentUser() user: AuthUser) {
    await this.access.assertWorkspaceAccess(user.userId, landlordId, READ_ROLES);
    return this.svc.listProperties(landlordId);
  }

  @Get('properties/:propertyId')
  async getProperty(@Param('propertyId') propertyId: string, @CurrentUser() user: AuthUser) {
    const property = await this.svc.getProperty(propertyId);
    await this.access.assertWorkspaceAccess(user.userId, property.landlordId, READ_ROLES);
    return property;
  }

  @Post('properties/:propertyId/units')
  @ApiOperation({ summary: 'Add a unit to a property' })
  async createUnit(@Param('propertyId') propertyId: string, @Body() dto: CreateUnitDto, @CurrentUser() user: AuthUser) {
    const property = await this.svc.getProperty(propertyId);
    await this.access.assertWorkspaceAccess(user.userId, property.landlordId, MANAGE_ROLES);
    return this.svc.createUnit(propertyId, dto.label, user.userId);
  }

  @Get('properties/:propertyId/units')
  async listUnits(@Param('propertyId') propertyId: string, @CurrentUser() user: AuthUser) {
    const property = await this.svc.getProperty(propertyId);
    await this.access.assertWorkspaceAccess(user.userId, property.landlordId, READ_ROLES);
    return this.svc.listUnits(propertyId);
  }
}
