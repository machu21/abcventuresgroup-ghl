import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { BatchDialerService } from '@/lib/services/BatchDialerService';
import { LeadController } from '@/lib/controllers/LeadController';
import { GHLService } from '@/lib/services/GHLService';

const batchService = new BatchDialerService(process.env.BATCHDIALER_KEY!);
const ghlService = new GHLService(process.env.GHL_API_KEY!);
const controller = new LeadController(ghlService);

export async function GET(request: Request) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const leads = await batchService.fetchRecentTaggedLeads();
    let syncedCount = 0;

    for (const lead of leads) {
      // Use the BatchDialer Lead ID as a unique key
      const cacheKey = `synced_lead:${lead.id}`;
      
      // 2. Check if we've already synced this lead
      const alreadySynced = await kv.get(cacheKey);

      if (!alreadySynced) {
        // 3. Process the lead through your OOP logic
        await controller.processLead(lead);

        // 4. Mark as synced for 7 days (so we don't check forever)
        await kv.set(cacheKey, 'true', { ex: 604800 }); 
        syncedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      newLeadsSynced: syncedCount,
      totalChecked: leads.length 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}