export default function ClientInstructionsPanel() {
  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-7 border border-border-light max-w-[680px] shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <img
            src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg"
            alt="ETV"
            className="h-[22px]"
          />
        </div>
        <div className="text-lg font-bold text-bark mb-0.5">Discharge Instructions</div>
        <div className="text-xs text-text-muted mb-5">Generated from consultation on 25 Feb 2026</div>

        {/* Patient bar */}
        <div className="flex gap-5 px-4 py-2.5 bg-sand rounded-md mb-5 text-xs">
          {[
            ['Patient', 'Bella'],
            ['Species', 'Dog — Labrador'],
            ['Age', '6 years'],
            ['Date', '25/02/2026'],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase text-text-muted tracking-[0.3px] mb-px">{label}</div>
              <div className="font-semibold text-text-primary">{value}</div>
            </div>
          ))}
        </div>

        {/* Sections */}
        <CISection color="bg-forest" title="Things to do">
          Keep Bella warm, quiet and indoors for the next 24–48 hours. Make sure fresh water is always available. Offer
          small amounts of water frequently — little and often is best. After 12 hours with no vomiting, offer a small,
          bland meal such as plain boiled chicken and rice.
        </CISection>
        <CISection color="bg-error" title="Things to avoid">
          Do not offer food for the first 12 hours. Avoid treats, chews, or fatty foods during recovery. Do not allow
          vigorous exercise until Bella is eating normally and showing no further vomiting.
        </CISection>
        <CISection color="bg-forest" title="Medication">
          Please complete the full course of any medications provided. Maropitant (anti-sickness) — one injection given
          today. Omeprazole — give one tablet twice daily with food for 5 days.
        </CISection>
        <CISection color="bg-warning" title="When to contact us immediately">
          Please contact us if you notice any of the following: further vomiting despite treatment, blood in vomit or
          stools, increased lethargy or collapse, refusal to drink water, abdominal swelling or pain.
        </CISection>
        <div className="mb-4">
          <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">📅 Follow-up appointment</div>
          <p className="text-[13px] leading-[1.75] text-text-secondary">
            A recheck is recommended in 24 hours to reassess hydration and appetite. If symptoms persist beyond 48
            hours, further diagnostics may be recommended.
          </p>
        </div>

        {/* Emergency footer */}
        <div className="text-xs text-text-muted border-t border-border-light pt-3.5 mb-5">
          In the event of an emergency outside of our regular operating hours, please contact{' '}
          <strong className="text-text-primary">Veteris Home Emergency Services</strong> at{' '}
          <strong className="text-text-primary">020 3808 0100</strong>. Veteris provides 24/7 mobile veterinary care
          across Greater London.
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-border-light">
          {['📋 Copy', '📥 Download PDF', '✏️ Edit', '📧 Email to Client'].map((label) => (
            <button
              key={label}
              className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CISection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        {title}
      </div>
      <p className="text-[13px] leading-[1.75] text-text-secondary">{children}</p>
    </div>
  );
}
