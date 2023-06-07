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
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;

import java.io.IOException;

@Service
public class TextReader extends Reader {

  @Override
  public String[] readByChunkSize(MultipartFile file, int chunkSize) {

    BodyContentHandler contentHandler = new BodyContentHandler();
    Metadata metadata = new Metadata();
    ParseContext parseContext = new ParseContext();
    TXTParser TexTParser = new TXTParser();

    try {
      TexTParser.parse(file.getInputStream(), contentHandler, metadata, parseContext);
      Chunker chunker = new Chunker();
      return chunker.byChunkSize(
          Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "), chunkSize);

    } catch (IOException | SAXException | TikaException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public String[] readBySentence(MultipartFile file) {
    BodyContentHandler contentHandler = new BodyContentHandler();
    Metadata metadata = new Metadata();
    ParseContext parseContext = new ParseContext();
    TXTParser TexTParser = new TXTParser();

    try {
      TexTParser.parse(file.getInputStream(), contentHandler, metadata, parseContext);

      Chunker chunker = new Chunker();
      return chunker.bySentence(
          Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "));

    } catch (IOException | SAXException | TikaException e) {
      throw new RuntimeException(e);
    }
  }
}
