package com.edgechain;

// SOURCES ChatMessage.java
// SOURCES MessageItem.java
// SOURCES Chat.java
// SOURCES User.java

// FILES resources/templates/index.html=./index.html
// FILES resources/templates/fragments.html=./fragments.html
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.reactive.function.client.WebClient;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
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

  private StringBuilder currentContent;
  public List<MessageItem> messages = new ArrayList<>();
  public List<Chat> chats = new ArrayList<>();
  private String Url = "http://localhost:8080/v1/examples/wiki-summary?query=";

  @GetMapping
  public String index(Model model, HttpServletRequest request) {
    if ((String) request.getSession().getAttribute("access_token") == null) {
      return "redirect:/login";
    }

    addAttributeForIndex(model);
    return "index";
  }

  @PostMapping
  public String sendMessage(@ModelAttribute("item") MessageItem messageItem, Model model) {
    messages.add(messageItem);
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

  @GetMapping("login")
  public String logIn() {
    return "signIn";
  }

  @GetMapping("signup")
  public String singUp() {
    return "signUp";
  }

  @GetMapping("signinlink")
  public String signInLink() {
    return "signInLink";
  }

  public User user = new User();

  @PostMapping("signup")
  public String signUpRequest(HttpServletRequest request) {

    user.email = request.getParameter("email");
    user.password = request.getParameter("password");

    User info =
        webClient()
            .post()
            .uri("http://localhost:8080/v1/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Mono.just(user), User.class)
            .retrieve()
            .bodyToMono(User.class)
            .block();

    return "redirect:/signInLink";
  }

  @PostMapping("signin")
  public String signInRequest(HttpServletRequest request) {
    user.email = request.getParameter("email");
    user.password = request.getParameter("password");

    AuthenticatedResponse authResponse =
        webClient()
            .post()
            .uri("http://localhost:8080/v1/login")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Mono.just(user), User.class)
            .retrieve()
            .bodyToMono(AuthenticatedResponse.class)
            .block();

    HttpSession session = request.getSession();
    session.setAttribute("access_token", authResponse.getAccess_token());

    return "redirect:/";
  }

  @GetMapping("logout")
  public String logOut(HttpServletRequest request) {
    request.getSession().setAttribute("access_token", null);
    return "redirect:/login";
  }
}
