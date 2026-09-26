import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

// Vite уже собрал стили в style.css; относительного SCSS в dist нет.
for (const entry of readdirSync("dist", {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile() || !entry.name.endsWith(".d.ts")) {
    continue;
  }
  const file = join(entry.parentPath, entry.name);
  let text = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports = tree.statements.filter(
    (node) =>
      ts.isImportDeclaration(node) &&
      !node.importClause &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /\.(?:scss|css)$/.test(node.moduleSpecifier.text),
  );
  for (const node of imports.reverse()) {
    text = text.slice(0, node.getStart(tree)) + text.slice(node.end);
  }
  if (imports.length) {
    writeFileSync(file, text);
  }
}
