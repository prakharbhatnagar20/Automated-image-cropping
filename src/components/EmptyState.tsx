export default function EmptyState() {
  return (
    <div className="empty">
      <svg viewBox="0 0 180 200" aria-hidden="true">
        <rect x="1" y="1" width="178" height="198" rx="3" strokeWidth="2" style={{ fill: "var(--bg)", stroke: "var(--line)" }} />
        <circle cx="90" cy="70" r="27" opacity=".55" style={{ fill: "var(--muted)" }} />
        <path d="M30 200c6-42 30-62 60-62s54 20 60 62z" opacity=".55" style={{ fill: "var(--muted)" }} />
        <circle cx="90" cy="90" r="89" fill="none" strokeWidth="1.5" strokeDasharray="5 4" style={{ stroke: "var(--guide)" }} />
        <line x1="10" y1="24" x2="170" y2="24" strokeWidth="1.2" strokeDasharray="3 3" style={{ stroke: "var(--accent)" }} />
        <line x1="10" y1="121" x2="170" y2="121" strokeWidth="1.2" strokeDasharray="3 3" style={{ stroke: "var(--accent)" }} />
        <text x="172" y="20" textAnchor="end" fontSize="9" className="svg-mono" style={{ fill: "var(--accent)" }}>crown</text>
        <text x="172" y="117" textAnchor="end" fontSize="9" className="svg-mono" style={{ fill: "var(--accent)" }}>chin</text>
      </svg>
      <div>
        <h2>Batch ID photos, framed the same way every time</h2>
        <ol>
          <li><b>Add photos.</b> Each face is found, centred and levelled.</li>
          <li><b>Check the proofs.</b> Drag a photo to nudge it, or use Zoom.</li>
          <li><b>Save.</b> You get print-ready JPGs at your size and dpi, plus circle PNGs.</li>
        </ol>
        <p>The pink dashed circle on each proof shows the circle crop.</p>
      </div>
    </div>
  );
}
