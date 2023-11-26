local prompt = ||| 
                    # How to write great unit tests with {test_package}
                    In this advanced tutorial for experts, we'll use Java and {test_package} to write a suite of unit tests to verify the behavior of the following function.
                    ```java
                    {test_class}
                    ```
                    Before writing any unit tests, let's review what each element of the function is doing exactly and what the author's intentions may have been.
                    - First,
                |||;

local prompt_to_explain_a_plan =|||
                                    A good unit test suite should aim to:
                                    - Test the function's behavior for a wide range of possible inputs
                                    - Test edge cases that the author may not have foreseen
                                    - Take advantage of the features of {test_package} to make the tests easy to write and maintain
                                    - Be easy to read and understand, with clean code and descriptive names
                                    - Be deterministic, so that the tests always pass or fail in the same way

                                    {test_package} has many convenient features that make it easy to write and maintain unit tests. We'll use them to write unit tests for the function above.

                                    For this particular function, we'll want our unit tests to handle the following diverse scenarios (and under each scenario, we include a few examples as sub-bullets):
                                    -
                                |||;

{
    "promptPlan" : prompt_to_explain_a_plan,
    "prompt" : prompt
}