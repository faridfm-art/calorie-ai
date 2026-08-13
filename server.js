import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

/* =====================================================
   APP
===================================================== */

const app = express();

/* =====================================================
   CONFIG
===================================================== */

const PORT = Number(process.env.PORT || 3000);

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
  console.error("");
  console.error("======================================");
  console.error("ERROR: GEMINI_API_KEY TIDAK DITEMUKAN");
  console.error("======================================");
  console.error("");
  console.error("Pastikan file .env berisi:");
  console.error("");
  console.error("GEMINI_API_KEY=API_KEY_KAMU");
  console.error("GEMINI_MODEL=gemini-3.5-flash");
  console.error("");
  process.exit(1);
}

/* =====================================================
   STARTUP LOG
===================================================== */

console.log("");
console.log("======================================");
console.log("CALORIE AI BACKEND");
console.log("======================================");
console.log("API key terbaca :", true);
console.log("Panjang API key:", API_KEY.length);
console.log("Model          :", MODEL);
console.log("Port           :", PORT);
console.log(
  "Max image      :",
  MAX_IMAGE_BYTES,
  "bytes"
);
console.log(
  "Max output     :",
  MAX_OUTPUT_TOKENS,
  "tokens"
);
console.log("======================================");
console.log("");

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
   MIDDLEWARE
===================================================== */

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(express.static("public"));

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "calorie-ai-backend",
    provider: "Google Gemini",
    model: MODEL
  });
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
   CLEAN JSON RESPONSE
===================================================== */

function cleanJsonText(text) {
  if (!text) {
    return "";
  }

  let cleaned = String(text).trim();

  /* Remove markdown code fence */

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

  /*
   * Cari object JSON pertama.
   */

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
   NORMALIZE GEMINI DATA
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

  const foods = data.foods.map((food) => {
    return {
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
    };
  });

  return {
    foods,

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

app.post(
  "/api/analyze-food",
  upload.single("photo"),

  async (req, res) => {
    try {
      /* =================================================
         INPUT
      ================================================= */

      const description =
        String(
          req.body.description || ""
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

      /* =================================================
         REQUEST LOG
      ================================================= */

      console.log("");
      console.log("======================================");
      console.log("REQUEST ANALISIS MAKANAN");
      console.log("======================================");

      console.log(
        "Deskripsi:",
        description || "(tidak ada)"
      );

      if (req.file) {
        console.log(
          "Foto:",
          req.file.originalname
        );

        console.log(
          "Ukuran asli:",
          req.file.size,
          "bytes"
        );
      } else {
        console.log(
          "Foto: tidak ada"
        );
      }

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
         PROCESS IMAGE
      ================================================= */

      if (req.file) {
        console.log("");
        console.log(
          "Memproses dan mengompres foto..."
        );

        const compressed =
          await sharp(
            req.file.buffer
          )
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
          "Ukuran foto:",
          req.file.size,
          "→",
          compressed.length,
          "bytes"
        );

        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data:
              compressed.toString(
                "base64"
              )
          }
        });

        console.log(
          "Foto berhasil dimasukkan ke request."
        );
      }

      /* =================================================
         GEMINI REQUEST
      ================================================= */

      console.log("");
      console.log(
        "======================================"
      );

      console.log(
        `Mengirim analisis ke Gemini (${MODEL})...`
      );

      console.log(
        "======================================"
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
         RESPONSE DEBUG
      ================================================= */

      console.log("");
      console.log(
        "======================================"
      );

      console.log(
        "GEMINI RESPONSE DITERIMA"
      );

      console.log(
        "======================================"
      );

      console.log(
        "response.text type:",
        typeof response.text
      );

      console.log(
        "response.text:"
      );

      console.log(
        response.text
      );

      console.log(
        "======================================"
      );

      /* =================================================
         GET RESPONSE TEXT
      ================================================= */

      let raw =
        response.text;

      /*
       * Beberapa versi SDK dapat memberikan
       * response.text sebagai getter.
       */

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
        console.error("");
        console.error(
          "FULL GEMINI RESPONSE:"
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
          "Gemini tidak mengembalikan teks JSON."
        );
      }

      /* =================================================
         CLEAN JSON
      ================================================= */

      console.log("");
      console.log(
        "Membersihkan response JSON..."
      );

      const cleaned =
        cleanJsonText(raw);

      console.log("");
      console.log(
        "========== CLEANED JSON =========="
      );

      console.log(
        cleaned
      );

      console.log(
        "=================================="
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
        console.error("");
        console.error(
          "======================================"
        );

        console.error(
          "JSON PARSE ERROR"
        );

        console.error(
          "======================================"
        );

        console.error(
          "Pesan:",
          parseError.message
        );

        console.error("");
        console.error(
          "RAW RESPONSE:"
        );

        console.error(
          raw
        );

        console.error("");
        console.error(
          "CLEANED RESPONSE:"
        );

        console.error(
          cleaned
        );

        console.error(
          "======================================"
        );

        /*
         * Jangan mengganti error dengan pesan
         * generik yang menyulitkan debugging.
         */

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
         SUCCESS LOG
      ================================================= */

      console.log("");
      console.log(
        "======================================"
      );

      console.log(
        "ANALISIS BERHASIL"
      );

      console.log(
        "======================================"
      );

      console.log(
        "Jumlah makanan:",
        data.foods.length
      );

      console.log(
        "Total kalori:",
        data.total.calories,
        "kcal"
      );

      console.log(
        "Protein:",
        data.total.protein_g,
        "g"
      );

      console.log(
        "Karbohidrat:",
        data.total.carbs_g,
        "g"
      );

      console.log(
        "Lemak:",
        data.total.fat_g,
        "g"
      );

      console.log(
        "Confidence:",
        data.confidence
      );

      console.log(
        "Score:",
        data.score,
        "/10"
      );

      console.log(
        "Label:",
        data.label
      );

      console.log(
        "======================================"
      );

      /* =================================================
         RETURN
      ================================================= */

      return res.json(data);

    } catch (err) {
      /* =================================================
         ERROR
      ================================================= */

      console.error("");
      console.error(
        "######################################"
      );

      console.error(
        "# ERROR ANALISIS GEMINI"
      );

      console.error(
        "######################################"
      );

      console.error(err);

      console.error(
        "######################################"
      );

      const message =
        String(
          err?.message || ""
        );

      let error =
        "Terjadi kesalahan saat menganalisis makanan.";

      /* API KEY */

      if (
        /API[_ ]?key|API_KEY|401|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID/i.test(
          message
        )
      ) {
        error =
          "Gemini API key tidak valid atau tidak punya akses.";
      }

      /* MODEL */

      else if (
        /404|NOT_FOUND|model.*not.*available|model.*not.*found/i.test(
          message
        )
      ) {
        error =
          `Model "${MODEL}" tidak tersedia untuk API key ini.`;
      }

      /* QUOTA */

      else if (
        /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(
          message
        )
      ) {
        error =
          "Quota Gemini tercapai. Periksa quota atau billing Google AI Studio.";
      }

      /* FILE */

      else if (
        /LIMIT_FILE_SIZE/i.test(
          message
        )
      ) {
        error =
          "Foto terlalu besar. Maksimum 12 MB.";
      }

      /* JSON */

      else if (
        /JSON|parse|Unexpected token|response.*JSON/i.test(
          message
        )
      ) {
        error =
          message;
      }

      /* OTHER */

      else if (message) {
        error =
          message;
      }

      return res.status(500).json({
        error
      });
    }
  }
);

/* =====================================================
   MULTER ERROR HANDLER
===================================================== */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
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

    console.error(
      "SERVER ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Terjadi kesalahan pada server."
    });
  }
);

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("======================================");
  console.log(`Calorie AI berjalan di port ${PORT}`);
  console.log("Provider: Google Gemini");
  console.log(`Model: ${MODEL}`);
  console.log("Mode: PRODUCTION");
  console.log("======================================");
});