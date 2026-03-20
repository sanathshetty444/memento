import { describe, it, expect } from "vitest";
import { autoTag } from "../src/memory/tagger.js";

describe("autoTag", () => {
  it("tags code when content has code fences", () => {
    const tags = autoTag("Here is some code:\n```\nconsole.log('hi')\n```");
    expect(tags).toContain("code");
  });

  it("tags code when content has file paths with extensions", () => {
    const tags = autoTag("Check the file at src/index.ts for details");
    expect(tags).toContain("code");
  });

  it("tags error when content has 'Error:'", () => {
    const tags = autoTag("Error: something went wrong");
    expect(tags).toContain("error");
  });

  it("tags error when content has 'exception'", () => {
    const tags = autoTag("An exception was thrown during execution");
    expect(tags).toContain("error");
  });

  it("tags decision when content has 'decided'", () => {
    const tags = autoTag("We decided to use PostgreSQL");
    expect(tags).toContain("decision");
  });

  it("tags decision when content has 'because'", () => {
    const tags = autoTag("We chose this because it is faster");
    expect(tags).toContain("decision");
  });

  it("tags architecture when content has 'component'", () => {
    const tags = autoTag("The auth component handles login");
    expect(tags).toContain("architecture");
  });

  it("tags architecture when content has 'service'", () => {
    const tags = autoTag("The user service exposes a REST API");
    expect(tags).toContain("architecture");
  });

  it("tags architecture when content has 'pattern'", () => {
    const tags = autoTag("We follow the repository pattern here");
    expect(tags).toContain("architecture");
  });

  it("tags config when content has process.env", () => {
    const tags = autoTag("Read the value from process.env.DATABASE_URL");
    expect(tags).toContain("config");
  });

  it("tags config when content has config file references", () => {
    const tags = autoTag("Update the config.json file with new settings");
    expect(tags).toContain("config");
  });

  it("tags dependency when content has @scope/package", () => {
    const tags = autoTag("Install @nestjs/core for the framework");
    expect(tags).toContain("dependency");
  });

  it("tags dependency when content has version numbers", () => {
    const tags = autoTag("Upgrade to ^2.4.1 for the fix");
    expect(tags).toContain("dependency");
  });

  it("tags todo when content has 'TODO'", () => {
    const tags = autoTag("TODO implement error handling");
    expect(tags).toContain("todo");
  });

  it("tags todo when content has 'FIXME'", () => {
    const tags = autoTag("FIXME this is broken");
    expect(tags).toContain("todo");
  });

  it("falls back to 'conversation' when no patterns match", () => {
    const tags = autoTag("Hello, how are you today?");
    expect(tags).toEqual(["conversation"]);
  });

  it("returns multiple tags when content matches multiple categories", () => {
    const tags = autoTag("Error: the auth service component failed because of a bug in index.ts");
    expect(tags.length).toBeGreaterThan(1);
    expect(tags).toContain("error");
    expect(tags).toContain("architecture");
    expect(tags).toContain("decision");
  });

  it("performs case insensitive matching", () => {
    const tags = autoTag("an EXCEPTION occurred in the SERVICE");
    expect(tags).toContain("error");
    expect(tags).toContain("architecture");
  });
});
