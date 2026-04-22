type Props = {
  label: string;
  value: string;
  note: string;
  noteRed?: boolean;
};

export function IndicatorCard({ label, value, note, noteRed }: Props) {
  return (
    <div className="indicator-card">
      <div className="indicator-card-header">
        <span className="indicator-card-label">{label}</span>
        <span className="indicator-card-info" aria-hidden="true">
          ⓘ
        </span>
      </div>
      <div className="indicator-card-body">
        <div className="indicator-value">{value}</div>
        <div className={noteRed ? 'indicator-note-red' : 'indicator-note'}>
          {note}
        </div>
      </div>
    </div>
  );
}
