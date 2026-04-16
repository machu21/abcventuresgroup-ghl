import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { BatchDialerService } from '@/lib/services/BatchDialerService';
import { LeadController } from '@/lib/controllers/LeadController';
import { GHLService } from '@/lib/services/GHLService';

export async function GET(request: Request) {
  // 1. Security Check: Compare the header to your Environment Variable
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batchService = new BatchDialerService(process.env.BATCHDIALER_KEY!);
    const ghlService = new GHLService(process.env.GHL_API_KEY!);
    const controller = new LeadController(ghlService);

    // 2. Fetch the leads
    const leads = await batchService.fetchRecentTaggedLeads();
    let syncedCount = 0;

    for (const lead of leads) {
      const cacheKey = `synced_lead:${lead.id || lead._id}`;
      const alreadySynced = await kv.get(cacheKey);

      if (!alreadySynced) {
        await controller.processLead(lead);
        // Mark as synced for 7 days
        await kv.set(cacheKey, 'true', { ex: 604800 }); 
        syncedCount++;
      }
    }

    console.log(`[${new Date().toISOString()}] Sync complete. New: ${syncedCount}`);

    return NextResponse.json({ 
      success: true, 
      processed: syncedCount 
    });

  } catch (error: any) {
    console.error("CRON ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}