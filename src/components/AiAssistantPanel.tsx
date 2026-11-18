import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  ExternalLink,
  Globe,
  MapPin,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useOneGov } from '../context/OneGovContext';
import type { MapsGroundingPlace, SearchGroundingSource, VoiceNoteSourceType } from '../lib/onegovRules';

type AssistantMode = 'catalog' | 'search' | 'maps' | 'voice';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  mode: AssistantMode;
  suggestedCodes?: string[];
  webSources?: SearchGroundingSource[];
  mapsPlaces?: MapsGroundingPlace[];
}

function pcmFloat32ToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToPcmFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export const AiAssistantPanel: React.FC = () => {
  const {
    user,
    token,
    services,
    apiFetch,
    setSelectedService,
    setActiveScreen,
    isFirebaseUser,
    voiceNotes,
    saveVoiceNoteBookmark,
    removeVoiceNoteBookmark,
  } = useOneGov();

  const [mode, setMode] = useState<AssistantMode>('catalog');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      mode: 'catalog',
      text: 'Welcome to OneGov Intelligence. Switch tabs above for Web Search Grounding, Google Maps Civic Locator, or Real-Time Live Voice Conversations, or use the microphone button below to transcribe audio.',
      suggestedCodes: ['LCC-TRADING-PERMIT', 'RTSA-ROAD-TAX', 'PACRA-PATENT-FILE'],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Pre-recorded audio transcription (gemini-3.5-transcribe)
  const [recordingDictation, setRecordingDictation] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Voice Conversation state (gemini-3.8-live via /ws/live)
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const liveStatusRef = useRef<'idle' | 'connecting' | 'active'>('idle');
  const [liveMuted, setLiveMuted] = useState(false);
  const liveMutedRef = useRef(false);
  const [liveTranscripts, setLiveTranscripts] = useState<
    Array<{ speaker: 'You' | 'OneGov Voice'; text: string }>
  >([]);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    liveMutedRef.current = liveMuted;
  }, [liveMuted]);

  useEffect(() => {
    liveStatusRef.current = liveStatus;
  }, [liveStatus]);

  const stopLiveVoice = () => {
    try {
      processorRef.current?.disconnect();
    } catch {
      // Ignore cleanup race
    }
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    inputAudioCtxRef.current?.close().catch(() => undefined);
    inputAudioCtxRef.current = null;
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore stopped source
      }
    });
    activeSourcesRef.current = [];
    outputAudioCtxRef.current?.close().catch(() => undefined);
    outputAudioCtxRef.current = null;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore WS close race
      }
      wsRef.current = null;
    }
    nextStartTimeRef.current = 0;
    liveStatusRef.current = 'idle';
    setLiveStatus('idle');
  };

  useEffect(() => {
    return () => {
      stopLiveVoice();
    };
  }, []);

  const schedule24kPcmChunk = (base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const float32 = base64ToPcmFloat32(base64Audio);
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const startLiveVoice = async () => {
    if (!token) {
      setError('Active workspace session required for Live Voice.');
      return;
    }
    setError(null);
    liveStatusRef.current = 'connecting';
    setLiveStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/live?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(inputCtx.destination);
        processor.onaudioprocess = (ev) => {
          if (liveMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const pcmBase64 = pcmFloat32ToBase64(ev.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: pcmBase64 }));
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as {
          ready?: boolean;
          audio?: string;
          inputTranscript?: string;
          outputTranscript?: string;
          interrupted?: boolean;
          error?: string;
          closed?: boolean;
        };
        if (msg.ready) {
          liveStatusRef.current = 'active';
          setLiveStatus('active');
        }
        if (msg.audio) {
          schedule24kPcmChunk(msg.audio);
        }
        if (msg.interrupted) {
          activeSourcesRef.current.forEach((src) => {
            try {
              src.stop();
            } catch {
              // Ignore
            }
          });
          activeSourcesRef.current = [];
          nextStartTimeRef.current = 0;
        }
        if (msg.inputTranscript) {
          setLiveTranscripts((prev) => [...prev, { speaker: 'You', text: msg.inputTranscript! }]);
        }
        if (msg.outputTranscript) {
          setLiveTranscripts((prev) => [...prev, { speaker: 'OneGov Voice', text: msg.outputTranscript! }]);
        }
        if (msg.error) {
          setError(msg.error);
          stopLiveVoice();
        }
        if (msg.closed) {
          stopLiveVoice();
        }
      };

      ws.onerror = () => {
        setError('Live Voice WebSocket connection failed.');
        stopLiveVoice();
      };

      ws.onclose = () => {
        if (liveStatusRef.current !== 'idle') {
          stopLiveVoice();
        }
      };
    } catch (err: any) {
      setError(err?.message || 'Microphone access or Live Voice initialization failed.');
      stopLiveVoice();
    }
  };

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read audio bytes.'));
        reader.readAsDataURL(blob);
      });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const res = await apiFetch<{ transcript: string }>('/api/ai/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      });
      if (res.transcript) {
        setInput((prev) => (prev ? `${prev} ${res.transcript}` : res.transcript));
      } else {
        setError('No speech detected in the audio recording.');
      }
    } catch (err: any) {
      setError(err?.message || 'Audio transcription failed.');
    } finally {
      setTranscribing(false);
    }
  };

  const toggleDictationRecording = async () => {
    if (recordingDictation && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingDictation(false);
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        transcribeBlob(blob, mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingDictation(true);
    } catch (err: any) {
      setError(err?.message || 'Could not access microphone for audio transcription.');
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await transcribeBlob(file, file.type || 'audio/mp3');
    e.target.value = '';
  };

  const sendPrompt = async (promptText: string, overrideMode?: AssistantMode) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const activeMode = overrideMode || mode;
    setError(null);
    setMessages((prev) => [...prev, { sender: 'user', text: trimmed, mode: activeMode }]);
    setInput('');
    setLoading(true);
    try {
      if (activeMode === 'search') {
        const res = await apiFetch<{ reply: string; sources: SearchGroundingSource[] }>(
          '/api/ai/search-grounding',
          {
            method: 'POST',
            body: JSON.stringify({ query: trimmed, language }),
          },
        );
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            mode: 'search',
            text: res.reply,
            webSources: res.sources,
          },
        ]);
      } else if (activeMode === 'maps') {
        let coords: { latitude: number; longitude: number } = {
          latitude: -15.4167,
          longitude: 28.2833,
        };
        if (navigator.geolocation) {
          coords = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                }),
              () => resolve(coords),
              { timeout: 1500 },
            );
          });
        }
        const res = await apiFetch<{ reply: string; places: MapsGroundingPlace[] }>(
          '/api/ai/maps-grounding',
          {
            method: 'POST',
            body: JSON.stringify({ query: trimmed, ...coords }),
          },
        );
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            mode: 'maps',
            text: res.reply,
            mapsPlaces: res.places,
          },
        ]);
      } else {
        const res = await apiFetch<{ reply: string; suggestedServiceCodes: string[] }>(
          '/api/ai/assistant',
          {
            method: 'POST',
            body: JSON.stringify({
              message: trimmed,
              language,
            }),
          },
        );
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            mode: 'catalog',
            text: res.reply,
            suggestedCodes: res.suggestedServiceCodes,
          },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'AI Assistant could not respond right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMessageToFirestore = async (msg: ChatMessage) => {
    setSaveFeedback(null);
    const sourceType: VoiceNoteSourceType =
      msg.mode === 'search'
        ? 'search_grounding'
        : msg.mode === 'maps'
          ? 'maps_grounding'
          : 'transcription';
    const sourceUrl = msg.webSources?.[0]?.uri || msg.mapsPlaces?.[0]?.uri;
    try {
      await saveVoiceNoteBookmark({
        title: `OneGov ${msg.mode.toUpperCase()} Note`,
        transcript: msg.text,
        sourceType,
        sourceUrl,
      });
      setSaveFeedback('Saved AI response to your Firestore workspace notes.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save note to Firestore.');
    }
  };

  const quickPrompts: Record<Exclude<AssistantMode, 'voice'>, string[]> = {
    catalog: [
      'Which permits do I need to open an agro-supply shop in Lusaka?',
      'How do I pay Road Tax and check my vehicle insurance status?',
      'Explain how PACRA patent similarity checking works on OneGov.',
    ],
    search: [
      'What are current ZRA TPIN and turnover tax thresholds in Zambia?',
      'Latest PACRA trademark filing classes and renewal periods in Zambia',
    ],
    maps: [
      'Find nearest RTSA vehicle licensing offices in Lusaka',
      'Locate Lusaka City Council Civic Centre and PACRA head office',
    ],
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="text-xs font-mono text-[#059669]">
            OneGov Intelligence · Grounded Search, Maps, Voice &amp; Transcription ({user?.role})
          </div>
          <h1 className="text-xl font-bold text-[#0B192C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#059669]" /> AI Government &amp; Business Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ai-lang-select" className="sr-only">
            Language
          </label>
          <select
            id="ai-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="English">English</option>
            <option value="Icibemba">Icibemba</option>
            <option value="Chinyanja">Chinyanja</option>
            <option value="Chitonga">Chitonga</option>
          </select>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg" role="tablist" aria-label="AI assistant capabilities">
        {[
          { id: 'catalog' as const, label: 'Service Guide', icon: Sparkles },
          { id: 'search' as const, label: 'Search Grounding', icon: Globe },
          { id: 'maps' as const, label: 'Maps Grounding', icon: MapPin },
          { id: 'voice' as const, label: 'Live Voice (Audio)', icon: Radio },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setMode(tab.id);
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-[#0B192C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#059669]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}
      {saveFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          {saveFeedback}
        </div>
      )}

      {mode === 'voice' ? (
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0B192C]">
                Real-Time Bidirectional Voice Conversation
              </h2>
              <p className="text-xs text-slate-600">
                Speak directly with OneGov Voice Guide (16kHz mic stream &amp; 24kHz live audio response).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {liveStatus === 'idle' ? (
                <button
                  type="button"
                  onClick={startLiveVoice}
                  className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" /> Start Live Voice
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLiveMuted((m) => !m)}
                    className="px-3 py-2 border border-slate-300 bg-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {liveMuted ? <MicOff className="w-3.5 h-3.5 text-amber-600" /> : <Mic className="w-3.5 h-3.5 text-[#059669]" />}
                    {liveMuted ? 'Unmute Mic' : 'Mute Mic'}
                  </button>
                  <button
                    type="button"
                    onClick={stopLiveVoice}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" /> End Session
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-xs font-mono text-slate-600">
            Session State:{' '}
            <span className="font-bold text-[#0B192C] uppercase">{liveStatus}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 min-h-[180px] max-h-[280px] overflow-y-auto space-y-2 text-xs">
            {liveTranscripts.length === 0 ? (
              <div className="text-slate-400">
                Click &ldquo;Start Live Voice&rdquo; and ask about permits, RTSA road tax, ZESCO, or PACRA IP.
              </div>
            ) : (
              liveTranscripts.map((t, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="font-bold text-[#0B192C]">{t.speaker}: </span>
                  <span className="text-slate-700">{t.text}</span>
                </div>
              ))
            )}
          </div>

          {isFirebaseUser && liveTranscripts.length > 0 && (
            <button
              type="button"
              onClick={() =>
                saveVoiceNoteBookmark({
                  title: 'OneGov Live Voice Conversation',
                  transcript: liveTranscripts.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
                  sourceType: 'live_voice',
                })
              }
              className="px-3 py-1.5 border border-slate-300 bg-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#059669]" /> Save Live Transcript to Firestore
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {quickPrompts[mode].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => sendPrompt(p)}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 hover:border-[#059669] rounded-lg text-slate-700 cursor-pointer text-left"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-[#0B192C] text-white ml-8'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 mr-8'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.suggestedCodes && m.suggestedCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-200">
                    {m.suggestedCodes.map((code) => {
                      const svc = services.find((s) => s.code === code);
                      if (!svc) return null;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setSelectedService(svc);
                            setActiveScreen('application-workflow');
                          }}
                          className="px-3 py-1 bg-white border border-slate-300 hover:border-[#059669] text-xs font-semibold text-[#0B192C] rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          Open {svc.title} <ArrowRight className="w-3 h-3" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {m.webSources && m.webSources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200 space-y-1 text-xs">
                    <div className="font-bold text-[#0B192C]">Google Search Grounded Sources</div>
                    <div className="flex flex-wrap gap-2">
                      {m.webSources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[#059669] hover:underline inline-flex items-center gap-1"
                        >
                          {src.title} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {m.mapsPlaces && m.mapsPlaces.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-[#0B192C]">Google Maps Verified Places</div>
                    <div className="space-y-1.5">
                      {m.mapsPlaces.map((place) => (
                        <div key={place.uri} className="p-2 bg-white border border-slate-200 rounded-md">
                          <a
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#0B192C] hover:text-[#059669] inline-flex items-center gap-1"
                          >
                            {place.title} <ExternalLink className="w-3 h-3" />
                          </a>
                          {place.snippets.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              “{place.snippets[0]}”
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {m.sender === 'assistant' && isFirebaseUser && (
                  <div className="mt-2 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => handleSaveMessageToFirestore(m)}
                      className="text-[11px] font-semibold text-[#059669] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Bookmark className="w-3 h-3" /> Save to Firestore Notes
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPrompt(input);
            }}
            className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100"
          >
            <input
              type="text"
              aria-label="Ask OneGov AI Assistant"
              placeholder={
                mode === 'search'
                  ? 'Search Zambian civic & regulatory information with Google Search...'
                  : mode === 'maps'
                    ? 'Find nearest RTSA, ZRA, PACRA, or City Council stations...'
                    : 'Ask about permits, taxes, road tax, land rates, or IP...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 min-w-[220px] px-4 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={toggleDictationRecording}
              disabled={transcribing}
              aria-label={recordingDictation ? 'Stop audio dictation' : 'Record audio to transcribe'}
              className={`px-3 py-2.5 border rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                recordingDictation
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-[#0B192C]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              {transcribing ? 'Transcribing...' : recordingDictation ? 'Stop Rec' : 'Dictate'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              aria-label="Upload audio file for transcription"
              onChange={handleAudioFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={transcribing}
              aria-label="Upload audio clip to transcribe"
              className="px-3 py-2.5 border border-slate-300 bg-white hover:border-[#0B192C] text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Audio File
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> {loading ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>
        </>
      )}

      {voiceNotes.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="text-xs font-bold text-[#0B192C]">
            Saved Voice Transcripts &amp; Grounded Notes (Firestore)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {voiceNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold text-[#0B192C] truncate">{note.title}</div>
                  <p className="text-slate-600 line-clamp-2">{note.transcript}</p>
                  {note.sourceUrl && (
                    <a
                      href={note.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#059669] hover:underline inline-flex items-center gap-1"
                    >
                      Source Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${note.title}`}
                  onClick={() => removeVoiceNoteBookmark(note.id)}
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
