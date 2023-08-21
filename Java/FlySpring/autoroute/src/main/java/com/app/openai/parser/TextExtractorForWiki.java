package com.app.openai.parser;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

// used this class for debugging.
public class TextExtractorForWiki {

  public static String extractTextFromBrackets(String input) {
    Pattern pattern = Pattern.compile("\\[(.*?)\\]");
    Matcher matcher = pattern.matcher(input);
    String extractedText = null;
    if (matcher.find()) {
      extractedText = matcher.group(1);
    }
    return extractedText;
  }
}
