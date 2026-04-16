import { NextResponse } from 'next/server';
import { BatchDialerService } from '@/lib/services/BatchDialerService';
import { LeadController } from '@/lib/controllers/LeadController';
import { GHLService } from '@/lib/services/GHLService';

const batchService = new BatchDialerService(process.env.BATCHDIALER_KEY!);
const ghlService = new GHLService(process.env.GHL_API_KEY!);
const controller = new LeadController(ghlService);

export async function GET() {
  try {
    // 1. Ask BatchDialer: "Who did we mark as Hot/Warm/Cold in the last 5 mins?"
    const recentLeads = await batchService.fetchRecentTaggedLeads();

    // 2. Loop through them and push to GHL
    const results = await Promise.all(
            recentLeads.map((lead: unknown) => controller.processLead(lead))
    );

    return NextResponse.json({ success: true, processed: results.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}