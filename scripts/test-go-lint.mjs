import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "go-quality-fixture-"));
assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + "\\") || resolve(temporary).startsWith(resolve(tmpdir()) + "/"));
try {
  function write(file, text) {
    const path = join(temporary, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  // Читаем настоящее имя: те же пробы должны работать после init-project.
  const serviceModule = /^module\s+(\S+)/m.exec(readFileSync(join(root, "backend/gotemplate/go.mod"), "utf8"))[1];
  const kitModule = /^module\s+(\S+)/m.exec(readFileSync(join(root, "backend/kit/go.mod"), "utf8"))[1];
  write("backend/gotemplate/go.mod", `module ${serviceModule}\n\ngo 1.25.0\nrequire github.com/gin-gonic/gin v1.0.0\nreplace github.com/gin-gonic/gin => ../../gin\n`);
  write("backend/kit/go.mod", `module ${kitModule}\n\ngo 1.25.0\nrequire ${serviceModule} v0.0.0\nreplace ${serviceModule} => ../gotemplate\n`);
  write("gin/go.mod", "module github.com/gin-gonic/gin\n\ngo 1.25.0\n");
  write("gin/gin.go", "package gin\nconst Value = 1\n");
  copyFileSync(join(root, "backend/.golangci.yml"), join(temporary, "backend/.golangci.yml"));

  const good = 'package fixture\nimport "os"\nfunc Check() error { return os.Chdir(".") }\n';
  write("backend/kit/check.go", good);
  write("backend/gotemplate/check.go", good);
  write("backend/gotemplate/pkg/contract/check.go", "package contract\nconst Value = 1\n");
  write("backend/gotemplate/internal/domain/model/check.go", "package model\nconst Value = 1\n");
  function lint(module, violation, forbidden = "") {
    const result = spawnSync(process.execPath, [join(root, "scripts/lint-go.mjs"), join(temporary, "backend", module)], { encoding: "utf8", env: { ...process.env, GOWORK: "off" } });
    if (result.error) {
      throw result.error;
    }
    const output = result.stdout + result.stderr;
    if (violation) {
      assert.notEqual(result.status, 0, `Линтер пропустил ${violation} в ${module}: ${forbidden}`);
      assert.ok(output.includes(`(${violation})`), output);
      assert.ok(output.includes(forbidden), output);
    } else {
      assert.equal(result.status, 0, output);
    }
  }
  lint("kit", null);
  lint("gotemplate", null);
  const importCode = (pkg) => `package fixture\nimport imported ${JSON.stringify(pkg)}\nvar Value = imported.Value\n`;
  for (const [module, file, code, violation, forbidden] of [
    ["kit", "check.go", 'package fixture\nimport "os"\nfunc Check() { os.Chdir(".") }\n', "errcheck", "os.Chdir"],
    ["kit", "check.go", 'package fixture\nimport _ "io/ioutil"\n', "depguard", "io/ioutil"],
    ["kit", "check.go", importCode(`${serviceModule}/pkg/contract`), "depguard", serviceModule],
    ["kit", "nested/check.go", importCode(`${serviceModule}/pkg/contract`), "depguard", serviceModule],
    ["gotemplate", "internal/domain/dtos/check.go", importCode("github.com/gin-gonic/gin"), "depguard", "gin-gonic/gin"],
    ["gotemplate", "internal/domain/dtos/nested/check.go", importCode("github.com/gin-gonic/gin"), "depguard", "gin-gonic/gin"],
    ["gotemplate", "internal/infra/services/check.go", importCode("github.com/gin-gonic/gin"), "depguard", "gin-gonic/gin"],
    ["gotemplate", "internal/infra/services/example/check.go", importCode("github.com/gin-gonic/gin"), "depguard", "gin-gonic/gin"],
    ["gotemplate", "pkg/check.go", importCode(`${serviceModule}/internal/domain/model`), "depguard", `${serviceModule}/internal`],
    ["gotemplate", "pkg/probe/check.go", importCode(`${serviceModule}/internal/domain/model`), "depguard", `${serviceModule}/internal`],
  ]) {
    const path = `backend/${module}/${file}`;
    write(path, code);
    lint(module, violation, forbidden);
    if (file === "check.go") {
      write(path, good);
    } else {
      rmSync(join(temporary, path));
    }
  }
  console.log("Go lint: PASS в обоих модулях; FAIL на errcheck, deprecated imports и границах kit/DTO/service/public.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
