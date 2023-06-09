package com.application.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);


        SocraticCoT socraticCoT = new SocraticCoT();
        Problem problem = new Problem();
        
        Solution solution = socraticCoT.solveProblem(problem);
        
        // Process and use the final solution as needed
        solution.display();


  }
}
