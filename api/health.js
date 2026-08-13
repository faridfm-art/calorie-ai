export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "calorie-ai-backend",
    provider: "Google Gemini",
    model: process.env.GEMINI_MODEL || "tidak ada",
    hasGeminiKey: !!process.env.GEMINI_API_KEY
  });
}