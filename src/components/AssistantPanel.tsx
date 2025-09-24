// AssistantPanel.tsx
// In-app voice/NLP assistant using Web Speech API and Smart Home APIs

import React, { useEffect, useRef, useState } from 'react';

const languages = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi' },
  // Add more languages as needed
];

export const AssistantPanel: React.FC = () => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [lang, setLang] = useState('en-US');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setResponse('Speech recognition not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleCommand(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => setResponse('Error: ' + e.error);
    recognitionRef.current = recognition;
  }, [lang]);

  const startListening = () => {
    setTranscript('');
    setResponse('');
    setListening(true);
    recognitionRef.current?.start();
  };

  const stopListening = () => {
    setListening(false);
    recognitionRef.current?.stop();
  };

  // Simple NLP/command handler (expand as needed)
  const handleCommand = (text: string) => {
    // Example: "Turn off all lights in Room 101"
    if (/turn off all lights in room (\d+)/i.test(text)) {
      const room = text.match(/room (\d+)/i)?.[1];
      setResponse(`✅ All lights in Room ${room} are now OFF.`);
      // TODO: Send command to backend/Socket.IO/MQTT
      return;
    }
    if (/schedule ac to start (\d+) minutes before class/i.test(text)) {
      const minutes = text.match(/(\d+) minutes/i)?.[1];
      setResponse(`✅ AC scheduled to start ${minutes} minutes before class.`);
      // TODO: Send scheduling command
      return;
    }
    setResponse('Sorry, I did not understand that command.');
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-2">Smart Assistant</h2>
      <div className="flex gap-2 mb-2">
        <select value={lang} onChange={e => setLang(e.target.value)} className="border rounded px-2 py-1">
          {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button
          onClick={listening ? stopListening : startListening}
          className={`px-4 py-2 rounded ${listening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}
        >
          {listening ? 'Stop' : 'Start'} Listening
        </button>
      </div>
      <div className="mb-2">
        <strong>Transcript:</strong> {transcript}
      </div>
      <div className="mb-2">
        <strong>Assistant:</strong> {response}
      </div>
      <div className="text-xs text-gray-500">Try: "Turn off all lights in Room 101" or "Schedule AC to start 30 minutes before class"</div>
    </div>
  );
};

export default AssistantPanel;
