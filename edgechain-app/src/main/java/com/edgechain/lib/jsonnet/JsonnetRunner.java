package com.edgechain.lib.jsonnet;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import scala.Option;
import sjsonnet.DefaultParseCache;
import sjsonnet.SjsonnetMain;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class JsonnetRunner {

    public JsonObject executor(String targetJsonnetLocation, Map<String, String> extVarsConfig) {

        List<String> extVarsList = new ArrayList<String>();
        List<String> totalData = new ArrayList<String>();
        totalData.add(targetJsonnetLocation); // Add the target jsonnet location

        for (Map.Entry<String, String> ele : extVarsConfig.entrySet()) {
            String arg = ele.getKey() + "=" + ele.getValue();
            extVarsList.add("--ext-str");
            extVarsList.add(arg);
        }

        for (String ele : extVarsList) {
            totalData.add(ele);
        }

        ByteArrayOutputStream stdoutBuffer = new ByteArrayOutputStream();
        ByteArrayOutputStream stderrBuffer = new ByteArrayOutputStream();
        PrintStream stdoutStream = new PrintStream(stdoutBuffer);
        PrintStream stderrStream = new PrintStream(stderrBuffer);
        InputStream inputStream = new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8));

        String[] argsArray = totalData.toArray(String[]::new);

        String finalCommand = "";
        for (String arg : argsArray) {
            finalCommand += arg + " ";
        }

        System.out.println("Final Command = " + finalCommand);
        int resultStatus = SjsonnetMain.main0(
                argsArray,
                new DefaultParseCache(),
                inputStream,
                stdoutStream,
                stderrStream,
                new os.Path(Path.of(System.getProperty("user.dir"))),
                Option.empty(),
                Option.empty());

        String stdoutOutput = stdoutBuffer.toString(StandardCharsets.UTF_8);
        String stderrOutput = stderrBuffer.toString(StandardCharsets.UTF_8);

        // logger.info("jsonnet processing read " + stdoutOutput.split("\n").length + "
        // lines.");
        // logger.info("jsonnet result:\n" + "stdout: " + stdoutOutput + " \n stderr:" +
        // stderrOutput);

        // Use Gson to parse the JSON
        JsonParser parser = new JsonParser();
        JsonElement jsonElement = parser.parse(stdoutOutput);
        System.out.println("Generated JSON = ");
        System.out.println(stdoutOutput);
        return jsonElement.getAsJsonObject();
    }

    public static void main(String[] args) {
        JsonnetRunner ob = new JsonnetRunner();
        Map<String, String> extVarsSettings = new HashMap<String, String>();
        extVarsSettings.put("keepContext", "true");
        extVarsSettings.put("capContext", "true");
        extVarsSettings.put("contextLength", "4096");
        extVarsSettings.put("context", "You are supposed to ");
        extVarsSettings.put("history", " ");

        JsonObject jsonObject = ob.executor(
                "/media/anuran/Samsung_SSD_970_EVO_1TB/Internship/GSSoC_2k23/EdgeChains/EdgeChains/Examples/jsonnet_impl/src/main/java/com/jsonnet/new.jsonnet",
                extVarsSettings);
        String prompt = jsonObject.get("prompt").getAsString();
        String typeString = jsonObject.get("type").getAsString();
        int promptLength = jsonObject.get("promptLength").getAsInt();

        System.out.println("Final Prompt = " + prompt);
    }
}