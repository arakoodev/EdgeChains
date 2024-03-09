// Edit me!

local sentence = |||
  Question: Which magazine was started first Arthur's Magazine or First for Women?
  Thought 1: I need to search Arthur's Magazine and First for Women, and find which was
  started first.
  Action 1: Search[Arthur's Magazine]
  Observation 1: Arthur's Magazine (1844-1846) was an American literary periodical published
  in Philadelphia in the 19th century.
  Thought 2: Arthur's Magazine was started in 1844. I need to search First for Women
  next.
  Action 2: Search[First for Women]
|||;

local searchPattern = 'Action 1: (.*)';
local get_search_string = arakoo.regexMatch(arakoo.regexMatch(sentence, searchPattern)[0], 'Search\\[(.*)\\]')[0];

local name = arakoo.join('Alice ', get_search_string);
{
  person1: {
    name: name,
    welcome: 'Hello ' + self.name + '!',
  },
  person2: self.person1 { name: get_search_string },
}
