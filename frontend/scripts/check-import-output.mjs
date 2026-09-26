import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
export function checkImportOutput(directory) {
  const failures = [];
  for (const entry of fs.readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?|vue)$/.test(entry.name)) {
      continue;
    }
    const file = path.join(entry.parentPath, entry.name);
    let code = fs.readFileSync(file, "utf8");
    if (file.endsWith(".vue")) {
      code = [
        ...code.matchAll(
          /<script\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/script>/g,
        ),
      ]
        .map((match) => match[1])
        .join("\n");
    }
    const source = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
            ? node.argument.literal
            : ts.isCallExpression(node) &&
                node.expression.kind === ts.SyntaxKind.ImportKeyword
              ? node.arguments[0]
              : undefined;
      if (specifier && ts.isStringLiteral(specifier)) {
        const request = specifier.text;
        if (/^(?:@|~)(?:\/|$)/.test(request)) {
          failures.push(`${file}: leaked source alias ${request}`);
        }
        if (
          path.posix.isAbsolute(request) ||
          path.win32.isAbsolute(request) ||
          request.startsWith("file:")
        ) {
          failures.push(
            `${file}: non-portable absolute output import ${request}`,
          );
        }
        if (request.startsWith(".")) {
          const target = path.resolve(
            path.dirname(file),
            request.split(/[?#]/)[0],
          );
          const relative = path.relative(directory, target);
          if (
            relative === ".." ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative)
          ) {
            failures.push(`${file}: output import escapes package ${request}`);
          }
          let candidates = [target];
          if (/\.d\.[cm]?ts$/.test(file)) {
            const extension = path.extname(target);
            const declarations = {
              ".js": ".d.ts",
              ".mjs": ".d.mts",
              ".cjs": ".d.cts",
            };
            const declaration = declarations[extension];
            if (declaration) {
              candidates = [target.slice(0, -extension.length) + declaration];
            } else if (!extension) {
              candidates = [
                target + ".d.ts",
                target + ".d.mts",
                target + ".d.cts",
                path.join(target, "index.d.ts"),
              ];
            } else if (extension === ".vue") {
              candidates = [target + ".d.ts"];
            }
          }
          if (
            !candidates.some(
              (candidate) =>
                fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
            )
          ) {
            failures.push(`${file}: unresolved output import ${request}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return failures;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const failures = checkImportOutput(path.resolve(process.argv[2] ?? "dist"));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}
