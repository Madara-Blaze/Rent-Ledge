import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../../infra/db/db.module';
import { portfolios, properties, units } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { CreatePropertyDto } from './properties.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async createPortfolio(landlordId: string, name: string, actor: string) {
    const [row] = await this.db.insert(portfolios).values({ landlordId, name }).returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'portfolio.create', resourceType: 'portfolio', resourceId: row.id });
    return row;
  }

  listPortfolios(landlordId: string) {
    return this.db.select().from(portfolios).where(eq(portfolios.landlordId, landlordId));
  }

  async createProperty(landlordId: string, dto: CreatePropertyDto, actor: string) {
    const [row] = await this.db
      .insert(properties)
      .values({
        landlordId,
        portfolioId: dto.portfolioId ?? null,
        name: dto.name,
        address: dto.address ?? null,
        type: dto.type ?? 'RESIDENTIAL',
      })
      .returning();
    await this.audit.log({ actorUserId: actor, landlordId, action: 'property.create', resourceType: 'property', resourceId: row.id });
    return row;
  }

  listProperties(landlordId: string) {
    return this.db.select().from(properties).where(eq(properties.landlordId, landlordId));
  }

  async getProperty(propertyId: string) {
    const [row] = await this.db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!row) throw new NotFoundException(`Property ${propertyId} not found`);
    return row;
  }

  async createUnit(propertyId: string, label: string, actor: string) {
    const property = await this.getProperty(propertyId);
    const [row] = await this.db.insert(units).values({ propertyId, label }).returning();
    await this.audit.log({
      actorUserId: actor,
      landlordId: property.landlordId,
      action: 'unit.create',
      resourceType: 'unit',
      resourceId: row.id,
    });
    return row;
  }

  listUnits(propertyId: string) {
    return this.db.select().from(units).where(eq(units.propertyId, propertyId));
  }
}
