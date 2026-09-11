package com.example.spring_thymeleaf_app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.spring_thymeleaf_app.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
}


