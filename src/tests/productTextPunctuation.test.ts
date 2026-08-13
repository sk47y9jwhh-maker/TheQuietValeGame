import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "tests" ? [] : sourceFiles(filePath);
    }
    return /\.tsx?$/.test(entry.name) ? [filePath] : [];
  });
}

describe("product punctuation", () => {
  it("uses no semicolons in source strings or visible JSX text", () => {
    const matches: string[] = [];

    for (const filePath of sourceFiles(path.join(process.cwd(), "src"))) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      const source = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteralLike(node) || ts.isJsxText(node)) &&
          node.text.includes(";")
        ) {
          const position = source.getLineAndCharacterOfPosition(node.getStart());
          matches.push(
            `${path.relative(process.cwd(), filePath)}:${position.line + 1}`
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect(matches).toEqual([]);
  });
});
