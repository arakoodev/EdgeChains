package com.openai.test;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;

public class callapi {

    public String createJsonWithContent(String inputContent) {
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode rootNode = objectMapper.createObjectNode();

        rootNode.put("model", "gpt-3.5-turbo");

        // Create an object node for the message
        ObjectNode messageNode = objectMapper.createObjectNode();
        messageNode.put("role", "user");

        // Combine existing content and input content
        String existingContent = "Question: What is the elevation range for the area that the eastern sector of the\n" +
                "Colorado orogeny extends into?\n" +
                "Thought 1: I need to search Colorado orogeny, find the area that the eastern sector\n" +
                "of the Colorado orogeny extends into, then find the elevation range of the\n" +
                "area.\n" +
                "Action 1: Search[Colorado orogeny]\n" +
                "Observation 1: The Colorado orogeny was an episode of mountain building (an orogeny) in\n" +
                "Colorado and surrounding areas.\n" +
                "Thought 2: It does not mention the eastern sector. So I need to look up eastern\n" +
                "sector.\n" +
                "Action 2: Lookup[eastern sector]\n" +
                "Observation 2: (Result 1 / 1) The eastern sector extends into the High Plains and is called\n" +
                "the Central Plains orogeny.\n" +
                "Thought 3: The eastern sector of Colorado orogeny extends into the High Plains. So I\n" +
                "need to search High Plains and find its elevation range.\n" +
                "Action 3: Search[High Plains]\n" +
                "Observation 3: High Plains refers to one of two distinct land regions\n" +
                "Thought 4: I need to instead search High Plains (United States).\n" +
                "Action 4: Search[High Plains (United States)]\n" +
                "Observation 4: The High Plains are a subregion of the Great Plains. From east to west, the\n" +
                "High Plains rise in elevation from around 1,800 to 7,000 ft (550 to 2,130\n" +
                "m).[3]\n" +
                "Thought 5: High Plains rise in elevation from around 1,800 to 7,000 ft, so the answer\n" +
                "is 1,800 to 7,000 ft.\n" +
                "Action 5: Finish[1,800 to 7,000 ft]\n" +
                "\n" +
                "Question: Musician and satirist Allie Goertz wrote a song about the \"The Simpsons\"\n" +
                "character Milhouse, who Matt Groening named after who?\n" +
                "Thought 1: The question simplifies to \"The Simpsons\" character Milhouse is named after\n" +
                "who. I only need to search Milhouse and find who it is named after.\n" +
                "Action 1: Search[Milhouse]\n" +
                "Observation 1: Milhouse Mussolini Van Houten is a recurring character in the Fox animated\n" +
                "television series The Simpsons voiced by Pamela Hayden and created by Matt\n" +
                "Groening.\n" +
                "Thought 2: The paragraph does not tell who Milhouse is named after, maybe I can look up\n" +
                "\"named after\".\n" +
                "Action 2: Lookup[named after]\n" +
                "Observation 2: (Result 1 / 1) Milhouse was named after U.S. president Richard Nixon, whose\n" +
                "middle name was Milhous.\n" +
                "Thought 3: Milhouse was named after U.S. president Richard Nixon, so the answer is\n" +
                "Richard Nixon.\n" +
                "Action 3: Finish[Richard Nixon]\n" +
                "\n" +
                "Question: Which documentary is about Finnish rock groups, Adam Clayton Powell or The\n" +
                "Saimaa Gesture?\n" +
                "Thought 1: I need to search Adam Clayton Powell and The Saimaa Gesture, and find which\n" +
                "documentary is about Finnish rock groups.\n" +
                "Action 1: Search[Adam Clayton Powell]\n" +
                "Observation 1 Could not find [Adam Clayton Powell]. Similar: [’Adam Clayton Powell\n" +
                "III’, ’Seventh Avenue (Manhattan)’, ’Adam Clayton Powell Jr. State Office\n" +
                "Building’, ’Isabel Washington Powell’, ’Adam Powell’, ’Adam Clayton Powell\n" +
                "(film)’, ’Giancarlo Esposito’].\n" +
                "Thought 2: To find the documentary, I can search Adam Clayton Powell (film).\n" +
                "Action 2: Search[Adam Clayton Powell (film)]\n" +
                "Observation 2: Adam Clayton Powell is a 1989 American documentary film directed by\n" +
                "Richard Kilberg. The film is about the rise and fall of influential\n" +
                "African-American politician Adam Clayton Powell Jr.[3][4] It was later aired\n" +
                "as part of the PBS series The American Experience.\n" +
                "Thought 3: Adam Clayton Powell (film) is a documentary about an African-American\n" +
                "politician, not Finnish rock groups. So the documentary about Finnish rock\n" +
                "groups must instead be The Saimaa Gesture.\n" +
                "Action 3: Finish[The Saimaa Gesture]\n" +
                "\n" +
                "Question: What profession does Nicholas Ray and Elia Kazan have in common?\n" +
                "Thought 1: I need to search Nicholas Ray and Elia Kazan, find their professions, then\n" +
                "find the profession they have in common.\n" +
                "Action 1: Search[Nicholas Ray]\n" +
                "Observation 1: Nicholas Ray (born Raymond Nicholas Kienzle Jr., August 7, 1911 - June 16,\n" +
                "1979) was an American film director, screenwriter, and actor best known for\n" +
                "the 1955 film Rebel Without a Cause.\n" +
                "Thought 2: Professions of Nicholas Ray are director, screenwriter, and actor. I need\n" +
                "to search Elia Kazan next and find his professions.\n" +
                "Action 2: Search[Elia Kazan]\n" +
                "Observation 2: Elia Kazan was an American film and theatre director, producer, screenwriter\n" +
                "and actor.\n" +
                "Thought 3: Professions of Elia Kazan are director, producer, screenwriter, and actor.\n" +
                "So profession Nicholas Ray and Elia Kazan have in common is director,\n" +
                "screenwriter, and actor.\n" +
                "Action 3: Finish[director, screenwriter, actor]\n" +
                "\n" +
                "Question: Which magazine was started first Arthur’s Magazine or First for Women?\n" +
                "Thought 1: I need to search Arthur’s Magazine and First for Women, and find which was\n" +
                "started first.\n" +
                "Action 1: Search[Arthur’s Magazine]\n" +
                "Observation 1: Arthur’s Magazine (1844-1846) was an American literary periodical published\n" +
                "in Philadelphia in the 19th century.\n" +
                "Thought 2: Arthur’s Magazine was started in 1844. I need to search First for Women\n" +
                "next.\n" +
                "Action 2: Search[First for Women]\n" +
                "Observation 2: First for Women is a woman’s magazine published by Bauer Media Group in the\n" +
                "USA.[1] The magazine was started in 1989.\n" +
                "Thought 3: First for Women was started in 1989. 1844 (Arthur’s Magazine) < 1989 (First\n" +
                "for Women), so Arthur’s Magazine was started first.\n" +
                "Action 3: Finish[Arthur’s Magazine]\n" +
                "\n" +
                "Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?\n" +
                "Thought 1: I need to search Pavel Urysohn and Leonid Levin, find their types of work,\n" +
                "then find if they are the same.\n" +
                "Action 1: Search[Pavel Urysohn]\n" +
                "Observation 1: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet\n" +
                "mathematician who is best known for his contributions in dimension theory.\n" +
                "Thought 2: Pavel Urysohn is a mathematician. I need to search Leonid Levin next and\n" +
                "find its type of work.\n" +
                "Action 2: Search[Leonid Levin]\n" +
                "Observation 2: Leonid Anatolievich Levin is a Soviet-American mathematician and computer\n" +
                "scientist.\n" +
                "Thought 3: Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn\n" +
                "and Leonid Levin have the same type of work.\n" +
                "Action 3: Finish[yes]\n " +
                "Question: Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President? \n"; // Replace with your existing content
        String combinedContent = existingContent + "\n" + inputContent;
        messageNode.put("content", combinedContent);

        // Set the messages array
        rootNode.set("messages", objectMapper.createArrayNode().add(messageNode));

        try {
            return objectMapper.writeValueAsString(rootNode);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return null;
        }
    }

    public String makePostRequest(String inputContent) {
        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.setBearerAuth("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");

        // Create body
        String jsonBody = createJsonWithContent(inputContent);

        // Create HttpEntity with headers and body
        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

        // Create a RestTemplate
        RestTemplate restTemplate = new RestTemplate();

        // Send the POST request
        ResponseEntity<String> response = restTemplate.exchange("https://api.openai.com/v1/chat/completions",
                HttpMethod.POST, entity, String.class);

        // Return the output as it is
        return response.getBody();
    }
}