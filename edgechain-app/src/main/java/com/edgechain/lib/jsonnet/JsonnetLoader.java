package com.edgechain.lib.jsonnet;

import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;
import com.edgechain.lib.utils.JsonUtils;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang.RandomStringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import sjsonnet.DefaultParseCache;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;

public abstract class JsonnetLoader {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private Map<String, JsonnetArgs> args;
    public JsonnetLoader() {}


    public <T> T load(Map<String, JsonnetArgs> args, InputStream inputStream, Class<T> clazz) {
        try{
            this.args = args;
            preconfigured();

            // Create Temp File With Unique Name
            String filename = RandomStringUtils.randomAlphanumeric(12)+"_"+System.currentTimeMillis()+".jsonnet";
            File file = new File(System.getProperty("java.io.tmpdir") + File.separator + filename);

            BufferedReader br = new BufferedReader(new InputStreamReader(inputStream));

            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append(System.lineSeparator());
            }

            String text = sb.toString().replaceAll("[\r]+", "");

            PrintWriter printWriter = new PrintWriter(file);
            printWriter.write(text);
            printWriter.flush();printWriter.close();


            List<String> argsList = new ArrayList<>();
            argsList.add(file.getAbsolutePath());


            // Transform Jsonnet Args
            for(Map.Entry<String, JsonnetArgs> entry: args.entrySet()) {

                if(entry.getValue().getDataType().equals(DataType.STRING)) {
                    argsList.add("--ext-str");
                    String regex = "[^\\p{L}\\p{N}\\p{P}\\p{Z}]";
                    argsList.add(entry.getKey()+"="+entry.getValue().getVal().replaceAll(regex,""));
                }
                else if(entry.getValue().getDataType().equals(DataType.INTEGER) || entry.getValue().getDataType().equals(DataType.BOOLEAN)) {
                    argsList.add("--ext-code");
                    argsList.add(entry.getKey()+"="+entry.getValue().getVal());
                }
            }

            logger.info("Args: "+argsList);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            PrintStream printStream = new PrintStream(outputStream);

            sjsonnet.SjsonnetMain.main0(
                    argsList.toArray(String[]::new),
                    new DefaultParseCache(),
                    System.in,
                    printStream,
                    System.err,
                    new os.Path(Path.of(System.getProperty("java.io.tmpdir"))),
                    scala.None$.empty(),
                    scala.None$.empty()
            );

            // Get the String Output & Transform it into JsonnetSchema
            T tClass = JsonUtils.convertToObject(outputStream.toString(StandardCharsets.UTF_8), clazz);
//            System.out.println(schema);

            // Delete File
            FileUtils.deleteQuietly(file);

            return tClass;

        }catch (final Exception e){
            throw new JsonnetLoaderException(e.getMessage());
        }
    }

    public abstract <T> T loadOrReload(HashMap<String, JsonnetArgs> args, Class<T> clazz);


    private void setArgs(Map<String, JsonnetArgs> args) {
        this.args = args;
    }

    public Map<String, JsonnetArgs> getArgs() {
        return args;
    }


    private void preconfigured() {
        Map<String, JsonnetArgs> args = this.getArgs();

        if(Objects.isNull(args.get("keepContext"))){
            args.put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "false"));
        }

        if(Objects.isNull(args.get("keepMaxTokens")))
            args.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "false"));
        }

    }

