const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const { SarvamAIClient } = require("sarvamai");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Temporary audio storage
const upload = multer({
    dest: "uploads/",
});

// Sarvam AI
const sarvam = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Health Voice AI Backend is running!",
    });
});

// ===============================
// SPEECH TO TEXT
// ===============================

app.post(
    "/api/transcribe",
    upload.single("audio"),
    async (req, res) => {
        try {
            console.log("Audio received!");

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No audio file received",
                });
            }

            console.log("Audio file:", req.file.originalname);
            console.log("Converting speech to text...");

            // Send audio to Sarvam
            const response = await sarvam.speechToText.transcribe({
                file: fs.createReadStream(req.file.path),
                model: "saaras:v3",
                mode: "transcribe",
                languageCode: "unknown",
            });

            console.log("Sarvam response:", response);

            console.log("Transcription:", response.transcript);

            // Delete temporary audio
            fs.unlinkSync(req.file.path);

            res.json({
                success: true,
                text: response.transcript,
                language: response.languageCode,
            });

        } catch (error) {
            console.error("Sarvam transcription error:");
            console.error(error);

            // Delete temporary file
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                success: false,
                message: "Speech-to-text failed",
                error: error.message,
            });
        }
    }
);
// ===============================
// AI CHAT
// ===============================

app.post("/api/chat", async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                message: "Messages are required",
            });
        }

        console.log("Sending conversation to Sarvam AI...");

        const response = await sarvam.chat.completions({
            model: "sarvam-105b-conversations",

            messages: [
                {
                    role: "system",
                    content: `
You are a friendly AI health screening assistant.

Your job is to conduct a basic health intake conversation.

Ask ONE question at a time.

Collect these details:
1. Name
2. Main health concern or symptom
3. How long the problem has been happening
4. Severity from 1 to 10
5. Other related symptoms

Rules:
- Be friendly and conversational.
- Keep responses short because they will eventually be spoken aloud.
- Do not diagnose diseases.
- Do not prescribe medicines.
- If the user mentions a serious emergency symptom, tell them to seek immediate professional medical help.
- Remember information already provided.
- Do not repeat questions that have already been answered.
- If an answer is unclear, ask a simple follow-up question.
- Respond in the same language as the user when possible.
          `,
                },

                ...messages,
            ],

            temperature: 0.2,
            max_tokens: 300,
            reasoning_effort: null,
        });

        const reply = response.choices[0].message.content;

        console.log("AI reply:", reply);

        res.json({
            success: true,
            reply: reply,
        });

    } catch (error) {
        console.error("AI chat error:", error);

        res.status(500).json({
            success: false,
            message: "AI response failed",
            error: error.message,
        });
    }
});
// ===============================
// TEXT TO SPEECH
// ===============================

app.post("/api/speak", async (req, res) => {
    try {
        const { text, language } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: "Text is required",
            });
        }

        console.log("Converting AI text to speech...");

        const response = await sarvam.textToSpeech.convert({
            text: text,
            target_language_code: language || "en-IN",
            model: "bulbul:v3",
            speaker: language === "hi-IN" ? "shubh" : "ratan",
            speech_sample_rate: 24000,
        });

        console.log("TTS generated successfully");

        res.json({
            success: true,
            audio: response.audios[0],
        });

    } catch (error) {
        console.error("TTS error:", error);

        res.status(500).json({
            success: false,
            message: "Text-to-speech failed",
            error: error.message,
        });
    }
});
// ===============================
// HEALTH REPORT
// ===============================

app.post("/api/report", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: "Conversation is required",
      });
    }

    console.log("Creating health report...");

    const response = await sarvam.chat.completions({
      model: "sarvam-105b-conversations",

      messages: [
        {
          role: "system",
          content: `
You are creating a basic health screening summary.

Read the conversation and return ONLY valid JSON.

Use exactly this structure:

{
  "mainConcern": "",
  "keySymptoms": [],
  "duration": "",
  "severity": "",
  "followUp": ""
}

Rules:

- Only use information actually provided by the user.
- Never invent medical information.
- If something was not provided, use "Not provided".
- keySymptoms must be an array.
- Keep the report short and clear.
- This is a screening summary, NOT a diagnosis.
- Do not prescribe medication.
- Mention professional medical follow-up when appropriate.
          `,
        },

        ...messages,
      ],

      temperature: 0.1,
      max_tokens: 400,
      reasoning_effort: null,
    });

    let reportText = response.choices[0].message.content;

    console.log("Raw report:", reportText);

    // Remove markdown code fences if the AI adds them
    reportText = reportText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const report = JSON.parse(reportText);

    res.json({
      success: true,
      report: report,
    });

  } catch (error) {
    console.error("Report error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create health report",
      error: error.message,
    });
  }
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});