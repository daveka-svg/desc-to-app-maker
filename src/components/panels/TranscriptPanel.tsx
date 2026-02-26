export default function TranscriptPanel() {
  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-6 border border-border-light text-sm leading-[1.8] text-text-primary">
        <p className="mb-3.5">
          So the owner reports that Bella has been off her food since yesterday morning, completely anorexic. She started
          vomiting yesterday afternoon, about four episodes total. Initially liquid, yellowish, foamy material, and the
          last episode was just bile.
        </p>
        <p className="mb-3.5">
          She's still drinking water and keeping it down. The owner describes her as lethargic and a bit shaky when she
          stands. Last normal faeces was yesterday morning. No access to toxins, no dietary indiscretion reported.
        </p>
        <p className="mb-3.5">
          Vaccinations are up to date. She's normally a very active dog, so this lethargy is quite out of character for her...
        </p>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-forest mt-2">
          <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse-dot" />
          Listening...
        </div>
      </div>
    </div>
  );
}
