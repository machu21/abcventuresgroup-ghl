import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

// 1. NEW: Fetch the complete contact profile directly from GHL
async function getFullContact(contactId: string) {
  const apiKey = process.env.GHL_API_KEY;
  
  const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contact details from GHL. Status: ${response.status}`);
  }

  const data = await response.json();
  return data.contact; // GHL v1 API returns data nested inside a 'contact' object
}

// 2. Generate the Comps using Gemini
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

// 3. Post the Note back to GHL
async function addNoteToGHLContact(contactId: string, noteBody: string) {
  const apiKey = process.env.GHL_API_KEY;
  
  const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: noteBody,
      userId: "" 
    }),
  });

  if (!response.ok) {
    throw new Error("GHL API Error when adding note");
  }
}

// 4. Main Webhook Handler
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("INCOMING WEBHOOK ID:", payload.id || payload.contact_id);

    const contactId = payload.contact_id || payload.id;
    if (!contactId) {
      return NextResponse.json({ error: 'No contact ID provided' }, { status: 400 });
    }

    // Fetch the FULL data from GHL so we don't rely on the skinny webhook payload
    const fullContactData = await getFullContact(contactId);
    console.log("FETCHED FULL CONTACT:", JSON.stringify({
      name: fullContactData.name,
      address: fullContactData.address1,
      tags: fullContactData.tags
    }));

    // Check tags safely
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

    // Generate Comps
    const aiComps = await generateAIComps(fullContactData);

    // Save Note
    await addNoteToGHLContact(contactId, `**Gemini 2.5 Flash Comps Report**\n\n${aiComps}`);

    console.log("Success!");
    return NextResponse.json({ success: true, message: 'AI Comps generated and saved.' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}