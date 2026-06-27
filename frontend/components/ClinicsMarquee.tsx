"use client";

const LOGOS = [
  "INVITRO",
  "HELIX",
  "KDL OLYMP",
  "INVIVO",
  "DOQ",
  "MEDELICA",
  "SUNKAR",
  "iDOCTOR",
];

export default function ClinicsMarquee() {
  const items = [...LOGOS, ...LOGOS];

  return (
    <div
      className="overflow-hidden pt-2"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      }}
    >
      <div className="marquee-track">
        {items.map((name, i) => (
          <span key={`${name}-${i}`} className="marquee-logo">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
