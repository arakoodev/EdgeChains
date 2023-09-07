var assert = require('power-assert'), truthy = 'true', falsy = 'false';
assert(assert._expr(assert._capt(falsy, 'arguments/0'), {
    content: 'assert(falsy)',
    filepath: 'test/fixtures/example.js',
    line: 4
}));
assert.equal(assert._expr(assert._capt(truthy, 'arguments/0'), {
    content: 'assert.equal(truthy, falsy)',
    filepath: 'test/fixtures/example.js',
    line: 5
}), assert._expr(assert._capt(falsy, 'arguments/1'), {
    content: 'assert.equal(truthy, falsy)',
    filepath: 'test/fixtures/example.js',
    line: 5
}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvZml4dHVyZXMvZXhhbXBsZS5qcyJdLCJuYW1lcyI6WyJhc3NlcnQiLCJyZXF1aXJlIiwidHJ1dGh5IiwiZmFsc3kiLCJfZXhwciIsIl9jYXB0IiwiY29udGVudCIsImZpbGVwYXRoIiwibGluZSIsImVxdWFsIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxNQUFBLEdBQVNDLE9BQUEsQ0FBUSxjQUFSLENBQWIsRUFDSUMsTUFBQSxHQUFTLE1BRGIsRUFFSUMsS0FBQSxHQUFRLE9BRlo7QUFHQUgsTUFBQSxDQUFPQSxNQUFBLENBQUFJLEtBQUEsQ0FBQUosTUFBQSxDQUFBSyxLQUFBLENBQUFGLEtBQUE7QUFBQSxJQUFBRyxPQUFBO0FBQUEsSUFBQUMsUUFBQTtBQUFBLElBQUFDLElBQUE7QUFBQSxFQUFQLEVBSEE7QUFJQVIsTUFBQSxDQUFPUyxLQUFQLENBQWFULE1BQUEsQ0FBQUksS0FBQSxDQUFBSixNQUFBLENBQUFLLEtBQUEsQ0FBQUgsTUFBQTtBQUFBLElBQUFJLE9BQUE7QUFBQSxJQUFBQyxRQUFBO0FBQUEsSUFBQUMsSUFBQTtBQUFBLEVBQWIsRUFBcUJSLE1BQUEsQ0FBQUksS0FBQSxDQUFBSixNQUFBLENBQUFLLEtBQUEsQ0FBQUYsS0FBQTtBQUFBLElBQUFHLE9BQUE7QUFBQSxJQUFBQyxRQUFBO0FBQUEsSUFBQUMsSUFBQTtBQUFBLEVBQXJCIiwic291cmNlc0NvbnRlbnQiOlsidmFyIGFzc2VydCA9IHJlcXVpcmUoJ3Bvd2VyLWFzc2VydCcpLFxuICAgIHRydXRoeSA9ICd0cnVlJyxcbiAgICBmYWxzeSA9ICdmYWxzZSc7XG5hc3NlcnQoZmFsc3kpO1xuYXNzZXJ0LmVxdWFsKHRydXRoeSwgZmFsc3kpO1xuIl19
