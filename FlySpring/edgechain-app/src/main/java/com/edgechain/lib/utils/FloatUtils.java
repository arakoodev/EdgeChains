package com.edgechain.lib.utils;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;

public class FloatUtils {

  public static byte[] toByteArray(Float[] input) {
    float[] primitiveArray = new float[input.length];
    for (int i = 0; i < input.length; i++) {
      primitiveArray[i] = input[i] != null ? input[i] : Float.NaN;
    }

    byte[] bytes = new byte[Float.BYTES * primitiveArray.length];
    ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().put(primitiveArray);
    return bytes;
  }

  public static Float[] toFloatArray(List<Float> floatList) {
    Float[] floatArray = new Float[floatList.size()];
    int i = 0;

    for (Float f : floatList) {
      floatArray[i++] = f;
    }

    return floatArray;
  }
}
