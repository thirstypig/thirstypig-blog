import React from "react";

// Icon for the sidebar — a simple paint-palette glyph
export const StyleSheetIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F3A8;</span>
);

// ---------------------------------------------------------------------------
// Source-of-truth values
//
// All values here are mirrored from src/styles/global.css (@theme block).
// This page is a TinaCMS Screen Plugin which renders inside its own iframe,
// so we cannot rely on the site's Tailwind classes — we copy the literal
// hex values + font stacks instead.
//
// Mono font: the site does not define a custom mono token, so it inherits
// Tailwind's default ui-monospace stack. We mirror that here.
// ---------------------------------------------------------------------------

const FONT_SANS =
  "'Inter', system-ui, -apple-system, sans-serif";
const FONT_SERIF =
  "'Playfair Display', Georgia, serif";
const FONT_POSTER =
  "'Archivo', system-ui, -apple-system, sans-serif";
const FONT_POSTER_DISPLAY =
  "'Archivo Black', 'Archivo', system-ui, sans-serif";
const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

interface Swatch {
  name: string;
  varName: string;
  light: string;
  dark?: string;
  note: string;
  textOn?: "light" | "dark";
}

const COLORS: Swatch[] = [
  {
    name: "cream",
    varName: "--color-cream",
    light: "#F5EFE3",
    dark: "#3A3A3A",
    note: "Page background. Warm paper tone.",
    textOn: "dark",
  },
  {
    name: "cream-dark",
    varName: "--color-cream-dark",
    light: "#E9DFC9",
    dark: "#282828",
    note: "Card surfaces, subtle borders.",
    textOn: "dark",
  },
  {
    name: "ink",
    varName: "--color-ink",
    light: "#1A1A1A",
    dark: "#E8E4DF",
    note: "Primary body text.",
    textOn: "light",
  },
  {
    name: "ink-light",
    varName: "--color-ink-light",
    light: "#374151",
    dark: "#C8C4BF",
    note: "Prose body, secondary headings.",
    textOn: "light",
  },
  {
    name: "amber",
    varName: "--color-amber",
    light: "#B45309",
    dark: "#F59E0B",
    note: "Links, accents. AA on cream.",
    textOn: "light",
  },
  {
    name: "amber-light",
    varName: "--color-amber-light",
    light: "#D97706",
    dark: "#FBBF24",
    note: "Hover/highlight variant.",
    textOn: "light",
  },
  {
    name: "rust",
    varName: "--color-rust",
    light: "#9A3412",
    dark: "#FB923C",
    note: "Link hover, blockquote accents.",
    textOn: "light",
  },
  {
    name: "sage",
    varName: "--color-sage",
    light: "#5A6B4D",
    dark: "#8FA07F",
    note: "Subdued accent (rare).",
    textOn: "light",
  },
  {
    name: "stone",
    varName: "--color-stone",
    light: "#655F5B",
    dark: "#A8A29E",
    note: "Muted text. Hardened to AA on cream.",
    textOn: "light",
  },
  {
    name: "stone-light",
    varName: "--color-stone-light",
    light: "#A8A29E",
    dark: "#78716C",
    note: "Dividers, footnotes.",
    textOn: "dark",
  },
  {
    name: "poster-red",
    varName: "--color-poster-red",
    light: "#E4152B",
    note: "Bold Red Poster hero.",
    textOn: "light",
  },
  {
    name: "poster-red-deep",
    varName: "--color-poster-red-deep",
    light: "#B50E1F",
    note: "Poster red shadow/deep variant.",
    textOn: "light",
  },
  {
    name: "poster-paper",
    varName: "--color-poster-paper",
    light: "#FDFBF7",
    note: "Poster's paper surface.",
    textOn: "dark",
  },
  {
    name: "poster-ink",
    varName: "--color-poster-ink",
    light: "#1A1413",
    note: "Poster body ink.",
    textOn: "light",
  },
  {
    name: "poster-muted",
    varName: "--color-poster-muted",
    light: "#6B635C",
    note: "Poster meta/caption text.",
    textOn: "light",
  },
];

const styles = {
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: FONT_SANS,
    color: "#1f2937",
  } as React.CSSProperties,

  header: {
    marginBottom: 32,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 24,
  } as React.CSSProperties,

  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    color: "#111827",
  } as React.CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    margin: "40px 0 14px",
    paddingBottom: 8,
    borderBottom: "1px solid #e5e7eb",
  } as React.CSSProperties,

  sectionLede: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: -8,
    marginBottom: 16,
  } as React.CSSProperties,

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  } as React.CSSProperties,

  swatchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  } as React.CSSProperties,

  swatch: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  } as React.CSSProperties,

  swatchTile: {
    height: 72,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: "8px 10px",
    fontFamily: FONT_MONO,
    fontSize: 11,
  } as React.CSSProperties,

  swatchMeta: {
    padding: "10px 12px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#374151",
  } as React.CSSProperties,

  swatchName: {
    fontWeight: 600,
    color: "#111827",
    fontSize: 13,
  } as React.CSSProperties,

  swatchVar: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  } as React.CSSProperties,

  swatchNote: {
    color: "#6b7280",
    marginTop: 6,
  } as React.CSSProperties,

  typeRow: {
    padding: "14px 0",
    borderBottom: "1px solid #f3f4f6",
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    alignItems: "baseline",
    gap: 16,
  } as React.CSSProperties,

  typeMeta: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: "#9ca3af",
    lineHeight: 1.4,
  } as React.CSSProperties,

  fontCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "18px 20px",
    marginBottom: 12,
  } as React.CSSProperties,

  spacingRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "8px 0",
  } as React.CSSProperties,

  spacingBox: {
    background: "#B45309",
    height: 22,
    borderRadius: 3,
  } as React.CSSProperties,

  // Component samples
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#F5EFE3",
    border: "1px solid #E9DFC9",
    fontSize: 13,
    color: "#1A1A1A",
  } as React.CSSProperties,

  chipCount: {
    color: "#655F5B",
    fontSize: 11,
    fontFamily: FONT_MONO,
  } as React.CSSProperties,

  chipCity: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(180, 83, 9, 0.15)",
    border: "1px solid rgba(180, 83, 9, 0.4)",
    fontSize: 13,
    color: "#1A1A1A",
  } as React.CSSProperties,

  buttonAmber: {
    background: "#B45309",
    color: "#FDFBF7",
    border: "none",
    padding: "10px 18px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT_SANS,
    cursor: "pointer",
  } as React.CSSProperties,

  buttonCream: {
    background: "#F5EFE3",
    color: "#1A1A1A",
    border: "1px solid #E9DFC9",
    padding: "10px 18px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT_SANS,
    cursor: "pointer",
  } as React.CSSProperties,

  sampleCard: {
    background: "#FDFBF7",
    border: "1px solid #E9DFC9",
    borderRadius: 8,
    padding: "20px 22px",
    maxWidth: 380,
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  tagPill: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: "#B45309",
    color: "#FDFBF7",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as React.CSSProperties,
};

// --- Sub-components ---

function ColorSwatch({ s }: { s: Swatch }) {
  const isLight = s.textOn === "dark";
  return (
    <div style={styles.swatch}>
      <div
        style={{
          ...styles.swatchTile,
          background: s.light,
          color: isLight ? "#1A1A1A" : "#FDFBF7",
        }}
      >
        <span>{s.light}</span>
        {s.dark && (
          <span
            style={{
              background: s.dark,
              color: s.dark.toUpperCase() === "#E8E4DF" ? "#1A1A1A" : "#FDFBF7",
              padding: "2px 6px",
              borderRadius: 3,
              fontSize: 10,
            }}
            title="Dark mode value"
          >
            {s.dark}
          </span>
        )}
      </div>
      <div style={styles.swatchMeta}>
        <div style={styles.swatchName}>{s.name}</div>
        <div style={styles.swatchVar}>{s.varName}</div>
        <div style={styles.swatchNote}>{s.note}</div>
      </div>
    </div>
  );
}

function TypeRow({
  label,
  spec,
  family,
  children,
}: {
  label: string;
  spec: string;
  family: "serif" | "sans" | "mono" | "poster";
  children: React.ReactNode;
}) {
  const fontFamily =
    family === "serif"
      ? FONT_SERIF
      : family === "mono"
      ? FONT_MONO
      : family === "poster"
      ? FONT_POSTER_DISPLAY
      : FONT_SANS;
  return (
    <div style={styles.typeRow}>
      <div style={styles.typeMeta}>
        <div style={{ color: "#374151", fontWeight: 600 }}>{label}</div>
        <div>{spec}</div>
      </div>
      <div style={{ fontFamily, color: "#1A1A1A" }}>{children}</div>
    </div>
  );
}

// --- Main Component ---

export default function StyleSheet() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Style Sheet</h1>
        <div style={styles.subtitle}>
          Live design-system reference. All values mirror{" "}
          <code style={{ fontFamily: FONT_MONO, fontSize: 12 }}>
            src/styles/global.css
          </code>
          .
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Color palette                                                   */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Color palette</h2>
      <p style={styles.sectionLede}>
        Each tile shows the light-mode hex on the swatch and the dark-mode hex
        in the corner badge (where applicable). Names match the CSS variable.
      </p>
      <div style={styles.swatchGrid}>
        {COLORS.map((c) => (
          <ColorSwatch key={c.varName} s={c} />
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Type scale                                                      */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Type scale</h2>
      <p style={styles.sectionLede}>
        Headings render in Playfair Display (serif). Body in Inter. Posters in
        Archivo Black.
      </p>
      <div style={styles.card}>
        <TypeRow
          label="h1"
          spec="2.5rem · 700 · serif"
          family="serif"
        >
          <div style={{ fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.2 }}>
            Eat everything. Twice.
          </div>
        </TypeRow>
        <TypeRow
          label="h2"
          spec="1.75rem · 600 · serif"
          family="serif"
        >
          <div style={{ fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.2 }}>
            A heading for sections
          </div>
        </TypeRow>
        <TypeRow
          label="h3"
          spec="1.375rem · 600 · serif"
          family="serif"
        >
          <div
            style={{ fontSize: "1.375rem", fontWeight: 600, lineHeight: 1.2 }}
          >
            Subsection heading
          </div>
        </TypeRow>
        <TypeRow
          label="h4"
          spec="1.125rem · 600 · serif"
          family="serif"
        >
          <div
            style={{ fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.2 }}
          >
            Smaller subhead
          </div>
        </TypeRow>
        <TypeRow
          label="h5"
          spec="1rem · 700 · serif"
          family="serif"
        >
          <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>
            Tight heading
          </div>
        </TypeRow>
        <TypeRow
          label="h6"
          spec="0.875rem · 700 · serif uppercase"
          family="serif"
        >
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Eyebrow heading
          </div>
        </TypeRow>
        <TypeRow
          label="body"
          spec="1.125rem · 400 · sans · 1.8 line"
          family="sans"
        >
          <div
            style={{ fontSize: "1.125rem", lineHeight: 1.8, color: "#374151" }}
          >
            The dumplings were translucent and the broth was so hot it nearly
            steamed the table. Twelve years on, this place still hits.
          </div>
        </TypeRow>
        <TypeRow
          label="small"
          spec="0.8125rem · 400 · sans"
          family="sans"
        >
          <div style={{ fontSize: "0.8125rem", color: "#655F5B" }}>
            Photographed Apr 12, 2026 · Los Angeles
          </div>
        </TypeRow>
        <TypeRow
          label="mono"
          spec="0.8125rem · 400 · mono"
          family="mono"
        >
          <code style={{ fontSize: "0.8125rem", color: "#655F5B" }}>
            placeId: ChIJN1t_tDeuEmsRUsoyG83frY4
          </code>
        </TypeRow>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Font families                                                   */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Font families</h2>
      <div>
        <div style={styles.fontCard}>
          <div style={styles.typeMeta}>
            <span style={{ color: "#374151", fontWeight: 600 }}>
              --font-poster-display
            </span>{" "}
            · Archivo Black 400
          </div>
          <div
            style={{
              fontFamily: FONT_POSTER_DISPLAY,
              fontSize: 36,
              lineHeight: 1.05,
              marginTop: 8,
              color: "#1A1413",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            Eat everything. Twice.
          </div>
        </div>
        <div style={styles.fontCard}>
          <div style={styles.typeMeta}>
            <span style={{ color: "#374151", fontWeight: 600 }}>
              --font-poster
            </span>{" "}
            · Archivo 500/700/800/900
          </div>
          <div
            style={{
              fontFamily: FONT_POSTER,
              fontSize: 22,
              fontWeight: 700,
              marginTop: 8,
              color: "#1A1413",
            }}
          >
            Sharp sans for poster captions and meta.
          </div>
        </div>
        <div style={styles.fontCard}>
          <div style={styles.typeMeta}>
            <span style={{ color: "#374151", fontWeight: 600 }}>
              --font-serif
            </span>{" "}
            · Playfair Display 400/600/700
          </div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 26,
              marginTop: 8,
              color: "#1A1A1A",
            }}
          >
            The dumplings were translucent and the broth was hot.
          </div>
        </div>
        <div style={styles.fontCard}>
          <div style={styles.typeMeta}>
            <span style={{ color: "#374151", fontWeight: 600 }}>
              --font-sans
            </span>{" "}
            · Inter 400/500/600
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 18,
              marginTop: 8,
              color: "#374151",
            }}
          >
            Inter is the body copy face. Steady, readable at every size.
          </div>
        </div>
        <div style={styles.fontCard}>
          <div style={styles.typeMeta}>
            <span style={{ color: "#374151", fontWeight: 600 }}>mono</span> ·
            ui-monospace (system)
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 14,
              marginTop: 8,
              color: "#374151",
            }}
          >
            const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Spacing tokens                                                  */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Spacing</h2>
      <p style={styles.sectionLede}>
        No custom spacing scale is defined in <code>global.css</code>. The
        project uses Tailwind v4 defaults (4px base unit). Common rungs in use:
      </p>
      <div style={styles.card}>
        {[
          { name: "1", px: 4 },
          { name: "2", px: 8 },
          { name: "3", px: 12 },
          { name: "4", px: 16 },
          { name: "6", px: 24 },
          { name: "8", px: 32 },
          { name: "12", px: 48 },
          { name: "16", px: 64 },
        ].map((s) => (
          <div key={s.name} style={styles.spacingRow}>
            <div
              style={{
                width: 64,
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              gap-{s.name}
            </div>
            <div style={{ ...styles.spacingBox, width: s.px }} />
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              {s.px}px
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Component samples                                               */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Component samples</h2>

      {/* Chips */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Venue chips
        </h3>
        <p style={{ ...styles.sectionLede, marginTop: 0 }}>
          Mirrors <code>src/components/VenueChips.astro</code>.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={styles.chipCity}>
            <span aria-hidden>📍</span>
            <span>Los Angeles</span>
          </span>
          <span style={styles.chip}>
            <span>soup dumplings</span>
            <span style={styles.chipCount}>312</span>
          </span>
          <span style={styles.chip}>
            <span>cash only</span>
            <span style={styles.chipCount}>87</span>
          </span>
          <span style={styles.chip}>
            <span>weekend brunch</span>
            <span style={styles.chipCount}>54</span>
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Buttons
        </h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button style={styles.buttonAmber}>Save changes</button>
          <button style={styles.buttonCream}>Cancel</button>
        </div>
      </div>

      {/* Card */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Card surface
        </h3>
        <p style={{ ...styles.sectionLede, marginTop: 0 }}>
          Used by <code>/hitlist</code> entries and post tiles.
        </p>
        <div style={styles.sampleCard}>
          <div style={{ marginBottom: 10 }}>
            <span style={styles.tagPill}>Japanese</span>
          </div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 22,
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: 6,
            }}
          >
            Sushi Tsujita
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 14,
              color: "#374151",
              lineHeight: 1.6,
            }}
          >
            West LA, omakase counter. Twelve years on the hit list, finally
            booked.
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: "#655F5B",
              marginTop: 10,
            }}
          >
            Apr 12, 2026 · Los Angeles
          </div>
        </div>
      </div>

      {/* Tag pills */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 14,
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Tag / category pills
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Japanese", "Korean", "Mexican", "Taiwanese", "BBQ"].map((t) => (
            <span key={t} style={styles.tagPill}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Bold Red Poster brand mark                                      */}
      {/* ------------------------------------------------------------------ */}
      <h2 style={styles.sectionTitle}>Bold Red Poster brand mark</h2>
      <p style={styles.sectionLede}>
        Active redesign signature. Wordmark uses Archivo Black on poster red.
      </p>
      <div
        style={{
          background: "#E4152B",
          padding: "56px 40px",
          borderRadius: 12,
          textAlign: "center",
          color: "#FDFBF7",
          boxShadow: "0 6px 18px rgba(228,21,43,0.25)",
        }}
      >
        <div
          style={{
            fontFamily: FONT_POSTER_DISPLAY,
            fontSize: 64,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            textTransform: "lowercase",
          }}
        >
          thirsty
          <span style={{ color: "#1A1413" }}>pig</span>
        </div>
        <div
          style={{
            fontFamily: FONT_POSTER_DISPLAY,
            fontSize: 22,
            marginTop: 18,
            letterSpacing: "0.01em",
            textTransform: "uppercase",
          }}
        >
          Eat everything. Twice.
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            marginTop: 22,
            opacity: 0.85,
          }}
        >
          background #E4152B · ink #1A1413 · paper #FDFBF7
        </div>
      </div>

      <div style={{ height: 60 }} />
    </div>
  );
}
