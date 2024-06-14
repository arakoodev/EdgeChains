import Jsonnet from "@arakoodev/jsonnet";
// import Jsonnet from "../src/index.js"
// import Jsonnet from "../src/index.mjs"
import { expect } from "chai";
import { describe, it } from "mocha";

let jsonnet = new Jsonnet();

describe("Testing evaluateSnippet function of jsonnet library", () => {
    it("self reference", () => {
        let result = JSON.parse(
            jsonnet.evaluateSnippet(`{
          Martini: {
            local drink = self,
            ingredients: [
              { kind: "Farmer's Gin", qty: 1 },
              {
                kind: 'Dry White Vermouth',
                qty: drink.ingredients[0].qty,
              },
            ],
            garnish: 'Olive',
            served: 'Straight Up',
          },
        }`));
        let expected = {
            Martini: {
                garnish: "Olive",
                ingredients: [
                    {
                        kind: "Farmer's Gin",
                        qty: 1,
                    },
                    {
                        kind: "Dry White Vermouth",
                        qty: 1,
                    },
                ],
                served: "Straight Up",
            },
        };
        expect(result).to.eql(expected);
    });

    it("math operations", () => {
        let result = JSON.parse(
            jsonnet.evaluateSnippet(`{
		  a: 1 + 2,
		  b: 3 * 4,
		  c: 5 / 6,
		  d: 7 % 8,
		  e: 9 - 10,
		}`)
        );
        let expected = {
            a: 3,
            b: 12,
            c: 0.8333333333333334,
            d: 7,
            e: -1,
        };
        expect(result).to.eql(expected);
    });
});

describe("Testing evaluateFile function of jsonnet library", () => {
    it("Read File and evaluate", () => {
        // let result = jsonnet.extString("name", "Alice");
        let result = JSON.parse(jsonnet.evaluateFile("./test.jsonnet"));
        let expected = {
            concat_array: [1, 2, 3, 4],
            concat_string: "1234",
            equality1: false,
            equality2: true,
            ex1: 1.6666666666666665,
            ex2: 3,
            ex3: 1.6666666666666665,
            ex4: true,
            obj: {
                a: 1,
                b: 3,
                c: 4,
            },
            obj_member: true,
            str1: "The value of self.ex2 is 3.",
            str2: "The value of self.ex2 is 3.",
            str3: "ex1=1.67, ex2=3.00",
            str4: "ex1=1.67, ex2=3.00",
            str5: "ex1=1.67\nex2=3.00\n",
        };
        expect(result).to.eql(expected);
    });
});

describe("Testing extString function of jsonnet library", () => {
    it("Test extString function", () => {
        let result = JSON.parse(
            jsonnet.extString("name", "Alice").evaluateSnippet(`local username = std.extVar('name');
		local Person(name='Alice') = {
		  name: name,
		  welcome: 'Hello ' + name + '!',
		};
		{
		  person1: Person(username),
		  person2: Person('Bob'),
		}`)
        );
        let expected = {
            person1: {
                name: "Alice",
                welcome: "Hello Alice!",
            },
            person2: {
                name: "Bob",
                welcome: "Hello Bob!",
            },
        };
        expect(result).to.eql(expected);
    });
});

describe("Testing regex function of jsonnet library", () => {
    it("Test regex function", () => {
        let result = JSON.parse(jsonnet.evaluateFile("./test_regex.jsonnet"));
        let expected = {
            person1: {
                name: "Alice Arthur's Magazine",
                welcome: "Hello Alice Arthur's Magazine!",
            },
            person2: {
                name: "Arthur's Magazine",
                welcome: "Hello Arthur's Magazine!",
            },
        };
        // console.log("result : ", result);
        expect(result).to.eql(expected);
    });
});

describe("Testing join function of jsonnet library", () => {
    it("Test join function", () => {
        let result = JSON.parse(
            jsonnet.evaluateSnippet(`local a  = "open";
        local b = "source";
        {
            "joined string":arakoo.join(a,b)
        }`)
        );
        let expected = {
            "joined string": "opensource",
        };
        expect(result).to.eql(expected);
    });
});

describe("Testing javascript native function of jsonnet library", () => {
    it("Test javascript native function using arithematic operations : add", () => {
        function add(a: number, b: number, c: number) {
            return a + b + c;
        }
        let result = JSON.parse(
            jsonnet.javascriptCallback("add", add).evaluateSnippet(`{
			"result": "Output "+arakoo.native("add")(1,2,3),
			"name":"Alice"
		}`)
        );
        expect(result).to.eql({
            result: "Output 6",
            name: "Alice",
        });
    });
    it("Test javascript native function using arithematic operations : array sum", () => {
        let numArr = [1, 2, 3, 4, 5];
        function calcSum(arr: number[]) {
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum;
        }
        let result = JSON.parse(
            jsonnet.javascriptCallback("arrsum", calcSum).evaluateSnippet(`{
			"result": "Output "+arakoo.native("arrsum")(${JSON.stringify(numArr)}),
			"name":"Alice"
		}`)
        );
        expect(result).to.eql({
            result: "Output 15",
            name: "Alice",
        });
    });
    it("Test javascript native function using string operations : concat", () => {
        function concat(a: string, b: string) {
            return a + b;
        }
        let result = JSON.parse(
            jsonnet.javascriptCallback("concat", concat).evaluateSnippet(`{
			"result": "Output "+arakoo.native("concat")("Hello ","World"),
			"name":"Alice"
		}`)
        );
        expect(result).to.eql({
            result: "Output Hello World",
            name: "Alice",
        });
    });
});

describe("Testing includes function of jsonnet library", () => {
    it("Test includes function", () => {
        let result = JSON.parse(
            jsonnet.evaluateSnippet(`{
            "result":arakoo.includes("open source is awesome","source")
        }`)
        );
        let expected = {
            result: true,
        };
        expect(result).to.eql(expected);
    });
});

describe("Testing urlencoding function of jsonnet library", () => {
    it("Test urlencoding function", () => {
        let result = JSON.parse(
            jsonnet.evaluateSnippet(`{
            "result":arakoo.urlEncode("open source is awesome")
        }`)
        );
        let expected = {
            result: "open%20source%20is%20awesome",
        };
        expect(result).to.eql(expected);
    })
});