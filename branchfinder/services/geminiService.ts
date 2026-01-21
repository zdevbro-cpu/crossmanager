import { GoogleGenAI } from "@google/genai";
import { BRANCH_DB } from "../constants";

let ai: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }
  return ai;
};

// We inject the database into the system instruction
const SYSTEM_INSTRUCTION = `
You are the intelligent virtual assistant for "Seoul Retail," a chain of retail stores in Seoul.
You have access to the following database of our branches:
${JSON.stringify(BRANCH_DB, null, 2)}

Your goal is to assist customers who are looking for information about our branches.
- When asked about locations, hours, or phone numbers, provide accurate data from the database.
- You can calculate rough directions or relative locations (e.g., "Gangnam is south of the river").
- Be polite, concise, and helpful.
- If a user asks something unrelated to our stores or locations, politely steer them back to store topics.
- Answer in the language the user speaks (English or Korean).
`;

export const sendMessageToGemini = async (
  message: string,
  history: { role: string; parts: { text: string }[] }[]
) => {
  try {
    const client = getAIClient();
    
    // We map the simplified history to the Gemini format
    const chat = client.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I am having trouble connecting to the network right now. Please try again later.";
  }
};