package com.app.openaiwiki.constants;

public class JSONPluginConstants {

    /* For Calculator */
    public static String calculatorPluginJSON = "{\n" +
            "  \"schema_version\": \"v1\",\n" +
            "  \"name_for_human\": \"Calculator Plugin (service http)\",\n" +
            "  \"name_for_model\": \"calculator\",\n" +
            "  \"description_for_human\": \"Plugin for performing basic arithmetic operations like addition, subtraction, multiplication, division, power, and square root.\",\n" +
            "  \"description_for_model\": \"Use the Calculator plugin to perform basic arithmetic operations, including addition (+), subtraction (-), multiplication (*), division (/), power (^), and square root (√). Provide the numbers and the operation symbol in your query, and the plugin will return the calculated result. The calculator works best with clear and concise queries.\\nExamples of supported queries include:\\n\\nAdditions: '2 + 3','1+1','3.5 + 2.3'\\n\\nSubtractions: '10 - 5','3.4 - 2.1','6.4 - 3.1'\\n\\nMultiplications: '4 * 8','6 * 4','7.8 * 1.2'\\n\\nDivisions: '9 / 3','10 / 2','9.6 / 4.8'\\n\\nPowers: '2 ^ 3','4 ^ 8','3.2 ^ 2.5'\\n\\nSquare roots: '√9'\",\n" +
            "  \"logo_url\": \"https://chat-calculator-plugin.supportmirage.repl.co/logo.png\",\n" +
            "  \"contact_email\": \"support@mirage-studio.io\",\n" +
            "  \"legal_info_url\": \"https://www.mirage-studio.io\"\n" +
            "}";

    public static String calculatorAPIConfigJSON = "{\n" +
            "    \"type\": \"openapi\",\n" +
            "    \"url\": \"https://chat-calculator-plugin.supportmirage.repl.co/openapi.json\",\n" +
            "    \"is_user_authenticated\": false\n" +
            "  }";

    public static String calculatorSpecJSON = "{\n" +
            "  \"openapi\": \"3.0.1\",\n" +
            "  \"info\": {\n" +
            "    \"title\": \"Calculator Plugin\",\n" +
            "    \"description\": \"A plugin that allows the user to perform basic arithmetic operations like addition, subtraction, multiplication, division, power, and square root.\",\n" +
            "    \"version\": \"v1\"\n" +
            "  },\n" +
            "  \"servers\": [\n" +
            "    {\n" +
            "      \"url\": \"https://chat-calculator-plugin.supportmirage.repl.co\"\n" +
            "    }\n" +
            "  ],\n" +
            "  \"paths\": {\n" +
            "    \"/calculator/{operation}/{a}/{b}\": {\n" +
            "      \"get\": {\n" +
            "        \"operationId\": \"calculate\",\n" +
            "        \"summary\": \"Perform a calculation\",\n" +
            "        \"parameters\": [\n" +
            "          {\n" +
            "            \"in\": \"path\",\n" +
            "            \"name\": \"operation\",\n" +
            "            \"schema\": {\n" +
            "              \"type\": \"string\",\n" +
            "              \"enum\": [\n" +
            "                \"add\",\n" +
            "                \"subtract\",\n" +
            "                \"multiply\",\n" +
            "                \"divide\",\n" +
            "                \"power\"\n" +
            "              ]\n" +
            "            },\n" +
            "            \"required\": true,\n" +
            "            \"description\": \"The operation to perform.\"\n" +
            "          },\n" +
            "          {\n" +
            "            \"in\": \"path\",\n" +
            "            \"name\": \"a\",\n" +
            "            \"schema\": {\n" +
            "              \"type\": \"number\"\n" +
            "            },\n" +
            "            \"required\": true,\n" +
            "            \"description\": \"The first operand.\"\n" +
            "          },\n" +
            "          {\n" +
            "            \"in\": \"path\",\n" +
            "            \"name\": \"b\",\n" +
            "            \"schema\": {\n" +
            "              \"type\": \"number\"\n" +
            "            },\n" +
            "            \"required\": true,\n" +
            "            \"description\": \"The second operand.\"\n" +
            "          }\n" +
            "        ],\n" +
            "        \"responses\": {\n" +
            "          \"200\": {\n" +
            "            \"description\": \"OK\",\n" +
            "            \"content\": {\n" +
            "              \"application/json\": {\n" +
            "                \"schema\": {\n" +
            "                  \"$ref\": \"#/components/schemas/calculateResponse\"\n" +
            "                }\n" +
            "              }\n" +
            "            }\n" +
            "          }\n" +
            "        }\n" +
            "      }\n" +
            "    },\n" +
            "    \"/calculator/sqrt/{a}\": {\n" +
            "      \"get\": {\n" +
            "        \"operationId\": \"sqrt\",\n" +
            "        \"summary\": \"Find the square root of a number\",\n" +
            "        \"parameters\": [\n" +
            "          {\n" +
            "            \"in\": \"path\",\n" +
            "            \"name\": \"a\",\n" +
            "            \"schema\": {\n" +
            "              \"type\": \"number\"\n" +
            "            },\n" +
            "            \"required\": true,\n" +
            "            \"description\": \"The number to find the square root of.\"\n" +
            "          }\n" +
            "        ],\n" +
            "        \"responses\": {\n" +
            "          \"200\": {\n" +
            "            \"description\": \"OK\",\n" +
            "            \"content\": {\n" +
            "              \"application/json\": {\n" +
            "                \"schema\": {\n" +
            "                  \"$ref\": \"#/components/schemas/calculateResponse\"\n" +
            "                }\n" +
            "              }\n" +
            "            }\n" +
            "          }\n" +
            "        }\n" +
            "      }\n" +
            "    }\n" +
            "  },\n" +
            "  \"components\": {\n" +
            "    \"schemas\": {\n" +
            "      \"calculateResponse\": {\n" +
            "        \"type\": \"object\",\n" +
            "        \"properties\": {\n" +
            "          \"result\": {\n" +
            "            \"type\": \"number\",\n" +
            "            \"description\": \"The result of the calculation.\"\n" +
            "          }\n" +
            "        }\n" +
            "      }\n" +
            "    }\n" +
            "  }\n" +
            "}";

}
