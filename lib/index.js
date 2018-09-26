"use strict";

var _postcss = _interopRequireDefault(require("postcss"));

var _postcssValueParser = _interopRequireDefault(
  require("postcss-value-parser")
);

var _icssUtils = require("icss-utils");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

const plugin = "postcss-plugin-import";

const getArg = nodes =>
  nodes.length !== 0 && nodes[0].type === "string"
    ? nodes[0].value
    : _postcssValueParser.default.stringify(nodes);

const getUrl = node => {
  if (node.type === "function" && node.value.toLowerCase() === "url") {
    return getArg(node.nodes);
  }

  if (node.type === "string") {
    return node.value;
  }

  return "";
};

const parseImport = params => {
  const _valueParser = (0, _postcssValueParser.default)(params),
    nodes = _valueParser.nodes;

  if (nodes.length === 0) {
    return null;
  }

  const url = getUrl(nodes[0]);

  if (url.trim().length === 0) {
    return null;
  }

  return {
    url,
    media: _postcssValueParser.default.stringify(nodes.slice(1)).trim()
  };
};

const defaultFilter = url => !/^\w+:\/\//.test(url) && !url.startsWith("//");

module.exports = _postcss.default.plugin(
  plugin,
  (options = {}) => (css, result) => {
    const imports = {};
    const filter = options.filter || defaultFilter;
    css.walkAtRules(/^import$/i, atrule => {
      // Convert only top-level @import
      if (atrule.parent.type !== "root") {
        return;
      }

      if (atrule.nodes) {
        return result.warn(
          "It looks like you didn't end your @import statement correctly. " +
            "Child nodes are attached to it.",
          {
            node: atrule
          }
        );
      }

      const parsed = parseImport(atrule.params);

      if (parsed === null) {
        return result.warn(`Unable to find uri in '${atrule.toString()}'`, {
          node: atrule
        });
      }

      if (filter && !filter(parsed.url)) {
        return;
      }

      atrule.remove();
      imports[
        `"${parsed.url}"${
          parsed.media.length > 0 ? ` ${parsed.media.toLowerCase()}` : ""
        }`
      ] = {};
    });

    if (Object.keys(imports).length === 0) {
      return;
    }

    css.prepend((0, _icssUtils.createICSSRules)(imports, {}));
  }
);
