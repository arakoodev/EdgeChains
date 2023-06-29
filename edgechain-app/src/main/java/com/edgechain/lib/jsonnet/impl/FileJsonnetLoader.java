package com.edgechain.lib.jsonnet.impl;

import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;

import java.io.*;
import java.util.HashMap;

public class FileJsonnetLoader extends JsonnetLoader {



    private String filePath;

    public FileJsonnetLoader(String filePath) {
        this.filePath = filePath;
    }

    public FileJsonnetLoader() {
        super();
    }

    @Override
    public  <T> T  loadOrReload(HashMap<String, JsonnetArgs> args,Class<T> clazz) {
       try(InputStream in = new FileInputStream(filePath)){
           JsonnetLoader loader = new FileJsonnetLoader();
           return loader.load(args,in, clazz);
       }catch (final Exception e){
           throw new JsonnetLoaderException(e.getMessage());
       }

    }


    public String getFilePath() {
        return filePath;
    }
}
