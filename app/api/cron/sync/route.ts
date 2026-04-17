import { NextResponse } from 'next/server';
import axios from 'axios'; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== 'abcgroup') {
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
  const BATCH_KEY = "638aec5a-0c14-4bc6-a9ba-50af23fcc4b0";
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
  // Left side is BatchDialer. Right side is GoHighLevel.
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
    const translatedTag = tagMap[rawDisposition]; // Converts 'QA COLD' to 'cold lead'
    
    return addToGHL(call, translatedTag); 
  });

  await Promise.allSettled(syncPromises); 
  return validCalls.length;
}

async function addToGHL(callRecord: any, tag: string) {
  const API_KEY = "pit-36de15db-0c6f-4939-a50a-85711f26df17";
  const LOCATION_ID = "I0M7RpC6J5qdQsAC6WVi";

  const primaryPhone = callRecord.customerNumber || '';
  const contactInfo = callRecord.contact || {};
  const rawEmail = contactInfo.email || '';

  if (!primaryPhone && !rawEmail) {
      console.log(`Skipping: No phone or email found in call record`);
      return;
  }

  // 1. Build the base payload without the email
  const payload: any = {
    locationId: LOCATION_ID,
    firstName: contactInfo.firstname || 'Batch',
    lastName: contactInfo.lastname || 'Lead',
    phone: primaryPhone,
    tags: [tag], 
    source: 'BatchDialer'
  };

  // 2. Only attach the email field if it actually has text in it
  if (rawEmail && rawEmail.trim() !== '') {
    payload.email = rawEmail.trim();
  }

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