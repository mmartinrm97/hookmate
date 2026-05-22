import './index.css';

const readinessItems = [
  'Webhook ingestion with 202-first API contract',
  'Retry and DLQ flow with observable event states',
  'AI summaries running as non-blocking background work',
];

const buildTracks = [
  {
    title: 'API',
    status: 'Ready to start',
    description: 'NestJS base with health endpoint and room for feature modules.',
  },
  {
    title: 'Dashboard',
    status: 'Ready to shape',
    description: 'React shell prepared for event log, DLQ review, and metrics.',
  },
  {
    title: 'Infrastructure',
    status: 'Bootstrapped',
    description: 'CDK app wired so stacks can land without inventing structure later.',
  },
];

function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">HookMate bootstrap</p>
        <h1>Webhook infrastructure that starts clean, not chaotic.</h1>
        <p className="lede">
          This dashboard shell replaces the Vite starter and defines the product direction before
          real features land.
        </p>

        <div className="pill-row" aria-label="Project focus">
          {readinessItems.map((item) => (
            <span className="pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="tracks-grid" aria-label="Build tracks">
        {buildTracks.map((track) => (
          <article className="track-card" key={track.title}>
            <div className="track-status">{track.status}</div>
            <h2>{track.title}</h2>
            <p>{track.description}</p>
          </article>
        ))}
      </section>

      <section className="blueprint-grid">
        <article className="blueprint-card">
          <p className="card-label">Next UI slices</p>
          <ul>
            <li>Endpoints registry</li>
            <li>Event timeline with filters</li>
            <li>DLQ triage panel</li>
            <li>Summary + category view</li>
          </ul>
        </article>

        <article className="blueprint-card">
          <p className="card-label">Contract already defined</p>
          <p>
            Product and system requirements live in <code>docs/hookmate-spec.md</code>. The UI base
            now points to the real domain instead of starter content.
          </p>
        </article>
      </section>
    </main>
  );
}

export default App;
