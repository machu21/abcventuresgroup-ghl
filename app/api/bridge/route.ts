// src/app/api/bridge/route.ts
import { NextResponse } from 'next/server';
import { GHLService } from '@/lib/services/GHLService';
import { LeadController } from '@/lib/controllers/LeadController';

const ghlService = new GHLService(process.env.GHL_API_KEY!);
const controller = new LeadController(ghlService);

export async function POST(req: Request) {
  try {
    // 1. Read the body ONLY ONCE here
    const body = await req.json();
    
    console.log("DEBUG: INCOMING FROM BATCH DIALER", body);
    
    // 2. Pass the ALREADY READ body to the controller
    const result = await controller.processLead(body);
    
    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error: any) {
    console.error("ERROR:", error.message);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 400 });
  }
}