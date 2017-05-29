/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input => stripIndent(input).replace(/^\n/, "");
const compile = input => postcss([plugin]).process(input);
const runWarnings = input =>
  compile(input).then(result => result.warnings().map(warning => warning.text));
const runCSS = input => compile(strip(input)).then(result => strip(result.css));

test("convert @import", () => {
  return expect(
    runCSS(`
      @import "foo.css";
      @import 'bar.css';
      @import url(baz.css);
      @import url("foobar.css");
      @import url('foobarbaz.css');
      .foo {}
    `)
  ).resolves.toEqual(
    strip(`
      :import('foo.css') {
        import: default
      }
      :import('bar.css') {
        import: default
      }
      :import('baz.css') {
        import: default
      }
      :import('foobar.css') {
        import: default
      }
      :import('foobarbaz.css') {
        import: default
      }
      .foo {}
    `)
  );
});

test("convert @import with media queries", () => {
  return expect(
    runCSS(`
      @import "foo.css" screen;
      @import 'bar.css' screen;
      @import url(baz.css) screen;
      @import url("foobar.css") screen and (min-width: 25em);
      @import url('foobarbaz.css') print, screen and (min-width: 25em);
      .foo {}
    `)
  ).resolves.toEqual(
    strip(`
      :import('foo.css') {
        import: default screen
      }
      :import('bar.css') {
        import: default screen
      }
      :import('baz.css') {
        import: default screen
      }
      :import('foobar.css') {
        import: default screen and (min-width: 25em)
      }
      :import('foobarbaz.css') {
        import: default print, screen and (min-width: 25em)
      }
      .foo {}
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
      :import('path.css') {
        import: default
      }
    `)
  );
});

test("not convert external uri", () => {
  const input = `
    @import 'http://path';
    @import 'https://path';
    @import '//path';
  `;
  return expect(runCSS(input)).resolves.toEqual(strip(input));
});

test("not warn when a user closed an import with ;", () => {
  return expect(runWarnings(`@import url('http://');`, [])).resolves.toEqual(
    []
  );
});

test("warn when a user didn't close an import with ;", () => {
  return expect(
    runWarnings(`@import url('http://') :root{}`)
  ).resolves.toEqual([
    "It looks like you didn't end your @import statement correctly. " +
      "Child nodes are attached to it."
  ]);
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
