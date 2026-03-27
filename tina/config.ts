import { defineConfig } from "tinacms";

const branch = process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

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
            list: true,
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
          },
          {
            type: "string",
            name: "location",
            label: "Restaurant / Location Name",
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
