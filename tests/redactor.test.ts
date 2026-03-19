import { describe, it, expect } from "vitest";
import { redact, shouldExcludeFile } from "../src/memory/redactor.js";

describe("redact", () => {
  it("redacts AWS keys (AKIA...)", () => {
    const content = "My key is AKIAIOSFODNN7EXAMPLE";
    const result = redact(content);
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result).toContain("[REDACTED:AWS_KEY]");
  });

  it("redacts API keys (sk-...)", () => {
    const content = "API key: sk-abcdefghij1234567890abcd";
    const result = redact(content);
    expect(result).not.toContain("sk-abcdefghij1234567890abcd");
    expect(result).toContain("[REDACTED:API_KEY]");
  });

  it("redacts bearer tokens", () => {
    const content = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const result = redact(content);
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(result).toContain("[REDACTED:BEARER_TOKEN]");
  });

  it("redacts passwords in URLs", () => {
    const content = "Connect to https://admin:s3cret@db.example.com/mydb";
    const result = redact(content);
    expect(result).not.toContain("admin:s3cret@");
    expect(result).toContain("[REDACTED:PASSWORD_IN_URL]");
  });

  it("preserves non-sensitive content", () => {
    const content = "This is a normal message with no secrets.";
    const result = redact(content);
    expect(result).toBe(content);
  });
});

describe("shouldExcludeFile", () => {
  it("matches .env files", () => {
    expect(shouldExcludeFile(".env")).toBe(true);
    expect(shouldExcludeFile("/project/.env")).toBe(true);
  });

  it("matches .env variant files", () => {
    expect(shouldExcludeFile(".env.local")).toBe(true);
    expect(shouldExcludeFile(".env.production")).toBe(true);
  });

  it("matches .pem files", () => {
    expect(shouldExcludeFile("server.pem")).toBe(true);
    expect(shouldExcludeFile("/certs/private.pem")).toBe(true);
  });

  it("matches credentials files", () => {
    expect(shouldExcludeFile("credentials")).toBe(true);
    expect(shouldExcludeFile("credentials.json")).toBe(true);
    expect(shouldExcludeFile("aws_credentials.txt")).toBe(true);
  });

  it("allows normal files", () => {
    expect(shouldExcludeFile("index.ts")).toBe(false);
    expect(shouldExcludeFile("README.md")).toBe(false);
    expect(shouldExcludeFile("package.json")).toBe(false);
    expect(shouldExcludeFile("src/config.ts")).toBe(false);
  });
});
