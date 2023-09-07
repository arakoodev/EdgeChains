### 0.3.1 (2014-08-18)


#### Bug Fixes

* **escallmatch:** dealing with optional parameters in the middle ([05faf341](https://github.com/twada/escallmatch/commit/05faf34123b6b05ac9859a46779c749e33493ad8))


## 0.3.0 (2014-08-08)


#### Bug Fixes

* **escallmatch:** fix silly misspelling ([f5cedac8](https://github.com/twada/escallmatch/commit/f5cedac849717f714f7e1162c28068f518b46532))


#### Features

* **escallmatch:** make callee comparison faster ([aaf16312](https://github.com/twada/escallmatch/commit/aaf16312f45813b2ff8b089f5a1e926098dccfbe))


#### Breaking Changes

* `argumentSignitures` method is renamed to `argumentSignatures`

To migrate, change your code from the following:

`matcher.argumentSignitures()`

To:

`matcher.argumentSignatures()`

 ([f5cedac8](https://github.com/twada/escallmatch/commit/f5cedac849717f714f7e1162c28068f518b46532))


### 0.2.0 (2014-08-04)


#### Features

* **escallmatch:**
  * argumentSignitures method that returns argument specs in signiture ([2c2478a6](https://github.com/twada/escallmatch/commit/2c2478a6262743ce71f52cf01c82302e1f789d4e))
  * calleeAst method that returns clone of callee in signiture ([0df6baed](https://github.com/twada/escallmatch/commit/0df6baed4510aaf22df3084559722e4cce36e13a))


### 0.1.1 (2014-08-01)


### 0.1.0 (2014-07-31)


#### Features

* **escallmatch:**
  * ensure API definition is in the form of CallExpression ([2aea209a](https://github.com/twada/escallmatch/commit/2aea209ad5ff00d2da174218dbaa3bf23e3ae46b), [fb53e1e3](https://github.com/twada/escallmatch/commit/fb53e1e355a44275d510657b087d06f2dcdfea60))
  * ensure arguments are in the form of `name` or `[name]` ([8f85a422](https://github.com/twada/escallmatch/commit/8f85a422b2672e6ede9433d71692df907c2b10de), [bf14aa5d](https://github.com/twada/escallmatch/commit/bf14aa5d8126ae25a3298443e775194adb772380), [5bdb3f6e](https://github.com/twada/escallmatch/commit/5bdb3f6e1089a1a23ad985f7136933930256a568))
  * ensure argument names are unique ([df15c138](https://github.com/twada/escallmatch/commit/df15c1380793a15703a9b04a3f830b0fd2f5b0bf))
  * matchArgument returns result object containing name and kind ([71559f68](https://github.com/twada/escallmatch/commit/71559f682ee3832c7c413ad06826bf39934b0114))
  * optional parameter matching ([a2ae9e1c](https://github.com/twada/escallmatch/commit/a2ae9e1ca4a41ca12724367448fdaf26126da1dc), [86a1fb78](https://github.com/twada/escallmatch/commit/86a1fb786a2856f431947f6ed1ce69652e2c0fa0))
  * without optional parameters, argument count should be an exact match ([eb750b27](https://github.com/twada/escallmatch/commit/eb750b2781d2bf73e6c42bb80fe8cfb40cc870f6))
  * matchArgument returns corresponding identifier name in example ([10c9eb0e](https://github.com/twada/escallmatch/commit/10c9eb0e129ad4e35c6b3c73c7549a9df41b7dce))
  * count arguments length to detect missing / optional parameters ([0e24e84e](https://github.com/twada/escallmatch/commit/0e24e84ebf3eeb052d0530e6e60aba50eb13243e))
  * calculate AST depth first ([1024f7c3](https://github.com/twada/escallmatch/commit/1024f7c351bf52cf669447e7364498bfae92fe41))
  * Matcher#test to match whole CallExpression ([b9e3d2e0](https://github.com/twada/escallmatch/commit/b9e3d2e016f3aa5f5547a4e639a2a69869c80bc4))
  * use new espurify module to compare two AST trees ([e0cbe00d](https://github.com/twada/escallmatch/commit/e0cbe00d26b6bbe52c6d6234b707e83eca8c6877))
  * simple implementation using deep-equal ([80de163d](https://github.com/twada/escallmatch/commit/80de163db857f364a6f5fcfc6321cb84f114b0f0))
