const LOG = [
  { date: "October 2026", title: "The design is frozen.", detail: "24,970 flights. Stability holds at 2.01 cal." },
  { date: "November 2026", title: "The airframe gets cut.", detail: "BT-80 over BT-60. Eggs in foam. Balsa through the wall." },
  { date: "December 2026", title: "Ejection, on the ground.", detail: "Chute, wadding, and the altimeter, checked before flight." },
  { date: "Spring 2027", title: "Then the rail.", detail: "Two eggs. An 800-foot target." },
];

export function BuildLog() {
  return (
    <section className="panel rail" id="log" aria-labelledby="log-title">
      <p className="eyebrow">The path</p>
      <h2 id="log-title">From OpenRocket to the rail.</h2>
      <ol className="rail-list">
        {LOG.map((entry) => (
          <li key={entry.title}>
            <span>{entry.date}</span>
            <strong>{entry.title}</strong>
            <p>{entry.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
