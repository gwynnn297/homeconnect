package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_post_edit_logs", indexes = {
        @Index(name = "idx_job_post_edit_logs_post_id", columnList = "post_id"),
        @Index(name = "idx_job_post_edit_logs_edited_by", columnList = "edited_by")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobPostEditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "edit_log_id")
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "edited_by", nullable = false)
    private Long editedBy;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    @Column(name = "old_title")
    private String oldTitle;

    @Column(name = "new_title")
    private String newTitle;

    @Column(name = "old_description", columnDefinition = "TEXT")
    private String oldDescription;

    @Column(name = "new_description", columnDefinition = "TEXT")
    private String newDescription;

    @Column(name = "old_additional_data", columnDefinition = "TEXT")
    private String oldAdditionalData;

    @Column(name = "new_additional_data", columnDefinition = "TEXT")
    private String newAdditionalData;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
