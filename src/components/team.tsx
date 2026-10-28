interface TeamMember {
  name: string;
  role?: string;
}

const TEAM: TeamMember[] = [
  { name: "Krish Bharadiya", role: "Designer" },
  { name: "Ammar Shaikh" },
  { name: "Pranav Bhat" },
  { name: "Abhinav Chintala" },
];

export function Team() {
  return (
    <section className="panel crew" id="team" aria-labelledby="team-title">
      <p className="eyebrow">The team</p>
      <h2 id="team-title">Four people. One rocket.</h2>
      <ul className="crew-list">
        {TEAM.map((member) => (
          <li key={member.name}>
            <span>{member.name}</span>
            {member.role && <span className="crew-role">{member.role}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
