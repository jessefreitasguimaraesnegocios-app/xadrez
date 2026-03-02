import { useState, useCallback, useEffect, useRef } from 'react';

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export interface UseSpeechRecognitionOptions {
  lang: string;
  onResult: (transcript: string) => void;
  enabled: boolean;
  continuous?: boolean;
}

export function useSpeechRecognition({
  lang,
  onResult,
  enabled,
  continuous = true,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const onResultRef = useRef(onResult);
  const enabledRef = useRef(enabled);
  onResultRef.current = onResult;
  enabledRef.current = enabled;

  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    setIsSupported(!!SpeechRecognitionClass);
    if (!SpeechRecognitionClass) return;

    const rec = new SpeechRecognitionClass();
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.lang = lang;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      if (result.isFinal && result.length > 0) {
        const transcript = result[0].transcript?.trim();
        if (transcript) onResultRef.current(transcript);
      }
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setIsListening(false);
    };
    rec.onend = () => {
      if (enabledRef.current && continuous) {
        try {
          rec.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    enabledRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!enabled && isListening) stop();
  }, [enabled, isListening, stop]);

  return { isListening, start, stop, isSupported };
}
