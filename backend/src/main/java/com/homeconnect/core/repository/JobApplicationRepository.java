package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    List<JobApplication> findByPostId(Long postId);

    List<JobApplication> findByHelperId(Long helperId);

    @Query("SELECT DISTINCT ja.helperId FROM JobApplication ja WHERE ja.postId = :postId")
    List<Long> findHelperIdsByPostId(@Param("postId") Long postId);
    List<JobApplication> findByHelperIdAndStatusInOrderByCreatedAtDesc(Long helperId, java.util.Collection<String> statuses);
    boolean existsByPostIdAndHelperId(Long postId, Long helperId);

    boolean existsByPostIdAndHelperIdAndStatusIn(Long postId, Long helperId, java.util.Collection<String> statuses);

    boolean existsByPostIdAndHelperIdAndTypeAndStatusIn(Long postId, Long helperId, String type, java.util.Collection<String> statuses);

    java.util.Optional<JobApplication> findByPostIdAndHelperId(Long postId, Long helperId);

    Optional<JobApplication> findByPostIdAndStatus(Long postId, String status);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE JobApplication ja SET ja.status = :newStatus WHERE ja.postId = :postId AND ja.status IN :oldStatuses")
    void updateStatusByPostIdAndStatusIn(@Param("postId") Long postId, @Param("newStatus") String newStatus, @Param("oldStatuses") java.util.Collection<String> oldStatuses);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM JobApplication ja WHERE ja.postId = :postId AND ja.status = :status AND ja.type = :type")
    void deleteByPostIdAndStatusAndType(@Param("postId") Long postId, @Param("status") String status, @Param("type") String type);
}