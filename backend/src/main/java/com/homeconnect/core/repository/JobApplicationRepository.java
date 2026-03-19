package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    List<JobApplication> findByPostId(Long postId);

    List<JobApplication> findByHelperId(Long helperId);

    @Query("SELECT DISTINCT ja.helperId FROM JobApplication ja WHERE ja.postId = :postId")
    List<Long> findHelperIdsByPostId(@Param("postId") Long postId);

    boolean existsByPostIdAndHelperId(Long postId, Long helperId);
}