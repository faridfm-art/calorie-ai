export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "analyze-food function berjalan",
    method: req.method,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "tidak ada"
  });
}