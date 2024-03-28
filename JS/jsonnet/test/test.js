import Jsonnet from "../src/jsonnet.js";
import { expect } from "chai";

let jsonnet = new Jsonnet();

describe("Testing evaluateSnippet function of jsonnet library", () => {
	it("self reference", () => {
		let result = JSON.parse(jsonnet.evaluateSnippet(`{
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
		let expected = JSON.parse(`{
      "Martini": {
        "garnish": "Olive",
        "ingredients": [
          {
            "kind": "Farmer's Gin",
            "qty": 1
          },
          {
            "kind": "Dry White Vermouth",
            "qty": 1
          }
        ],
        "served": "Straight Up"
      }
    }`);
		// expect(JSON.stringify(result)).to.equal(JSON.stringify(expected));
		expect(result).to.eql(expected);
	});

	it("math operations", () => {
		let result = JSON.parse(jsonnet.evaluateSnippet(`{
		  a: 1 + 2,
		  b: 3 * 4,
		  c: 5 / 6,
		  d: 7 % 8,
		  e: 9 - 10,
		}`));
		let expected = JSON.parse(`{
	  "a": 3,
	  "b": 12,
	  "c": 0.8333333333333334,
	  "d": 7,
	  "e": -1
	}`);
		// expect(JSON.stringify(result)).to.equal(JSON.stringify(expected));
		expect(result).to.eql(expected);
	})
});


describe("Testing extString function of jsonnet library", () => {
	it("extString", () => {
		let result = JSON.parse(jsonnet.extString("name", "Alice").evaluateSnippet(`  local username = std.extVar('name');
		local Person(name='Alice') = {
		  name: name,
		  welcome: 'Hello ' + name + '!',
		};
		{
		  person1: Person(username),
		  person2: Person('Bob'),
		}`));
		let expected = JSON.parse(`{
			"person1": {
				"name": "Alice",
				"welcome": "Hello Alice!"
			},
			"person2": {
				"name": "Bob",
				"welcome": "Hello Bob!"
			}
		}`);
		console.log(result);
		// expect(JSON.stringify(result)).to.equal(JSON.stringify(expected));
		expect(result).to.eql(expected);
	});
});