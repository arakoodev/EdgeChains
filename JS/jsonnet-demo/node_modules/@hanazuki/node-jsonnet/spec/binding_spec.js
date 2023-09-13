const {Jsonnet, JsonnetError} = require("../");

describe('binding', () => {
  beforeEach(function() {
    jasmine.addMatchers({
      toBeJSON: (util) => ({
        compare: (actual, expected) => {
          const result = {
            pass: util.equals(JSON.parse(actual), expected),
          }
          if(!result.pass) {
            result.message = `Expect '${actual}' to be JSON representing ${JSON.stringify(expected)}.`
          }
          return result;
        },
      })
    });
  });

  it('has version', async() => {
    expect(Jsonnet.version).toEqual(jasmine.stringMatching(/^v/));
  });

  it('can evaluate complex JSON', async () => {
    const jsonnet = new Jsonnet();

    let j = await jsonnet.evaluateSnippet(`[1,"a",true,null,{a:{b:3}}]`);
    expect(j).toBeJSON([1,"a",true,null,{a:{b:3}}]);
  });

  it('supports extVar', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.extString("var1", "str");
    jsonnet.extCode("var2", `{a: [0]}`);

    let j = await jsonnet.evaluateSnippet(`std.extVar("var1")`);
    expect(j).toBeJSON("str");

    j = await jsonnet.evaluateSnippet(`std.extVar("var2")`);
    expect(j).toBeJSON({a: [0]});
  });

  it('uses the extVar added most recently for the same name', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.extString("var1", "str1");
    jsonnet.extCode("var1", `"str2"`);

    let j = await jsonnet.evaluateSnippet(`std.extVar("var1")`);
    expect(j).toBeJSON("str2");
  });

  it('can import files using Jpath', async () => {
    const jsonnet = new Jsonnet().addJpath(`${__dirname}/fixtures`);

    const j = await jsonnet.evaluateFile(`${__dirname}/fixtures/fruits.jsonnet`);
    expect(j).toBeJSON([{name: "Kiwi"}, {name: "Orange"}]);
  });

  it('Jpath added later takes precedence', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.addJpath(`${__dirname}/fixtures/a`);
    jsonnet.addJpath(`${__dirname}/fixtures/b`);

    let j = await jsonnet.evaluateSnippet(`import "lib.jsonnet"`);
    expect(j).toBeJSON("b");
  });

  it('handles files in UTF-8', async () => {
    const jsonnet = new Jsonnet().addJpath(`${__dirname}/fixtures`);

    let j = await jsonnet.evaluateFile(`${__dirname}/fixtures/utf8.jsonnet`);
    expect(j).toBeJSON({"あ": "あいうえお", "🍔": "🐧"});

    j = await jsonnet.evaluateSnippet(`import "utf8.jsonnet"`);
    expect(j).toBeJSON({"あ": "あいうえお", "🍔": "🐧"});

    j = await jsonnet.evaluateSnippet(`{"あ": "あいうえお", "🍔": "🐧"}`);
    expect(j).toBeJSON({"あ": "あいうえお", "🍔": "🐧"});
  });

  it('handles paths in UTF-8', async () => {
    const jsonnet = new Jsonnet().addJpath(`${__dirname}/fixtures`);

    let j = await jsonnet.evaluateFile(`${__dirname}/fixtures/🦔.jsonnet`);
    expect(j).toBeJSON("🦔");

    j = await jsonnet.evaluateSnippet(`import "🦔.jsonnet"`);
    expect(j).toBeJSON("🦔");
  });

  it('supports importstr', async () => {
    const jsonnet = new Jsonnet().addJpath(`${__dirname}/fixtures`);

    const j = await jsonnet.evaluateSnippet(`importstr "🦔.jsonnet"`);
    expect(j).toBeJSON('"🦔"\n');
  });

  it('supports top-level arguments', async () => {
    const jsonnet = new Jsonnet().tlaString("var1", "test").tlaCode("var2", "{x:1,y:2}");

    let j = await jsonnet.evaluateSnippet(`function(var1, var2) var1 + var2.y`);
    expect(j).toBeJSON("test2");

    j = await jsonnet.evaluateSnippet(`function(var2, var1) var1 + var2.y`);
    expect(j).toBeJSON("test2");
  });

  it('support native callbacks', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.nativeCallback("double", (x) => x * 2, "x");
    jsonnet.nativeCallback("negate", (b) => !b, "b");
    jsonnet.nativeCallback("concat", (s, t) => s + t, "s", "t");
    jsonnet.nativeCallback("isNull", (v) => v === null, "v");
    jsonnet.nativeCallback("null", () => null);
    jsonnet.nativeCallback("arrayOfObjects", () => [{name: "Kiwi"}, {name: "Orange"}]);

    let j = await jsonnet.evaluateSnippet(`std.native("double")(4)`);
    expect(j).toBeJSON(8);

    j = await jsonnet.evaluateSnippet(`std.native("negate")(true)`);
    expect(j).toBeJSON(false);

    j = await jsonnet.evaluateSnippet(`std.native("negate")(false)`);
    expect(j).toBeJSON(true);

    j = await jsonnet.evaluateSnippet(`std.native("concat")("a", "b")`);
    expect(j).toBeJSON("ab");

    j = await jsonnet.evaluateSnippet(`std.native("isNull")(null)`);
    expect(j).toBeJSON(true);

    j = await jsonnet.evaluateSnippet(`std.native("null")()`);
    expect(j).toBeJSON(null);

    j = await jsonnet.evaluateSnippet(`std.native("arrayOfObjects")()`);
    expect(j).toBeJSON([{name: "Kiwi"}, {name: "Orange"}]);
  });

  it('serializes JavaScript objects', async () => {
    const jsonnet = new Jsonnet();

    jsonnet.nativeCallback("int8array", () => new Int8Array([1,2,3]));
    let j = await jsonnet.evaluateSnippet(`std.native("int8array")()`);
    expect(j).toBeJSON({0: 1, 1: 2, 2: 3});

    jsonnet.nativeCallback("function", () => function(){ return 1; });
    j = await jsonnet.evaluateSnippet(`std.native("function")()`);
    expect(j).toBeJSON(null);

    jsonnet.nativeCallback("asyncFunction", () => async function(){ return 1; });
    j = await jsonnet.evaluateSnippet(`std.native("asyncFunction")()`);
    expect(j).toBeJSON(null);

    jsonnet.nativeCallback("date", () => new Date(0));
    j = await jsonnet.evaluateSnippet(`std.native("date")()`);
    expect(j).toBeJSON("1970-01-01T00:00:00.000Z");

    jsonnet.nativeCallback("symbol", () => Symbol("foo"));
    j = await jsonnet.evaluateSnippet(`std.native("symbol")()`);
    expect(j).toBeJSON(null);
  });

  it('supports top-level arguments for native callbacks', async () => {
    const jsonnet = new Jsonnet().tlaString("var1", "test").tlaCode("var2", "2");
    jsonnet.nativeCallback("func1", (var1, var2) => var1 + var2, "var1", "var2")

    let j = await jsonnet.evaluateSnippet(`std.native("func1")`);
    expect(j).toBeJSON("test2");
  });

  it('supports native callback that returns a promise', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.nativeCallback("readFile", (name) => require("fs").promises.readFile(`${__dirname}/fixtures/${name}.jsonnet`, "utf8"), "name")

    let j = await jsonnet.evaluateSnippet(`std.native("readFile")("🦔")`);
    expect(j).toBeJSON(`"🦔"\n`);

    await expectAsync(jsonnet.evaluateSnippet(`std.native("readFile")("non-existent")`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR: .* ENOENT/);
  });

  it('uses the native callback added most recently for the same name', async () => {
    const jsonnet = new Jsonnet();
    jsonnet.nativeCallback("func1", () => 1);

    let j = await jsonnet.evaluateSnippet(`std.native("func1")()`);
    expect(j).toBeJSON(1);

    jsonnet.nativeCallback("func1", () => 2);
    j = await jsonnet.evaluateSnippet(`std.native("func1")()`);
    expect(j).toBeJSON(2);
  });

  it('reports Jsonnet errors', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateSnippet(`var1`))
      .toBeRejectedWithError(JsonnetError, /^STATIC ERROR: .* Unknown variable/);
    await expectAsync(jsonnet.evaluateSnippet(`1 / 0`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR: division by zero/);
  });

  it('reports throwing native callback', async () => {
    const jsonnet = new Jsonnet();

    jsonnet.nativeCallback("fail", (msg) => { throw msg; }, "msg");
    await expectAsync(jsonnet.evaluateSnippet(`std.native("fail")("kimagure")`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR: kimagure/);

  });

  it('reports throwing async native callback', async () => {
    const jsonnet = new Jsonnet();

    jsonnet.nativeCallback("failAsync", async (msg) => { throw msg; }, "msg");
    await expectAsync(jsonnet.evaluateSnippet(`std.native("failAsync")("kimagure")`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR: kimagure/);
  });

  it('reports syntax error in snippet with filename', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateSnippet(`1 +`, "snippet-filename"))
      .toBeRejectedWithError(JsonnetError, /^STATIC ERROR: snippet-filename:1:4/);
  });

  it('evaluateSnippetMulti', async () => {
    const jsonnet = new Jsonnet();

    let dict = await jsonnet.evaluateSnippetMulti(`{"a.json": {a: 1}, "b.yaml": std.manifestYamlDoc({b: 2})}`);
    expect(dict).toEqual({
      'a.json': '{\n   "a": 1\n}\n',
      'b.yaml': '"\\"b\\": 2"\n',
    });


    dict = await jsonnet.evaluateFileMulti(`${__dirname}/fixtures/multi.jsonnet`);
    expect(dict).toEqual({
      'a.json': '{\n   "a": 1\n}\n',
      'b.yaml': '"\\"b\\": 2"\n',
    });
  });

  it('reports error for evaluateSnippetMulti', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateSnippetMulti(`1`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR:/)
  });

  it('reports error for evaluateFileMulti', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateFileMulti(`${__dirname}/fixtures/runtime_error.jsonnet`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR:/)
  });

  it('evaluateSnippetStream', async () => {
    const jsonnet = new Jsonnet();

    let list = await jsonnet.evaluateSnippetStream(`[{a: 1}, {b: 2}]`);
    expect(list).toEqual([
      '{\n   "a": 1\n}\n',
      '{\n   "b": 2\n}\n',
    ])

    list = await jsonnet.evaluateFileStream(`${__dirname}/fixtures/stream.jsonnet`);
    expect(list).toEqual([
      '{\n   "a": 1\n}\n',
      '{\n   "b": 2\n}\n',
    ])
  });

  it('reports error for evaluateSnippetStream', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateSnippetStream(`1`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR:/)
  });

  it('reports error for evaluateFileStream', async () => {
    const jsonnet = new Jsonnet();

    await expectAsync(jsonnet.evaluateFileStream(`${__dirname}/fixtures/runtime_error.jsonnet`))
      .toBeRejectedWithError(JsonnetError, /^RUNTIME ERROR:/)
  });

  it('supports stringOutput for snippet', async () => {
    const jsonnet = new Jsonnet();

    jsonnet.stringOutput(true);
    let str = await jsonnet.evaluateSnippet(`"a"`);
    expect(str).toEqual("a\n");

    jsonnet.stringOutput(false);
    str = await jsonnet.evaluateSnippet(`"a"`);
    expect(str).toEqual('"a"\n');
  });

  it('supports stringOutput for multi', async () => {
    const jsonnet = new Jsonnet().stringOutput(true);

    let dict = await jsonnet.evaluateSnippetMulti(`{"0":"a","1":"b"}`);
    expect(dict).toEqual({
      '0': "a\n",
      '1': "b\n",
    })
  });

  it('supports stringOutput for stream', async () => {
    const jsonnet = new Jsonnet().stringOutput(true);

    let list = await jsonnet.evaluateSnippetStream(`["a","b"]`);
    expect(list).toEqual([
      "a\n",
      "b\n",
    ]);
  });

});
