package com.edgechain;

// SOURCES ./ChatMessage.java
// SOURCES ./MessageItem.java
// SOURCES ./Chat.java

// FILES resources/templates/index.html=./index.html
// FILES resources/templates/fragments.html=./fragments.html
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.MediaType;
import com.edgechain.lib.configuration.RedisEnv;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.reactive.function.client.WebClient;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

@SpringBootApplication
@Controller
@RequestMapping("/")
public class DashboardApp {

  public WebClient webClient() {
    return WebClient.builder().build();
  }

  public static void main(String[] args) {
    System.setProperty("server.port", "8081");
    SpringApplication.run(DashboardApp.class, args);
  }

  @Bean
  public RedisEnv redisEnv() {
    RedisEnv redisEnv = new RedisEnv();
    redisEnv.setUrl("");
    redisEnv.setPort(12285);
    redisEnv.setUsername("");
    redisEnv.setPassword("");
    redisEnv.setTtl(3600); // Configuring ttl for HistoryContext;
    return redisEnv;
  }

  private StringBuilder currentContent;

  public List<MessageItem> messages = new ArrayList<>();

  private String Url = "http://localhost:8080/v1/examples/wiki-summary?query=";

  @GetMapping
  public String index(Model model) {
    addChat();
    addAttributeForIndex(model);
    return "index";
  }

  @PostMapping
  public String sendMessage(@ModelAttribute("item") MessageItem messageItem, Model model) {
    System.out.println(messageItem);
    messages.add(messageItem);
    System.out.println(messages);
    return "redirect:/";
  }

  @PostMapping(headers = "HX-Request")
  public String htmxSendMessage(
      MessageItem messageItem, Model model, HttpServletResponse response) {
    System.out.println(messages + "from htmx");
    System.out.println(messageItem);
    messages.add(messageItem);
    model.addAttribute("item", messageItem);

    response.setHeader("HX-Trigger", "itemAdded");

    return "fragments :: meassageItem";
  }

  private void addAttributeForIndex(Model model) {
    System.out.println("Add Attribute For Index");
    model.addAttribute("item", new MessageItem());
    model.addAttribute("messages", messages);
    model.addAttribute("chats", chats);
    model.addAttribute("chat", new Chat());
    model.addAttribute("currentId", 1);
  }

  @GetMapping("/responce")
  public String reply(Model model) {
    System.out.println("reply");
    currentContent = new StringBuilder();
    MessageItem messageItem = new MessageItem("", true);
    model.addAttribute("item", messageItem);

    return "fragments :: meassageItem";
  }

  @GetMapping(value = "/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public Flux sseMethod() {

    return webClient()
        .get()
        .uri(Url + messages.get(messages.size() - 1).getMessage())
        .headers(
            httpHeaders -> {
              httpHeaders.setContentType(MediaType.APPLICATION_JSON);
              httpHeaders.set("stream", "true");
            })
        .retrieve()
        .bodyToFlux(ChatCompletionResponse.class)
        .map(it -> currentContent.append(it.getChoices().get(0).getMessage().getContent()));
  }

  public void addChat() {
    chats.add(new Chat("Chat 1", new ArrayList<MessageItem>()));
    chats.add(new Chat("Chat 2", new ArrayList<MessageItem>()));
    chats.add(new Chat("Chat 3", new ArrayList<MessageItem>()));
    chats.add(new Chat("Chat 4", new ArrayList<MessageItem>()));
  }

  public List<Chat> chats = new ArrayList<>();
}
