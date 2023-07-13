package com.edgechain.lib.jsonnet;

import scala.collection.mutable.HashMap;
import sjsonnet.FileScope;
import sjsonnet.Path;
import sjsonnet.Position;
import sjsonnet.Val;

import java.util.LinkedHashMap;


public class NewStd extends sjsonnet.Std {
    public Val.Obj test() {
        System.out.println("\n\n\n Inside custom sjsonnet function! \n\n\n");
        return null;
    }
}
