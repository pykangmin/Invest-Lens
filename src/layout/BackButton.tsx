type Props = {
  onClick: () => void;
};

export function BackButton({ onClick }: Props) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <svg
        className="back-arrow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      BACK
    </button>
  );
}
