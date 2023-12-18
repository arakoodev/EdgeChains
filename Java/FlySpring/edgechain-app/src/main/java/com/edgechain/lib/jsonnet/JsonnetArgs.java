package com.edgechain.lib.jsonnet;

import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.exceptions.JsonnetArgException;

public class JsonnetArgs {

  private DataType dataType;
  private String val;

  public JsonnetArgs() {}

  public JsonnetArgs(DataType dataType, String val) {

    this.dataType = dataType;

    // Validation
    if (dataType.equals(DataType.INTEGER)) Integer.parseInt(val);
    else if (dataType.equals(DataType.BOOLEAN)) {
      try {
        this.validateBoolean(val);
      } catch (JsonnetArgException e) {
        throw new RuntimeException(e);
      }
    }
    this.val = val;
  }

  public DataType getDataType() {
    return dataType;
  }

  public void setDataType(DataType dataType) {
    this.dataType = dataType;
  }

  public String getVal() {
    return val;
  }

  public boolean validateBoolean(String val) throws JsonnetArgException {

    if ("true".equalsIgnoreCase(val)) {
      return true;
    } else if ("false".equalsIgnoreCase(val)) {
      return true;
    } else {
      throw new JsonnetArgException("Invalid Boolean DataType");
    }
  }
}
