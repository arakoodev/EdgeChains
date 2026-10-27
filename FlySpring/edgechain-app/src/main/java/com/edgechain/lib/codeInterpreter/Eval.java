package com.edgechain.lib.codeInterpreter;

import net.objecthunter.exp4j.Expression;
import net.objecthunter.exp4j.ExpressionBuilder;

public class Eval {

  public static double evaluateExpression(String input) {
    Expression expression = new ExpressionBuilder(input).build();
    double result = expression.evaluate();
    System.out.println(result + " from Eval");
    return result;
  }
}
