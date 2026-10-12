// Optional Web Speech API helper. Fails closed if the browser has no recognizer.
type Rec = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function createRecognizer(onText: (text: string) => void): { start: () => void; stop: () => void } | null {
  const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => Rec; SpeechRecognition?: new () => Rec })
    .SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript;
    if (text) onText(text);
  };
  rec.onerror = () => undefined;
  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}
