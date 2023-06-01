package com.edgechain.lib.openai.parser;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Scratchpad {

    private List<String> scratchpadList;

    public Scratchpad() {}

    public Scratchpad(String textoutput) {
        scratchpadList = new ArrayList<>();
        String regex = "(Thought \\d+:.*?(?=Thought \\d+|Action \\d+|Observation \\d+|$))|(Action \\d+:.*?(?=Thought \\d+|Action \\d+|Observation \\d+|$))|(Observation \\d+:.*?(?=Thought \\d+|Action \\d+|Observation \\d+|$))";
        Pattern pattern = Pattern.compile(regex, Pattern.DOTALL);
        Matcher matcher = pattern.matcher(textoutput);

        while (matcher.find()) {
            scratchpadList.add(matcher.group().trim());
        }

    }

    public List<String> getScratchpadList() {
        return scratchpadList;
    }

    public void setScratchpadList(List<String> scratchpadList) {
        this.scratchpadList = scratchpadList;
    }

    // Method to extract content between brackets for a given action index
    public String getActionContent() {
        String actionContent = null;
        for (String item : scratchpadList) {
            if (item.startsWith("Action") && item.contains("Search")) {
                Pattern pattern = Pattern.compile("\\[(.*?)\\]");
                Matcher matcher = pattern.matcher(item);
                if (matcher.find()) {
                    actionContent = matcher.group(1);
                }
                break;
            }
        }
        return actionContent;
    }

    // Method to replace the content of an action by the given index with a new string called wikiContentForAction
    public void observationReplacer(String newString) {
        boolean observationFound = false;
        int observationIndex = -1;
        for (int i = 0; i < scratchpadList.size(); i++) {
            String item = scratchpadList.get(i);
            if (item.startsWith("Observation")) {
                String updatedItem = "Observation: " + newString;
                scratchpadList.set(i, updatedItem);
                observationFound = true;
                observationIndex = i;
                break;
            }
        }
        if (!observationFound) {
            scratchpadList.add("Observation: " + newString);
            observationIndex = scratchpadList.size() - 1;
        }

        // Remove everything after the newly added or updated observation
        if (observationIndex >= 0 && observationIndex < scratchpadList.size() - 1) {
            scratchpadList.subList(observationIndex + 1, scratchpadList.size()).clear();
        }
    }
}