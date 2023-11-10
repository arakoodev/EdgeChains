local prompt = ||| 
                    # How to write great unit tests with {test_package}
                    In this advanced tutorial for experts, we'll use Java and {test_package} to write a suite of unit tests to verify the behavior of the following function.
                    ```java
                    {test_class}
                    ```
                    Before writing any unit tests, let's review what each element of the function is doing exactly and what the author's intentions may have been.
                    - First,
                |||;

local test_package = std.extVar("testPackage");
local test_class = std.extVar("testClass");



{
    "testpackage" : test_package,
    "testclass" : test_class,
    "prompt" : prompt
}