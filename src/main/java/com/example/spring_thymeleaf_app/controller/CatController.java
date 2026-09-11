package com.example.spring_thymeleaf_app.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.client.RestTemplate;

import java.util.Random;

@Controller
public class CatController {

    @Value("${cat.api.url}")
    private String url;

    @Value("${cat.rare.url}")
    private String rareUrl;

    @Autowired
    private RestTemplate restTemplate;

    @GetMapping("/cat")
    public String getCatImage(Model model) {
        Random random = new Random();
        int randomNumber = random.nextInt(10); // 0から9までのランダムな数値を生成

        if (randomNumber == 0) {
            // 10回に1回は異なる画像を設定
            model.addAttribute("catImageUrl", rareUrl);
        } else {
            // それ以外の場合は猫の画像を設定
            CatImage[] catImages = restTemplate.getForObject(url, CatImage[].class);
            if (catImages != null && catImages.length > 0) {
                model.addAttribute("catImageUrl", catImages[0].getUrl());
            } else {
                model.addAttribute("catImageUrl", rareUrl);
            }
        }
        return "cat";
    }

    static class CatImage {
        private String url;

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }
}
