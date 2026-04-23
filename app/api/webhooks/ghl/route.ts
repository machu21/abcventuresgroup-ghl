import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client
const ai = new GoogleGenAI({});

async function generateAIComps(contactData: any) {
  const address = contactData.address1 || "the subject property";
  const city = contactData.city || "";
  const state = contactData.state || "";
  const fullAddress = `${address} ${city} ${state}`.trim();

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
    const errorData = await response.json();
    console.error("Failed to add note to GHL:", errorData);
    throw new Error("GHL API Error");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // DEBUG: Print the exact data GHL sent us into the Vercel Logs
    console.log("INCOMING GHL PAYLOAD:", JSON.stringify(payload, null, 2));

    const contactId = payload.contact_id || payload.id;
    if (!contactId) {
      return NextResponse.json({ error: 'No contact ID provided' }, { status: 400 });
    }

    // BULLETPROOF TAG CHECKING
    let hasAiCompsTag = false;
    const rawTags = payload.tags;

    if (rawTags) {
      if (typeof rawTags === 'string') {
        // If GHL sends a comma-separated string: "buyer, ai comps, hot lead"
        const lowerTags = rawTags.toLowerCase();
        hasAiCompsTag = lowerTags.includes('ai comps') || lowerTags.includes('ai-comps');
      } else if (Array.isArray(rawTags)) {
        // If GHL sends an array: ["buyer", "ai comps"]
        hasAiCompsTag = rawTags.some(tag => {
          const t = String(tag).toLowerCase();
          return t.includes('ai comps') || t.includes('ai-comps');
        });
      }
    }

    if (!hasAiCompsTag) {
      return NextResponse.json({ message: 'Tag not matched. Ignored.' }, { status: 200 });
    }

    console.log(`Tag matched for contact ${contactId}. Generating comps...`);

    // Generate Comps using Gemini
    const aiComps = await generateAIComps(payload);

    // Send the note back to GHL
    await addNoteToGHLContact(contactId, `**Gemini 2.5 Flash Comps Report**\n\n${aiComps}`);

    console.log("Successfully saved note to GHL!");
    return NextResponse.json({ success: true, message: 'AI Comps generated and saved to GHL.' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}