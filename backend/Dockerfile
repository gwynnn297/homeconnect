# syntax=docker/dockerfile:1

FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /workspace

# Help Gradle stay within small VPS RAM (e.g., 2GB)
ENV GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx768m -Dfile.encoding=UTF-8"

# Pre-copy build scripts for better layer caching
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN chmod +x ./gradlew

# Copy sources
COPY src ./src

# Build fat jar
RUN ./gradlew --no-daemon bootJar


FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app

ENV TZ=Asia/Ho_Chi_Minh

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Spring Boot listens on 8080; Socket.IO (netty-socketio) on 9092.
EXPOSE 8080 9092

COPY --from=build /workspace/build/libs/*.jar /app/app.jar

ENTRYPOINT ["java","-jar","/app/app.jar"]
