import { NextResponse } from 'next/server';
import axios from 'axios'; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const syncedCount = await syncBatchToGHL();
    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (error: any) {
    console.error('SYSTEM ERROR:', error); 
    return NextResponse.json({ 
      error: "fetch failed", 
      details: error.message,
      check: "Check Vercel Logs for the full trace"
    }, { status: 500 });
  }
}

async function syncBatchToGHL() {
  const BATCH_KEY = process.env.BATCH_API_KEY;
  if (!BATCH_KEY) throw new Error("Missing BATCH_API_KEY in environment variables.");

  const BATCH_URL = 'https://app.batchdialer.com/api/v2/cdrs?page=1&pageSize=10';
  
  let result;
  try {
    const response = await axios.get(BATCH_URL, {
      headers: { 'X-ApiKey': BATCH_KEY }
    });
    result = response.data;
  } catch (e: any) {
    throw new Error(`BatchDialer Connection Failed: ${e.message}`);
  }

  const calls = result.items || []; 
  if (calls.length === 0) return 0;

  // 1. The Translation Dictionary
  const tagMap: { [key: string]: string } = {
    'QA COLD': 'cold lead',
    'QA WARM': 'warm lead',
    'QA HOT': 'hot lead'
  };
  
  // 2. Filter using the dictionary keys
  const validCalls = calls.filter((call: any) => {
    const rawDisposition = (call.disposition || "").toString().toUpperCase();
    return Object.keys(tagMap).includes(rawDisposition);
  });

  console.log(`Matched ${validCalls.length} calls with the QA tags.`);

  // 3. Translate the tag before sending to GHL
  const syncPromises = validCalls.map((call: any) => {
    const rawDisposition = (call.disposition || "").toString().toUpperCase();
    const translatedTag = tagMap[rawDisposition]; 
    
    return addToGHL(call, translatedTag); 
  });

  await Promise.allSettled(syncPromises); 
  return validCalls.length;
}

async function addToGHL(callRecord: any, tag: string) {
  const API_KEY = process.env.GHL_API_KEY;
  const LOCATION_ID = process.env.GHL_LOCATION_ID;

  if (!API_KEY || !LOCATION_ID) {
    console.error("Missing GHL environment variables.");
    return;
  }

  const primaryPhone = callRecord.customerNumber || '';
  const contactInfo = callRecord.contact || {};
  const rawEmail = contactInfo.email || '';

  if (!primaryPhone && !rawEmail) {
      console.log(`Skipping: No phone or email found in call record`);
      return;
  }

  // 1. Build the base payload
  const payload: any = {
    locationId: LOCATION_ID,
    firstName: contactInfo.firstname || 'Batch',
    lastName: contactInfo.lastname || 'Lead',
    phone: primaryPhone,
    tags: [tag], 
    source: 'BatchDialer'
  };

  // 2. Attach email if it exists
  if (rawEmail && rawEmail.trim() !== '') {
    payload.email = rawEmail.trim();
  }

  // 3. Attach Address data (Mapping BatchDialer keys to GHL API keys)
  if (contactInfo.address) payload.address1 = contactInfo.address;
  if (contactInfo.city) payload.city = contactInfo.city;
  if (contactInfo.state) payload.state = contactInfo.state;
  if (contactInfo.zip) payload.postalCode = contactInfo.zip;

  try {
    const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-04-15'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`GHL Rejected Lead (${primaryPhone}):`, errorText);
    } else {
      console.log(`Successfully added ${contactInfo.firstname || 'Lead'} to GHL with tag: ${tag}`);
    }
  } catch (e: any) {
    console.error("GHL Network/Push Failed for 1 lead:", e.message);
  }
}