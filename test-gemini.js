import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

console.log("API key terbaca:", !!process.env.GEMINI_API_KEY);
console.log(
  "Panjang API key:",
  process.env.GEMINI_API_KEY?.length || 0
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

try {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: "Balas hanya dengan kata: OK"
  });

  console.log("BERHASIL!");
  console.log(response.text);

} catch (error) {

  console.error("GAGAL!");
  console.error(error);
}