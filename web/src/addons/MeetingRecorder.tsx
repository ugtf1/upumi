import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiSquare, FiX, FiCheck, FiLoader } from "react-icons/fi";
import { saveMeeting, Meeting } from "./api";
import "./meeting-recorder.scss";

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

type MeetingRecorderProps = {
  onMeetingSaved?: (newMeeting: Meeting) => void;
};

export default function MeetingRecorder({ onMeetingSaved }: MeetingRecorderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  // Check browser support
  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;

  const isSupported = Boolean(SpeechRecognitionClass);

  // Initialize Speech Recognition instance
  useEffect(() => {
    if (!SpeechRecognitionClass) return;

    const instance = new SpeechRecognitionClass();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";

    instance.onresult = (event: SpeechRecognitionEvent) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalStr += result[0].transcript + " ";
        } else {
          interimStr += result[0].transcript;
        }
      }

      if (finalStr) {
        setTranscript((prev) => (prev ? prev + " " + finalStr.trim() : finalStr.trim()));
      }
      setInterimText(interimStr);
    };

    instance.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("SpeechRecognition error:", event.error);
      if (event.error !== "no-speech") {
        setErrorMsg(`Speech recognition notice: ${event.error}`);
      }
    };

    instance.onend = () => {
      // Auto-restart if still flagged as recording (Web Speech API can auto-stop after silence)
      if (isRecordingRef.current) {
        try {
          instance.start();
        } catch {
          // ignore if already started
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = instance;

    return () => {
      try {
        instance.stop();
      } catch {
        // cleanup safe
      }
    };
  }, [SpeechRecognitionClass]);

  // Timer counter effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setTimerSeconds((sec) => sec + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const defaultTitle = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `Executive Meeting - ${dateStr}`;
  };

  const handleOpenModal = () => {
    setTitle(defaultTitle());
    setTranscript("");
    setInterimText("");
    setSavedSummary(null);
    setErrorMsg(null);
    setTimerSeconds(0);
    setIsOpen(true);
  };

  const handleCloseModal = () => {
    if (isRecording) {
      stopRecording();
    }
    setIsOpen(false);
  };

  const startRecording = () => {
    setErrorMsg(null);
    setSavedSummary(null);

    if (!recognitionRef.current) {
      if (!isSupported) {
        setErrorMsg("Web Speech API is not supported in this browser. You can manually type the meeting transcript below.");
      }
      setIsRecording(true);
      isRecordingRef.current = true;
      return;
    }

    try {
      isRecordingRef.current = true;
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  const handleStopAndSave = async () => {
    stopRecording();
    const fullTranscript = (transcript + " " + interimText).trim();

    if (!fullTranscript) {
      setErrorMsg("Please record or enter a meeting transcript before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const saved = await saveMeeting({
        title: title.trim() || defaultTitle(),
        transcript: fullTranscript,
        date: new Date().toISOString(),
      });

      setSavedSummary(saved.summary);
      showToast("Meeting saved and summarised successfully!");
      if (onMeetingSaved) {
        onMeetingSaved(saved);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save meeting summary";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="meeting-recorder__fab"
        onClick={handleOpenModal}
        aria-label="Record Meeting"
        title="Record Live Meeting & AI Summary"
      >
        <div className="meeting-recorder__fab-icon">
          <FiMic size={20} />
        </div>
        <span>Record Meeting</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="meeting-recorder__modal-backdrop">
          <div className="meeting-recorder__modal" role="dialog" aria-modal="true">
            <div className="meeting-recorder__modal-header">
              <h2>
                <FiMic size={22} color="#1ba389" />
                Live Meeting Recorder & AI Summary
              </h2>
              <button
                type="button"
                className="meeting-recorder__close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="meeting-recorder__modal-body">
              {/* Meeting Title Input */}
              <div className="meeting-recorder__field">
                <label htmlFor="meeting-title-input">Meeting Title</label>
                <input
                  id="meeting-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Executive Board Monthly Briefing"
                />
              </div>

              {/* Recording Status & Timer */}
              <div className="meeting-recorder__status-bar">
                <div className="meeting-recorder__pulse-wrap">
                  <span
                    className={`meeting-recorder__pulse-dot ${
                      isRecording ? "is-recording" : ""
                    }`}
                  />
                  <span>
                    {isRecording
                      ? "Recording live speech..."
                      : "Ready to record speech"}
                  </span>
                </div>
                <div className="meeting-recorder__timer">
                  {formatTimer(timerSeconds)}
                </div>
              </div>

              {errorMsg && (
                <div style={{ padding: "0.75rem 1rem", background: "#fdf2f2", color: "#e63946", borderRadius: "10px", fontSize: "0.875rem" }}>
                  {errorMsg}
                </div>
              )}

              {/* Real-Time Transcript View & Edit */}
              <div className="meeting-recorder__transcript-box">
                <div className="meeting-recorder__transcript-label">
                  <span>Live Transcript</span>
                  {isRecording && <span style={{ fontSize: "0.75rem", color: "#1ba389" }}>Listening...</span>}
                </div>

                <textarea
                  className="meeting-recorder__transcript-content"
                  value={(transcript + (interimText ? " " + interimText : "")).trim()}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setInterimText("");
                  }}
                  rows={6}
                  data-placeholder="Speech will be transcribed here in real-time. You can also edit or paste text directly."
                />
              </div>

              {/* AI Generated Summary Inline Preview */}
              {savedSummary && (
                <div className="meeting-feed__card-summary" style={{ margin: 0 }}>
                  <strong style={{ display: "block", marginBottom: "0.5rem", color: "#145a3d" }}>
                    AI Summary Generated:
                  </strong>
                  <div style={{ whiteSpace: "pre-wrap" }}>{savedSummary}</div>
                </div>
              )}

              {/* Controls */}
              <div className="meeting-recorder__controls">
                {!isRecording ? (
                  <button type="button" className="btn-record" onClick={startRecording}>
                    <FiMic size={18} />
                    <span>Start Recording</span>
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={stopRecording}>
                    <FiMicOff size={18} />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-stop"
                  onClick={handleStopAndSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <FiLoader className="spin" size={18} />
                      <span>Summarising with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <FiSquare size={18} />
                      <span>Stop & Save Meeting</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="meeting-toast">
          <FiCheck size={18} color="#79d28d" />
          <span>{toastMsg}</span>
        </div>
      )}
    </>
  );
}
