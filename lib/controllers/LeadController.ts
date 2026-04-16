// src/lib/controllers/LeadController.ts
import { GHLService } from '../services/GHLService';
import { LeadPayload, LeadSchema } from '../types/bridge';

export class LeadController {
  private service: GHLService;

  constructor(service: GHLService) {
    this.service = service;
  }

  // src/lib/controllers/LeadController.ts

  async processLead(data: any) {
    // 1. Map "QA HOT" to just "hot" so it passes Zod validation
    let rawTag = (data.tag || data.disposition || "").toLowerCase();

    // Strip "qa " if it exists
    const cleanTag = rawTag.replace('qa ', '').trim();

    const normalizedData = {
      firstName: data.firstName || data.first_name,
      lastName: data.lastName || data.last_name,
      phone: data.phone?.replace(/\D/g, '') || data.phone_number?.replace(/\D/g, ''),
      email: data.email || '',
      tag: cleanTag // Now "qa hot" becomes "hot"
    };

    const validatedLead = LeadSchema.parse(normalizedData);
    return await this.service.upsertContact(validatedLead);
  }
}