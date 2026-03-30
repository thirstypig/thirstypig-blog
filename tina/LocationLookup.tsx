/**
 * Custom TinaCMS field component for Foursquare-powered location lookup.
 *
 * Type a restaurant name → search Foursquare → click a result →
 * auto-fills location, address, city, region, and coordinates.
 *
 * Requires FOURSQUARE_API_KEY in .env (loaded via tina config).
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import fsqConfig from "./fsq-config.json";

interface FoursquareResult {
  name: string;
  address: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
}

/** Raw Foursquare Places API response shape */
interface FoursquarePlace {
  name?: string;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
  };
  geocodes?: {
    main?: {
      latitude?: number;
      longitude?: number;
    };
  };
}

/** TinaCMS field plugin props */
interface TinaFieldProps {
  input: { value: string; onChange: (val: string) => void };
  field: { name: string; label?: string };
  form: {
    values: Record<string, unknown>;
    change: (field: string, value: unknown) => void;
  };
}

const FSQ_API_KEY = fsqConfig?.apiKey || "";
const FSQ_ENDPOINT = "https://places-api.foursquare.com/places/search";

// Debounce helper
function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useCallback(
    (...args: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

export default function LocationLookup(props: TinaFieldProps) {
  const { input, field, form } = props;
  const [results, setResults] = useState<FoursquareResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const searchFoursquare = useCallback(
    async (query: string) => {
      if (query.length < 3) {
        setResults([]);
        return;
      }

      if (!FSQ_API_KEY) {
        setError("Add your API key to tina/fsq-config.json");
        return;
      }

      setSearching(true);
      setError("");
      try {
        const city = form.values?.city || "";
        const near = city || "Los Angeles, CA";
        const params = new URLSearchParams({
          query,
          near,
          limit: "5",
          fields: "name,location,geocodes",
        });

        const res = await fetch(`${FSQ_ENDPOINT}?${params}`, {
          headers: {
            Authorization: `Bearer ${FSQ_API_KEY}`,
            "X-Places-Api-Version": "2025-06-17",
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          setError(`Foursquare error: ${res.status}`);
          setResults([]);
          return;
        }

        const data: { results?: FoursquarePlace[] } = await res.json();
        const mapped: FoursquareResult[] = (data.results || []).map((place) => ({
          name: place.name || "",
          address: place.location?.formatted_address || place.location?.address || "",
          city: place.location?.locality || "",
          region: place.location?.region || "",
          lat: place.geocodes?.main?.latitude ?? 0,
          lng: place.geocodes?.main?.longitude ?? 0,
        }));

        setResults(mapped);
        setShowResults(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSearching(false);
      }
    },
    [form.values?.city]
  );

  const debouncedSearch = useDebounce(searchFoursquare, 400);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    input.onChange(val);
    debouncedSearch(val);
  };

  const selectResult = (result: FoursquareResult) => {
    input.onChange(result.name);

    if (result.address) form.change("address", result.address);
    if (result.city) form.change("city", result.city);
    if (result.region) form.change("region", result.region);
    if (result.lat != null && result.lng != null) {
      form.change("coordinates", { lat: result.lat, lng: result.lng });
    }

    setShowResults(false);
    setResults([]);
  };

  return (
    <div style={{ position: "relative" }}>
      <label
        htmlFor={field.name}
        style={{
          display: "block",
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "4px",
          color: "#333",
        }}
      >
        {field.label || "Restaurant / Location Name"}
        {searching && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>
            Searching Foursquare...
          </span>
        )}
      </label>
      <input
        id={field.name}
        type="text"
        value={input.value || ""}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Type to search Foursquare..."
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #e1e1e1",
          borderRadius: "6px",
          fontSize: "14px",
          outline: "none",
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
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e1e1e1",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 100,
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                border: "none",
                borderBottom:
                  i < results.length - 1 ? "1px solid #f0f0f0" : "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "13px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f7f5f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <strong>{r.name}</strong>
              <br />
              <span style={{ color: "#888", fontSize: 12 }}>
                {r.address}
                {r.city ? ` · ${r.city}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>
        Type 3+ characters to search Foursquare. Selecting a result fills
        address, city, region, and coordinates.
      </p>
    </div>
  );
}
