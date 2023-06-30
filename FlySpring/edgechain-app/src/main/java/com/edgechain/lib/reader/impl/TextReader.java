package com.edgechain.lib.reader.impl;

import com.edgechain.lib.chunk.Chunker;
import com.edgechain.lib.reader.Reader;
import me.xuender.unidecode.Unidecode;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.txt.TXTParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;

import java.io.IOException;
import java.io.InputStream;

@Service
public class TextReader extends Reader {

  @Override
  public String[] readByChunkSize(InputStream inputStream, int chunkSize) {

    BodyContentHandler contentHandler = new BodyContentHandler();
    Metadata metadata = new Metadata();
    ParseContext parseContext = new ParseContext();
    TXTParser txtParser = new TXTParser();

    try {
      txtParser.parse(inputStream, contentHandler, metadata, parseContext);
      Chunker chunker =
          new Chunker(Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "));
      return chunker.byChunkSize(chunkSize);

    } catch (IOException | SAXException | TikaException e) {
      throw new RuntimeException(e);
    }
  }

  /**
   * If you are using Reader & Chunker in a different project; make sure you import OpenNLP & also
   * use en-sent.zip file as an InputStream
   */
  @Override
  public String[] readBySentence(InputStream modelInputStream, InputStream fileInputStream) {
    BodyContentHandler contentHandler = new BodyContentHandler();
    Metadata metadata = new Metadata();
    ParseContext parseContext = new ParseContext();
    TXTParser txtParser = new TXTParser();

    try {
      txtParser.parse(fileInputStream, contentHandler, metadata, parseContext);
      Chunker chunker =
          new Chunker(Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "));
      return chunker.bySentence(modelInputStream);

    } catch (IOException | SAXException | TikaException e) {
      throw new RuntimeException(e);
    }
  }
}
