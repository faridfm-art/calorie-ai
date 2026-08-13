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
   API KEY CHECK
===================================================== */

if (!API_KEY) {
  throw new Error(
    "GEMINI_API_KEY belum diset di Vercel Environment Variables."
  );
}

/* =====================================================
   GEMINI CLIENT
===================================================== */

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
   GEMINI RESPONSE SCHEMA
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
   CLEAN JSON
===================================================== */

function cleanJsonText(text) {
  if (!text) {
    return "";
  }

  let cleaned = String(text).trim();

  // Hapus markdown code fence
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

  // Cari object JSON
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
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Response Gemini bukan object JSON."
    );
  }

  if (
    !Array.isArray(data.foods)
  ) {
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
   ANALYZE FOOD
===================================================== */

async function analyzeFood(
  req,
  res
) {
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

    console.log(
      "======================================"
    );

    console.log(
      "CALORIE AI - ANALYZE FOOD"
    );

    console.log(
      "Model:",
      MODEL
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
- Jika portion_g tidak relevan, isi 0.
- Jika portion_ml tidak relevan, isi 0.
- confidence harus bernilai 0 sampai 1.
- score harus bernilai 0 sampai 10.
- score adalah penilaian kualitas makanan secara umum.
- Bukan diagnosis medis.
- label harus singkat.
- assessment harus singkat.
- suggestion harus praktis.
- Jika ada beberapa makanan/minuman, masukkan semuanya ke foods.
- total harus merupakan jumlah seluruh foods.
- Gunakan Bahasa Indonesia.
- Jangan memberikan markdown.
- Jangan memberikan penjelasan di luar JSON.

PENTING:

Kamu WAJIB mengembalikan JSON yang mengikuti schema yang diberikan.

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
        "Memasukkan foto langsung ke Gemini..."
      );

      /*
       * TIDAK menggunakan sharp.
       * File dikirim langsung dalam bentuk base64.
       */

      parts.push({
        inlineData: {
          mimeType:
            req.file.mimetype ||
            "image/jpeg",

          data:
            req.file.buffer.toString(
              "base64"
            )
        }
      });

      console.log(
        "Foto siap dikirim:",
        req.file.size,
        "bytes"
      );
    }

    /* =================================================
       GEMINI REQUEST
    ================================================= */

    console.log(
      "Mengirim request ke Gemini..."
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
       GET RESPONSE TEXT
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
        "Gemini response object:"
      );

      try {
        console.error(
          JSON.stringify(
            response,
            null,
            2
          )
        );
      } catch {
        console.error(
          response
        );
      }

      throw new Error(
        "Gemini tidak mengembalikan JSON."
      );
    }

    /* =================================================
       CLEAN JSON
    ================================================= */

    const cleaned =
      cleanJsonText(raw);

    console.log(
      "Cleaned JSON:",
      cleaned
    );

    if (!cleaned) {
      throw new Error(
        "Response Gemini kosong."
      );
    }

    /* =================================================
       PARSE JSON
    ================================================= */

    let parsed;

    try {

      parsed =
        JSON.parse(cleaned);

    } catch (parseError) {

      console.error(
        "======================================"
      );

      console.error(
        "JSON PARSE ERROR"
      );

      console.error(
        parseError.message
      );

      console.error(
        "RAW RESPONSE:"
      );

      console.error(
        raw
      );

      console.error(
        "CLEANED RESPONSE:"
      );

      console.error(
        cleaned
      );

      console.error(
        "======================================"
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
      "======================================"
    );

    console.log(
      "ANALISIS BERHASIL"
    );

    console.log(
      "Foods:",
      data.foods.length
    );

    console.log(
      "Calories:",
      data.total.calories
    );

    console.log(
      "Protein:",
      data.total.protein_g
    );

    console.log(
      "Carbs:",
      data.total.carbs_g
    );

    console.log(
      "Fat:",
      data.total.fat_g
    );

    console.log(
      "======================================"
    );

    return res.status(200).json(
      data
    );

  } catch (err) {

    console.error(
      "======================================"
    );

    console.error(
      "ERROR ANALISIS GEMINI"
    );

    console.error(
      err
    );

    console.error(
      "======================================"
    );

    const message =
      String(
        err?.message || ""
      );

    /* =================================================
       API KEY
    ================================================= */

    if (
      /API[_ ]?key|401|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID/i
        .test(message)
    ) {

      return res.status(500).json({
        error:
          "Gemini API key tidak valid atau tidak punya akses."
      });
    }

    /* =================================================
       MODEL
    ================================================= */

    if (
      /404|NOT_FOUND|model.*not.*available|model.*not.*found/i
        .test(message)
    ) {

      return res.status(500).json({
        error:
          `Model "${MODEL}" tidak tersedia untuk API key ini.`
      });
    }

    /* =================================================
       QUOTA
    ================================================= */

    if (
      /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i
        .test(message)
    ) {

      return res.status(429).json({
        error:
          "Quota Gemini tercapai. Periksa quota atau billing Google AI Studio."
      });
    }

    /* =================================================
       FILE SIZE
    ================================================= */

    if (
      /LIMIT_FILE_SIZE/i.test(
        message
      )
    ) {

      return res.status(413).json({
        error:
          "Foto terlalu besar. Maksimum 12 MB."
      });
    }

    /* =================================================
       OTHER ERROR
    ================================================= */

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

export default async function handler(
  req,
  res
) {

  /* =================================================
     METHOD
  ================================================= */

  if (
    req.method !== "POST"
  ) {

    return res.status(405).json({
      error:
        "Method tidak diizinkan. Gunakan POST."
    });
  }

  /* =================================================
     MULTER
  ================================================= */

  upload.single("photo")(
    req,
    res,
    async (err) => {

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

      try {

        await analyzeFood(
          req,
          res
        );

      } catch (error) {

        console.error(
          "UNHANDLED HANDLER ERROR:",
          error
        );

        if (!res.headersSent) {
          return res.status(500).json({
            error:
              error?.message ||
              "Terjadi kesalahan pada server."
          });
        }
      }
    }
  );
}
