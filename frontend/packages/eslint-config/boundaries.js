import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default function boundaries(configUrl) {
  const project = dirname(fileURLToPath(configUrl));
  const workspace = resolve(project, "../..");
  const packages = ["packages", "applications"].flatMap((kind) =>
    readdirSync(join(workspace, kind), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(join(workspace, kind, entry.name, "package.json")),
      )
      .map(({ name }) => {
        const root = join(workspace, kind, name);
        const manifest = JSON.parse(
          readFileSync(join(root, "package.json"), "utf8"),
        );
        return { root, name, kind, manifest };
      }),
  );
  const source = join(
    project,
    existsSync(join(project, "app")) ? "app" : "src",
  );
  const slash = (value) => value.replaceAll("\\", "/");
  const rule = {
    meta: {
      type: "problem",
      schema: [],
      fixable: "code",
      messages: {
        boundary: "Запрещённая зависимость {{request}}: {{reason}}.",
        builtin: "Встроенный модуль импортируется через node:{{request}}.",
        dynamic:
          "Путь динамического импорта должен быть строковым литералом для проверки границ.",
      },
    },
    create(context) {
      const owner = packages.find(
        (entry) => entry.root === project && entry.kind === "packages",
      )?.name;
      const local = slash(relative(source, context.filename));
      function check(node) {
        if (!node || typeof node.value !== "string") {
          return;
        }
        const request = node.value;
        if (isBuiltin(request) && !request.startsWith("node:")) {
          context.report({
            node,
            messageId: "builtin",
            data: { request },
            fix: (fixer) =>
              fixer.replaceText(node, JSON.stringify(`node:${request}`)),
          });
          return;
        }
        const target = request.startsWith(".")
          ? resolve(dirname(context.filename), request)
          : /^[~@]\//.test(request)
            ? resolve(source, request.slice(2))
            : null;
        const imported = packages.find(
          (entry) =>
            request === entry.manifest.name ||
            request.startsWith(entry.manifest.name + "/") ||
            (target &&
              (target === entry.root ||
                target.startsWith(entry.root + "/") ||
                target.startsWith(entry.root + "\\"))),
        );
        let reason;
        if (imported && imported.root !== project) {
          const subpath = "." + request.slice(imported.manifest.name.length);
          const publicExport = Object.keys(
            imported.manifest.exports ?? {},
          ).some((key) => {
            const [prefix, suffix] = key.split("*");
            return suffix === undefined
              ? key === subpath
              : subpath.startsWith(prefix) && subpath.endsWith(suffix);
          });
          if (target || !publicExport) {
            reason = "используйте публичный экспорт workspace-пакета";
          }
        }
        const framework =
          /^(?:vue(?:\/|$)|pinia(?:\/|$)|@vueuse\/|nuxt(?:\/|$)|#app$)/.test(
            request,
          );
        const routerOrNuxt = /^(?:vue-router(?:\/|$)|nuxt(?:\/|$)|#app$)/.test(
          request,
        );
        if (
          owner === "api" &&
          (framework ||
            routerOrNuxt ||
            imported?.name === "components" ||
            imported?.name === "shared")
        ) {
          reason = "API не зависит от UI и реактивности";
        }
        if (
          owner === "shared" &&
          (routerOrNuxt ||
            imported?.name === "components" ||
            imported?.name === "api" ||
            /\.(?:s?css|vue)$/.test(request))
        ) {
          reason = "общая логика не зависит от UI, транспорта и Nuxt";
        }
        if (
          owner === "components" &&
          (routerOrNuxt || imported?.name === "api")
        ) {
          reason = "дизайн-система не зависит от транспорта и роутера";
        }
        if (
          !owner &&
          local.startsWith("components/") &&
          (imported?.name === "api" ||
            (target &&
              /^(?:adapters|api)\//.test(slash(relative(source, target)))))
        ) {
          reason = "компонент приложения обращается к сценарию через контракт";
        }
        if (
          owner &&
          (imported?.kind === "applications" ||
            (target &&
              slash(relative(workspace, target)).startsWith("applications/")))
        ) {
          reason = "библиотека не зависит от приложения";
        }
        if (reason) {
          context.report({
            node,
            messageId: "boundary",
            data: { request, reason },
          });
        }
      }
      return {
        ImportDeclaration: (node) => check(node.source),
        ExportNamedDeclaration: (node) => check(node.source),
        ExportAllDeclaration: (node) => check(node.source),
        ImportExpression(node) {
          if (node.source.type !== "Literal") {
            context.report({ node, messageId: "dynamic" });
          } else {
            check(node.source);
          }
        },
        TSImportType: (node) =>
          check(
            node.argument?.literal ??
              node.argument ??
              node.parameter?.literal ??
              node.parameter,
          ),
      };
    },
  };
  return {
    files: ["src/**/*.{js,ts,tsx,vue}", "app/**/*.{js,ts,tsx,vue}"],
    plugins: { workspace: { rules: { boundaries: rule } } },
    rules: { "workspace/boundaries": "error" },
  };
}
