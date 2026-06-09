import React from "react";

interface InputProps {
  value: string;
  onChange: (val: string) => void;
}

interface FieldProps {
  name: string;
  label?: string;
}

// ── Single image (heroImage) ──────────────────────────────────────────────────

export const HeroImagePreview = ({
  input,
  field,
}: {
  input: InputProps;
  field: FieldProps;
}) => {
  const src = input.value || "";
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        {field.label || field.name}
      </label>

      {src ? (
        <img
          src={src}
          alt="Hero image preview"
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
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 80,
            background: "#f3f4f6",
            border: "1px dashed #d1d5db",
            borderRadius: 6,
            color: "#9ca3af",
            fontSize: 13,
            marginBottom: 8,
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
          width: "100%",
          padding: "6px 8px",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "monospace",
          color: "#374151",
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
  input: { value: string[]; onChange: (val: string[]) => void };
  field: FieldProps;
}) => {
  const images: string[] = input.value || [];

  const update = (index: number, val: string) => {
    const next = [...images];
    next[index] = val;
    input.onChange(next);
  };

  const remove = (index: number) => {
    input.onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 8,
        }}
      >
        {field.label || field.name}{" "}
        <span style={{ fontWeight: 400, color: "#9ca3af" }}>
          ({images.length})
        </span>
      </label>

      {images.length === 0 && (
        <div
          style={{
            padding: "12px 16px",
            background: "#f3f4f6",
            border: "1px dashed #d1d5db",
            borderRadius: 6,
            color: "#9ca3af",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          No images
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {images.map((src, i) => (
            <div key={i} style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={src}
                alt={`Image ${i + 1}`}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  display: "block",
                }}
              />
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
          ))}
        </div>
      )}

      {/* Editable path list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {images.map((src, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="text"
              value={src}
              onChange={(e) => update(i, e.target.value)}
              style={{
                flex: 1,
                padding: "4px 8px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "monospace",
                color: "#374151",
              }}
            />
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
