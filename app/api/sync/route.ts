import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // 1. Security Check
  // In cron-job.org, add a custom header or a query param. 
  // Let's use a simple query param for ease: ?key=mysecret
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== 'abcgroup') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const syncedCount = await syncBatchToGHL();
    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${syncedCount} leads.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function syncBatchToGHL() {
  const BATCH_KEY = "638aec5a-0c14-4bc6-a9ba-50af23fcc4b0";
  
  const response = await fetch('https://api.batchservice.com/batchdialer/v1/contacts?order_by=updated_at&order_dir=desc&limit=20', {
    headers: { 'X-ApiKey': BATCH_KEY }
  });
  
  const result = await response.json();
  const leads = result.data || result.results || []; 

  const allowedTags = ['QA COLD', 'QA HOT', 'QA WARM'];
  let count = 0;

  for (const lead of leads) {
    const rawTag = lead.last_disposition_name || lead.last_disposition || "";
    const cleanTag = rawTag.toUpperCase();
    
    if (allowedTags.includes(cleanTag)) {
      await addToGHL(lead, cleanTag);
      count++;
    }
  }
  return count;
}

async function addToGHL(contact: any, tag: string) {
  const API_KEY = "pit-36de15db-0c6f-4939-a50a-85711f26df17";
  const LOCATION_ID = "I0M7RpC6J5qdQsAC6WVi";

  await fetch('https://services.leadconnectorhq.com/contacts/', {
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
}