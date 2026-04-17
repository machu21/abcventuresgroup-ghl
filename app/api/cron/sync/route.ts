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
  
  // 1. Fetch from BatchDialer
  const response = await fetch('https://api.batchservice.com/batchdialer/v1/contacts?order_by=updated_at&order_dir=desc&limit=10', {
    headers: { 'X-ApiKey': BATCH_KEY },
    signal: AbortSignal.timeout(5000) // Timeout BatchDialer after 5 seconds
  });
  
  if (!response.ok) throw new Error(`BatchDialer down: ${response.status}`);

  const result = await response.json();
  const leads = Array.isArray(result.data) ? result.data : result.results || []; 

  if (leads.length === 0) return 0;

  const allowedTags = ['QA COLD', 'QA HOT', 'QA WARM'];
  
  // 2. Filter leads first
  const validLeads = leads.filter((lead: any) => {
    const tag = (lead.last_disposition_name || lead.last_disposition || "").toString().toUpperCase();
    return allowedTags.includes(tag);
  });

  // 3. Fire all GHL requests at the same time (Parallel)
  // This is much faster than the 'for...of' loop
  const syncPromises = validLeads.map((lead: any) => {
    const tag = (lead.last_disposition_name || lead.last_disposition || "").toUpperCase();
    return addToGHL(lead, tag);
  });

  await Promise.allSettled(syncPromises); 
  
  return validLeads.length;
}

async function addToGHL(contact: any, tag: string) {
  const API_KEY = "pit-36de15db-0c6f-4939-a50a-85711f26df17";
  const LOCATION_ID = "I0M7RpC6J5qdQsAC6WVi";

  // Quick validation to avoid unnecessary fetch calls
  const phone = contact?.phone || contact?.phoneNumber || '';
  const email = contact?.email || '';
  if (!phone && !email) return;

  return fetch('https://services.leadconnectorhq.com/contacts/', {
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
      phone,
      email,
      tags: [tag], 
      source: 'BatchDialer Cron'
    }),
    signal: AbortSignal.timeout(4000) // Timeout GHL after 4 seconds
  }).catch(e => console.error("Individual lead fetch failed", e.message));
}