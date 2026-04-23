import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { set } from 'zod';

const ai = new GoogleGenAI({});

// 1. Fetch Full Contact from GHL v2
async function getFullContact(contactId: string) {
  const apiKey = process.env.GHL_API_KEY;

  if (!apiKey) {
    console.error("FATAL: GHL_API_KEY is undefined.");
    throw new Error("Missing API Key");
  } else {
    console.log(`Loaded API Key starting with: ${apiKey.substring(0, 5)}...`);
  }

  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-07-28',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GHL ERROR DETAILS: ${errorText}`);
    throw new Error(`Failed to fetch contact. Status: ${response.status}`);
  }

  const data = await response.json();
  return data.contact;
}

// 2. Generate Comps using Gemini
async function generateAIComps(contactData: any) {
  const address = contactData.address1 || "";
  const city = contactData.city || "";
  const state = contactData.state || "";
  const fullAddress = `${address} ${city} ${state}`.trim();

  if (!fullAddress) {
    return "Error: Could not generate comps because this contact has no address saved in GoHighLevel.";
  }

  const prompt = `
    You are an expert real estate wholesale analyst. 
    Please generate a brief, realistic comparables (comps) report for the property located at: ${fullAddress}.
    
    Format the output cleanly:
    1. Provide 3 plausible comparable properties in the same general area.
    2. Include estimated ARV (After Repair Value) for each.
    3. Add a 2-sentence summary of the local market conditions.
    
    Keep the response concise and formatted so it is easy to read inside a CRM note.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "AI generated a blank response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating comps via Gemini.";
  }
}



// 3. Post Note back to GHL v2
async function addNoteToGHLContact(contactId: string, noteBody: string) {
  const apiKey = process.env.GHL_API_KEY;

  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
    },
    body: JSON.stringify({
      body: noteBody,
      userId: ""
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GHL Note Error: ${errorText}`);
    throw new Error("GHL API Error when adding note");
  }
}

const processedIds = new Set<string>();
// 4. Main Webhook Handler
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const contactId = payload.contact_id || payload.id;

    if (processedIds.has(contactId)) {
      console.log(`Duplicate webhook ignored for contact: ${contactId}`);
      return NextResponse.json({ message: 'Duplicate ignored.' }, { status: 200 });
    }
    processedIds.add(contactId);
    setTimeout(() => processedIds.delete(contactId), 10000);

    console.log("INCOMING WEBHOOK ID:", payload.id || payload.contact_id);

    if (!contactId) {
      return NextResponse.json({ error: 'No contact ID provided' }, { status: 400 });
    }

    const fullContactData = await getFullContact(contactId);
    console.log("FETCHED FULL CONTACT:", JSON.stringify({
      name: fullContactData.name,
      address: fullContactData.address1,
      tags: fullContactData.tags
    }));

    let hasAiCompsTag = false;
    const rawTags = fullContactData.tags;

    if (rawTags) {
      if (typeof rawTags === 'string') {
        const lowerTags = rawTags.toLowerCase();
        hasAiCompsTag = lowerTags.includes('ai comps') || lowerTags.includes('ai-comps');
      } else if (Array.isArray(rawTags)) {
        hasAiCompsTag = rawTags.some((tag: string) => {
          const t = String(tag).toLowerCase();
          return t.includes('ai comps') || t.includes('ai-comps');
        });
      }
    }

    if (!hasAiCompsTag) {
      return NextResponse.json({ message: 'Tag not matched on full profile. Ignored.' }, { status: 200 });
    }

    console.log(`Tag matched! Generating comps for ${fullContactData.address1}...`);

    const aiComps = await generateAIComps(fullContactData);
    await addNoteToGHLContact(contactId, `**SVD AI Comps:**\n\n${aiComps}`);

    console.log("Success!");
    return NextResponse.json({ success: true, message: 'AI Comps generated and saved.' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}