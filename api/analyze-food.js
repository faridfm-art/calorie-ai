import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash";

const API_KEY =
  process.env.GEMINI_API_KEY;

const MAX_IMAGE_BYTES = Number(
  process.env.MAX_IMAGE_BYTES || 12 * 1024 * 1024
);

const MAX_OUTPUT_TOKENS = Number(
  process.env.MAX_OUTPUT_TOKENS || 4096
);

if (!API_KEY) {
  throw new Error(
    "GEMINI_API_KEY belum diset di Vercel Environment Variables."
  );
}

const ai = new GoogleGenAI({
  apiKey: API_KEY
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES
  }
});

const schema = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string"
          },
          portion_g: {
            type: "number"
          },
          portion_ml: {
            type: "number"
          },
          calories: {
            type: "number"
          },
          protein_g: {
            type: "number"
          },
          carbs_g: {
            type: "number"
          },
          fat_g: {
            type: "number"
          },
          confidence: {
            type: "number"
          }
        },
        required: [
          "name",
          "portion_g",
          "portion_ml",
          "calories",
          "protein_g",
          "carbs_g",
          "fat_g",
          "confidence"
        ]
      }
    },

    total: {
      type: "object",
      properties: {
        calories: {
          type: "number"
        },
        protein_g: {
          type: "number"
        },
        carbs_g: {
          type: "number"
        },
        fat_g: {
          type: "number"
        }
      },
      required: [
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g"
      ]
    },

    confidence: {
      type: "number"
    },

    score: {
      type: "number"
    },

    label: {
      type: "string"
    },

    assessment: {
      type: "string"
    },

    suggestion: {
      type: "string"
    }
  },

  required: [
    "foods",
    "total",
    "confidence",
    "score",
    "label",
    "assessment",
    "suggestion"
  ]
};

function normalizeData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Response Gemini bukan object.");
  }

  if (!Array.isArray(data.foods)) {
    throw new Error(
      "Response Gemini tidak memiliki foods."
    );
  }

  if (!data.total || typeof data.total !== "object") {
    throw new Error(
      "Response Gemini tidak memiliki total."
    );
  }

  return {
    foods: data.foods.map((food) => ({
      name: String(food?.name || "Makanan"),

      portion_g: Number(food?.portion_g ?? 0),

      portion_ml: Number(food?.portion_ml ?? 0),

      calories: Number(food?.calories ?? 0),

      protein_g: Number(food?.protein_g ?? 0),

      carbs_g: Number(food?.carbs_g ?? 0),

      fat_g: Number(food?.fat_g ?? 0),

      confidence: Number(food?.confidence ?? 0)
    })),

    total: {
      calories: Number(
        data.total.calories ?? 0
      ),

      protein_g: Number(
        data.total.protein_g ?? 0
      ),

      carbs_g: Number(
        data.total.carbs_g ?? 0
      ),

      fat_g: Number(
        data.total.fat_g ?? 0
      )
    },

    confidence: Number(
      data.confidence ?? 0
    ),

    score: Number(
      data.score ?? 0
    ),

    label: String(
      data.label || "Cukup"
    ),

    assessment: String(
      data.assessment ||
      "Analisis makanan berhasil."
    ),

    suggestion: String(
      data.suggestion ||
      "Perhatikan porsi dan keseimbangan nutrisi."
    )
  };
}

async function processRequest(req, res) {
  try {
    const description =
      String(
        req.body?.description || ""
      ).trim();

    console.log(
      "[Calorie AI] Description:",
      description
    );

    console.log(
      "[Calorie AI] Photo:",
      req.file
        ? req.file.originalname
        : "none"
    );

    if (!description && !req.file) {
      return res.status(400).json({
        error:
          "Kirim foto, deskripsi, atau keduanya."
      });
    }

    const prompt = `
Kamu adalah AI nutrition assistant untuk aplikasi pencatat kalori.

Analisis makanan dan minuman berdasarkan deskripsi dan foto jika tersedia.

ATURAN:

- Identifikasi hanya makanan atau minuman yang terlihat atau disebutkan.
- Jangan mengarang makanan.
- Semua nilai nutrisi adalah estimasi.
- Jika pengguna memberikan berat atau ukuran porsi, gunakan informasi tersebut.
- Jika berat tidak diberikan, lakukan estimasi yang masuk akal.
- Makanan menggunakan portion_g.
- Minuman menggunakan portion_ml.
- Jika tidak relevan, isi nilai tersebut dengan 0.
- confidence antara 0 dan 1.
- score antara 0 dan 10.
- score adalah penilaian kualitas makanan secara umum.
- Bukan diagnosis medis.
- Gunakan Bahasa Indonesia.
- Jika ada beberapa makanan, masukkan semuanya ke foods.
- total harus merupakan jumlah seluruh foods.
- Jangan memberikan markdown.
- Jangan memberikan teks di luar JSON.

DESKRIPSI PENGGUNA:

${description || "(tidak ada deskripsi)"}
`;

    const parts = [
      {
        text: prompt
      }
    ];

    if (req.file) {
      console.log(
        "[Calorie AI] Image MIME:",
        req.file.mimetype
      );

      console.log(
        "[Calorie AI] Image size:",
        req.file.size
      );

      parts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64")
        }
      });
    }

    console.log(
      "[Calorie AI] Calling Gemini:",
      MODEL
    );

    const response =
      await ai.models.generateContent({
        model: MODEL,

        contents: [
          {
            role: "user",
            parts
          }
        ],

        config: {
          responseMimeType:
            "application/json",

          responseJsonSchema:
            schema,

          maxOutputTokens:
            MAX_OUTPUT_TOKENS
        }
      });

    console.log(
      "[Calorie AI] Gemini response received"
    );

    let raw = response.text;

    if (typeof raw === "function") {
      raw = raw();
    }

    if (
      raw &&
      typeof raw.then === "function"
    ) {
      raw = await raw;
    }

    console.log(
      "[Calorie AI] Raw response:",
      raw
    );

    if (!raw || typeof raw !== "string") {
      throw new Error(
        "Gemini tidak mengembalikan JSON."
      );
    }

    let cleaned = raw.trim();

    if (
      cleaned.startsWith("```json")
    ) {
      cleaned = cleaned
        .replace(/^```json/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    if (
      cleaned.startsWith("```")
    ) {
      cleaned = cleaned
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    let data;

    try {
      data = JSON.parse(cleaned);
    } catch {
      const first =
        cleaned.indexOf("{");

      const last =
        cleaned.lastIndexOf("}");

      if (
        first === -1 ||
        last === -1 ||
        last <= first
      ) {
        throw new Error(
          "Gemini mengembalikan response yang bukan JSON."
        );
      }

      const extracted =
        cleaned.substring(
          first,
          last + 1
        );

      data = JSON.parse(extracted);
    }

    const normalized =
      normalizeData(data);

    console.log(
      "[Calorie AI] SUCCESS:",
      normalized.total.calories,
      "kcal"
    );

    return res.status(200).json(
      normalized
    );

  } catch (error) {
    console.error(
      "[Calorie AI] ERROR:"
    );

    console.error(error);

    const message =
      String(
        error?.message || error || ""
      );

    if (
      /API[_ ]?key|401|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID/i
        .test(message)
    ) {
      return res.status(500).json({
        error:
          "Gemini API key tidak valid atau tidak punya akses."
      });
    }

    if (
      /404|NOT_FOUND|model.*not.*available|model.*not.*found/i
        .test(message)
    ) {
      return res.status(500).json({
        error:
          `Model "${MODEL}" tidak tersedia untuk API key ini.`
      });
    }

    if (
      /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i
        .test(message)
    ) {
      return res.status(429).json({
        error:
          "Quota Gemini tercapai. Periksa quota atau billing Google AI Studio."
      });
    }

    return res.status(500).json({
      error:
        message ||
        "Terjadi kesalahan saat menganalisis makanan."
    });
  }
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error:
        "Method tidak diizinkan. Gunakan POST."
    });
  }

  upload.single("photo")(
    req,
    res,
    (error) => {

      if (error) {
        console.error(
          "[Calorie AI] Upload error:",
          error
        );

        if (
          error instanceof multer.MulterError
        ) {
          if (
            error.code ===
            "LIMIT_FILE_SIZE"
          ) {
            return res.status(413).json({
              error:
                "Foto terlalu besar. Maksimum 12 MB."
            });
          }

          return res.status(400).json({
            error:
              error.message
          });
        }

        return res.status(500).json({
          error:
            "Gagal memproses upload foto."
        });
      }

      return processRequest(
        req,
        res
      );
    }
  );
}
