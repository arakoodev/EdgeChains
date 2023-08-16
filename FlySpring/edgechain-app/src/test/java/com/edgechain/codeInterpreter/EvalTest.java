package com.edgechain.codeInterpreter;

import org.junit.jupiter.api.Test;

import com.edgechain.lib.codeInterpreter.Eval;

import static org.junit.jupiter.api.Assertions.*;

public class EvalTest {

  @Test
  public void testEvaluateExpression_Addition() {
    double result = Eval.evaluateExpression("2 + 2");
    assertEquals(4.0, result, 0.0001);
  }

  @Test
  public void testEvaluateExpression_ComplexExpression() {
    double result = Eval.evaluateExpression("(10 + 5) * 2 - (3 / 1)");
    assertEquals(27.0, result, 0.0001);
  }

  @Test
  public void testEvaluateExpression_DivideByZero() {

    assertThrows(
        ArithmeticException.class,
        () -> {
          Eval.evaluateExpression("1 / 0");
        });
  }
}
