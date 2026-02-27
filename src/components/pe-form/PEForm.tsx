import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';

type PillField = {
  label: string;
  field: string;
  options: { value: string; warn?: boolean; abn?: boolean }[];
  hasDetail?: boolean;
  detailPlaceholder?: string;
};

const generalFields: PillField[] = [
  { label: 'Mentation', field: 'mentation', options: [{ value: 'BAR' }, { value: 'QAR' }, { value: 'obt' }] },
  { label: 'Demeanour', field: 'demeanour', options: [{ value: 'calm' }, { value: 'frndly' }, { value: 'anxious', warn: true }, { value: 'grumbly' }] },
];

const headNeckFields: PillField[] = [
  { label: 'Eyes', field: 'eyes', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. bilateral epiphora, conjunctivitis OS)' },
  { label: 'Ears', field: 'ears', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. brown waxy discharge AU, erythema)' },
  { label: 'Nose', field: 'nose', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. serous nasal discharge bilateral)' },
  { label: 'Oral', field: 'oral', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. grade 2 dental disease, gingivitis)' },
  { label: 'PLNs', field: 'plns', options: [{ value: 'WNL' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. submandibular LN enlarged bilateral)' },
];

const cardioFields: PillField[] = [
  { label: 'MM', field: 'mmColor', options: [{ value: 'pink' }, { value: 'red' }, { value: 'pale' }, { value: 'white' }, { value: 'cyan' }] },
  { label: 'Moist', field: 'mmMoisture', options: [{ value: 'moist' }, { value: 'tacky', warn: true }] },
  { label: 'CRT', field: 'crt', options: [{ value: '<1' }, { value: '<2' }, { value: '=2' }, { value: '>2' }] },
  { label: 'Heart', field: 'heart', options: [{ value: 'N' }, { value: 'mur', abn: true }, { value: 'arrh', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. grade III/VI systolic murmur, L apex)' },
  { label: 'Lungs', field: 'lungs', options: [{ value: 'clr' }, { value: 'crack', abn: true }, { value: 'wheez', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. bilateral crackles ventral lung fields)' },
  { label: 'Pulses', field: 'pulses', options: [{ value: 'strong' }, { value: 'weak' }, { value: 'bound' }] },
];

const abdomenFields: PillField[] = [
  { label: 'Hydration', field: 'hydration', options: [{ value: 'eu' }, { value: 'dehydr', warn: true, abn: true }], hasDetail: true, detailPlaceholder: 'Describe (e.g. ~5-7% dehydrated, skin tent delayed, tacky MM)' },
  { label: 'Abdo palp', field: 'abdoPalp', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. cranial abdominal pain, mass palpable R kidney)' },
  { label: 'Skin/coat', field: 'skinCoat', options: [{ value: 'NAD' }, { value: 'abn', abn: true }], hasDetail: true, detailPlaceholder: 'Describe abnormality (e.g. alopecia ventral abdomen, erythematous)' },
];

export default function PEForm() {
  const peData = useSessionStore((s) => s.peData);
  const setPEField = useSessionStore((s) => s.setPEField);
  const applyNormal = useSessionStore((s) => s.applyNormalPE);

  return (
    <div>
      <div className="bg-card rounded-lg p-[18px] border border-border-light">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={applyNormal}
            className="flex items-center gap-[5px] px-3.5 py-1.5 bg-etv-olive text-primary-foreground border-none rounded-pill text-xs font-semibold cursor-pointer hover:bg-etv-olive-hover transition-colors"
          >
            ⚡ Apply Normal
          </button>
          <select className="text-xs px-2.5 py-[5px] border border-border rounded-md bg-card text-text-primary outline-none">
            <option>Normal</option>
            <option>Dehydrated</option>
            <option>+ New Template</option>
          </select>
        </div>

        {/* Vitals */}
        <PECard title="Vitals">
          <div className="flex gap-2.5 items-center flex-wrap">
            {[
              { label: 'Temp', field: 'temp', unit: '°C' },
              { label: 'HR', field: 'hr', unit: 'bpm' },
              { label: 'RR', field: 'rr', unit: 'rpm' },
              { label: 'Weight', field: 'weight', unit: 'kg' },
            ].map((v) => (
              <div key={v.field} className="flex items-center gap-1.5 bg-sand rounded-md px-3 py-[7px] border-[1.5px] border-transparent focus-within:border-bark-muted focus-within:bg-card transition-all duration-150">
                <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">{v.label}</span>
                <input
                  className="w-[50px] border-none text-sm font-semibold font-mono text-center outline-none text-bark bg-transparent"
                  value={peData.vitals[v.field as keyof typeof peData.vitals]}
                  onChange={(e) => setPEField('vitals', { ...peData.vitals, [v.field]: e.target.value })}
                />
                <span className="text-[11px] text-text-muted">{v.unit}</span>
              </div>
            ))}
          </div>
        </PECard>

        {/* General */}
        <PECard title="General">
          {generalFields.map((f) => (
            <PERow key={f.field} {...f} value={peData[f.field as keyof typeof peData] as string} onSelect={(v) => setPEField(f.field, v)} />
          ))}
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-20 text-[13px] font-semibold text-text-secondary shrink-0">BCS</span>
            <div className="flex items-center gap-[3px]">
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <div
                  key={n}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-[1.5px] cursor-pointer transition-all duration-100 ${
                    peData.bcs === n
                      ? 'bg-bark text-primary-foreground border-bark'
                      : 'bg-card text-text-secondary border-border hover:border-bark-muted hover:text-bark'
                  }`}
                  onClick={() => setPEField('bcs', n)}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </PECard>

        {/* Head & Neck */}
        <PECard title="Head & Neck">
          {headNeckFields.map((f) => (
            <PERowWithDetail
              key={f.field}
              {...f}
              value={peData[f.field as keyof typeof peData] as string}
              detailValue={peData[`${f.field}Detail` as keyof typeof peData] as string}
              onSelect={(v) => setPEField(f.field, v)}
              onDetailChange={(v) => setPEField(`${f.field}Detail`, v)}
            />
          ))}
        </PECard>

        {/* Cardiovascular & Respiratory */}
        <PECard title="Cardiovascular & Respiratory">
          {cardioFields.map((f) =>
            f.hasDetail ? (
              <PERowWithDetail
                key={f.field}
                {...f}
                value={peData[f.field as keyof typeof peData] as string}
                detailValue={peData[`${f.field}Detail` as keyof typeof peData] as string}
                onSelect={(v) => setPEField(f.field, v)}
                onDetailChange={(v) => setPEField(`${f.field}Detail`, v)}
              />
            ) : (
              <PERow key={f.field} {...f} value={peData[f.field as keyof typeof peData] as string} onSelect={(v) => setPEField(f.field, v)} />
            )
          )}
        </PECard>

        {/* Abdomen & Body */}
        <PECard title="Abdomen & Body">
          {abdomenFields.map((f) => (
            <PERowWithDetail
              key={f.field}
              {...f}
              value={peData[f.field as keyof typeof peData] as string}
              detailValue={peData[`${f.field}Detail` as keyof typeof peData] as string}
              onSelect={(v) => setPEField(f.field, v)}
              onDetailChange={(v) => setPEField(`${f.field}Detail`, v)}
            />
          ))}
        </PECard>
      </div>
    </div>
  );
}

function PECard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg px-4 py-3.5 mb-2.5 border border-border-light hover:border-border transition-colors duration-150">
      <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-muted mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function PERow({ label, options, value, onSelect }: PillField & { value: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <span className="w-20 text-[13px] font-semibold text-text-secondary shrink-0">{label}</span>
      <div className="flex gap-[5px] flex-wrap flex-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`px-3 py-[5px] text-xs font-semibold border-[1.5px] rounded-pill cursor-pointer transition-all duration-100 ${
              value === opt.value
                ? opt.warn
                  ? 'bg-[#fef3e8] text-warning border-[#f0c89a]'
                  : 'bg-bark text-primary-foreground border-bark'
                : 'bg-card text-text-secondary border-border hover:border-bark-muted hover:text-bark'
            }`}
            onClick={() => onSelect(opt.value)}
          >
            {opt.value}
          </button>
        ))}
      </div>
    </div>
  );
}

function PERowWithDetail({
  label, options, value, detailValue, detailPlaceholder, onSelect, onDetailChange,
}: PillField & { value: string; detailValue: string; onSelect: (v: string) => void; onDetailChange: (v: string) => void }) {
  const isAbn = options.some((o) => o.abn && o.value === value);

  return (
    <>
      <PERow label={label} field="" options={options} value={value} onSelect={onSelect} />
      {isAbn && (
        <div className="ml-[90px] mt-1 mb-2">
          <input
            className="w-full px-3 py-[7px] border-[1.5px] border-warning rounded-md text-xs outline-none bg-[#fffcf5] text-text-primary placeholder:text-text-muted placeholder:italic focus:border-bark-muted focus:bg-card"
            placeholder={detailPlaceholder}
            value={detailValue}
            onChange={(e) => onDetailChange(e.target.value)}
            autoFocus
          />
          <div className="text-[10px] text-text-muted mt-[3px]">This will be included in the generated clinical notes</div>
        </div>
      )}
    </>
  );
}
