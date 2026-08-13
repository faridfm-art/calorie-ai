import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export default async function handler(req, res) {
  // Hanya menerima POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method tidak diizinkan. Gunakan POST."
    });
  }

  try {
    const {
      weight,
      height,
      age,
      activity,
      goal,
      customTarget
    } = req.body || {};

    // ==============================
    // VALIDASI DATA
    // ==============================

    if (!weight || !height || !age || !activity || !goal) {
      return res.status(400).json({
        success: false,
        error: "Data profil belum lengkap."
      });
    }

    // ==============================
    // PROMPT UNTUK GEMINI
    // ==============================

    const prompt = `
Kamu adalah AI nutrition assistant untuk aplikasi bernama "Dapur Data".

Tugasmu adalah memberikan rekomendasi asupan kalori berdasarkan profil pengguna.

DATA PENGGUNA:
- Berat badan: ${weight} kg
- Tinggi badan: ${height} cm
- Usia: ${age} tahun
- Aktivitas: ${activity}
- Tujuan: ${goal}
- Target kalori yang dipilih sendiri pengguna: ${
      customTarget ? customTarget + " kcal/hari" : "tidak ada"
    }

TUJUAN:
Berikan rekomendasi yang masuk akal dan mudah dipahami.

PERTIMBANGKAN:
1. Perkiraan kebutuhan energi harian.
2. Tujuan pengguna:
   - loss = menurunkan berat badan
   - maintain = mempertahankan berat badan
   - gain = menaikkan berat badan
3. Target kalori yang dipilih sendiri pengguna jika tersedia.
4. Protein harian.
5. Lemak harian.
6. Berikan penjelasan singkat mengenai rekomendasi.
7. Jika target manual pengguna terlalu jauh dari rekomendasi, berikan peringatan yang wajar.
8. Jangan menganggap hasil sebagai diagnosis medis.
9. Gunakan bahasa Indonesia.
10. Jangan memberikan klaim medis yang pasti.

PENTING:
Jika pengguna memiliki target manual, JANGAN mengganti target manual tersebut.
Berikan rekomendasi AI secara terpisah dan berikan pendapat apakah target manual tersebut masih masuk akal.

BALAS HANYA DALAM FORMAT JSON BERIKUT:

{
  "recommendedCalories": 0,
  "protein": 0,
  "fat": 0,
  "summary": "Penjelasan singkat mengenai rekomendasi.",
  "customTargetAdvice": "Pendapat mengenai target manual pengguna."
}
`;

    // ==============================
    // PANGGIL GEMINI
    // ==============================

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    // ==============================
    // AMBIL HASIL AI
    // ==============================

    const text = response.text;

    if (!text) {
      throw new Error("Gemini tidak memberikan respons.");
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Gemini tidak valid:", text);

      throw new Error(
        "Respons AI tidak dapat dibaca sebagai JSON."
      );
    }

    // ==============================
    // VALIDASI HASIL AI
    // ==============================

    if (
      typeof result.recommendedCalories !== "number" ||
      typeof result.protein !== "number" ||
      typeof result.fat !== "number"
    ) {
      throw new Error(
        "Format rekomendasi AI tidak sesuai."
      );
    }

    // ==============================
    // KIRIM HASIL KE HTML
    // ==============================

    return res.status(200).json({
      success: true,
      result: {
        recommendedCalories: Math.round(
          result.recommendedCalories
        ),

        protein: Math.round(
          result.protein
        ),

        fat: Math.round(
          result.fat
        ),

        summary: result.summary || "",

        customTargetAdvice:
          result.customTargetAdvice || ""
      }
    });

  } catch (error) {

    console.error(
      "PROFILE RECOMMENDATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Gagal mendapatkan rekomendasi AI."
    });
  }
}