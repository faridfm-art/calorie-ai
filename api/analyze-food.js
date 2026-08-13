import "dotenv/config";
import multer from "multer";
import sharp from "sharp";
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
   GEMINI CLIENT
===================================================== */

if (!API_KEY) {
  throw new Error(
    "GEMINI_API_KEY belum diset di Environment Variables."
  );
}

const ai = new GoogleGenAI({
  apiKey: API_KEY
});

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
   JSON CLEANER
===================================================== */

function cleanJsonText(text) {
  if (!text) {
    return "";
  }

  let cleaned = String(text).trim();

  cleaned = cleaned.replace(
    /^```json\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /^```\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s*```$/i,
    ""
  );

  cleaned = cleaned.trim();

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned =
      cleaned.substring(
        firstBrace,
        lastBrace + 1
      );
  }

  return cleaned.trim();
}

/* =====================================================
   NORMALIZE DATA
===================================================== */

function normalizeData(data) {
  if (!data || typeof data !== "object") {
    throw new Error(
      "Response Gemini bukan object JSON."
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
   ANALYZE FOOD HANDLER
===================================================== */

async function analyzeFood(req, res) {

  try {

    /* =================================================
       INPUT
    ================================================= */

    const description =
      String(
        req.body?.description || ""
      ).trim();

    if (
      !req.file &&
      !description
    ) {

      return res.status(400).json({
        error:
          "Kirim foto, deskripsi, atau keduanya."
      });

    }

    console.log("");
    console.log(
      "======================================"
    );

    console.log(
      "CALORIE AI - ANALYZE FOOD"
    );

    console.log(
      "======================================"
    );

    console.log(
      "Description:",
      description || "(tidak ada)"
    );

    console.log(
      "Photo:",
      req.file
        ? `${req.file.originalname} (${req.file.size} bytes)`
        : "tidak ada"
    );

    /* =================================================
       PROMPT
    ================================================= */

    const prompt = `
Kamu adalah AI nutrition assistant untuk aplikasi pencatat kalori.

Analisis makanan dan/atau minuman berdasarkan:
1. foto pengguna jika tersedia
2. deskripsi pengguna jika tersedia

ATURAN UTAMA:

- Identifikasi hanya makanan atau minuman yang terlihat pada foto atau disebutkan pengguna.
- Jangan mengarang makanan yang tidak terlihat atau tidak disebutkan.
- Kalori adalah estimasi.
- Protein, karbohidrat, dan lemak adalah estimasi.
- Jangan mengklaim berat makanan dari foto sebagai berat pasti.
- Jika pengguna memberikan berat atau ukuran porsi secara eksplisit, prioritaskan informasi tersebut.
- Jika berat tidak diberikan, lakukan estimasi yang wajar berdasarkan ukuran visual.
- Untuk makanan gunakan portion_g.
- Untuk minuman gunakan portion_ml.
- Jika portion_g tidak relevan, gunakan 0.
- Jika portion_ml tidak relevan, gunakan 0.
- confidence harus bernilai 0 sampai 1.
- score harus bernilai 0 sampai 10.
- score adalah penilaian kualitas makanan secara umum, bukan diagnosis medis.
- label harus singkat.
- assessment harus singkat dan mudah dipahami.
- suggestion harus praktis.
- Jika ada beberapa makanan/minuman, masukkan semuanya ke foods.
- total harus merupakan jumlah seluruh foods.
- Gunakan Bahasa Indonesia.
- Jangan memberikan markdown.
- Jangan memberikan penjelasan di luar JSON.

DESKRIPSI PENGGUNA:
${description || "(tidak ada deskripsi)"}
`;

    /* =================================================
       GEMINI PARTS
    ================================================= */

    const parts = [
      {
        text: prompt
      }
    ];

    /* =================================================
       IMAGE
    ================================================= */

    if (req.file) {

      console.log(
        "Memproses foto..."
      );

      const compressed =
        await sharp(req.file.buffer)
          .rotate()
          .resize({
            width: 1280,
            height: 1280,
            fit: "inside",
            withoutEnlargement: true
          })
          .jpeg({
            quality: 75,
            mozjpeg: true
          })
          .toBuffer();

      console.log(
        `Image: ${req.file.size} → ${compressed.length} bytes`
      );

      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data:
            compressed.toString("base64")
        }
      });
    }

    /* =================================================
       GEMINI REQUEST
    ================================================= */

    console.log(
      `Mengirim request ke Gemini: ${MODEL}`
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
       GET RESPONSE
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

    console.log(
      "Gemini response diterima."
    );

    console.log(
      "Raw response:",
      raw
    );

    if (
      !raw ||
      typeof raw !== "string"
    ) {

      console.error(
        "FULL RESPONSE:",
        JSON.stringify(
          response,
          null,
          2
        )
      );

      throw new Error(
        "Gemini tidak mengembalikan JSON."
      );

    }

    /* =================================================
       CLEAN
    ================================================= */

    const cleaned =
      cleanJsonText(raw);

    if (!cleaned) {

      throw new Error(
        "Response Gemini kosong."
      );

    }

    console.log(
      "Cleaned JSON:",
      cleaned
    );

    /* =================================================
       PARSE
    ================================================= */

    let parsed;

    try {

      parsed =
        JSON.parse(cleaned);

    } catch (parseError) {

      console.error(
        "JSON PARSE ERROR:",
        parseError.message
      );

      console.error(
        "RAW:",
        raw
      );

      console.error(
        "CLEANED:",
        cleaned
      );

      throw new Error(
        "JSON Gemini tidak valid: " +
        parseError.message
      );

    }

    /* =================================================
       NORMALIZE
    ================================================= */

    const data =
      normalizeData(parsed);

    /* =================================================
       SUCCESS
    ================================================= */

    console.log(
      "ANALISIS BERHASIL"
    );

    console.log(
      "Calories:",
      data.total.calories
    );

    return res.status(200).json(data);

  } catch (err) {

    console.error(
      "ERROR ANALISIS GEMINI:"
    );

    console.error(err);

    const message =
      String(
        err?.message || ""
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
   EXPORT HANDLER
===================================================== */

export default async function handler(req, res) {

  /*
   * Vercel menerima request langsung
   * dari frontend ke /api/analyze-food.
   */

  if (req.method !== "POST") {

    return res.status(405).json({
      error:
        "Method tidak diizinkan. Gunakan POST."
    });

  }

  /*
   * Karena menggunakan multer,
   * proses multipart/form-data di sini.
   */

  upload.single("photo")(req, res, (err) => {

    if (err) {

      console.error(
        "UPLOAD ERROR:",
        err
      );

      if (
        err instanceof multer.MulterError
      ) {

        if (
          err.code ===
          "LIMIT_FILE_SIZE"
        ) {

          return res.status(413).json({
            error:
              "Foto terlalu besar. Maksimum 12 MB."
          });

        }

        return res.status(400).json({
          error:
            err.message
        });

      }

      return res.status(500).json({
        error:
          "Gagal memproses upload foto."
      });

    }

    return analyzeFood(req, res);

  });

}
