import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { createICSSRules } from "icss-utils";

const plugin = "postcss-plugin-import";

const getArg = nodes =>
  nodes.length !== 0 && nodes[0].type === "string"
    ? nodes[0].value
    : valueParser.stringify(nodes);

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
  const { nodes } = valueParser(params);
  if (nodes.length === 0) {
    return null;
  }
  const url = getUrl(nodes[0]);
  if (url.trim().length === 0) {
    return null;
  }
  return {
    url,
    media: valueParser.stringify(nodes.slice(1)).trim()
  };
};

const defaultFilter = url => !/^\w+:\/\//.test(url) && !url.startsWith("//");

module.exports = postcss.plugin(plugin, (options = {}) => (css, result) => {
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
        { node: atrule }
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

  css.prepend(createICSSRules(imports, {}));
});
