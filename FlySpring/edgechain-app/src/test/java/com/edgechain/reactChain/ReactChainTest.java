package com.edgechain.reactChain;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;


@SpringBootTest
public class ReactChainTest {

    @Test
    @DisplayName("Test extractAction method for Reach Chain")
    public void test_extractAction_fromJsonnet() throws Exception {

        String inputJsonnet = "local extractAction(str) =\n    local action = xtr.strings.substringBefore(xtr.strings.substringAfter(str, \"[\"), \"]\");\n    action;\n{ \"action\": extractAction(\"Thought 1: I need to search ABC and XYZ, and find which was started first.Action 1: Search[ABC]\") }";
        InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
        JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
        jsonnetLoader.load(inputStream);
        String action = jsonnetLoader.get("action");
        assertNotNull(action);
        assertEquals(action, "ABC");
    }

    @Test
    @DisplayName("Test extractThought method for Reach Chain")
    public void test_extractThought_fromJsonnet() throws Exception {

        String inputJsonnet = "local extractThought(str) =\n   local thought = xtr.strings.substringAfter(xtr.strings.substringBefore(str, \"Action\"), \":\");\n   thought;\n{ \"thought\": extractThought(\"Thought 1:I need to search ABC and XYZ, and find which was started first.Action 1: Search[ABC]\") }";
        InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
        JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
        jsonnetLoader.load(inputStream);
        String thought = jsonnetLoader.get("thought");
        assertNotNull(thought);
        assertEquals(thought, "I need to search ABC and XYZ, and find which was started first.");
    }



    @Test
    @DisplayName("Mapper search function test")
    public void test_mapper() {
        String inputJsonnet = """
                local config = {
                  "edgechains.config": {
                    "mapper": {
                      "search": "udf.fn",
                    },
                  },
                };
                local callFunction(funcName) =
                    local mapper = config["edgechains.config"].mapper;
                    mapper[funcName];
                local searchFunction = callFunction("search");
                { "searchFunction": searchFunction }
                """;
        InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
        JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
        jsonnetLoader.load(inputStream);
        String searchFunction = jsonnetLoader.get("searchFunction");
        assertNotNull(searchFunction);
        assertEquals(searchFunction, "udf.fn");
    }


}
