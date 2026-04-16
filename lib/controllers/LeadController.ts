// src/lib/controllers/LeadController.ts
import { GHLService } from '../services/GHLService';
import { LeadPayload, LeadSchema } from '../types/bridge';

export class LeadController {
  private service: GHLService;

  constructor(service: GHLService) {
    this.service = service;
  }

  async processLead(data: any) {
    // 1. Clean the data if coming from BatchDialer (Normalize keys)
    const normalizedData = {
      firstName: data.firstName || data.first_name,
      lastName: data.lastName || data.last_name,
      phone: data.phone?.replace(/\D/g, '') || data.phone_number?.replace(/\D/g, ''),
      email: data.email || '',
      tag: data.tag?.toLowerCase()
    };

    // 2. Validate with Zod
    const validatedLead = LeadSchema.parse(normalizedData);
    
    // 3. Direct to Upsert Service
    return await this.service.upsertContact(validatedLead);
  }
}