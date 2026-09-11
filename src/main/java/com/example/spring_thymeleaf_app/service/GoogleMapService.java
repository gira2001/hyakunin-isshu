package com.example.spring_thymeleaf_app.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class GoogleMapService {

    @Value("${google.api.key}")
    private String apiKey;

    public String searchStations(String station, Model model) {
        // 駅名の一部分を使用してPlace Autocomplete APIを呼び出す
        String autocompleteUrl = String.format("https://maps.googleapis.com/maps/api/place/autocomplete/json?input=%s&types=establishment&key=%s",
                                               station, apiKey);

        RestTemplate restTemplate = new RestTemplate();
        String autocompleteResponse = restTemplate.getForObject(autocompleteUrl, String.class);

        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode autocompleteRoot = mapper.readTree(autocompleteResponse);
            JsonNode predictions = autocompleteRoot.path("predictions");

            List<Map<String, String>> stations = new ArrayList<>();
            for (JsonNode prediction : predictions) {
                String placeId = prediction.path("place_id").asText();
                String name = prediction.path("description").asText();

                // Place Details APIを呼び出して緯度と経度を取得
                String detailsUrl = String.format("https://maps.googleapis.com/maps/api/place/details/json?place_id=%s&key=%s",
                                                  placeId, apiKey);
                String detailsResponse = restTemplate.getForObject(detailsUrl, String.class);
                JsonNode detailsRoot = mapper.readTree(detailsResponse);
                JsonNode locationNode = detailsRoot.path("result").path("geometry").path("location");
                double lat = locationNode.path("lat").asDouble();
                double lng = locationNode.path("lng").asDouble();

                Map<String, String> stationInfo = new HashMap<>();
                stationInfo.put("name", name);
                stationInfo.put("lat", String.valueOf(lat));
                stationInfo.put("lng", String.valueOf(lng));
                stations.add(stationInfo);
            }

            model.addAttribute("stations", stations);
            return "result";
        } catch (Exception e) {
            e.printStackTrace();
            model.addAttribute("stations", null);
            return "result";
        }
    }

    public String searchNearbyRestaurants(String location, int radius, String keyword, Model model) {
        String[] latLng = location.split(",");
        double lat = Double.parseDouble(latLng[0]);
        double lng = Double.parseDouble(latLng[1]);

        String baseUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
        String url = String.format("%s?location=%f,%f&radius=%d&type=restaurant&keyword=%s&language=ja&key=%s",
                                   baseUrl, lat, lng, radius, keyword, apiKey);

        RestTemplate restTemplate = new RestTemplate();
        String response = restTemplate.getForObject(url, String.class);

        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(response);
            JsonNode results = root.path("results");

            int resultCount = results.size(); // 結果の数を数える

            if (resultCount > 0) {
                Random random = new Random();
                int randomIndex = random.nextInt(resultCount); // ランダムに数字を選ぶ

                JsonNode selectedNode = results.get(randomIndex);
                String name = selectedNode.path("name").asText();
                String address = selectedNode.path("vicinity").asText();
                String placeId = selectedNode.path("place_id").asText();
                String photoReference = selectedNode.path("photos").get(0).path("photo_reference").asText();
                double rating = selectedNode.path("rating").asDouble(); // 評価を取得

                // PhotoリクエストURLを生成
                String photoUrl = String.format("https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=%s&key=%s",
                                                photoReference, apiKey);

                // Google Mapsの店舗リンクを生成
                String mapUrl = String.format("https://www.google.com/maps/place/?q=place_id:%s", placeId);

                Map<String, Object> item = new HashMap<>();
                item.put("name", name);
                item.put("address", address);
                item.put("photoUrl", photoUrl);
                item.put("mapUrl", mapUrl);
                item.put("rating", rating); // 評価をモデルに追加
                model.addAttribute("result", item); // 選んだ数字番目の値だけをモデルに格納
            } else {
                model.addAttribute("result", null);
            }
        } catch (Exception e) {
            e.printStackTrace();
            model.addAttribute("result", null);
        }

        return "result";
    }
}
