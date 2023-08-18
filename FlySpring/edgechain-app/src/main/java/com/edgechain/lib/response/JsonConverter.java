package com.edgechain.lib.response;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class JsonConverter {
    public static <T> List<T> jsonArrayToList(JSONArray jsonArray, Class<T> targetType) {
        List<T> result = new ArrayList<>();

        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject jsonObject = jsonArray.getJSONObject(i);
            T instance = createInstanceFromJSONObject(jsonObject, targetType);
            result.add(instance);
        }

        return result;
    }

    private static <T> T createInstanceFromJSONObject(JSONObject jsonObject, Class<T> targetType) {
        try {
            Constructor<T> constructor = targetType.getConstructor();
            T instance = constructor.newInstance();

            Field[] fields = targetType.getDeclaredFields();
            for (Field field : fields) {
                String fieldName = field.getName();
                if (jsonObject.has(fieldName)) {
                    Object fieldValue = jsonObject.get(fieldName);
                    field.setAccessible(true);
                    field.set(instance, convertFieldValue(fieldValue, field.getType()));
                }
            }

            return instance;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private static Object convertFieldValue(Object fieldValue, Class<?> targetType) {
        if (fieldValue == null) {
            return null;
        }

        if (targetType.isEnum()) {
            return Enum.valueOf((Class<Enum>) targetType, fieldValue.toString());
        } else if (targetType == LocalDateTime.class) {
            return LocalDateTime.parse((String) fieldValue);
        } else if (fieldValue instanceof JSONObject) {
            return createInstanceFromJSONObject((JSONObject) fieldValue, targetType);
        } else if (fieldValue instanceof JSONArray && List.class.isAssignableFrom(targetType)) {
            JSONArray jsonArray = (JSONArray) fieldValue;
            List<Object> list = new ArrayList<>();
            for (int i = 0; i < jsonArray.length(); i++) {
                Object element = jsonArray.get(i);
                list.add(convertFieldValue(element, targetType.getComponentType()));
            }
            return list;
        } else if (fieldValue instanceof Number) {
            Number number = (Number) fieldValue;
            if (targetType == Byte.class || targetType == byte.class) {
                return number.byteValue();
            } else if (targetType == Short.class || targetType == short.class) {
                return number.shortValue();
            } else if (targetType == Integer.class || targetType == int.class) {
                return number.intValue();
            } else if (targetType == Long.class || targetType == long.class) {
                return number.longValue();
            } else if (targetType == Float.class || targetType == float.class) {
                return number.floatValue();
            } else if (targetType == Double.class || targetType == double.class) {
                return number.doubleValue();
            }
        } else if (fieldValue instanceof Boolean && targetType == boolean.class) {
            // Handle Boolean to boolean conversion
            return (boolean) fieldValue;
        }
        else {
            return fieldValue;
        }

        return fieldValue;
    }
}