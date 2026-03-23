import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Memento",
  description:
    "Persistent semantic memory for AI coding agents — Claude Code, OpenCode, Cursor, Windsurf",
  lang: "en-US",
  cleanUrls: true,
  base: "/memento/",

  head: [
    ["meta", { name: "theme-color", content: "#7c3aed" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "Memento — AI Agent Memory" }],
    [
      "meta",
      {
        name: "og:description",
        content:
          "Persistent semantic memory for AI coding agents. Save, recall, and search context across sessions.",
      },
    ],
    ["meta", { name: "og:url", content: "https://sanathshetty444.github.io/memento/" }],
  ],

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Memento",

    nav: [
      { text: "Guide", link: "/getting-started/installation" },
      { text: "Reference", link: "/reference/tools" },
      { text: "Architecture", link: "/architecture/overview" },
      {
        text: "v1.0.0",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/sanathshetty444/memento/blob/main/CHANGELOG.md",
          },
          {
            text: "Contributing",
            link: "/contributing/CONTRIBUTING",
          },
        ],
      },
    ],

    sidebar: {
      "/getting-started/": [
        {
          text: "Getting Started",
          items: [
            { text: "Installation", link: "/getting-started/installation" },
            { text: "Quickstart", link: "/getting-started/quickstart" },
            { text: "How It Works", link: "/getting-started/how-it-works" },
            { text: "Upgrading from v0.x", link: "/getting-started/upgrading" },
          ],
        },
        {
          text: "Next Steps",
          items: [
            { text: "Search Modes", link: "/guides/search-modes" },
            { text: "Smart Memory", link: "/guides/smart-memory" },
            { text: "Configuration", link: "/guides/configuration" },
          ],
        },
      ],

      "/guides/": [
        {
          text: "Core Concepts",
          items: [
            { text: "Auto-Capture", link: "/guides/auto-capture" },
            { text: "Search Modes", link: "/guides/search-modes" },
            { text: "Smart Memory", link: "/guides/smart-memory" },
          ],
        },
        {
          text: "Setup & Configuration",
          items: [
            { text: "Multi-IDE Setup", link: "/guides/multi-ide-setup" },
            { text: "Configuration", link: "/guides/configuration" },
            { text: "Browser Usage", link: "/guides/browser-usage" },
          ],
        },
        {
          text: "Data Management",
          items: [
            { text: "Project Indexing", link: "/guides/project-indexing" },
            { text: "Export & Import", link: "/guides/export-import" },
            { text: "Compaction", link: "/guides/compaction" },
          ],
        },
        {
          text: "Integrations",
          items: [{ text: "HTTP API & Graph UI", link: "/guides/http-api" }],
        },
      ],

      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "MCP Tools (all 17)", link: "/reference/tools" },
            { text: "CLI Commands", link: "/reference/cli" },
            { text: "REST API", link: "/reference/rest-api" },
            { text: "TypeScript Types", link: "/reference/types" },
            { text: "Storage Backends", link: "/reference/storage-backends" },
            { text: "Embedding Providers", link: "/reference/embedding-providers" },
          ],
        },
      ],

      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "System Overview", link: "/architecture/overview" },
            { text: "Memory Pipeline", link: "/architecture/memory-pipeline" },
            { text: "Search Internals", link: "/architecture/search-internals" },
            { text: "Resilience", link: "/architecture/resilience" },
            { text: "Architecture Decisions", link: "/architecture/decisions" },
          ],
        },
      ],

      "/contributing/": [
        {
          text: "Contributing",
          items: [
            { text: "Contributing Guide", link: "/contributing/CONTRIBUTING" },
            { text: "Code Style", link: "/contributing/code-style" },
            { text: "Testing", link: "/contributing/testing" },
            { text: "Adding a Tool", link: "/contributing/adding-a-tool" },
            { text: "Adding a Storage Backend", link: "/contributing/adding-a-storage-backend" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/sanathshetty444/memento" }],

    editLink: {
      pattern: "https://github.com/sanathshetty444/memento/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the AGPL-3.0 License.",
      copyright: "Copyright © 2026 Sanath Shetty",
    },
  },
});
