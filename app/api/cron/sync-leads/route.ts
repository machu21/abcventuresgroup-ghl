import { NextResponse } from 'next/server';
import { LeadController } from '@/lib/controllers/LeadController';
import { GHLService } from '@/lib/services/GHLService';

// Notice we changed GET to POST
export async function POST(request: Request) {
  try {
    // 1. Catch the data BatchDialer throws at us
    const leadData = await request.json();
    
    // DEBUG: This will print the EXACT payload BatchDialer sends so we can map it perfectly!
    console.log("🚨 WEBHOOK RECEIVED:", JSON.stringify(leadData));

    // 2. Initialize GHL Service
    const ghlService = new GHLService(process.env.GHL_API_KEY!);
    const controller = new LeadController(ghlService);

    // 3. Send it directly to GoHighLevel
    // Note: We'll refine the data mapping once we see the log, but this passes it to your controller
    await controller.processLead(leadData);

    console.log(`✅ Successfully pushed ${leadData.first_name || 'Lead'} to GHL`);

    // 4. Tell BatchDialer we received it successfully
    return NextResponse.json({ success: true, message: "Webhook caught and processed" });

  } catch (error: any) {
    console.error("❌ WEBHOOK ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// We leave a GET route just so you can test if the URL is online in your browser
export async function GET() {
  return NextResponse.json({ status: "Webhook receiver is live and waiting for BatchDialer POST requests." });
}