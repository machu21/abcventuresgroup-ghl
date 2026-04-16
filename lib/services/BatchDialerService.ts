// src/lib/services/BatchDialerService.ts
export class BatchDialerService {
  private apiKey: string;
  // UPDATE: The host is batchservice.com
  private baseUrl = 'https://api.batchservice.com/api/v1/batchdialer'; 

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchRecentTaggedLeads() {
    try {
      // The endpoint for listing contacts is usually /contacts
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'GET',
        headers: {
          'X-ApiKey': this.apiKey, // BatchDialer specific header
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`BatchDialer API Error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      // Adjust this based on their actual data property (usually 'data' or 'contacts')
      const contacts = data.data || data.contacts || [];

      return contacts.filter((contact: any) => {
        const leadTags = Array.isArray(contact.tags) 
          ? contact.tags.map((t: string) => t.toLowerCase())
          : [contact.tag?.toLowerCase()];

        return leadTags.some((tag: string) => ['hot', 'warm', 'cold', 'qa hot', 'qa warm', 'qa cold'].includes(tag));
      });
    } catch (error: any) {
      console.error("BatchDialer Fetch Error:", error.message);
      return [];
    }
  }
}