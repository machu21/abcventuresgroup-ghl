export class BatchDialerService {
  private apiKey: string;
  private baseUrl = 'https://app.batchdialer.com/api';
  // We add the campaign ID here. (Later, you can move this to Vercel Env Vars!)
  private campaignId = '353263';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchRecentTaggedLeads() {
    try {
      // 1. Use the EXACT parameter structure from your PowerShell script
      const url = `${this.baseUrl}/contacts?campaignId=${this.campaignId}&page=1&pageSize=50`;

      console.log(`Fetching from: ${url}`);

      const response = await fetch(url, {
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

      // 2. LOG THE RAW RESPONSE: This is the ultimate truth-teller!
      console.log("RAW BATCH API RESPONSE:", JSON.stringify(data).substring(0, 300));

      const contacts = data.value || data.contacts || data.data || [];

      console.log(`Found ${contacts.length} contacts in Campaign ${this.campaignId}`);

      return contacts.filter((contact: any) => {
        const status = (contact.disposition || contact.dispositionName || contact.status || "").toLowerCase();
        return ['qa hot', 'qa warm', 'qa cold', 'hot', 'warm', 'cold'].includes(status);
      });

    } catch (error: any) {
      console.error("BatchDialer Fetch Error:", error.message);
      return [];
    }
  }
}