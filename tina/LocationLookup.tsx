/**
 * Custom TinaCMS field component for Google Places-powered location lookup.
 *
 * Uses the NEW Places API (Place.searchByText) — required for new customers
 * as of March 2025. The legacy AutocompleteService/PlacesService are blocked.
 *
 * Loads Google Maps JS SDK via script tag injection (most reliable method).
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import googleConfig from "./google-places-config.json";

const GOOGLE_API_KEY = googleConfig?.apiKey || "";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
}

interface TinaFieldProps {
  input: { value: string; onChange: (val: string) => void };
  field: { name: string; label?: string };
  form: {
    values: Record<string, unknown>;
    change: (field: string, value: unknown) => void;
  };
}

// Load the Google Maps JS SDK via script tag (avoids loader library issues)
let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (loadPromise) return loadPromise;
  if (typeof google !== "undefined" && google.maps?.places?.Place) {
    return Promise.resolve();
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps SDK"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export default function LocationLookup(props: TinaFieldProps) {
  const { input, field, form } = props;
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [ready, setReady] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      setError("Add your API key to tina/google-places-config.json");
      return;
    }
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const search = useCallback(
    async (query: string) => {
      if (query.length < 3 || !ready) {
        setResults([]);
        return;
      }

      setSearching(true);
      setError("");

      try {
        // Use the NEW Place.searchByText API (required for new customers since March 2025)
        const { Place } = google.maps.places;
        const { places } = await Place.searchByText({
          textQuery: query,
          fields: [
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "addressComponents",
          ],
          locationBias: new google.maps.Circle({
            center: { lat: 34.0522, lng: -118.2437 },
            radius: 50000,
          }),
          maxResultCount: 5,
          language: "en",
        });

        const mapped: PlaceResult[] = (places || []).map((place: any) => {
          const components = place.addressComponents || [];
          const city =
            components.find((c: any) => c.types?.includes("locality"))
              ?.longText || "";
          const region =
            components.find((c: any) =>
              c.types?.includes("administrative_area_level_1")
            )?.shortText || "";

          return {
            placeId: place.id || "",
            name: place.displayName || "",
            address: place.formattedAddress || "",
            city,
            region,
            lat: place.location?.lat() ?? 0,
            lng: place.location?.lng() ?? 0,
          };
        });

        setResults(mapped);
        setShowResults(mapped.length > 0);
        if (inputRef.current && mapped.length > 0) {
          const rect = inputRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("ZERO_RESULTS") || msg.includes("not find")) {
          setResults([]);
        } else {
          setError(`Google Places: ${msg}`);
        }
      } finally {
        setSearching(false);
      }
    },
    [ready]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    input.onChange(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(val), 400);
  };

  const selectResult = (result: PlaceResult) => {
    input.onChange(result.name);
    if (result.address) form.change("address", result.address);
    if (result.city) form.change("city", result.city);
    if (result.region) form.change("region", result.region);
    if (result.lat !== 0 && result.lng !== 0) {
      form.change("coordinates", { lat: result.lat, lng: result.lng });
    }
    setShowResults(false);
    setResults([]);
  };

  return (
    <div style={{ position: "relative", zIndex: 9999 }}>
      <label
        htmlFor={field.name}
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "6px",
          color: "inherit",
        }}
      >
        {field.label || "Restaurant / Location Name"}
        {searching && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>
            Searching...
          </span>
        )}
      </label>
      <input
        id={field.name}
        type="text"
        value={input.value || ""}
        onChange={handleChange}
        ref={inputRef}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
          }
        }}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder={
          ready
            ? "Type to search Google Places..."
            : error
            ? "API error — check console"
            : "Loading Google Maps..."
        }
        disabled={!ready && !error}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          fontSize: "14px",
          outline: "none",
          opacity: ready || error ? 1 : 0.6,
          transition: "border-color 0.2s",
        }}
      />
      {error && (
        <p style={{ fontSize: 12, color: "#c00", margin: "4px 0 0" }}>
          {error}
        </p>
      )}
      {showResults && results.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width || "100%",
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 99999,
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={r.placeId || i}
              type="button"
              onClick={() => selectResult(r)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                borderBottom:
                  i < results.length - 1 ? "1px solid #e5e7eb" : "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "14px",
                lineHeight: "1.4",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f3f4f6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                {r.name}
              </div>
              <div style={{ color: "#6b7280", fontSize: 12, lineHeight: "1.3" }}>
                {r.address}
              </div>
              {r.city && (
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
                  {[r.city, r.region].filter(Boolean).join(", ")}
                  {r.lat !== 0 && ` · ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
                </div>
              )}
            </button>
          ))}
          <div
            style={{
              padding: "6px 14px",
              borderTop: "1px solid #e5e7eb",
              textAlign: "right",
              background: "#f9fafb",
              borderRadius: "0 0 8px 8px",
            }}
          >
            <img
              src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png"
              alt="Powered by Google"
              style={{ height: 14, opacity: 0.5 }}
            />
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>
        Type 3+ characters to search Google Places. Selecting a result fills
        address, city, region, and coordinates.
      </p>
    </div>
  );
}
