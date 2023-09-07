var empower = require('empower'),
    formatter = require('power-assert-formatter'),
    busterAssertions = require("buster-assertions"),
    refute = empower(busterAssertions.refute, formatter(), { targetMethods: { oneArg: ['isNull'], twoArgs: ['same'] } }),
    truthy = 'true',
    falsy = 'false';
refute(truthy);
refute.isNull(falsy);
refute.same(truthy, falsy);
