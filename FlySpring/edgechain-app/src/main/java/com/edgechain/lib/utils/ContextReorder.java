package com.edgechain.lib.utils;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class ContextReorder {

  public List<WordEmbeddings> reorderWordEmbeddings(List<WordEmbeddings> wordEmbeddingsList) {

    wordEmbeddingsList.sort(Comparator.comparingDouble(WordEmbeddings::getScore).reversed());

    int mid = wordEmbeddingsList.size() / 2;

    List<WordEmbeddings> modifiedList = new ArrayList<>(wordEmbeddingsList.subList(0, mid));

    List<WordEmbeddings> secondHalfList =
        wordEmbeddingsList.subList(mid, wordEmbeddingsList.size());
    secondHalfList.sort(Comparator.comparingDouble(WordEmbeddings::getScore));

    modifiedList.addAll(secondHalfList);

    return modifiedList;
  }

  public List<PostgresWordEmbeddings> reorderPostgresWordEmbeddings(
      List<PostgresWordEmbeddings> postgresWordEmbeddings) {

    postgresWordEmbeddings.sort(
        Comparator.comparingDouble(PostgresWordEmbeddings::getScore).reversed());

    int mid = postgresWordEmbeddings.size() / 2;

    List<PostgresWordEmbeddings> modifiedList =
        new ArrayList<>(postgresWordEmbeddings.subList(0, mid));

    List<PostgresWordEmbeddings> secondHalfList =
        postgresWordEmbeddings.subList(mid, postgresWordEmbeddings.size());
    secondHalfList.sort(Comparator.comparingDouble(PostgresWordEmbeddings::getScore));

    modifiedList.addAll(secondHalfList);

    return modifiedList;
  }
}
