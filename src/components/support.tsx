"use client";

import { useState, type FormEvent } from "react";

const SPONSOR_TIERS = [
  {
    tier: "Orbital Partner",
    amount: "$1,000+",
    perks: [
      "Primary airframe logo on Rocky 1 flight vehicle",
      "Full team jersey & banner branding at ARC events",
      "Dedicated featured spotlight on website & reports",
      "Framed commemorative flight certificate & altimeter plot",
    ],
    highlight: true,
  },
  {
    tier: "Launch Partner",
    amount: "$500",
    perks: [
      "Secondary airframe fin decal branding",
      "Team uniform sleeve logo placement",
      "Company recognition in official ARC design filings",
      "Printed team photo signed by the rocketry crew",
    ],
    highlight: false,
  },
  {
    tier: "Propulsion Sponsor",
    amount: "$250",
    perks: [
      "Covers AeroTech F44W composite motor reloads for test flights",
      "Website sponsor registry listing with direct link",
      "Quarterly technical test flight data updates",
    ],
    highlight: false,
  },
  {
    tier: "Booster Club",
    amount: "$100",
    perks: [
      "Funds competition Grade-A raw egg payloads & parachutes",
      "Website sponsor registry acknowledgment",
      "Invitation to local range test launch days",
    ],
    highlight: false,
  },
];

const QUICK_AMOUNTS = [
  { value: 15, label: "$15", note: "Competition Eggs" },
  { value: 25, label: "$25", note: "AeroTech Reload" },
  { value: 50, label: "$50", note: "Range Test Day" },
  { value: 100, label: "$100", note: "Avionics Wadding" },
];

export function Support() {
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleCopyNote(e: FormEvent) {
    e.preventDefault();
    const noteText = [
      "Rocky 1 — Rock Hill High School Rocketry (ARC 2027)",
      `I would like to support the team with $${selectedAmount}.`,
      name.trim() ? `Name / Organization: ${name.trim()}` : null,
      email.trim() ? `Contact: ${email.trim()}` : null,
      message.trim() ? `Note: ${message.trim()}` : null,
      "Please provide the Rock Hill High School booster club donation details.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(noteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  }

  function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="panel" id="support" aria-labelledby="support-title">
      <div className="panel-intro">
        <p className="eyebrow">Sponsorship & Support</p>
        <h2 id="support-title">Back Rock Hill High School on the national stage.</h2>
        <p className="deck">
          Every dollar directly funds composite rocket motors, certified altimeters, and test flight range fees.
          Contributions can be routed through our official school booster organization.
        </p>
      </div>

      {/* Sponsor Tiers Grid */}
      <div className="sponsor-tiers-grid">
        {SPONSOR_TIERS.map((tier) => (
          <div key={tier.tier} className={`tier-card ${tier.highlight ? "tier-highlight" : ""}`}>
            <div className="tier-header">
              <span className="tier-name">{tier.tier}</span>
              <span className="tier-amount">{tier.amount}</span>
            </div>
            <ul className="tier-perks">
              {tier.perks.map((perk, i) => (
                <li key={i}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" className={`tier-btn ${tier.highlight ? "tier-btn-primary" : "tier-btn-secondary"}`}>
              Select {tier.tier}
            </a>
          </div>
        ))}
      </div>

      {/* Direct Donation & Contact Grid */}
      <div className="support-dual-grid" id="contact">
        {/* Quick Supporter Pledge */}
        <div className="support-card">
          <p className="eyebrow">Individual Supporter</p>
          <h3 className="support-card-title">Pledge a Flight Essential</h3>
          <p className="support-card-desc">
            Select an amount to generate an official pledge memo for the school booster treasurer.
          </p>

          <div className="amounts-grid" role="group" aria-label="Support amount options">
            {QUICK_AMOUNTS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`amount-btn ${selectedAmount === option.value ? "is-selected" : ""}`}
                onClick={() => setSelectedAmount(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.note}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleCopyNote} className="pledge-form">
            <div className="form-row">
              <label className="field-group">
                <span>Your Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional or Organization"
                />
              </label>
              <label className="field-group">
                <span>Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </label>
            </div>

            <button type="submit" className="hero-btn-primary full-width">
              {copied ? "✓ Copied Pledge Memo to Clipboard" : `Copy $${selectedAmount} Pledge Memo`}
            </button>
            <p className="support-fine-print">
              Copies a formatted pledge memo to send to our school rocketry booster coordinator. No credit card required.
            </p>
          </form>
        </div>

        {/* Sponsor Contact Form */}
        <div className="support-card">
          <p className="eyebrow">Corporate & Community Inquiries</p>
          <h3 className="support-card-title">Get in Touch with the Crew</h3>
          <p className="support-card-desc">
            Have questions regarding 501(c)(3) tax deductions, booster club details, or logo placement on the airframe?
          </p>

          {submitted ? (
            <div className="form-success">
              <h4>Thank you for your interest!</h4>
              <p>Our team captain and faculty sponsor will follow up with official booster documentation shortly.</p>
              <button type="button" onClick={() => setSubmitted(false)} className="hero-btn-secondary">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="contact-form">
              <label className="field-group">
                <span>Name / Company</span>
                <input required type="text" placeholder="Your name or company" />
              </label>
              <label className="field-group">
                <span>Email Address</span>
                <input required type="email" placeholder="contact@domain.com" />
              </label>
              <label className="field-group">
                <span>Message or Tier Interest</span>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us how you would like to partner with Rock Hill High School Rocketry..."
                />
              </label>
              <button type="submit" className="hero-btn-secondary full-width">
                Submit Inquiry to Team
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
