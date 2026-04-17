import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  // 1. Security Check
  if (key !== 'abcgroup') {
    return new Response('Invalid Key', { status: 401 });
  }

  try {
    const syncedCount = await syncBatchToGHL();
    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed. Synced ${syncedCount} leads.` 
    });
  } catch (error: any) {
    // This logs the ACTUAL error to your Vercel Dashboard Logs
    console.error('CRON ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function syncBatchToGHL() {
  const BATCH_KEY = "638aec5a-0c14-4bc6-a9ba-50af23fcc4b0";
  
  const response = await fetch('https://api.batchservice.com/batchdialer/v1/contacts?order_by=updated_at&order_dir=desc&limit=20', {
    headers: { 'X-ApiKey': BATCH_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`BatchDialer API failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  // CRITICAL FIX: Safely handle if 'data' is missing or not an array
  const leads = Array.isArray(result.data) ? result.data : 
                Array.isArray(result.results) ? result.results : []; 

  if (leads.length === 0) return 0;

  const allowedTags = ['QA COLD', 'QA HOT', 'QA WARM'];
  let count = 0;

  for (const lead of leads) {
    // Safely get the disposition tag
    const rawTag = lead.last_disposition_name || lead.last_disposition || "";
    const cleanTag = rawTag.toString().toUpperCase();
    
    if (allowedTags.includes(cleanTag)) {
      try {
        await addToGHL(lead, cleanTag);
        count++;
      } catch (ghlErr) {
        console.error("GHL Sync Error for one lead:", ghlErr);
        // Continue to next lead instead of crashing the whole script
      }
    }
  }
  return count;
}

async function addToGHL(contact: any, tag: string) {
  const API_KEY = "pit-36de15db-0c6f-4939-a50a-85711f26df17";
  const LOCATION_ID = "I0M7RpC6J5qdQsAC6WVi";

  // Skip if no phone or email (GHL will reject these anyway)
  if (!contact?.phone && !contact?.email && !contact?.phoneNumber) return;

  const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Version': '2021-04-15'
    },
    body: JSON.stringify({
      locationId: LOCATION_ID,
      firstName: contact?.first_name || contact?.firstName || 'Batch',
      lastName: contact?.last_name || contact?.lastName || 'Lead',
      phone: contact?.phone || contact?.phoneNumber || '',
      email: contact?.email || '',
      tags: [tag], 
      source: 'BatchDialer Cron'
    })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("GHL API Error Details:", errorBody);
  }
}