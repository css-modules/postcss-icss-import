/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input => stripIndent(input).replace(/^\n/, "");
const compile = (input, opts) =>
  postcss([plugin(opts)]).process(input, { from: undefined });
const runWarnings = (input, opts) =>
  compile(input, opts).then(result =>
    result.warnings().map(warning => warning.text)
  );
const runCSS = (input, opts) =>
  compile(strip(input), opts).then(result => strip(result.css));

test("convert @import", () => {
  return expect(
    runCSS(`
      @import "foo.css";
      @import 'bar.css';
      @import url(baz.css);
      @import url("foobar.css");
      @import url('foobarbaz.css');
      @import url('~package/test.css');
      @import url('./a.css');
      @import url('../b.css');
      @import url('../c.gif');
      @import url('query.css?foo=1&bar=1');
      @import url('other-query.css?foo=1&bar=1#hash');
      @import url(   spaces.css   );
      @import   'other-spaces.css'   ;
      .foo {}
    `)
  ).resolves.toEqual(
    strip(`
      :import("foo.css") {}
      :import("bar.css") {}
      :import("baz.css") {}
      :import("foobar.css") {}
      :import("foobarbaz.css") {}
      :import("~package/test.css") {}
      :import("./a.css") {}
      :import("../b.css") {}
      :import("../c.gif") {}
      :import("query.css?foo=1&bar=1") {}
      :import("other-query.css?foo=1&bar=1#hash") {}
      :import("spaces.css") {}
      :import("other-spaces.css") {}
      .foo {}
    `)
  );
});

test("convert @import with media queries", () => {
  return expect(
    runCSS(`
      @import "foo.css" screen;
      @import "foobar.css"screen;
      @import 'bar.css' screen;
      @import url(baz.css) screen;
      @import url("foobar.css") screen and (min-width: 25em);
      @import url('foobarbaz.css') print, screen and (min-width: 25em);
      @import url('other.css') (min-width: 100px);
      .foo {}
    `)
  ).resolves.toEqual(
    strip(`
      :import("foo.css" screen) {}
      :import("foobar.css" screen) {}
      :import("bar.css" screen) {}
      :import("baz.css" screen) {}
      :import("foobar.css" screen and (min-width: 25em)) {}
      :import("foobarbaz.css" print, screen and (min-width: 25em)) {}
      :import("other.css" (min-width: 100px)) {}
      .foo {}
    `)
  );
});

test("ignore not @import at-rules", () => {
  return expect(
    runCSS(`
      @import-normalize;
      @import-normalize path;
      @import-normalize url();
    `)
  ).resolves.toEqual(
    strip(`
      @import-normalize;
      @import-normalize path;
      @import-normalize url();
    `)
  );
});

test("convert camelcased @import", () => {
  return expect(
    runCSS(`
      @IMPORT 'path.css';
    `)
  ).resolves.toEqual(
    strip(`
      :import("path.css") {}
    `)
  );
});

test("convert camelcased url", () => {
  return expect(
    runCSS(`
      @import URL('FOO.css');
    `)
  ).resolves.toEqual(
    strip(`
      :import("FOO.css") {}
    `)
  );
});

test("convert camelcased media", () => {
  return expect(
    runCSS(`
      @import "foo.css" SCREEN;
    `)
  ).resolves.toEqual(
    strip(`
      :import("foo.css" screen) {}
    `)
  );
});

test("not convert external uri by default", () => {
  const input = `
    @import 'http://path';
    @IMPORT 'http://path';
    @import 'https://path';
    @import '//path';
    @import url('http://path');
    @import URL('http://path');
    @import url('https://path');
    @import url('//path');
    @import url("chrome://communicator/skin/");
  `;
  return expect(runCSS(input)).resolves.toEqual(strip(input));
});

test("not warn when a user closed an import with ;", () => {
  return expect(runWarnings(`@import url('http://');`, {})).resolves.toEqual(
    []
  );
});

test("warn when a user didn't close an import with ;", () => {
  return expect(runWarnings(`@import url('http://') :root{}`)).resolves.toEqual(
    [
      "It looks like you didn't end your @import statement correctly. " +
        "Child nodes are attached to it."
    ]
  );
});

test("warn on invalid url", () => {
  return expect(
    runWarnings(`
      @import foo-bar;
      @import ;
      @import '';
      @import "";
      @import " ";
      @import url();
      @import url('');
      @import url("");
    `)
  ).resolves.toEqual([
    `Unable to find uri in '@import foo-bar'`,
    `Unable to find uri in '@import '`,
    `Unable to find uri in '@import '''`,
    `Unable to find uri in '@import ""'`,
    `Unable to find uri in '@import " "'`,
    `Unable to find uri in '@import url()'`,
    `Unable to find uri in '@import url('')'`,
    `Unable to find uri in '@import url("")'`
  ]);
});

test("convert only top-level @import", () => {
  const input = `
    .foo {
      @import 'path.css';
    }
  `;
  return expect(runCSS(input)).resolves.toEqual(strip(input));
});

test("option filter", () => {
  return expect(
    runCSS(
      `
      @import "a.css";
      @import "b.css" screen;
      @import url("c.css");
      @import url("d.css") screen;
      @import 'http://domain.com/e.css';
      @import 'http://domain.com/f.css' screen;
      @import url('http://domain.com/g.css');
      @import url('http://domain.com/h.css') screen;
      .foo {}
    `,
      { filter: () => true }
    )
  ).resolves.toEqual(
    strip(`
      :import("a.css") {}
      :import("b.css" screen) {}
      :import("c.css") {}
      :import("d.css" screen) {}
      :import("http://domain.com/e.css") {}
      :import("http://domain.com/f.css" screen) {}
      :import("http://domain.com/g.css") {}
      :import("http://domain.com/h.css" screen) {}
      .foo {}
    `)
  );
});
