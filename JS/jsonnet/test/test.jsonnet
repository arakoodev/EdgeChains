{
  concat_array: [1, 2, 3] + [4],
  concat_string: '123' + 4,
  equality1: 1 == '1',
  equality2: [{}, { x: 3 - 1 }]
             == [{}, { x: 2 }],
  ex1: 1 + 2 * 3 / (4 + 5),
  ex2: self.ex1 | 3,
  ex3: self.ex1 % 2,
  ex4: (4 > 3) && (1 <= 3) || false,
  obj: { a: 1, b: 2 } + { b: 3, c: 4 },
  obj_member: 'foo' in { foo: 1 },
  str1: 'The value of self.ex2 is '
        + self.ex2 + '.',
  str2: 'The value of self.ex2 is %g.'
        % self.ex2,
  str3: 'ex1=%0.2f, ex2=%0.2f'
        % [self.ex1, self.ex2],
  str4: 'ex1=%(ex1)0.2f, ex2=%(ex2)0.2f'
        % self,
  str5: |||
    ex1=%(ex1)0.2f
    ex2=%(ex2)0.2f
  ||| % self,
}