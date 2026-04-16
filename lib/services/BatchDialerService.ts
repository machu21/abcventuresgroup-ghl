export class BatchDialerService {
  private apiKey: string;
  private baseUrl = 'https://app.batchdialer.com/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchRecentTaggedLeads() {
    try {
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'GET',
        headers: {
          'X-ApiKey': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`BatchDialer API Error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      // Response shape: { value: [...], Count: number }
      const contacts = data.value || [];

      return contacts.filter((contact: any) => {
        // Check multiple possible fields where BatchDialer stores the "QA HOT" status
        const status = (contact.disposition || contact.last_disposition || contact.status || "").toLowerCase();

        console.log(`Checking contact: ${contact.firstName}, Status found: ${status}`); // This will show in Vercel Logs

        return ['qa hot', 'qa warm', 'qa cold', 'hot', 'warm', 'cold'].includes(status);
      });

    } catch (error: any) {
      console.error("BatchDialer Fetch Error:", error.message);
      return [];
    }
  }
}