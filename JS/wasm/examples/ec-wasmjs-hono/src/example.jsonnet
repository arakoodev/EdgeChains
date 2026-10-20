local name = 'bob';
{
  p1: {
    name: std.extVar('extName'),
    age: 20,
  },
  p2: {
    name: name,
    age: 30,
  },
}
