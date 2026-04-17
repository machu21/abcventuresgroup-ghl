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
      const contacts = data.value || [];

      // 1. LOG THE RAW DATA (Check your Vercel Logs for this!)
      if (contacts.length > 0) {
        console.log("DEBUG: First Contact Keys:", Object.keys(contacts[0]));
        console.log("DEBUG: First Contact Sample:", JSON.stringify(contacts[0]));
      } else {
        console.log("DEBUG: BatchDialer returned 0 contacts total. Check if the API Key has access to any campaigns.");
      }

      // 2. FILTER LOGIC
      return contacts.filter((contact: any) => {
        // We look for any field that might contain our tag
        const disposition = (contact.dispositionName || contact.disposition || contact.last_disposition || "").toLowerCase();
        const status = (contact.status || contact.statusName || "").toLowerCase();
        
        // Match against our FAR AGENTS target list
        const targets = ['qa hot', 'qa warm', 'qa cold', 'hot', 'warm', 'cold'];
        
        const isMatch = targets.includes(disposition) || targets.includes(status);

        if (isMatch) {
          console.log(`MATCH FOUND: ${contact.firstName} with Status: ${disposition || status}`);
        }

        return isMatch;
      });

    } catch (error: any) {
      console.error("BatchDialer Fetch Error:", error.message);
      return [];
    }
  }
}