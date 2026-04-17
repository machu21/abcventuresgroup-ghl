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
      // 1. Combine your parameters: Target the campaign and grab the 50 most recent
      // Note: Depending on BatchDialer's API, adding &sort=-updatedAt is a common way to get newest first
      const url = `${this.baseUrl}/contacts?campaignId=${this.campaignId}&limit=50`;
      
      console.log(`Fetching from: ${url}`); // Let's log this so you can see it in Vercel

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
      const contacts = data.value || [];
      
      console.log(`Found ${contacts.length} contacts in Campaign ${this.campaignId}`);

      // 2. Filter for your FAR AGENTS targets
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