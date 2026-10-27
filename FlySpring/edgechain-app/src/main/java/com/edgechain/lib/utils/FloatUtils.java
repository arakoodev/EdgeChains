package com.edgechain.lib.utils;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;

public class FloatUtils {

  public static byte[] toByteArray(float[] input) {
    byte[] bytes = new byte[Float.BYTES * input.length];
    ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().put(input);
    return bytes;
  }

  public static float[] toFloatArray(List<Float> floatList) {
    float[] floatArray = new float[floatList.size()];
    int i = 0;

    for (Float f : floatList) {
      floatArray[i++] = (f != null ? f : Float.NaN);
    }

    return floatArray;
  }
}
