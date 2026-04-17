import { NextResponse } from 'next/server';
// We are keeping the import but will bypass KV for now to prevent crashes
import { kv } from '@vercel/kv'; 
import { BatchDialerService } from '@/lib/services/BatchDialerService';
import { LeadController } from '@/lib/controllers/LeadController';
import { GHLService } from '@/lib/services/GHLService';

export async function GET(request: Request) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    console.error("CRON AUTH FAILED: Check your CRON_SECRET in Vercel and Cron-job.org");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batchService = new BatchDialerService(process.env.BATCHDIALER_KEY!);
    const ghlService = new GHLService(process.env.GHL_API_KEY!);
    const controller = new LeadController(ghlService);

    // 2. Fetch the leads from BatchDialer
    const leads = await batchService.fetchRecentTaggedLeads();
    
    // DEBUG LOG: See if the API is actually returning anything
    console.log(`TOTAL LEADS FETCHED FROM BATCHDIALER: ${leads.length}`);

    let syncedCount = 0;

    for (const lead of leads) {
      try {
        /* NOTE: KV is bypassed here until you set up your database.
           GHL's internal "Upsert" logic will prevent duplicate contacts, 
           but it will log an "Update" every time this cron runs.
        */
        
        // Push lead to GoHighLevel
        await controller.processLead(lead);
        
        syncedCount++;
        console.log(`SUCCESS: Synced lead ${lead.firstName || 'Unknown'} (${lead.id || 'No ID'})`);

      } catch (leadError: any) {
        console.error(`LEAD PROCESSING ERROR [${lead.id}]:`, leadError.message);
        // Continue to the next lead even if one fails
        continue;
      }
    }

    console.log(`[${new Date().toISOString()}] Sync complete. Total Synced this run: ${syncedCount}`);

    return NextResponse.json({ 
      success: true, 
      processed: syncedCount,
      fetched: leads.length
    });

  } catch (error: any) {
    console.error("CRON GLOBAL ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}