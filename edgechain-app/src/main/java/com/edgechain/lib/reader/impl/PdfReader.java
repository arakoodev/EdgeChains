package com.edgechain.lib.reader.impl;

import com.edgechain.lib.chunk.Chunker;
import com.edgechain.lib.reader.Reader;
import me.xuender.unidecode.Unidecode;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.pdf.PDFParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfReader extends Reader {

  @Override
  public String[] readByChunkSize(MultipartFile file, int chunkSize) {
    try {

      BodyContentHandler contentHandler = new BodyContentHandler(-1);
      Metadata data = new Metadata();
      ParseContext context = new ParseContext();
      PDFParser pdfparser = new PDFParser();
      pdfparser.parse(file.getInputStream(), contentHandler, data, context);

      Chunker chunker = new Chunker();
      return chunker.byChunkSize(
          Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "), chunkSize);

    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  @Override
  public String[] readBySentence(MultipartFile file) {
    try {
      BodyContentHandler contentHandler = new BodyContentHandler(-1);
      Metadata data = new Metadata();
      ParseContext context = new ParseContext();
      PDFParser pdfparser = new PDFParser();
      pdfparser.parse(file.getInputStream(), contentHandler, data, context);

      Chunker chunker = new Chunker();
      return chunker.bySentence(
          Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "));

    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }
}
