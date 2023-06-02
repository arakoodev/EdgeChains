package com.edgechain.app.extractor;

import me.xuender.unidecode.Unidecode;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.pdf.PDFParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.stream.IntStream;

@Service
public class PdfExtractor {

  public String[] extract(MultipartFile file, int chunkSize) {
    try {
      BodyContentHandler contentHandler = new BodyContentHandler(-1);
      Metadata data = new Metadata();
      ParseContext context = new ParseContext();
      PDFParser pdfparser = new PDFParser();
      pdfparser.parse(file.getInputStream(), contentHandler, data, context);
      return splitToChunks(
          Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "), chunkSize);
    } catch (final Exception e) {
      throw new RuntimeException(e.getMessage());
    }
  }

  private static String[] splitToChunks(String input, int chunkSize) {
    int noOfChunks = (int) Math.ceil((float) input.length() / chunkSize);

    return IntStream.range(0, noOfChunks)
        .parallel()
        .mapToObj(
            i -> {
              int start = i * chunkSize;
              int end = Math.min((i + 1) * chunkSize, input.length());
              return input.substring(start, end).strip();
            })
        .toArray(String[]::new);
  }
}
