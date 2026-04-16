import { LeadPayload } from "../types/bridge";

// src/lib/services/GHLService.ts
export class GHLService {
  private baseUrl = 'https://services.leadconnectorhq.com';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async upsertContact(data: LeadPayload) {
    // 1. Create or Update the Contact with the Tag
    const contactRes = await fetch(`${this.baseUrl}/contacts/upsert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        tags: [`${data.tag} lead`],
        source: 'BatchDialer'
      }),
    });

    const contactJson = await contactRes.json();

    // 2. Add a Note if the contact was successfully handled
    if (contactJson.contact?.id) {
      await this.addContactNote(contactJson.contact.id, data.tag);
    }

    return contactJson;
  }

  private async addContactNote(contactId: string, tag: string) {
    const timestamp = new Date().toLocaleString();
    await fetch(`${this.baseUrl}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify({
        body: `Lead imported from BatchDialer as a ${tag.toUpperCase()} lead on ${timestamp}.`,
        userId: process.env.GHL_USER_ID // Optional: assign the note to a specific user
      }),
    });
  }
}