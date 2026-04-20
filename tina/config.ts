import { defineConfig } from "tinacms";
import LocationLookup from "./LocationLookup";
import StatsDashboard, { StatsIcon } from "./StatsDashboard";
import PostManager, { PostManagerIcon } from "./PostManager";
import HitListManager, { HitListIcon } from "./HitListManager";
import TestingDashboard, { TestingIcon } from "./TestingDashboard";

// Shared cuisine options — single source of truth for both fields
const CUISINE_OPTIONS = [
  "Japanese", "Korean", "Mexican", "Taiwanese", "American", "Chinese",
  "Thai", "Vietnamese", "Italian", "French", "Indian", "Peruvian",
  "Mediterranean", "Filipino", "Hawaiian", "Colombian", "Cajun",
  "BBQ", "Seafood", "Bakery", "Dessert", "Coffee", "Cocktails",
  "Fusion", "Multi", "Cuban", "German", "British", "Spanish",
  "Brazilian", "Russian", "Ethiopian", "Persian", "Malaysian",
];

const NON_FOOD_CATEGORIES = [
  "Travel", "Baseball", "Sports", "Non-Food", "Uncategorized",
];

const branch = process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  cmsCallback: (cms) => {
    if (typeof document !== "undefined") {
      // Inject custom CSS (guard against duplicate injection)
      if (!document.querySelector('link[href="/admin/custom.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/admin/custom.css";
        document.head.appendChild(link);
      }

      // Add dark mode toggle button
      if (!document.getElementById("dark-mode-toggle")) {
        const btn = document.createElement("button");
        btn.id = "dark-mode-toggle";
        btn.title = "Toggle dark mode";
        const saved = localStorage.getItem("tina-dark-mode");
        let isDark = saved === "true";
        if (isDark) document.documentElement.classList.add("tina-dark");
        btn.textContent = isDark ? "☀️" : "🌙";
        btn.addEventListener("click", () => {
          isDark = !isDark;
          document.documentElement.classList.toggle("tina-dark", isDark);
          btn.textContent = isDark ? "☀️" : "🌙";
          localStorage.setItem("tina-dark-mode", String(isDark));
        });
        document.body.appendChild(btn);
      }
    }

    // Register Content Stats dashboard screen
    cms.plugins.add({
      __type: "screen",
      name: "Content Stats",
      Component: StatsDashboard,
      Icon: StatsIcon,
      layout: "fullscreen",
    });

    // Register Post Manager screen
    cms.plugins.add({
      __type: "screen",
      name: "Post Manager",
      Component: PostManager,
      Icon: PostManagerIcon,
      layout: "fullscreen",
    });

    // Register Hit List Manager screen
    cms.plugins.add({
      __type: "screen",
      name: "Hit List Manager",
      Component: HitListManager,
      Icon: HitListIcon,
      layout: "fullscreen",
    });

    // Register Testing dashboard screen
    cms.plugins.add({
      __type: "screen",
      name: "Testing",
      Component: TestingDashboard,
      Icon: TestingIcon,
      layout: "fullscreen",
    });

    return cms;
  },

  search: {
    tina: {
      indexerToken: process.env.TINA_SEARCH_TOKEN || "",
      stopwordLanguages: ["eng"],
    },
    indexBatchSize: 100,
    maxSearchIndexFieldLength: 200,
  },

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "images/posts",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "post",
        label: "Blog Posts",
        path: "src/content/posts",
        format: "md",
        ui: {
          filename: {
            readonly: false,
            slugify: (values) => {
              const date = values?.pubDate
                ? new Date(values.pubDate).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
              const slug = (values?.title || "untitled")
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .slice(0, 60)
                .replace(/-$/, "");
              return `${date}-${slug}`;
            },
          },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "datetime",
            name: "pubDate",
            label: "Publish Date",
            required: true,
            ui: {
              dateFormat: "YYYY-MM-DD",
            },
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            ui: {
              component: "textarea",
            },
          },
          {
            type: "string",
            name: "author",
            label: "Author",
          },
          {
            type: "image",
            name: "heroImage",
            label: "Hero Image",
          },
          {
            type: "string",
            name: "categories",
            label: "Categories",
            description: "Auto-synced from cuisine by sync_categories.py — edit cuisine instead",
            list: true,
            options: [...CUISINE_OPTIONS, ...NON_FOOD_CATEGORIES],
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
          },
          {
            type: "string",
            name: "cuisine",
            label: "Cuisine",
            list: true,
            options: CUISINE_OPTIONS,
          },
          {
            type: "string",
            name: "location",
            label: "Restaurant / Location Name",
            ui: {
              // TinaCMS field.ui.component accepts a React component at runtime,
              // but its type is too narrow. Cast to satisfy tsc without losing
              // the real type at runtime.
              component: LocationLookup as unknown as string,
            },
          },
          {
            type: "string",
            name: "city",
            label: "City",
          },
          {
            type: "string",
            name: "region",
            label: "Region",
          },
          {
            type: "string",
            name: "address",
            label: "Street Address",
          },
          {
            type: "object",
            name: "coordinates",
            label: "GPS Coordinates",
            fields: [
              {
                type: "number",
                name: "lat",
                label: "Latitude",
              },
              {
                type: "number",
                name: "lng",
                label: "Longitude",
              },
            ],
          },
          {
            type: "image",
            name: "images",
            label: "Additional Images",
            list: true,
          },
          {
            type: "string",
            name: "originalUrl",
            label: "Original URL",
          },
          {
            type: "string",
            name: "archiveUrl",
            label: "Archive URL",
          },
          {
            type: "string",
            name: "source",
            label: "Source",
            options: [
              "new",
              "instagram",
              "thirstypig.com",
              "thethirstypig.com",
              "blog.thethirstypig.com",
            ],
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
        ],
      },
    ],
  },
});
