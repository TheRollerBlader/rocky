const TEAM = ["Krish Bharadiya", "Ammar Shaikh", "Pranav Bhat", "Abhinav Chintala"];

export function Team() {
  return (
    <section className="panel crew" id="team" aria-labelledby="team-title">
      <p className="eyebrow">The team</p>
      <h2 id="team-title">Four people. One rocket.</h2>
      <ul className="crew-list">
        {TEAM.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  );
}
