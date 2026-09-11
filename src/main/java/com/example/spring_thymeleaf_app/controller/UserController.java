package com.example.spring_thymeleaf_app.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import com.example.spring_thymeleaf_app.repository.UserRepository;

@Controller
public class UserController {
  private final UserRepository userRepository;

  public UserController(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @GetMapping("/users")
  public String getUsers(Model model) {
    model.addAttribute("users", userRepository.findAll());
    return "users";
  }
}
