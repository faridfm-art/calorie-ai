import multer from "multer";
import { GoogleGenAI } from "@google/genai";

/* =====================================================
   CONFIG
===================================================== */

const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash";

const API_KEY =
  process.env.GEMINI_API_KEY;

const MAX_IMAGE_BYTES = Number(
  process.env.MAX_IMAGE_BYTES ||
  12 * 1024 * 1024
);

const MAX_OUTPUT_TOKENS = Number(
  process.env.MAX_OUTPUT_TOKENS || 4096
);

/* =====================================================
   GEMINI
===================================================== */

const ai = API_KEY
  ? new GoogleGenAI({
      apiKey: API_KEY
    })
  : null;

/* =====================================================
   MULTER
===================================================== */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_BYTES
  }
});

/* =====================================================
   SCHEMA
===================================================== */

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

/* =====================================================
   NORMALIZE
===================================================== */

function normalizeData(data) {
  if (!data || typeof data !== "object") {
    throw new Error(
      "Response Gemini bukan object."
    );
  }

  if (!Array.isArray(data.foods)) {
    throw new Error(
      "Response Gemini tidak memiliki foods."
    );
  }

  if (
    !data.total ||
    typeof data.total !== "object"
  ) {
    throw new Error(
      "Response Gemini tidak memiliki total."
    );
  }

  return {
    foods: data.foods.map((food) => ({
      name: String(
        food?.name || "Makanan"
      ),

      portion_g: Number(
        food?.portion_g ?? 0
      ),

      portion_ml: Number(
        food?.portion_ml ?? 0
      ),

      calories: Number(
        food?.calories ?? 0
      ),

      protein_g: Number(
        food?.protein_g ?? 0
      ),

      carbs_g: Number(
        food?.carbs_g ?? 0
      ),

      fat_g: Number(
        food?.fat_g ?? 0
      ),

      confidence: Number(
        food?.confidence ?? 0
      )
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

/* =====================================================
   ANALYZE
===================================================== */

async function analyzeFood(req, res) {
  try {

    // CORS untuk website dan Android Capacitor
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (!API_KEY || !ai) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY belum diset di Vercel Environment Variables."
      });
    }


    const description =
      String(
        req.body?.description || ""
      ).trim();

    if (
      !description &&
      !req.file
    ) {
      return res.status(400).json({
        error:
          "Kirim foto, deskripsi, atau keduanya."
      });
    }

    /* =================================================
       PROMPT
    ================================================= */

    const prompt = `
Kamu adalah AI nutrition assistant untuk aplikasi pencatat kalori.

Analisis makanan dan/atau minuman berdasarkan:
1. foto pengguna jika tersedia
2. deskripsi pengguna jika tersedia

ATURAN:

- Identifikasi hanya makanan atau minuman yang terlihat atau disebutkan.
- Jangan mengarang makanan.
- Kalori adalah estimasi.
- Protein, karbohidrat, dan lemak adalah estimasi.
- Jika pengguna memberikan berat atau ukuran porsi, gunakan informasi tersebut.
- Jika berat tidak diberikan, estimasikan berdasarkan ukuran visual.
- Untuk makanan gunakan portion_g.
- Untuk minuman gunakan portion_ml.
- Jika tidak relevan gunakan 0.
- confidence harus 0 sampai 1.
- score harus 0 sampai 10.
- score adalah penilaian kualitas makanan secara umum.
- Jangan memberikan diagnosis medis.
- assessment harus singkat.
- suggestion harus praktis.
- Jika terdapat beberapa makanan, masukkan semuanya ke foods.
- total harus merupakan jumlah seluruh makanan.
- Gunakan Bahasa Indonesia.
- Jangan menggunakan markdown.
- Hanya keluarkan JSON sesuai schema.

DESKRIPSI PENGGUNA:
${description || "(tidak ada deskripsi)"}
`;

    const parts = [
      {
        text: prompt
      }
    ];

    /* =================================================
       IMAGE
    ================================================= */

    if (req.file) {

      const mimeType =
        req.file.mimetype ||
        "image/jpeg";

      const supportedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (
        !supportedTypes.includes(
          mimeType
        )
      ) {
        return res.status(400).json({
          error:
            "Format foto harus JPG, PNG, atau WebP."
        });
      }

      parts.push({
        inlineData: {
          mimeType,
          data:
            req.file.buffer.toString(
              "base64"
            )
        }
      });
    }

    /* =================================================
       GEMINI REQUEST
    ================================================= */

    console.log(
      `Analyzing food with ${MODEL}`
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

    /* =================================================
       RESPONSE
    ================================================= */

    let raw =
      response.text;

    if (
      typeof raw === "function"
    ) {
      raw = raw();
    }

    if (
      raw &&
      typeof raw.then === "function"
    ) {
      raw = await raw;
    }

    if (
      !raw ||
      typeof raw !== "string"
    ) {
      throw new Error(
        "Gemini tidak mengembalikan JSON."
      );
    }

    /* =================================================
       PARSE
    ================================================= */

    let data;

    try {

      data =
        JSON.parse(
          raw.trim()
        );

    } catch {

      const start =
        raw.indexOf("{");

      const end =
        raw.lastIndexOf("}");

      if (
        start === -1 ||
        end === -1
      ) {
        throw new Error(
          "Response Gemini bukan JSON valid."
        );
      }

      data =
        JSON.parse(
          raw.substring(
            start,
            end + 1
          )
        );
    }

    /* =================================================
       NORMALIZE
    ================================================= */

    const normalized =
      normalizeData(data);

    return res.status(200).json(
      normalized
    );

  } catch (error) {

    console.error(
      "ANALYZE FOOD ERROR:",
      error
    );

    const message =
      String(
        error?.message || ""
      );

    if (
      /401|UNAUTHENTICATED|API.?KEY|PERMISSION_DENIED/i
        .test(message)
    ) {
      return res.status(401).json({
        error:
          "Gemini API key tidak valid atau tidak memiliki akses."
      });
    }

    if (
      /404|NOT_FOUND|model.*not.*found|model.*not.*available/i
        .test(message)
    ) {
      return res.status(500).json({
        error:
          `Model "${MODEL}" tidak tersedia.`
      });
    }

    if (
      /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i
        .test(message)
    ) {
      return res.status(429).json({
        error:
          "Quota Gemini tercapai."
      });
    }

    if (
      /LIMIT_FILE_SIZE/i
        .test(message)
    ) {
      return res.status(413).json({
        error:
          "Foto terlalu besar. Maksimum 12 MB."
      });
    }

    return res.status(500).json({
      error:
        message ||
        "Terjadi kesalahan saat menganalisis makanan."
    });
  }
}

/* =====================================================
   VERCEL HANDLER
===================================================== */

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
          "UPLOAD ERROR:",
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

      return analyzeFood(
        req,
        res
      );
    }
  );
}
