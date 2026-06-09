import React from "react";
import { isSafeSrc } from "../src/utils/image-validation";

// ── Shared types ──────────────────────────────────────────────────────────────

interface StringInputProps {
  value: string | null | undefined;
  onChange: (val: string) => void;
}

interface StringListInputProps {
  value: string[] | null | undefined;
  onChange: (val: string[]) => void;
}

interface FieldProps {
  name: string;
  label?: string;
}

// ── Shared style constants ────────────────────────────────────────────────────

const S_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const S_EMPTY: React.CSSProperties = {
  background: "#f3f4f6",
  border: "1px dashed #d1d5db",
  borderRadius: 6,
  color: "#9ca3af",
  fontSize: 13,
  marginBottom: 8,
};

const S_MONO_INPUT: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 4,
  fontFamily: "monospace",
  color: "#374151",
};


// ── Single image (heroImage) ──────────────────────────────────────────────────

export const HeroImagePreview = ({
  input,
  field,
}: {
  input: StringInputProps;
  field: FieldProps;
}) => {
  const src = input.value || "";
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={S_LABEL}>{field.label || field.name}</label>

      {src && isSafeSrc(src) ? (
        <img
          src={src}
          alt="Hero image preview"
          decoding="async"
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 220,
            objectFit: "cover",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            marginBottom: 8,
          }}
        />
      ) : src && !isSafeSrc(src) ? (
        <div
          style={{
            ...S_EMPTY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 80,
            color: "#ef4444",
          }}
        >
          ⚠ Invalid path (must start with /)
        </div>
      ) : (
        <div
          style={{
            ...S_EMPTY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 80,
          }}
        >
          No hero image set
        </div>
      )}

      <input
        type="text"
        value={src}
        onChange={(e) => input.onChange(e.target.value)}
        placeholder="/images/posts/slug/01.jpg"
        style={{
          ...S_MONO_INPUT,
          width: "100%",
          padding: "6px 8px",
          fontSize: 12,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
};

// ── Image list (images[]) ─────────────────────────────────────────────────────

export const ImageListPreview = ({
  input,
  field,
}: {
  input: StringListInputProps;
  field: FieldProps;
}) => {
  const [localImages, setLocalImages] = React.useState<string[]>(
    input.value || []
  );

  // Sync if TinaCMS resets the field externally
  React.useEffect(() => {
    setLocalImages(input.value || []);
  }, [input.value]);

  const update = (index: number, val: string) => {
    const next = [...localImages];
    next[index] = val;
    setLocalImages(next);
  };

  const flush = () => input.onChange(localImages);

  const remove = (index: number) => {
    const next = localImages.filter((_, i) => i !== index);
    setLocalImages(next);
    input.onChange(next);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ ...S_LABEL, marginBottom: 8 }}>
        {field.label || field.name}{" "}
        <span style={{ fontWeight: 400, color: "#9ca3af" }}>
          ({localImages.length})
        </span>
      </label>

      {localImages.length === 0 && (
        <div style={{ ...S_EMPTY, padding: "12px 16px" }}>No images</div>
      )}

      {/* Single pass: thumbnail + path input + remove button per row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {localImages.map((src, i) => (
          <div
            key={src + "_" + i}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {/* Thumbnail */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {src && isSafeSrc(src) ? (
                <img
                  src={src}
                  alt={`Image ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  width={72}
                  height={72}
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "cover",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#9ca3af",
                  }}
                >
                  {src ? "⚠" : "–"}
                </div>
              )}
              <span
                style={{
                  position: "absolute",
                  bottom: 2,
                  left: 2,
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  fontSize: 10,
                  lineHeight: 1,
                  padding: "2px 4px",
                  borderRadius: 2,
                }}
              >
                {i + 1}
              </span>
            </div>

            {/* Path input */}
            <input
              type="text"
              value={src}
              onChange={(e) => update(i, e.target.value)}
              onBlur={flush}
              style={{
                ...S_MONO_INPUT,
                flex: 1,
                padding: "4px 8px",
                fontSize: 11,
              }}
            />

            {/* Remove */}
            <button
              type="button"
              onClick={() => remove(i)}
              title="Remove"
              style={{
                background: "none",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: "2px 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
