import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client
// It will automatically pick up process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

async function generateAIComps(contactData: any) {
  // Extract the address from standard GHL fields (or custom fields if you use them)
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

// Function to push the generated comps back to GHL as a Note
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
      userId: "" // Optional: Assign the note to a specific GHL user ID
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

    const tags = payload.tags || '';
    const contactId = payload.contact_id || payload.id;

    if (!contactId) {
      return NextResponse.json({ error: 'No contact ID provided' }, { status: 400 });
    }

    const hasAiCompsTag = typeof tags === 'string' 
      ? tags.toLowerCase().includes('ai comps') 
      : tags.includes('ai comps');

    if (!hasAiCompsTag) {
      return NextResponse.json({ message: 'Tag not matched. Ignored.' }, { status: 200 });
    }

    // Generate Comps using Gemini 2.5 Flash
    const aiComps = await generateAIComps(payload);

    // Send the note back to GHL
    await addNoteToGHLContact(contactId, `**Gemini 2.5 Flash Comps Report**\n\n${aiComps}`);

    return NextResponse.json({ success: true, message: 'AI Comps generated and saved to GHL.' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}