package com.example.spring_thymeleaf_app.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.example.spring_thymeleaf_app.service.GoogleMapService;

@Controller
public class GoogleMapController {

    @Autowired
    private GoogleMapService googleMapService;

    @GetMapping("/search")
    public String searchNearby(
            @RequestParam(required = false) String station,
            @RequestParam(required = false) String location,
            @RequestParam(defaultValue = "300") int radius,
            @RequestParam(defaultValue = "チェーン") String keyword,
            Model model) {
        if (station != null && !station.isEmpty()) {
            return googleMapService.searchStations(station, model);
        }

        if (location == null || location.isEmpty()) {
            // locationパラメータが指定されていない場合は、検索を行わずにビューを返す
            return "result";
        }

        return googleMapService.searchNearbyRestaurants(location, radius, keyword, model);
    }
}
