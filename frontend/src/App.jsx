import { useRef, useState } from "react";

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [messages, setMessages] = useState([]);
  const [report, setReport] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Start the call
  const startCall = async () => {
    try {
      // Ask browser for microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      console.log("Microphone permission granted!");

      setIsCalling(true);

      // Create recorder
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      audioChunksRef.current = [];

      // When audio data is available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording starts
      mediaRecorder.onstart = () => {
        console.log("Recording started");
        setIsRecording(true);
      };

      // When recording stops
      mediaRecorder.onstop = async () => {
        console.log("Recording stopped");

        setIsRecording(false);

        // Create audio file
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Put audio inside FormData
        const formData = new FormData();

        formData.append("audio", audioBlob, "recording.webm");

        try {
          console.log("Sending audio to backend...");

          const response = await fetch(
            "https://health-voice-ai-backend.onrender.com/api/transcribe",
            {
              method: "POST",
              body: formData,
            }
          );

          const data = await response.json();

          console.log("Backend response:", data);

          if (data.success) {
            const userText = data.text;

            // Show what the user said
            setTranscript(userText);

            // Add user's message to conversation
            const updatedMessages = [
              ...messages,
              {
                role: "user",
                content: userText,
              },
            ];

            setMessages(updatedMessages);

            // Send conversation to AI
            console.log("Sending text to AI...");

            const aiResponse = await fetch(
              "https://health-voice-ai-backend.onrender.com/api/chat",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messages: updatedMessages,
                }),
              }
            );

            const aiData = await aiResponse.json();

            console.log("AI response:", aiData);

            if (aiData.success) {
              setAiReply(aiData.reply);

              // Save AI message
              setMessages([
                ...updatedMessages,
                {
                  role: "assistant",
                  content: aiData.reply,
                },
              ]);

              // =========================
              // MAKE AI SPEAK
              // =========================

              console.log("Generating AI voice...");

              const speechResponse = await fetch(
                "https://health-voice-ai-backend.onrender.com/api/speak",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    text: aiData.reply,
                    language: data.language || "en-IN",
                  }),
                }
              );

              const speechData = await speechResponse.json();

              console.log("TTS response:", speechData);

              if (speechData.success) {
                const audio = new Audio(
                  `data:audio/wav;base64,${speechData.audio}`
                );

                console.log("Playing AI voice...");

                audio.play().catch((error) => {
                  console.error("Audio playback failed:", error);
                });
              }
            }
          }
        } catch (error) {
          console.error("Upload error:", error);
        }

        // Clear old audio
        audioChunksRef.current = [];
      };

      // Start recording
      mediaRecorder.start();
    } catch (error) {
      console.error("Microphone error:", error);

      alert(
        "Please allow microphone permission to start the health screening."
      );
    }
  };

  // End the call
  const endCall = async () => {
    console.log("Call ended");

    setIsCalling(false);

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }

    // Create health report
    if (messages.length > 0) {
      console.log("Creating health report...");

      try {
        const response = await fetch(
          "https://health-voice-ai-backend.onrender.com/api/report",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: messages,
            }),
          }
        );

        const data = await response.json();

        console.log("Health report:", data);

        if (data.success) {
          setReport(data.report);
        }
      } catch (error) {
        console.error("Report error:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">

        {/* Logo */}
        <div className="text-6xl mb-6">
          🩺
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold mb-3">
          Health Voice AI
        </h1>

        <p className="text-slate-400 mb-10">
          Your AI health screening assistant
        </p>

        {/* Microphone */}
        <div
          className={`mx-auto mb-8 w-32 h-32 rounded-full
          flex items-center justify-center shadow-lg
          ${isCalling
              ? "bg-red-600 animate-pulse"
              : "bg-blue-600"
            }`}
        >
          <span className="text-5xl">
            🎤
          </span>
        </div>

        {/* Status */}
        {isCalling && (
          <p className="text-green-400 mb-5">
            {isRecording
              ? "🎙️ Listening..."
              : "Connecting..."}
          </p>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="mb-6 p-5 rounded-xl bg-slate-800 text-left">
            <p className="text-sm text-slate-400 mb-2">
              🗣️ You said:
            </p>

            <p className="text-white text-lg">
              {transcript}
            </p>
          </div>
        )}
        {aiReply && (
          <div className="mb-6 p-5 rounded-xl bg-blue-900/40 text-left">
            <p className="text-sm text-blue-300 mb-2">
              🤖 AI Assistant:
            </p>

            <p className="text-white text-lg">
              {aiReply}
            </p>
          </div>
        )}
        {report && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-800 text-left">
            <h2 className="text-2xl font-bold text-white mb-6">
              📋 Health Screening Report
            </h2>

            <div className="space-y-4">

              <div>
                <p className="text-slate-400 text-sm">
                  Main Concern
                </p>
                <p className="text-white text-lg">
                  {report.mainConcern}
                </p>
              </div>

              <div>
                <p className="text-slate-400 text-sm">
                  Key Symptoms
                </p>
                <p className="text-white text-lg">
                  {report.keySymptoms?.join(", ")}
                </p>
              </div>

              <div>
                <p className="text-slate-400 text-sm">
                  Duration
                </p>
                <p className="text-white text-lg">
                  {report.duration}
                </p>
              </div>

              <div>
                <p className="text-slate-400 text-sm">
                  Severity
                </p>
                <p className="text-white text-lg">
                  {report.severity}
                </p>
              </div>

              <div>
                <p className="text-slate-400 text-sm">
                  Follow-up
                </p>
                <p className="text-white text-lg">
                  {report.followUp}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Button */}
        {!isCalling ? (
          <button
            onClick={startCall}
            className="w-full bg-blue-600 hover:bg-blue-700
            py-4 rounded-xl text-lg font-semibold
            transition"
          >
            🎤 Start Call
          </button>
        ) : (
          <button
            onClick={endCall}
            className="w-full bg-red-600 hover:bg-red-700
            py-4 rounded-xl text-lg font-semibold
            transition"
          >
            🔴 End Call
          </button>
        )}

        <p className="text-sm text-slate-500 mt-6">
          This AI performs a basic health screening conversation.
        </p>

      </div>
    </div>
  );
}

export default App;