export class BatchDialerService {
  private apiKey: string;
  // Standard BatchDialer API Base
  private baseUrl = 'https://api.batchservice.com/api/v1/batchdialer';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchRecentTaggedLeads() {
    try {
      // Note: We use the 'contacts' endpoint as BatchDialer treats leads as contacts
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'GET',
        headers: {
          'X-ApiKey': this.apiKey, // Correct header for BatchDialer
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BatchDialer API Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // BatchDialer usually returns an array in a 'data' or 'contacts' property
      const contacts = data.data || data.contacts || [];

      // Filter for leads that have the tags: hot, warm, or cold
      return contacts.filter((contact: any) => {
        // Handle cases where tags might be an array or a single string
        const leadTags = Array.isArray(contact.tags) 
          ? contact.tags.map((t: string) => t.toLowerCase())
          : [contact.tag?.toLowerCase()];

        return leadTags.some((tag: string) => ['hot', 'warm', 'cold'].includes(tag));
      });
    } catch (error) {
      console.error("BatchDialer Fetch Error:", error);
      return [];
    }
  }
}